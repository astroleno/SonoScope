import { expect, it, vi } from 'vitest';
import { exportRecording, restoreRecording } from '../../packages/sdk/src/recording-archive';
import { crcUpdate, crcResult } from '../../packages/sdk/src/recording-checksum';
import { DEFAULT_RECORDING_CONTROLS, type RecordingManifest } from '@sonoscope/core';
import { memoryRecordingStore } from './recording-fixtures';

function source() {
  const e = memoryRecordingStore();
  const manifest: RecordingManifest = { version: '1', id: 'archive-one', title: '录播备份', createdAt: 1000, status: 'saved', durationMs: 10000, bytes: 5, mimeType: 'audio/mp4', sampleRate: 48000, channels: 1, mediaStorage: 'indexeddb', lastEventSeq: 2, commentCount: 1, appVersion: '1', message: null };
  e.manifests.set(manifest.id, manifest); e.parts.set(manifest.id, [new Blob(['audio'])]);
  e.timeline.set(manifest.id, [{ seq: 1, atMs: 0, type: 'controls', controls: DEFAULT_RECORDING_CONTROLS }, { seq: 2, atMs: 1000, type: 'comment-show', id: 'c1', text: '声音轻了下来', source: 'local', durationMs: 6500 }]);
  return e;
}

it('roundtrips original media and the complete timeline without replacing an existing take', async () => {
  const e = source(), backup = await exportRecording(e.store, 'archive-one'), restored = memoryRecordingStore();
  const manifest = await restoreRecording(restored.store, backup.blob, async (_blob, ms) => ms);
  expect(manifest.status).toBe('saved'); expect(await (await restored.store.media(manifest.id)).text()).toBe('audio');
  expect(restored.timeline.get(manifest.id)).toEqual(e.timeline.get(manifest.id));
  await expect(restoreRecording(e.store, backup.blob, async (_blob, ms) => ms)).rejects.toThrow('已在库中');
  expect(e.manifests.get('archive-one')?.status).toBe('saved'); await backup.dispose();
});

it('rejects truncated and modified backup data and cleans only the failed restoration', async () => {
  const e = source(), backup = await exportRecording(e.store, 'archive-one'), restored = memoryRecordingStore();
  await expect(restoreRecording(restored.store, backup.blob.slice(0, backup.blob.size - 10))).rejects.toThrow('不完整');
  const bytes = new Uint8Array(await backup.blob.arrayBuffer()), needle = new TextEncoder().encode('audio'); let changed = false;
  // Change the actual media payload, not the ZIP entry name or manifest MIME.
  for (let i = 0; i < bytes.length - 5; i++) if (bytes.slice(i, i + 5).every((byte, j) => byte === needle[j]) && bytes[i + 5] === 0x50) { bytes[i] ^= 1; changed = true; break; }
  expect(changed).toBe(true);
  await expect(restoreRecording(restored.store, new Blob([bytes]), async (_blob, ms) => ms)).rejects.toThrow('校验');
  expect(restored.manifests.size).toBe(0); await backup.dispose();
});

it('checks media integrity incrementally against the standard CRC-32 vector', () => {
  const bytes = new TextEncoder().encode('123456789');
  const crc = crcUpdate(crcUpdate(-1, bytes.slice(0, 4)), bytes.slice(4)); expect(crcResult(crc)).toBe(0xcbf43926);
});

it('cancels export and restoration while cleaning their own temporary data', async () => {
  const e = source(), cancellation = new AbortController(), dispose = vi.fn();
  const staging = e.store.staging.bind(e.store);
  e.store.staging = async () => { const stage = await staging(); return { ...stage, async write(data) { await stage.write(data); cancellation.abort(); }, async dispose() { dispose(); await stage.dispose(); } }; };
  await expect(exportRecording(e.store, 'archive-one', cancellation.signal)).rejects.toMatchObject({ name: 'AbortError' });
  expect(dispose).toHaveBeenCalledOnce(); expect(e.manifests.get('archive-one')?.status).toBe('saved');
  const original = source(), backup = await exportRecording(original.store, 'archive-one'), restored = memoryRecordingStore(), aborted = new AbortController();
  const create = restored.store.create.bind(restored.store);
  restored.store.create = async manifest => { const result = await create(manifest); aborted.abort(); return result; };
  await expect(restoreRecording(restored.store, backup.blob, async (_blob, ms) => ms, aborted.signal)).rejects.toMatchObject({ name: 'AbortError' });
  expect(restored.manifests.size).toBe(0); await backup.dispose();
});
