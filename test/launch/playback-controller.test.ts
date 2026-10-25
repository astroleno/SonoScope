import { expect, it, vi } from 'vitest';
import { PlaybackController, type PlaybackEnvironment, type PlaybackMedia } from '../../packages/sdk/src/playback-controller';
import { DEFAULT_RECORDING_CONTROLS, type RecordingManifest } from '@sonoscope/core';
import { memoryRecordingStore } from './recording-fixtures';
import { deferred } from './fixtures';

class Media extends EventTarget {
  time = 0; duration = 100; paused = true; playbackRate = 1;
  get currentTime() { return this.time; }
  set currentTime(value: number) { this.time = value; queueMicrotask(() => this.dispatchEvent(new Event('seeked'))); }
  async play() { this.paused = false; }
  pause() { this.paused = true; }
}
function setup() {
  const e = memoryRecordingStore(), media = new Media(), dispose = vi.fn(); let next: FrameRequestCallback | null = null;
  const env: PlaybackEnvironment = { async open() { return { media, dispose }; }, requestFrame: cb => { next = cb; return 1; }, cancelFrame: () => { next = null; } };
  e.manifests.set('r1', { id: 'r1', status: 'saved', bytes: 1, durationMs: 100000, title: '录播', mimeType: 'audio/mp4' } as RecordingManifest); e.parts.set('r1', [new Blob(['a'])]);
  e.timeline.set('r1', [{ seq: 1, atMs: 0, type: 'controls', controls: DEFAULT_RECORDING_CONTROLS }, { seq: 2, atMs: 1000, type: 'comment-show', id: 'early', source: 'local', text: '前半段', durationMs: 6500 }, { seq: 3, atMs: 60000, type: 'comment-show', id: 'late', source: 'local', text: '后半段', durationMs: 6500 }]);
  const playback = new PlaybackController(e.store, env);
  return { ...e, media, dispose, playback, env, advance: (seconds: number) => { media.time = seconds; const cb = next; next = null; cb?.(performance.now()); } };
}

it('keeps playback, pause, rate and seeks on the recorded media clock', async () => {
  const e = setup(), views = vi.fn(); e.playback.onView(views);
  await e.playback.open('r1'); await e.playback.play(); e.advance(2);
  expect(views.mock.calls.at(-1)![0].comments.map((c: { id: string }) => c.id)).toEqual(['early']);
  e.playback.pause(); expect(e.playback.current.positionMs).toBe(2000); expect(e.media.paused).toBe(true);
  e.playback.setRate(2); expect(e.media.playbackRate).toBe(2);
  e.playback.seek(62000); await vi.waitFor(() => expect(e.playback.current.status).toBe('paused'));
  expect(views.mock.calls.at(-1)![0].comments.map((c: { id: string }) => c.id)).toEqual(['late']);
  e.playback.seek(2000); await vi.waitFor(() => expect(e.playback.current.status).toBe('paused'));
  expect(views.mock.calls.at(-1)![0].comments.map((c: { id: string }) => c.id)).toEqual(['early']);
  e.playback.close(); expect(e.dispose).toHaveBeenCalledOnce(); expect(e.playback.current.id).toBeNull();
});

it('releases an asynchronously opened media handle after the user closes or switches recordings', async () => {
  const e = setup(), opening = deferred<{ media: PlaybackMedia; dispose(): void }>(); e.env.open = () => opening.promise;
  const loading = e.playback.open('r1'); await vi.waitFor(() => expect(e.playback.current.status).toBe('loading'));
  await new Promise(resolve => setTimeout(resolve, 0)); e.playback.close(); opening.resolve({ media: e.media, dispose: e.dispose }); await loading;
  expect(e.dispose).toHaveBeenCalledOnce(); expect(e.playback.current.status).toBe('idle');
});
it('keeps an interrupted recording notice visible through play, pause and seek', async () => {
  const e = setup(), notice = '弹幕同步未经验证。';
  e.manifests.set('r1', { ...e.manifests.get('r1')!, status: 'interrupted', message: notice });
  await e.playback.open('r1'); await e.playback.play(); expect(e.playback.current.message).toBe(notice);
  e.playback.pause(); e.playback.seek(2000);
  await vi.waitFor(() => expect(e.playback.current.status).toBe('paused'));
  expect(e.playback.current.message).toBe(notice);
  e.playback.close(); expect(e.playback.current.message).toBeNull();
});
