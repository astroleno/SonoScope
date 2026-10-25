import { RECORDING_WRITE_LIMIT, validRecordingId, type RecordingManifest, type RecordingEvent } from '@sonoscope/core';
import { RecordingIndex } from './storage/recording-index';
import { holdRecordingLock } from './storage/recording-lock';

export interface RecordingStore {
  create(manifest: RecordingManifest): Promise<RecordingManifest>;
  appendMedia(id: string, index: number, blob: Blob): Promise<void>;
  appendEvents(id: string, events: RecordingEvent[]): Promise<void>;
  finish(id: string, patch: Partial<RecordingManifest>): Promise<RecordingManifest>;
  get(id: string): Promise<RecordingManifest | null>;
  list(): Promise<RecordingManifest[]>;
  events(id: string, afterSeq?: number, limit?: number): Promise<RecordingEvent[]>;
  timeline(id: string, fromMs: number, toMs: number): Promise<RecordingEvent[]>;
  latest(id: string, type: RecordingEvent['type'], atMs: number): Promise<RecordingEvent | null>;
  comments(id: string, afterMs?: number, afterSeq?: number, limit?: number): Promise<Extract<RecordingEvent, { type: 'comment-show' }>[]>;
  media(id: string): Promise<Blob>;
  remove(id: string): Promise<void>;
  staging(): Promise<RecordingFileStage>;
  exclusive<T>(id: string, work: () => Promise<T>): Promise<T>;
  dispose(): void;
}
export interface RecordingFileStage { write(data: Uint8Array): Promise<void>; finish(): Promise<Blob>; dispose(): Promise<void> }

/** A stalled writer must stop recording instead of retaining unbounded audio. */
export class RecordingWriteQueue {
  private tail = Promise.resolve();
  private pending = 0;
  private failure: Error | null = null;
  constructor(private limit = RECORDING_WRITE_LIMIT) {}
  enqueue<T>(bytes: number, work: () => Promise<T>): Promise<T> {
    if (this.failure) return Promise.reject(this.failure);
    if (!Number.isFinite(bytes) || bytes < 0 || this.pending + bytes > this.limit) return Promise.reject(new Error('保存速度跟不上录制，录播已停止。'));
    this.pending += bytes;
    const task = this.tail.then(() => { if (this.failure) throw this.failure; return work(); });
    this.tail = task.then(() => undefined, error => { this.failure = error instanceof Error ? error : new Error('录播写入失败。'); }).finally(() => { this.pending -= bytes; });
    return task;
  }
  get pendingBytes() { return this.pending; }
  async drain() { await this.tail; if (this.failure) throw this.failure; }
}

