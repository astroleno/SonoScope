import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeFrame } from '@sonoscope/core';
import { CommentQueue } from '../../packages/danmu-pipeline/comment-queue';
import { DanmuController } from '../../packages/danmu-pipeline/controller';
import { streamingClient } from '../../packages/danmu-pipeline/client';
import { frame, request, comment, deferred } from './fixtures';

afterEach(() => vi.useRealTimers());
describe('single bounded comment path', () => {
  it('same ID/text renders once and count records actual display acknowledgement', () => {
    const show = vi.fn().mockReturnValue(true), queue = new CommentQueue({ show, clear() {} }); queue.start('audio-1', 'run-1');
    expect(queue.enqueue(comment())).toBe(true); queue.tick();
    expect(queue.enqueue(comment())).toBe(false); expect(queue.enqueue(comment({ commentId: 'c-2', text: '声音 轻轻展开！' }))).toBe(false); queue.tick();
    expect(show).toHaveBeenCalledTimes(1);
  });
  it('bounds queue, respects interval, drops expired and previous-session items', () => {
    let now = 1000; const show = vi.fn().mockReturnValue(true);
    const queue = new CommentQueue({ show, clear() {} }, { capacity: 2, intervalMs: 1000, now: () => now }); queue.start('audio-1', 'run-1');
    expect(queue.enqueue(comment({ createdAt: 1000, expiresAt: 2000 }))).toBe(true);
    expect(queue.enqueue(comment({ commentId: 'c-2', text: '第二条', createdAt: 1000, expiresAt: 5000 }))).toBe(true);
    expect(queue.enqueue(comment({ commentId: 'c-3', text: '第三条', createdAt: 1000, expiresAt: 5000 }))).toBe(false);
    queue.tick(); now = 1500; queue.tick(); expect(show).toHaveBeenCalledTimes(1);
    now = 2100; queue.tick(); expect(show).toHaveBeenCalledTimes(2);
    queue.start('audio-1', 'new-run'); expect(queue.enqueue(comment())).toBe(false); expect(queue.size).toBe(0);
  });
  it('late cloud result cannot render after stop/restart and pending never becomes negative', async () => {
    vi.useFakeTimers(); const pending = deferred<void>(), show = vi.fn().mockReturnValue(true); let emit: Parameters<NonNullable<ConstructorParameters<typeof DanmuController>[1]>['generate']>[2];
    const controller = new DanmuController({ show, clear() {} }, { id: () => 'run-1', generate: async (_r, _signal, callback) => { emit = callback; await pending.promise; } });
    controller.setCloudEnabled(true); controller.start('audio-1'); const generation = controller.feedSnapshot(request().snapshot);
    expect(controller.current.pendingRequests).toBe(1); controller.stop(); controller.start('audio-2');
    emit!({ type: 'comment', requestId: 'run-1', comment: comment() }); pending.resolve(); await generation;
    expect(show).not.toHaveBeenCalled(); expect(controller.current.pendingRequests).toBe(0); controller.dispose();
  });
  it('local first feedback arrives without network and does not switch a stopped session on', () => {
    vi.useFakeTimers(); const show = vi.fn().mockReturnValue(true), generate = vi.fn();
    const controller = new DanmuController({ show, clear() {} }, { generate });
    controller.feedFrame(frame()); expect(show).not.toHaveBeenCalled();
    controller.start('audio-1'); controller.feedFrame(frame()); expect(show).toHaveBeenCalledTimes(1); expect(controller.current.metrics.localFirstMs).toBe(0); expect(generate).not.toHaveBeenCalled();
    controller.dispose();
  });
  it('stable audio produces no periodic filler; a new confident voice observation can respond', () => {
    vi.useFakeTimers(); const show = vi.fn().mockReturnValue(true), stable = frame();
    const controller = new DanmuController({ show, clear() {} }); controller.start('audio-1'); controller.feedFrame(stable);
    for (let seq = 1; seq < 11; seq++) { vi.advanceTimersByTime(2500); controller.feedFrame({ ...stable, seq, capturedAt: Date.now() }); }
    expect(show).toHaveBeenCalledTimes(1);
    const model = { version: 'yamnet-1', capturedAt: Date.now(), categories: [{ label: 'Speech', score: .95 }], voiceProbability: .95, instrument: null };
    controller.feedFrame(makeFrame('audio-1', 11, 26, Date.now(), stable.sampleRate, stable.values, model));
    expect(show).toHaveBeenCalledTimes(2); expect(show.mock.calls.at(-1)![0].text).toContain('像是有人声');
    vi.advanceTimersByTime(5000); controller.feedFrame(makeFrame('audio-1', 12, 31, Date.now(), stable.sampleRate, stable.values, { ...model, capturedAt: Date.now() }));
    expect(show).toHaveBeenCalledTimes(2); controller.stop(); expect(controller.current.history).toHaveLength(2); expect(controller.current.active).toBe(false);
    controller.start('audio-2'); expect(controller.current.history).toHaveLength(0); controller.dispose();
  });
  it('AI gets one first-comment priority slot without blocking fresh local feedback behind the batch', () => {
    let now = 1000; const show = vi.fn().mockReturnValue(true), queue = new CommentQueue({ show, clear() {} }, { now: () => now, intervalMs: 950 }); queue.start('audio-1', 'run-1');
    for (let i = 0; i < 3; i++) queue.enqueue(comment({ commentId: `ai-${i}`, text: `AI反馈${i}`, createdAt: now, expiresAt: 10000, requestStartedAt: 900 }));
    queue.tick(); queue.enqueue(comment({ commentId: 'local', source: 'local', text: '新的声音变化', createdAt: now, expiresAt: 4000 }));
    now += 1000; queue.tick(); now += 1000; queue.tick();
    expect(show.mock.calls.map(([c]) => c.commentId)).toEqual(['ai-0', 'local', 'ai-1']); queue.stop();
  });
  it('empty/quiet window makes zero vendor calls and respects minimum request interval', async () => {
    vi.useFakeTimers(); let now = Date.now(); const generate = vi.fn().mockImplementation(async (r, _s, emit) => emit({ type: 'done', requestId: r.requestId, count: 0, status: 'partial' }));
    const controller = new DanmuController({ show: () => true, clear() {} }, { generate, now: () => now, minRequestIntervalMs: 12000 }); controller.setCloudEnabled(true); controller.start('audio-1');
    const quiet = request().snapshot; quiet.stats.rmsMean = 0;
    await controller.feedSnapshot(quiet); expect(controller.current.pendingRequests).toBe(0); expect(generate).not.toHaveBeenCalled();
    await controller.feedSnapshot(request().snapshot); now += 1000; await controller.feedSnapshot(request().snapshot); expect(generate).toHaveBeenCalledTimes(1); controller.dispose();
  });
  it('NDJSON yields first comment before response completion, including split UTF-8 bytes', async () => {
    let out!: ReadableStreamDefaultController<Uint8Array>; const end = deferred<void>(), seen: string[] = []; const r = request();
    const stream = new ReadableStream<Uint8Array>({ start(c) { out = c; } });
    const client = streamingClient('/SonoScope/api/danmu/stream', vi.fn().mockResolvedValue(new Response(stream, { headers: { 'content-type': 'application/x-ndjson' } })));
    const task = client(r, new AbortController().signal, event => { seen.push(event.type); if (event.type === 'comment') end.resolve(); });
    const bytes = new TextEncoder().encode(JSON.stringify({ type: 'comment', requestId: r.requestId, comment: comment() }) + '\n');
    out.enqueue(bytes.slice(0, bytes.length - 5)); out.enqueue(bytes.slice(bytes.length - 5)); await end.promise;
    expect(seen).toEqual(['comment']);
    out.enqueue(new TextEncoder().encode(JSON.stringify({ type: 'done', requestId: r.requestId, status: 'partial', count: 1 }) + '\n')); out.close(); await task;
  });
  it('an empty AI batch gives visible failure state and cools down instead of silently requesting more', async () => {
    vi.useFakeTimers(); let now = Date.now();
    const generate = vi.fn().mockImplementation(async (r, _s, emit) => emit({ type: 'done', requestId: r.requestId, count: 0, status: 'partial' }));
    const controller = new DanmuController({ show: () => true, clear() {} }, { generate, now: () => now });
    controller.setCloudEnabled(true); controller.start('audio-1'); await controller.feedSnapshot(request().snapshot);
    expect(controller.current.cloud).toBe('error'); expect(controller.current.message).toContain('没有生成新弹幕');
    expect(controller.current.pendingRequests).toBe(0); expect(controller.current.aiDisplayed).toBe(0);
    now += 12000; await controller.feedSnapshot(request().snapshot); expect(generate).toHaveBeenCalledTimes(1);
    now += 19000; await controller.feedSnapshot(request().snapshot); expect(generate).toHaveBeenCalledTimes(2);
    controller.dispose();
  });
  it('turning AI off discards queued AI while preserving local feedback and shown history', () => {
    vi.useFakeTimers(); const show = vi.fn().mockReturnValue(true);
    const controller = new DanmuController({ show, clear() {} }, { id: () => 'run-1', generate: vi.fn() });
    try {
      controller.setCloudEnabled(true); controller.start('audio-1');
      controller.offer(comment({ commentId: 'shown', text: '已经显示的声音观察' }));
      controller.offer(comment({ commentId: 'queued-ai', text: '尚未显示的声音观察' }));
      controller.offer(comment({ commentId: 'queued-local', text: '本地声音正在变化', source: 'local' }));
      expect(controller.current.queued).toBe(2); controller.setCloudEnabled(false); expect(controller.current.queued).toBe(1);
      vi.advanceTimersByTime(2000);
      expect(show.mock.calls.map(([c]) => c.commentId)).toEqual(['shown', 'queued-local']);
      expect(controller.current.history.map(c => c.commentId)).toEqual(['shown', 'queued-local']); expect(controller.current.cloud).toBe('off');
      controller.setCloudEnabled(true);
      expect(controller.offer(comment({ commentId: 'retry-unshown', text: '尚未显示的声音观察' }))).toBe(true);
      expect(controller.offer(comment({ commentId: 'retry-shown', text: '已经显示的声音观察' }))).toBe(false);
    } finally { controller.dispose(); expect(vi.getTimerCount()).toBe(0); }
  });
  it('late rejection after a rapid cloud off/on cannot fail or delete the new request', async () => {
    vi.useFakeTimers(); const old = deferred<void>(), next = deferred<void>(), signals: AbortSignal[] = []; let calls = 0;
    const controller = new DanmuController({ show: () => true, clear() {} }, { generate: async (_r, signal) => { signals.push(signal); await (++calls === 1 ? old.promise : next.promise); } });
    try {
      controller.setCloudEnabled(true); controller.start('audio-1'); const first = controller.feedSnapshot(request().snapshot);
      controller.setCloudEnabled(false); expect(signals[0].aborted).toBe(true); expect(controller.current.pendingRequests).toBe(0); expect(vi.getTimerCount()).toBe(1);
      controller.setCloudEnabled(true); await vi.advanceTimersByTimeAsync(12000); const second = controller.feedSnapshot(request().snapshot);
      expect(controller.current.pendingRequests).toBe(1); old.reject(new Error('old cancellation')); await first;
      expect(controller.current.pendingRequests).toBe(1); expect(controller.current.cloud).toBe('loading'); expect(controller.current.message).toBeNull();
      next.resolve(); await second; expect(controller.current.pendingRequests).toBe(0);
    } finally { controller.dispose(); expect(vi.getTimerCount()).toBe(0); }
  });
  it('the client deadline releases a transport that ignores cancellation', async () => {
    vi.useFakeTimers(); const controller = new DanmuController({ show: () => true, clear() {} }, { generate: () => new Promise(() => {}) });
    try {
      controller.setCloudEnabled(true); controller.start('audio-1'); const pending = controller.feedSnapshot(request().snapshot);
      await vi.advanceTimersByTimeAsync(8000); await pending;
      expect(controller.current.pendingRequests).toBe(0); expect(controller.current.cloud).toBe('error'); expect(controller.current.message).toContain('本地反馈'); expect(vi.getTimerCount()).toBe(1);
    } finally { controller.dispose(); expect(vi.getTimerCount()).toBe(0); }
  });
  it('a transport returning without a terminal event cannot leave the UI loading forever', async () => {
    vi.useFakeTimers(); const controller = new DanmuController({ show: () => true, clear() {} }, { generate: async () => {} });
    try {
      controller.setCloudEnabled(true); controller.start('audio-1'); await controller.feedSnapshot(request().snapshot);
      expect(controller.current.cloud).toBe('error'); expect(controller.current.pendingRequests).toBe(0);
    } finally { controller.dispose(); expect(vi.getTimerCount()).toBe(0); }
  });
});
