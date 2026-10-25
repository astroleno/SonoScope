import { afterEach, expect, it, vi } from 'vitest';
import { ReplayCommentSink } from '../../packages/danmu-pipeline/replay-sink';
import type { RecordedComment } from '@sonoscope/core';
afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('freezes animation at a paused media position and does not remeasure text on every tick', () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }); vi.stubGlobal('innerHeight', 600);
  const box = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () { return { width: this.className === 'danmu-comment' ? 200 : 800, height: this.className === 'danmu-comment' ? 36 : 600, top: 0 } as DOMRect; });
  const container = document.createElement('div'); document.body.append(container); const sink = new ReplayCommentSink(container);
  const comment: RecordedComment = { id: 'one', text: '声音轻了下来', source: 'local', startMs: 0, endMs: 6500, durationMs: 6500, elapsedMs: 0, order: 1 };
  sink.render([comment], 1000); const initial = (container.firstChild as HTMLElement).style.transform, measurements = box.mock.calls.length;
  sink.render([comment], 1000); expect((container.firstChild as HTMLElement).style.transform).toBe(initial); expect(box).toHaveBeenCalledTimes(measurements);
  sink.render([comment], 3000); expect((container.firstChild as HTMLElement).style.transform).not.toBe(initial);
  sink.render([], 7000); expect(container.children).toHaveLength(0); sink.dispose();
});
it('reflows paused comments on resize and does not resurrect a closed view', () => {
  let resize!: () => void, width = 800;
  vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { resize = callback; } observe() {} disconnect() {} }); vi.stubGlobal('innerHeight', 600);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () { return { width: this.className === 'danmu-comment' ? 200 : width, height: this.className === 'danmu-comment' ? 36 : 600, top: 0 } as DOMRect; });
  const container = document.createElement('div'); document.body.append(container); const sink = new ReplayCommentSink(container);
  const comment: RecordedComment = { id: 'resize', text: '声音轻了下来', source: 'local', startMs: 0, endMs: 6500, durationMs: 6500, elapsedMs: 0, order: 1 };
  sink.render([comment], 1000); const initial = (container.firstChild as HTMLElement).style.transform;
  width = 320; resize(); expect((container.firstChild as HTMLElement).style.transform).not.toBe(initial);
  sink.setReducedMotion(true); expect((container.firstChild as HTMLElement).style.transform).toContain('60px');
  sink.clear(); resize(); expect(container.children).toHaveLength(0); sink.dispose();
});
