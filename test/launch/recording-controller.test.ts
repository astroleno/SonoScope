import { afterEach, expect, it, vi } from 'vitest';
import { RecordingController } from '../../packages/sdk/src/recording-controller';
import type { RecorderFactory } from '../../packages/sdk/src/recorder-backend';
import type { RecordingTap } from '../../packages/sdk/src/audio-session';
import { memoryRecordingStore } from './recording-fixtures';
import { comment, deferred } from './fixtures';

afterEach(() => { vi.unstubAllGlobals(); });
function setup() {
  const memory = memoryRecordingStore(); let seconds = 10, id = 0;
  const tap: RecordingTap = { stream: {} as MediaStream, sampleRate: 48000, channels: 1, sourceSeconds: () => seconds, dispose: vi.fn() };
  const callbacks: { data: (blob: Blob) => void; fail: (error: Error) => void }[] = [];
  const recorder: RecorderFactory = (_tap, data, fail) => { callbacks.push({ data, fail }); return { mimeType: 'audio/mp4', async start() {}, async stop() { data(new Blob(['tail'])); }, dispose() {} }; };
  const createRecordingTap = vi.fn(() => tap);
  const controller = new RecordingController({ createRecordingTap }, memory.store, {}, { recorder, verifyMedia: async (_blob, duration) => duration, id: () => `recording-${++id}`, now: () => 1000 });
  return { ...memory, controller, tap, callbacks, createRecordingTap, at: (value: number) => { seconds = value; } };
}

it('saves more than twelve displayed comments and waits for the final audio before completing', async () => {
  const e = setup(); await e.controller.start(); e.callbacks[0].data(new Blob(['head']));
  for (let i = 0; i < 20; i++) {
    e.at(10 + i / 10); const candidate = comment({ commentId: `comment-${i}` });
    e.controller.presentation({ type: 'show', comment: candidate, durationMs: 6500 });
    e.controller.presentation({ type: 'hide', comment: candidate, durationMs: 6500 });
  }
  e.at(15); const manifest = await e.controller.stop();
  expect(manifest?.status).toBe('saved'); expect(manifest?.commentCount).toBe(20); expect(manifest?.bytes).toBe(8); expect(manifest?.durationMs).toBe(5000);
  expect(e.timeline.get('recording-1')!.filter(event => event.type === 'comment-show')).toHaveLength(20);
  expect(await (await e.store.media('recording-1')).text()).toBe('headtail');
  expect(e.tap.dispose).toHaveBeenCalled(); e.controller.dispose();
});

it('cancels during storage preflight without opening a recording branch', async () => {
  const estimate = deferred<StorageEstimate>(); vi.stubGlobal('navigator', { storage: { estimate: () => estimate.promise } });
  const e = setup(), start = e.controller.start(), stopped = e.controller.stop(); estimate.resolve({ quota: 10000000, usage: 0 });
  await start; await stopped; expect(e.createRecordingTap).not.toHaveBeenCalled(); expect(e.controller.current.status).toBe('idle'); e.controller.dispose();
});

it('preserves a visible carry-in and closes twenty takes without retaining recording timers', async () => {
  vi.useFakeTimers();
  const e = setup();
  try {
    for (let i = 0; i < 20; i++) {
      e.at(10 + i); await e.controller.start(); const shown = comment({ commentId: `visible-${i}` });
      e.controller.presentation({ type: 'show', comment: shown, durationMs: 6500, elapsedMs: 2500 }, 0);
      e.controller.presentation({ type: 'show', comment: shown, durationMs: 6500, elapsedMs: 2500 }, 0);
      e.at(10.5 + i); const manifest = await e.controller.stop(i % 2 ? 'page-hidden' : 'user');
      expect(manifest?.status).toBe(i % 2 ? 'interrupted' : 'saved');
      const events = e.timeline.get(`recording-${i + 1}`)!, comments = events.filter(event => event.type === 'comment-show');
      expect(comments).toHaveLength(1); expect(comments[0]).toMatchObject({ atMs: 0, elapsedMs: 2500 }); expect(vi.getTimerCount()).toBe(0);
    }
  } finally { e.controller.dispose(); vi.useRealTimers(); }
});

it('isolates late audio from a previous take and reports failed storage instead of a saved archive', async () => {
  const e = setup(); await e.controller.start(); e.at(11); await e.controller.stop();
  await e.controller.start(); e.callbacks[0].data(new Blob(['late-old-audio']));
  e.store.appendMedia = async () => { throw new Error('disk full'); }; e.callbacks[1].data(new Blob(['new-audio']));
  await vi.waitFor(() => expect(e.controller.current.status).toBe('error'));
  expect(e.manifests.get('recording-2')?.status).toBe('failed'); expect(e.parts.get('recording-2')).toHaveLength(0);
  e.controller.dispose();
});
