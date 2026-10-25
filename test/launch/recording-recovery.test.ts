import { expect, it } from 'vitest';
import { recoverRecording } from '../../packages/sdk/src/recording-archive';
import { DEFAULT_RECORDING_CONTROLS, type RecordingManifest } from '@sonoscope/core';
import { memoryRecordingStore } from './recording-fixtures';

it('preserves the interrupted source and copies only events inside a verified playable prefix', async () => {
  const e = memoryRecordingStore();
  e.manifests.set('broken', { version: '1', id: 'broken', title: '中断录播', createdAt: 1000, status: 'recording', durationMs: 10000, bytes: 5, mimeType: 'audio/mp4', sampleRate: 48000, channels: 1, mediaStorage: 'indexeddb', lastEventSeq: 3, commentCount: 2, appVersion: '1', message: null } as RecordingManifest);
  e.parts.set('broken', [new Blob(['audio'])]);
  e.timeline.set('broken', [{ seq: 1, atMs: 0, type: 'controls', controls: DEFAULT_RECORDING_CONTROLS }, { seq: 2, atMs: 1000, type: 'comment-show', id: 'first', text: '声音进来了', source: 'local', durationMs: 6500 }, { seq: 3, atMs: 9000, type: 'comment-show', id: 'lost-tail', text: '尾部', source: 'local', durationMs: 6500 }]);
  const recovered = await recoverRecording(e.store, 'broken', async () => 5000);
  expect(recovered.status).toBe('interrupted'); expect(recovered.durationMs).toBe(5000); expect(recovered.commentCount).toBe(1);
  expect(recovered.message).toMatch(/同步.*未经验证/);
  expect(e.timeline.get(recovered.id)!.map(event => event.seq)).toEqual([1, 2]);
  expect(await (await e.store.media('broken')).text()).toBe('audio'); expect(e.timeline.get('broken')).toHaveLength(3);
});
