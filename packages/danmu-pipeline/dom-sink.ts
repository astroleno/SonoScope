import type { CommentCandidate } from '@sonoscope/core';
import type { CommentSink, CommentPresentation } from './comment-queue';

export class DomCommentSink implements CommentSink {
  private active: { element: HTMLElement; comment: CommentCandidate; presented: boolean; duration: number; start: number; width: number; y: number; height: number; expires: number }[] = [];
  private width = 0;
  private top = 0;
  private bottom = 0;
  private raf: number | null = null;
  private observer: ResizeObserver;
  private reducedMotion = false;
  private listeners = new Set<(event: CommentPresentation) => void>();
  constructor(private container: HTMLElement, private controls: { top?: HTMLElement | null; bottom?: HTMLElement | null } = {}) {
    container.setAttribute('aria-hidden', 'true');
    this.measure(); this.observer = new ResizeObserver(() => this.measure()); this.observer.observe(container);
    if (controls.top) this.observer.observe(controls.top);
    if (controls.bottom) this.observer.observe(controls.bottom);
  }
  private measure() {
    const box = this.container.getBoundingClientRect(), viewport = globalThis.innerHeight || box.height;
    const topControl = this.controls.top && !this.controls.top.hidden ? this.controls.top.getBoundingClientRect() : null;
    const bottomControl = this.controls.bottom && !this.controls.bottom.hidden ? this.controls.bottom.getBoundingClientRect() : null;
    const top = Math.max(0, -box.top, (topControl?.bottom ?? box.top) - box.top) + 12;
    const bottom = Math.min(box.height, viewport - box.top, (bottomControl?.top ?? box.top + box.height) - box.top) - 12;
    const changed = this.width !== box.width || this.top !== top || this.bottom !== bottom;
    this.width = box.width; this.top = top; this.bottom = bottom;
    if (changed && this.active.length) {
      let y = top;
      this.active = this.active.filter(comment => {
        comment.element.style.maxWidth = `${Math.max(0, Math.min(580, this.width - 32))}px`;
        const rect = comment.element.getBoundingClientRect(); comment.width = rect.width; comment.height = rect.height;
        if (!this.width || y + rect.height > bottom) { this.remove(comment); return false; }
        comment.y = y; y += rect.height + 10;
        const progress = Math.max(0, (performance.now() - comment.start) / comment.duration), origin = Math.max(12, this.width - comment.width - 16);
        const x = this.reducedMotion ? Math.max(12, (this.width - comment.width) / 2) : origin - (origin + comment.width + 24) * progress;
        comment.element.style.transform = `translate3d(${x}px,${comment.y}px,0)`; return true;
      });
    }
  }
  setReducedMotion(value: boolean) { if (value === this.reducedMotion) return; this.clear(); this.reducedMotion = value; }
  subscribePresentation(listener: (event: CommentPresentation) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  visibleComments() { const now = performance.now(); return this.active.filter(c => c.presented && c.expires > now).map(c => ({ comment: c.comment, remainingMs: c.expires - now, durationMs: c.duration })); }
  private remove(c: typeof this.active[number]) { c.element.remove(); if (c.presented) for (const listener of this.listeners) listener({ type: 'hide', comment: c.comment, durationMs: c.duration }); }
  private position(height: number) {
    let y = this.top;
    for (const c of [...this.active].sort((a, b) => a.y - b.y)) {
      if (y + height + 10 <= c.y) break;
      y = Math.max(y, c.y + c.height + 10);
    }
    return y;
  }
  show(comment: CommentCandidate, options?: { priority?: boolean }) {
    this.measure();
    if ((this.active.length >= 6 && !options?.priority) || !this.width || this.bottom <= this.top) return false;
    const element = document.createElement('div'); element.className = 'danmu-comment'; element.textContent = comment.text;
    element.dataset.source = comment.source; element.dataset.commentId = comment.commentId;
    element.style.maxWidth = `${Math.max(0, Math.min(580, this.width - 32))}px`;
    this.container.appendChild(element);
    const { width, height } = element.getBoundingClientRect(); // measure once, never during the animation loop
    if (height > this.bottom - this.top) { element.remove(); return false; }
    let y = this.position(height);
    while (options?.priority && this.active.length && (this.active.length >= 6 || y + height > this.bottom)) {
      this.remove(this.active.shift()!);
      y = this.position(height);
    }
    if (this.active.length >= 6 || y + height > this.bottom) { element.remove(); return false; }
    const start = performance.now(), duration = this.reducedMotion ? 4000 : 6500, expires = start + duration;
    element.style.transform = `translate3d(${this.reducedMotion ? Math.max(12, (this.width - width) / 2) : Math.max(12, this.width - width - 16)}px,${y}px,0)`;
    this.active.push({ element, comment, presented: false, duration, start, width, height, y, expires });
    if (this.raf === null) this.raf = requestAnimationFrame(t => this.draw(t));
    return true;
  }
  private draw(time: number) {
    this.raf = null;
    this.active = this.active.filter(c => {
      if (!c.presented && c.comment.expiresAt <= Date.now()) { c.element.remove(); return false; }
      if (!c.presented && document.visibilityState !== 'hidden') {
        c.presented = true; c.start = time; c.expires = time + c.duration;
        for (const listener of this.listeners) listener({ type: 'show', comment: c.comment, durationMs: c.duration });
      }
      if (time >= c.expires) { this.remove(c); return false; }
      if (!this.reducedMotion) {
        const progress = Math.max(0, (time - c.start) / (c.expires - c.start));
        const origin = Math.max(12, this.width - c.width - 16);
        c.element.style.transform = `translate3d(${origin - (origin + c.width + 24) * progress}px,${c.y}px,0)`;
      }
      return true;
    });
    if (this.active.length) this.raf = requestAnimationFrame(t => this.draw(t));
  }
  clear() { if (this.raf !== null) cancelAnimationFrame(this.raf); this.raf = null; for (const c of this.active) this.remove(c); this.active = []; }
  dispose() { this.clear(); this.observer.disconnect(); this.listeners.clear(); }
}
