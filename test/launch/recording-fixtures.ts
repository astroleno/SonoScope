import type { RecordingEvent, RecordingManifest } from '@sonoscope/core';
import type { RecordingStore } from '../../packages/sdk/src/recording-store';

export function memoryRecordingStore() {
  const manifests = new Map<string, RecordingManifest>(), timeline = new Map<string, RecordingEvent[]>(), parts = new Map<string, Blob[]>();
  const store: RecordingStore = {
    async create(manifest) { manifests.set(manifest.id, { ...manifest }); timeline.set(manifest.id, []); parts.set(manifest.id, []); return manifest; },
    async appendMedia(id, _index, blob) { parts.get(id)!.push(blob); const manifest = manifests.get(id)!; manifest.bytes += blob.size; },
    async appendEvents(id, events) { timeline.get(id)!.push(...events); const manifest = manifests.get(id)!; manifest.lastEventSeq = events.at(-1)!.seq; manifest.commentCount += events.filter(e => e.type === 'comment-show').length; },
    async finish(id, patch) { const next = { ...manifests.get(id)!, ...patch }; manifests.set(id, next); return next; },
    async get(id) { return manifests.get(id) ?? null; }, async list() { return [...manifests.values()]; },
    async events(id, after = 0, limit = 256) { return (timeline.get(id) ?? []).filter(event => event.seq > after).slice(0, limit); },
    async timeline(id, from, to) { return (timeline.get(id) ?? []).filter(event => event.atMs >= from && event.atMs <= to).sort((a, b) => a.atMs - b.atMs || a.seq - b.seq); },
    async latest(id, type, at) { return (timeline.get(id) ?? []).filter(event => event.type === type && event.atMs <= at).sort((a, b) => b.atMs - a.atMs || b.seq - a.seq)[0] ?? null; },
    async comments(id, ms = 0, seq = 0, limit = 50) { return (timeline.get(id) ?? []).filter((event): event is Extract<RecordingEvent, { type: 'comment-show' }> => event.type === 'comment-show' && (event.atMs > ms || event.atMs === ms && event.seq > seq)).slice(0, limit); },
    async media(id) { return new Blob(parts.get(id), { type: manifests.get(id)!.mimeType }); },
    async remove(id) { manifests.delete(id); timeline.delete(id); parts.delete(id); }, dispose() {},
    async exclusive(_id, work) { return work(); },
    async staging() { const blobs: Blob[] = []; return { async write(data) { blobs.push(new Blob([new Uint8Array(data)])); }, async finish() { return new Blob(blobs, { type: 'application/zip' }); }, async dispose() { blobs.length = 0; } }; }
  };
  return { store, manifests, timeline, parts };
}
