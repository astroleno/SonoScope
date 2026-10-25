import { DEFAULT_RECORDING_CONTROLS, RECORDING_CACHE_LIMIT, type RecordedComment, type RecordingControls, type RecordingEvent } from '@sonoscope/core';
import type { RecordingStore } from './recording-store';

export interface ReplayRenderClock { positionMs: number; epoch: number; playing: boolean; warmup: Extract<RecordingEvent, { type: 'visual' }>[] }
export interface ReplayView { atMs: number; comments: RecordedComment[]; controls: RecordingControls; visual: Extract<RecordingEvent, { type: 'visual' }> | null; warmup: Extract<RecordingEvent, { type: 'visual' }>[] }
const byTime = (a: RecordingEvent, b: RecordingEvent) => a.atMs - b.atMs || a.seq - b.seq;
function latest<T extends { atMs: number }>(items: T[], atMs: number): T | null {
  let low = 0, high = items.length;
  while (low < high) { const middle = (low + high) >>> 1; if (items[middle].atMs <= atMs) low = middle + 1; else high = middle; }
  return items[low - 1] ?? null;
}
/** An indexed sliding window, rather than loading or re-generating the whole recording. */
export class ReplayTimeline {
  private fromMs = Infinity;
  private throughMs = -Infinity;
  private epoch = 0;
  private pending: Promise<void> | null = null;
  private pendingAt = -Infinity;
  private comments: RecordedComment[] = [];
  private visuals: Extract<RecordingEvent, { type: 'visual' }>[] = [];
  private controls: Extract<RecordingEvent, { type: 'controls' }>[] = [];
  constructor(private store: Pick<RecordingStore, 'timeline' | 'latest'>, readonly id: string, readonly durationMs: number) {}
  contains(atMs: number) { return atMs >= this.fromMs && atMs <= this.throughMs; }
  needsPrefetch(atMs: number) { return this.throughMs < this.durationMs && this.throughMs - atMs < 3000; }
  prepare(atMs: number, force = false): Promise<void> {
    atMs = Math.max(0, Math.min(this.durationMs, atMs));
    if (!force && this.contains(atMs) && !this.needsPrefetch(atMs)) return Promise.resolve();
    if (!force && this.pending && Math.abs(this.pendingAt - atMs) < 5000) return this.pending;
    const epoch = ++this.epoch, from = Math.max(0, atMs - 30000), through = Math.min(this.durationMs, atMs + 15000);
    this.pendingAt = atMs;
    const work = async () => {
      const [window, controls, visual] = await Promise.all([this.store.timeline(this.id, from, through), this.store.latest(this.id, 'controls', from), this.store.latest(this.id, 'visual', from)]);
      if (epoch !== this.epoch) return;
      const events = [...new Map([...window, ...(controls ? [controls] : []), ...(visual ? [visual] : [])].map(event => [event.seq, event])).values()].sort(byTime);
      if (JSON.stringify(events).length * 2 > RECORDING_CACHE_LIMIT) throw new Error('这段录播超出了回看缓存上限。');
      const shown = new Map<string, RecordedComment>();
      for (const event of events) {
        if (event.type === 'comment-show') {
          const elapsedMs = event.elapsedMs ?? 0;
          if (shown.has(event.id)) throw new Error('录播中有重复的弹幕身份。');
          shown.set(event.id, { id: event.id, text: event.text, source: event.source, startMs: event.atMs, endMs: Math.min(this.durationMs, event.atMs + event.durationMs - elapsedMs), durationMs: event.durationMs, elapsedMs, order: event.seq });
        } else if (event.type === 'comment-hide') {
          const comment = shown.get(event.id); if (comment) comment.endMs = Math.max(comment.startMs, Math.min(comment.endMs, event.atMs));
        }
      }
      this.comments = [...shown.values()].sort((a, b) => a.startMs - b.startMs || a.order - b.order);
      this.visuals = events.filter((event): event is Extract<RecordingEvent, { type: 'visual' }> => event.type === 'visual');
      this.controls = events.filter((event): event is Extract<RecordingEvent, { type: 'controls' }> => event.type === 'controls');
      this.fromMs = from; this.throughMs = through;
    };
    const pending = work().finally(() => { if (this.pending === pending) this.pending = null; }); this.pending = pending; return pending;
  }
  view(atMs: number): ReplayView {
    return { atMs, comments: this.comments.filter(c => c.startMs <= atMs && c.endMs > atMs), controls: latest(this.controls, atMs)?.controls ?? DEFAULT_RECORDING_CONTROLS, visual: latest(this.visuals, atMs), warmup: this.visuals.filter(v => v.atMs <= atMs && v.atMs >= atMs - 1000).slice(-20) };
  }
  close() { ++this.epoch; this.comments = []; this.visuals = []; this.controls = []; this.fromMs = Infinity; this.throughMs = -Infinity; this.pending = null; }
}
