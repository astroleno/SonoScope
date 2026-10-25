interface SyncHandle { write(data: Uint8Array, options: { at: number }): number; flush(): void; close(): void }
let sync: SyncHandle | null = null;
let position = 0;
let tail = Promise.resolve();
globalThis.onmessage = (event: MessageEvent) => {
  const message = event.data;
  const work = async () => {
    try {
      if (message.type === 'open') {
        if (!/^[a-zA-Z0-9_-]{1,96}$/.test(message.id) || sync) throw new Error('Invalid recording writer');
        const root = await navigator.storage.getDirectory(), dir = await root.getDirectoryHandle('sonoscope-recordings-v1', { create: true });
        try { await dir.getFileHandle(message.id); throw new Error('Recording file already exists'); } catch (error) { if (!(error instanceof DOMException) || error.name !== 'NotFoundError') throw error; }
        const file = await dir.getFileHandle(message.id, { create: true });
        const syncFile = file as FileSystemFileHandle & { createSyncAccessHandle?: () => Promise<SyncHandle> };
        if (!syncFile.createSyncAccessHandle) { await dir.removeEntry(message.id); throw new Error('Synchronous file writes unavailable'); }
        sync = await syncFile.createSyncAccessHandle();
        position = 0;
      } else if (message.type === 'write') {
        if (!(message.blob instanceof Blob) || !sync) throw new Error('Recording writer is unavailable');
        const reader = message.blob.stream().getReader();
        try {
          for (;;) {
            const part = await reader.read(); if (part.done) break;
            let offset = 0;
            while (offset < part.value.byteLength) { const written = sync.write(part.value.subarray(offset), { at: position }); if (written <= 0) throw new Error('Incomplete recording write'); position += written; offset += written; }
          }
        } finally { reader.releaseLock(); }
        sync?.flush();
      } else if (message.type === 'close') {
        sync?.flush(); sync?.close(); sync = null;
      } else throw new Error('Unknown recording operation');
      globalThis.postMessage({ requestId: message.requestId, bytes: position });
    } catch (error) {
      try { sync?.close(); } catch { /* failed handle */ } sync = null;
      globalThis.postMessage({ requestId: message.requestId, error: error instanceof Error ? error.message : '录播写入失败。' });
    }
  };
  tail = tail.then(work, work);
};
export {};
