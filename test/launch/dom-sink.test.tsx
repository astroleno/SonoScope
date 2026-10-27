import { afterEach, expect, it, vi } from 'vitest';
import { DomCommentSink } from '../../packages/danmu-pipeline/dom-sink';
import { CommentQueue } from '../../packages/danmu-pipeline/comment-queue';
import { comment } from './fixtures';
import { ReplayCommentSink } from '../../packages/danmu-pipeline/replay-sink';
afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it.each(['live', 'replay'] as const)('keeps %s comments visible below corner icons when the interface footer is hidden', mode => {
  let resize!: () => void, topBottom = 68;
  vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { resize = callback; } observe() {} disconnect() {} });
  vi.stubGlobal('innerHeight', 600); vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1)); vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const container = document.createElement('div'), top = document.createElement('div'), footer = document.createElement('footer');
  footer.hidden = true; document.body.append(top, container, footer);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    if (this === top) return { top: 0, bottom: topBottom } as DOMRect;
    if (this === footer) return { top: footer.hidden ? 0 : 500 } as DOMRect;
    return { width: this.className === 'danmu-comment' ? 200 : 800, height: this.className === 'danmu-comment' ? 30 : 600, top: 0 } as DOMRect;
  });
  const sink = mode === 'live' ? new DomCommentSink(container, { top, bottom: footer }) : new ReplayCommentSink(container, { top, bottom: footer });
  try {
    if (sink instanceof DomCommentSink) expect(sink.show(comment())).toBe(true);
    else sink.render([{ id: 'one', text: '声音在延续', source: 'local', startMs: 0, endMs: 6500, durationMs: 6500, elapsedMs: 0, order: 1 }], 1000);
    const node = container.firstElementChild as HTMLElement;
    expect(node).toBeTruthy(); expect(node.style.visibility).not.toBe('hidden'); expect(node.style.transform).toContain('80px');
    footer.hidden = false; topBottom = 160; resize(); expect(node.style.transform).toContain('172px');
    footer.hidden = true; topBottom = 68; resize(); expect(node.style.visibility).not.toBe('hidden'); expect(node.style.transform).toContain('80px');
  } finally { sink.dispose(); }
});
it('a shown comment starts inside the viewport and history height cannot add off-screen lanes', () => {
  const disconnect = vi.fn(), cancel = vi.fn();
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect = disconnect; });
  vi.stubGlobal('innerHeight', 600); vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1)); vi.stubGlobal('cancelAnimationFrame', cancel);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    return { width: this.className === 'danmu-comment' ? 200 : 800, height: this.className === 'danmu-comment' ? 36 : 1600, top: 0 } as DOMRect;
  });
  const container = document.createElement('div'); document.body.appendChild(container); const sink = new DomCommentSink(container);
  for (let i = 0; i < 6; i++) expect(sink.show(comment({ commentId: `c-${i}` }))).toBe(true);
  expect(sink.show(comment({ commentId: 'overflow' }))).toBe(false);
  for (const el of container.children) {
    const [x, y] = (el as HTMLElement).style.transform.match(/-?\d+(?:\.\d+)?(?=px)/g)!.map(Number);
    expect(x).toBeGreaterThanOrEqual(0); expect(x + 200).toBeLessThanOrEqual(800); expect(y + 36).toBeLessThanOrEqual(600);
  }
  sink.dispose(); expect(container.children).toHaveLength(0); expect(cancel).toHaveBeenCalledOnce(); expect(disconnect).toHaveBeenCalledOnce();
});
it('first AI and fresh local feedback can replace the oldest visible item when a short screen is full', () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  let nextFrame: FrameRequestCallback | undefined;
  vi.stubGlobal('innerHeight', 320); vi.stubGlobal('requestAnimationFrame', vi.fn(callback => { nextFrame = callback; return 1; })); vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  const container = document.createElement('div'), header = document.createElement('header'), footer = document.createElement('footer'); document.body.append(header, container, footer);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    if (this === header) return { top: 0, bottom: 105 } as DOMRect;
    if (this === footer) return { top: 224 } as DOMRect;
    return { width: this.className === 'danmu-comment' ? 200 : 740, height: this.className === 'danmu-comment' ? 37 : 320, top: 0 } as DOMRect;
  });
  let now = 1000; vi.spyOn(Date, 'now').mockImplementation(() => now);
  const sink = new DomCommentSink(container, { top: header, bottom: footer }), shown = vi.fn();
  const queue = new CommentQueue(sink, { now: () => now, onShown: shown }); queue.start('audio-1', 'run-1');
  const tick = () => { queue.tick(); const render = nextFrame; nextFrame = undefined; render?.(performance.now()); };
  const offer = (id: string, source: 'local' | 'ai') => queue.enqueue(comment({ commentId: id, text: id, source, snapshotId: 'snapshot-ai', createdAt: now, expiresAt: 10000, ...(source === 'ai' ? { requestStartedAt: 900 } : {}) }));
  offer('local-1', 'local'); queue.tick(); expect(shown).not.toHaveBeenCalled(); tick(); now += 1000; offer('local-2', 'local'); tick();
  now += 1000; offer('ai-first', 'ai'); tick();
  expect([...container.children].map(n => (n as HTMLElement).dataset.commentId)).toEqual(['local-2', 'ai-first']);
  now += 1000; offer('ai-rest', 'ai'); tick(); expect(queue.size).toBe(1); // Only the first result preempts.
  now += 1000; offer('local-fresh', 'local'); tick();
  expect([...container.children].map(n => (n as HTMLElement).dataset.commentId)).toEqual(['ai-first', 'local-fresh']);
  expect(shown).toHaveBeenCalledTimes(4); expect(queue.size).toBe(1);
  queue.dispose(); sink.dispose();
});
it('does not archive nodes removed before a visible render and reports early removal once', () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  let nextFrame: FrameRequestCallback | undefined;
  vi.stubGlobal('requestAnimationFrame', vi.fn(callback => { nextFrame = callback; return 1; })); vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  vi.stubGlobal('innerHeight', 600);
  const container = document.createElement('div'); document.body.append(container);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () { return { width: 800, height: this === container ? 600 : 100, top: 0 } as DOMRect; });
  const sink = new DomCommentSink(container), events = vi.fn(); sink.subscribePresentation(events);
  expect(sink.show(comment({ commentId: 'never-painted' }))).toBe(true); sink.clear(); expect(events).not.toHaveBeenCalled();
  expect(sink.show(comment({ commentId: 'visible' }))).toBe(true); nextFrame?.(performance.now());
  expect(events.mock.calls.map(([event]) => event.type)).toEqual(['show']); expect(sink.visibleComments()).toHaveLength(1);
  sink.clear(); expect(events.mock.calls.map(([event]) => event.type)).toEqual(['show', 'hide']); sink.dispose();
});
it('drops a candidate that expires before its first visible frame without acknowledging it', () => {
  let now = 1000, draw!: FrameRequestCallback;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('requestAnimationFrame', vi.fn(callback => { draw = callback; return 1; })); vi.stubGlobal('cancelAnimationFrame', vi.fn()); vi.stubGlobal('innerHeight', 600);
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  const container = document.createElement('div'); document.body.append(container);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () { return { width: 800, height: this === container ? 600 : 40, top: 0 } as DOMRect; });
  const sink = new DomCommentSink(container), events = vi.fn(); sink.subscribePresentation(events);
  expect(sink.show(comment({ expiresAt: 1100 }))).toBe(true);
  now = 1200; draw(performance.now());
  expect(container.children).toHaveLength(0); expect(events).not.toHaveBeenCalled(); expect(sink.visibleComments()).toEqual([]);
  sink.dispose();
});
it('uses measured controls and wrapped comment heights before acknowledging display', () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('innerHeight', 568); vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1)); vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const container = document.createElement('div'), header = document.createElement('header'), footer = document.createElement('footer');
  document.body.append(header, container, footer);
  let footerTop = 390;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    if (this === header) return { top: 0, bottom: 194 } as DOMRect;
    if (this === footer) return { top: footerTop } as DOMRect;
    return { width: this.className === 'danmu-comment' ? 288 : 320, height: this.className === 'danmu-comment' ? 60 : 568, top: 0 } as DOMRect;
  });
  const sink = new DomCommentSink(container, { top: header, bottom: footer });
  expect(sink.show(comment({ commentId: 'wrapped-1' }))).toBe(true);
  expect(sink.show(comment({ commentId: 'wrapped-2' }))).toBe(true);
  expect(sink.show(comment({ commentId: 'no-space' }))).toBe(false);
  expect(container.children).toHaveLength(2);
  const positions = [...container.children].map(el => (el as HTMLElement).style.transform.match(/-?\d+(?:\.\d+)?(?=px)/g)!.map(Number));
  expect(positions[0][1]).toBe(206); expect(positions[1][1]).toBe(276);
  expect(positions.every(([x, y]) => x >= 0 && x + 288 <= 320 && y >= 194 && y + 60 <= footerTop)).toBe(true);
  footerTop = 240;
  expect(sink.show(comment({ commentId: 'too-short' }))).toBe(false);
  expect(container.children).toHaveLength(0); // Resize removes comments that would now overlap controls.
  sink.dispose();
});
it('reflows a presented comment when recording controls grow without cutting it off unnecessarily', () => {
  let resized!: () => void, footerTop = 500, draw!: FrameRequestCallback;
  vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { resized = callback; } observe() {} disconnect() {} });
  vi.stubGlobal('requestAnimationFrame', vi.fn(callback => { draw = callback; return 1; })); vi.stubGlobal('cancelAnimationFrame', vi.fn()); vi.stubGlobal('innerHeight', 600);
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  const container = document.createElement('div'), header = document.createElement('header'), footer = document.createElement('footer'); document.body.append(header, container, footer);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    if (this === header) return { top: 0, bottom: 100 } as DOMRect;
    if (this === footer) return { top: footerTop } as DOMRect;
    return { width: this.className === 'danmu-comment' ? 200 : 800, height: this.className === 'danmu-comment' ? 37 : 600, top: 0 } as DOMRect;
  });
  const sink = new DomCommentSink(container, { top: header, bottom: footer }), events = vi.fn(); sink.subscribePresentation(events);
  sink.show(comment({ commentId: 'carry-in' })); draw(performance.now()); footerTop = 400; resized();
  expect(container.children).toHaveLength(1); expect(sink.visibleComments()[0].comment.commentId).toBe('carry-in'); expect(events).toHaveBeenCalledOnce();
  sink.dispose(); expect(events.mock.calls.map(([event]) => event.type)).toEqual(['show', 'hide']);
});
