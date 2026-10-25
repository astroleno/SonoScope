import { isRecordingEvent, isRecordingManifest, type RecordingEvent, type RecordingManifest } from '@sonoscope/core';

function request<T>(value: IDBRequest<T>) { return new Promise<T>((resolve, reject) => { value.onsuccess = () => resolve(value.result); value.onerror = () => reject(value.error); }); }
/** Media data never appears in a library query or an event-page query. */
export class RecordingIndex {
  private database: Promise<IDBDatabase> | null = null;
  constructor(private factory: IDBFactory = globalThis.indexedDB, private name = 'sonoscope-recordings-v1') {}
  private open() {
    if (!this.factory) return Promise.reject(new Error('这个浏览器暂不能保存录播。'));
    if (!this.database) this.database = new Promise<IDBDatabase>((resolve, reject) => {
      let expired = false;
      const timer = setTimeout(() => { expired = true; this.database = null; reject(new Error('打开录播库超时，请关闭其他 SS 页面后重试。')); }, 10000);
      const opening = this.factory.open(this.name, 3);
      opening.onupgradeneeded = () => {
        const db = opening.result;
        if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions', { keyPath: 'id' });
        const events = db.objectStoreNames.contains('events') ? opening.transaction!.objectStore('events') : db.createObjectStore('events', { keyPath: ['recordingId', 'seq'] });
        if (!events.indexNames.contains('time')) events.createIndex('time', ['recordingId', 'atMs', 'seq']);
        if (!events.indexNames.contains('typeTime')) events.createIndex('typeTime', ['recordingId', 'type', 'atMs', 'seq']);
        if (!db.objectStoreNames.contains('media')) db.createObjectStore('media', { keyPath: ['recordingId', 'index'] });
        if (!db.objectStoreNames.contains('staging')) db.createObjectStore('staging', { keyPath: ['token', 'index'] });
      };
      opening.onsuccess = () => { clearTimeout(timer); const db = opening.result; if (expired) { db.close(); return; } db.onversionchange = () => { db.close(); this.database = null; }; resolve(db); };
      opening.onerror = () => { clearTimeout(timer); this.database = null; reject(opening.error); };
      opening.onblocked = () => { expired = true; clearTimeout(timer); this.database = null; reject(new Error('请关闭其他正在更新录播库的 SS 页面后重试。')); };
    });
    return this.database;
  }
  private async transaction<T>(stores: string[], mode: IDBTransactionMode, work: (tx: IDBTransaction) => Promise<T>) {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(stores, mode); let result: T;
      const timer = setTimeout(() => { try { tx.abort(); } catch { /* already settled */ } reject(new Error('录播存储响应超时。')); }, 10000);
      tx.oncomplete = () => { clearTimeout(timer); resolve(result); };
      tx.onerror = () => { clearTimeout(timer); reject(tx.error ?? new Error('录播写入失败。')); };
      tx.onabort = () => { clearTimeout(timer); reject(tx.error ?? new Error('录播保存已中止。')); };
      void work(tx).then(value => { result = value; }, error => { try { tx.abort(); } catch { /* transaction already failed */ } reject(error); });
    });
  }
  async add(manifest: RecordingManifest) {
    if (!isRecordingManifest(manifest)) throw new Error('录播信息无效。');
    await this.transaction(['sessions'], 'readwrite', async tx => { await request(tx.objectStore('sessions').add(manifest)); });
  }
  get(id: string) { return this.transaction(['sessions'], 'readonly', async tx => { const value = await request(tx.objectStore('sessions').get(id)); return isRecordingManifest(value) ? value : null; }); }
  list() { return this.transaction(['sessions'], 'readonly', async tx => (await request(tx.objectStore('sessions').getAll())).filter(isRecordingManifest).filter(v => v.status !== 'deleting').sort((a, b) => b.createdAt - a.createdAt)); }
  update(id: string, patch: Partial<RecordingManifest>) {
    return this.transaction(['sessions'], 'readwrite', async tx => {
      const store = tx.objectStore('sessions'), current = await request(store.get(id));
      if (!isRecordingManifest(current)) throw new Error('找不到这段录播。');
      const next = { ...current, ...patch, id: current.id, version: current.version };
      if (!isRecordingManifest(next)) throw new Error('录播信息无效。');
      await request(store.put(next)); return next;
    });
  }
  appendEvents(id: string, events: RecordingEvent[]) {
    if (!events.length) return Promise.resolve();
    if (events.length > 512 || !events.every(isRecordingEvent)) return Promise.reject(new Error('录播时间线数据无效。'));
    return this.transaction(['sessions', 'events'], 'readwrite', async tx => {
      const sessions = tx.objectStore('sessions'), manifest = await request(sessions.get(id));
      if (!isRecordingManifest(manifest) || !['recording', 'finalizing'].includes(manifest.status)) throw new Error('录播已结束，不能继续写入。');
      let seq = manifest.lastEventSeq;
      if (!events.every(event => event.seq === ++seq)) throw new Error('录播时间线缺失或重复。');
      for (const event of events) await request(tx.objectStore('events').add({ ...event, recordingId: id }));
      await request(sessions.put({ ...manifest, lastEventSeq: seq, durationMs: Math.max(manifest.durationMs, ...events.map(event => event.atMs)), commentCount: manifest.commentCount + events.filter(e => e.type === 'comment-show').length }));
    });
  }
  events(id: string, afterSeq = 0, limit = 256) {
    return this.transaction(['events'], 'readonly', async tx => {
      const range = IDBKeyRange.bound([id, afterSeq + 1], [id, Number.MAX_SAFE_INTEGER]);
      return (await request(tx.objectStore('events').getAll(range, Math.max(1, Math.min(512, limit))))).map(({ recordingId: _id, ...event }) => event as RecordingEvent);
    });
  }
  timeline(id: string, fromMs: number, toMs: number) {
    return this.transaction(['events'], 'readonly', async tx => {
      const range = IDBKeyRange.bound([id, Math.max(0, fromMs), 0], [id, toMs, Number.MAX_SAFE_INTEGER]);
      const rows = await request(tx.objectStore('events').index('time').getAll(range, 1501));
      if (rows.length > 1500) throw new Error('这段录播的时间线数据过于密集。');
      return rows.map(({ recordingId: _id, ...event }) => event as RecordingEvent);
    });
  }
  latest(id: string, type: RecordingEvent['type'], atMs: number) {
    return this.transaction(['events'], 'readonly', async tx => {
      const range = IDBKeyRange.bound([id, type, 0, 0], [id, type, atMs, Number.MAX_SAFE_INTEGER]);
      const cursor = await request(tx.objectStore('events').index('typeTime').openCursor(range, 'prev'));
      if (!cursor) return null;
      const { recordingId: _id, ...event } = cursor.value; return event as RecordingEvent;
    });
  }
  comments(id: string, afterMs = 0, afterSeq = 0, limit = 50) {
    return this.transaction(['events'], 'readonly', async tx => {
      const range = IDBKeyRange.bound([id, 'comment-show', afterMs, afterSeq], [id, 'comment-show', Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER], true);
      return (await request(tx.objectStore('events').index('typeTime').getAll(range, Math.min(100, Math.max(1, limit))))).map(({ recordingId: _id, ...event }) => event as Extract<RecordingEvent, { type: 'comment-show' }>);
    });
  }
  appendMedia(id: string, index: number, blob: Blob) {
    return this.transaction(['media', 'sessions'], 'readwrite', async tx => {
      const sessions = tx.objectStore('sessions'), current = await request(sessions.get(id));
      if (!isRecordingManifest(current) || !['recording', 'finalizing'].includes(current.status)) throw new Error('录播已结束。');
      await request(tx.objectStore('media').add({ recordingId: id, index, blob }));
      await request(sessions.put({ ...current, bytes: current.bytes + blob.size }));
    });
  }
  addMediaBytes(id: string, bytes: number) {
    return this.transaction(['sessions'], 'readwrite', async tx => {
      const sessions = tx.objectStore('sessions'), current = await request(sessions.get(id));
      if (!isRecordingManifest(current) || !['recording', 'finalizing'].includes(current.status)) throw new Error('录播已结束。');
      await request(sessions.put({ ...current, bytes: current.bytes + bytes }));
    });
  }
  media(id: string) {
    return this.transaction(['media'], 'readonly', async tx => {
      const rows = await request(tx.objectStore('media').getAll(IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER])));
      return rows.map(row => row.blob as Blob);
    });
  }
  stage(token: string, index: number, blob: Blob) { return this.transaction(['staging'], 'readwrite', async tx => { await request(tx.objectStore('staging').add({ token, index, blob })); }); }
  staged(token: string) { return this.transaction(['staging'], 'readonly', async tx => (await request(tx.objectStore('staging').getAll(IDBKeyRange.bound([token, 0], [token, Number.MAX_SAFE_INTEGER])))).map(row => row.blob as Blob)); }
  removeStaged(token: string) {
    return this.transaction(['staging'], 'readwrite', async tx => new Promise<void>((resolve, reject) => {
      const cursor = tx.objectStore('staging').openCursor(IDBKeyRange.bound([token, 0], [token, Number.MAX_SAFE_INTEGER]));
      cursor.onerror = () => reject(cursor.error); cursor.onsuccess = () => { const value = cursor.result; if (!value) resolve(); else { value.delete(); value.continue(); } };
    }));
  }
  async remove(id: string) {
    await this.transaction(['sessions', 'events', 'media'], 'readwrite', async tx => {
      await request(tx.objectStore('sessions').delete(id));
      for (const name of ['events', 'media']) await new Promise<void>((resolve, reject) => {
        const cursor = tx.objectStore(name).openCursor(IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER]));
        cursor.onerror = () => reject(cursor.error);
        cursor.onsuccess = () => { const value = cursor.result; if (!value) resolve(); else { value.delete(); value.continue(); } };
      });
    });
  }
  async close() { const db = await this.database; db?.close(); this.database = null; }
}
