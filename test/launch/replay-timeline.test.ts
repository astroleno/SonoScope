import { expect, it } from 'vitest';
import { DEFAULT_RECORDING_CONTROLS, type RecordingEvent } from '@sonoscope/core';
import { ReplayTimeline } from '../../packages/sdk/src/replay-timeline';
import { memoryRecordingStore } from './recording-fixtures';
import { deferred } from './fixtures';

it('restores active comment intervals and the last controls without replaying skipped comments', async () => {
  const e = memoryRecordingStore();
  e.timeline.set('r1', [
    { seq: 1, atMs: 0, type: 'controls', controls: DEFAULT_RECORDING_CONTROLS },
    { seq: 2, atMs: 0, type: 'comment-show', id: 'carry', source: 'local', text: '高频更明显', durationMs: 6500, elapsedMs: 2000 },
    { seq: 3, atMs: 2000, type: 'comment-hide', id: 'carry' },
    { seq: 4, atMs: 60000, type: 'controls', controls: { ...DEFAULT_RECORDING_CONTROLS, preset: 'mochi' } },
    { seq: 5, atMs: 61000, type: 'comment-show', id: 'later', source: 'ai', text: '声音轻了下来', durationMs: 6500 }
  ]);
  const replay = new ReplayTimeline(e.store, 'r1', 100000);
  await replay.prepare(0); expect(replay.view(1000).comments[0]).toMatchObject({ id: 'carry', elapsedMs: 2000, durationMs: 6500, endMs: 2000 });
  expect(replay.view(2000).comments).toHaveLength(0);
  await replay.prepare(65000, true); expect(replay.view(65000).comments.map(c => c.id)).toEqual(['later']); expect(replay.view(65000).controls.preset).toBe('mochi');
  await replay.prepare(1000, true); expect(replay.view(1000).comments.map(c => c.id)).toEqual(['carry']); expect(replay.view(1000).controls.preset).toBe('wave'); replay.close();
});

it('discards a slower earlier seek instead of replacing the latest loaded window', async () => {
  const old = deferred<RecordingEvent[]>(), recent = deferred<RecordingEvent[]>();
  const store = { timeline: (_id: string, from: number) => from === 0 ? old.promise : recent.promise, latest: async () => null };
  const replay = new ReplayTimeline(store, 'r1', 100000);
  const first = replay.prepare(0), second = replay.prepare(90000, true);
  recent.resolve([{ seq: 5, atMs: 90000, type: 'comment-show', id: 'new', source: 'local', text: '新位置', durationMs: 6500 }]); await second;
  old.resolve([]); await first;
  expect(replay.contains(90000)).toBe(true); expect(replay.contains(0)).toBe(false); expect(replay.view(90001).comments.map(c => c.id)).toEqual(['new']);
});