export class BrowserRecordingStore implements RecordingStore {
  private writers = new Map<string, WorkerMediaWriter>();
  private leases = new Map<string, () => void>();
  constructor(private index = new RecordingIndex(), private workerFactory?: () => Worker) {}
  async create(seed: RecordingManifest) {
    if (!validRecordingId(seed.id)) throw new Error('录播编号无效。');
    const release = await holdRecordingLock(seed.id); this.leases.set(seed.id, release);
    let writer: WorkerMediaWriter | null = null, reserved = false;
    try {
      // Reserve the ID before touching a file: a duplicate import must not overwrite audio.
      await this.index.add({ ...seed, mediaStorage: 'indexeddb' }); reserved = true;
      if (this.workerFactory && globalThis.navigator?.storage?.getDirectory) {
        try { writer = new WorkerMediaWriter(this.workerFactory()); await writer.call('open', { id: seed.id }); } catch { writer?.dispose(); writer = null; }
      }
      const manifest = { ...seed, mediaStorage: writer ? 'opfs' as const : 'indexeddb' as const };
      await this.index.update(seed.id, { mediaStorage: manifest.mediaStorage });
      if (writer) this.writers.set(seed.id, writer);
      return manifest;
    } catch (error) { writer?.dispose(); release(); this.leases.delete(seed.id); if (reserved) await this.index.update(seed.id, { status: 'failed', message: '录播存储准备失败。' }).catch(() => undefined); throw error; }
  }
  async appendMedia(id: string, index: number, blob: Blob) {
    const writer = this.writers.get(id);
    if (writer) { await writer.call('write', { blob }); await this.index.addMediaBytes(id, blob.size); }
    else await this.index.appendMedia(id, index, blob);
  }
  appendEvents(id: string, events: RecordingEvent[]) { return this.index.appendEvents(id, events); }
  async finish(id: string, patch: Partial<RecordingManifest>) {
    const terminal = patch.status && !['recording', 'finalizing'].includes(patch.status);
    try {
      const writer = this.writers.get(id);
      if (writer) { try { await writer.call('close'); } finally { writer.dispose(); this.writers.delete(id); } }
      return await this.index.update(id, patch);
    } finally {
      if (terminal) { this.leases.get(id)?.(); this.leases.delete(id); }
    }
  }
  get(id: string) { return this.index.get(id); }
  list() { return this.index.list(); }
  events(id: string, afterSeq?: number, limit?: number) { return this.index.events(id, afterSeq, limit); }
  timeline(id: string, fromMs: number, toMs: number) { return this.index.timeline(id, fromMs, toMs); }
  latest(id: string, type: RecordingEvent['type'], atMs: number) { return this.index.latest(id, type, atMs); }
  comments(id: string, afterMs?: number, afterSeq?: number, limit?: number) { return this.index.comments(id, afterMs, afterSeq, limit); }
  async media(id: string) {
    const manifest = await this.get(id); if (!manifest || !validRecordingId(id)) throw new Error('找不到录播。');
    if (manifest.mediaStorage === 'opfs') {
      const root = await navigator.storage.getDirectory(), dir = await root.getDirectoryHandle('sonoscope-recordings-v1');
      const file = await (await dir.getFileHandle(id)).getFile();
      if (file.size < manifest.bytes) throw new Error('这段录播的音频文件不完整。');
      return file.slice(0, manifest.bytes, manifest.mimeType);
    }
    const blob = new Blob(await this.index.media(id), { type: manifest.mimeType });
    if (blob.size !== manifest.bytes) throw new Error('这段录播的音频文件不完整。');
    return blob;
  }
  async remove(id: string) {
    return this.exclusive(id, () => this.removeUnlocked(id));
  }
  private async removeUnlocked(id: string) {
    if (!validRecordingId(id) || this.writers.has(id)) throw new Error('录播还在保存，请稍后再删除。');
    const manifest = await this.get(id); if (!manifest) return;
    await this.index.update(id, { status: 'deleting' });
    if (manifest.mediaStorage === 'opfs') {
      try { const root = await navigator.storage.getDirectory(), dir = await root.getDirectoryHandle('sonoscope-recordings-v1'); await dir.removeEntry(id); }
      catch (error) { if (!(error instanceof DOMException) || error.name !== 'NotFoundError') throw error; }
    }
    await this.index.remove(id);
  }
  async exclusive<T>(id: string, work: () => Promise<T>): Promise<T> {
    if (!validRecordingId(id) || this.leases.has(id)) throw new Error('录播还在保存，请稍后再试。');
    if (!globalThis.navigator?.locks) {
      const current = await this.get(id);
      if (current && ['recording', 'finalizing'].includes(current.status)) throw new Error('这个浏览器无法确认未完成录播的占用状态，请先导出材料。');
    }
    const release = await holdRecordingLock(id); try { return await work(); } finally { release(); }
  }
  async staging(): Promise<RecordingFileStage> {
    const token = `backup-${crypto.randomUUID()}`;
    let writer: WorkerMediaWriter | null = null, index = 0;
    if (this.workerFactory && globalThis.navigator?.storage?.getDirectory) {
      try { writer = new WorkerMediaWriter(this.workerFactory()); await writer.call('open', { id: token }); } catch { writer?.dispose(); writer = null; }
    }
    const native = writer;
    return {
      write: async data => { const blob = new Blob([new Uint8Array(data)]); if (native) await native.call('write', { blob }); else await this.index.stage(token, index++, blob); },
      finish: async () => {
        if (native) { await native.call('close'); native.dispose(); const root = await navigator.storage.getDirectory(), dir = await root.getDirectoryHandle('sonoscope-recordings-v1'); return (await dir.getFileHandle(token)).getFile(); }
        return new Blob(await this.index.staged(token), { type: 'application/zip' });
      },
      dispose: async () => {
        native?.dispose();
        if (native) { try { const root = await navigator.storage.getDirectory(), dir = await root.getDirectoryHandle('sonoscope-recordings-v1'); await dir.removeEntry(token); } catch (error) { if (!(error instanceof DOMException) || error.name !== 'NotFoundError') throw error; } }
        else await this.index.removeStaged(token);
      }
    };
  }
  dispose() { for (const writer of this.writers.values()) writer.dispose(); this.writers.clear(); for (const release of this.leases.values()) release(); this.leases.clear(); void this.index.close(); }
}

class WorkerMediaWriter {
  private seq = 0;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  constructor(private worker: Worker) {
    worker.onmessage = e => {
      const task = this.pending.get(e.data?.requestId); if (!task) return;
      clearTimeout(task.timer); this.pending.delete(e.data.requestId);
      if (e.data.error) task.reject(new Error(e.data.error)); else task.resolve(e.data);
    };
    worker.onerror = () => this.dispose();
  }
  call(type: string, data: object = {}) {
    const requestId = ++this.seq;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(requestId); reject(new Error('录播保存超时。')); this.dispose(); }, 10000);
      this.pending.set(requestId, { resolve, reject, timer });
      try { this.worker.postMessage({ type, requestId, ...data }); } catch (error) { clearTimeout(timer); this.pending.delete(requestId); reject(error); }
    });
  }
  dispose() {
    for (const task of this.pending.values()) { clearTimeout(task.timer); task.reject(new Error('录播存储已关闭。')); }
    this.pending.clear(); this.worker.terminate();
  }
}
