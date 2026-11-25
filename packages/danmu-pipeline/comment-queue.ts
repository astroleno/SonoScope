import { cleanComment, textKey, type CommentCandidate } from '@sonoscope/core';

export type CommentPresentation = { type: 'show' | 'hide'; comment: CommentCandidate; durationMs: number; elapsedMs?: number };
export interface CommentSink {
  show(comment: CommentCandidate, options?: { priority?: boolean }): boolean;
  clear(): void;
  dispose?(): void;
  subscribePresentation?(listener: (event: CommentPresentation) => void): () => void;
  discardUnpresented?(commentId: string): void;
  visibleComments?(): { comment: CommentCandidate; remainingMs: number; durationMs?: number }[];
}
/** Only entry to rendering. IDs and text keys cover queued and actually displayed comments. */
export class CommentQueue {
  private items: CommentCandidate[] = [];
  private ids = new Map<string, number>();
  private texts = new Map<string, number>();
  private boostedAI = new Map<string, number>();
  private audioId: string | null = null;
  private runId: string | null = null;
  private lastShownAt = -Infinity;
  private acknowledged = new Set<string>();
  private unsubscribe?: () => void;
  constructor(private sink: CommentSink, private options: { capacity?: number; intervalMs?: number; dedupMs?: number; now?: () => number; onShown?: (c: CommentCandidate, at: number) => void } = {}) {
    this.unsubscribe = sink.subscribePresentation?.(event => {
      if (event.type === 'show') this.presented(event.comment, this.now());
    });
  }
  private presented(comment: CommentCandidate, now: number) {
    if (comment.audioSessionId !== this.audioId || comment.danmuRunId !== this.runId || comment.expiresAt <= now || this.acknowledged.has(comment.commentId)) return;
    this.acknowledged.add(comment.commentId);
    if (this.acknowledged.size > 100) this.acknowledged.delete(this.acknowledged.values().next().value!);
    this.lastShownAt = Math.max(this.lastShownAt, now);
    this.ids.set(comment.commentId, now + (this.options.dedupMs ?? 60000));
    this.texts.set(textKey(comment.text), now + (this.options.dedupMs ?? (comment.source === 'local' ? 10000 : 60000)));
    this.options.onShown?.(comment, now);
  }
  private now() { return (this.options.now ?? Date.now)(); }
  start(audioId: string, runId: string) { this.stop(); this.audioId = audioId; this.runId = runId; }
  enqueue(candidate: CommentCandidate, { retryIfUnpresented = false } = {}) {
    const now = this.now(); this.prune(now);
    const text = cleanComment(candidate.text);
    if (!text || candidate.audioSessionId !== this.audioId || candidate.danmuRunId !== this.runId || candidate.expiresAt <= now || this.ids.has(candidate.commentId) || this.texts.has(textKey(text))) return false;
    const capacity = this.options.capacity ?? 12;
    if (this.items.length >= capacity) return false;
    const c = { ...candidate, text };
    // An acoustic observation can retry when its slot expires without a presentation.
    this.items.push(c);
    this.ids.set(c.commentId, retryIfUnpresented ? c.expiresAt : now + (this.options.dedupMs ?? 60000));
    this.texts.set(textKey(text), retryIfUnpresented ? c.expiresAt : now + (this.options.dedupMs ?? (c.source === 'local' ? 10000 : 60000)));
    return true;
  }
  discardUnpresented(candidate: CommentCandidate) {
    if (candidate.audioSessionId !== this.audioId || candidate.danmuRunId !== this.runId || this.acknowledged.has(candidate.commentId)) return;
    const index = this.items.findIndex(comment => comment.commentId === candidate.commentId);
    if (index >= 0) this.items.splice(index, 1);
    if (this.ids.get(candidate.commentId) === candidate.expiresAt) {
      this.ids.delete(candidate.commentId);
      const key = textKey(candidate.text);
      if (this.texts.get(key) === candidate.expiresAt) this.texts.delete(key);
    }
    this.sink.discardUnpresented?.(candidate.commentId);
  }
  private prune(now: number) {
    this.items = this.items.filter(c => c.expiresAt > now && c.audioSessionId === this.audioId && c.danmuRunId === this.runId);
    for (const [id, expires] of this.ids) if (expires <= now) this.ids.delete(id);
    for (const [text, expires] of this.texts) if (expires <= now) this.texts.delete(text);
    for (const [id, expires] of this.boostedAI) if (expires <= now) this.boostedAI.delete(id);
  }
  tick() {
    const now = this.now(); this.prune(now);
    if (!this.items.length || now - this.lastShownAt < (this.options.intervalMs ?? 950)) return;
    // Give the first arriving AI result a prompt display slot; remaining order stays FIFO.
    const firstAI = this.items.findIndex(c => c.source === 'ai' && c.requestStartedAt !== undefined && !this.boostedAI.has(c.snapshotId));
    const local = this.items.findIndex(c => c.source === 'local');
    const index = firstAI >= 0 ? firstAI : local >= 0 ? local : 0;
    const candidate = this.items[index];
    if (!this.sink.show(candidate, { priority: firstAI >= 0 || candidate.source === 'local' })) return;
    if (candidate.source === 'ai') this.boostedAI.set(candidate.snapshotId, now + 60000);
    this.items.splice(index, 1); this.lastShownAt = now;
    if (!this.sink.subscribePresentation) this.presented(candidate, now);
  }
  stop() { this.audioId = null; this.runId = null; this.items = []; this.ids.clear(); this.texts.clear(); this.boostedAI.clear(); this.acknowledged.clear(); this.lastShownAt = -Infinity; this.sink.clear(); }
  dispose() { this.stop(); this.unsubscribe?.(); this.unsubscribe = undefined; }
  discardAI() {
    for (const c of this.items) if (c.source === 'ai') { this.ids.delete(c.commentId); this.texts.delete(textKey(c.text)); }
    this.items = this.items.filter(c => c.source !== 'ai');
  }
  get size() { return this.items.length; }
}
