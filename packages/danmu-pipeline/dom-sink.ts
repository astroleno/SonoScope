import type { CommentCandidate } from '@sonoscope/core';
import type { CommentSink } from './comment-queue';

export class DomCommentSink implements CommentSink {
  private active: { element: HTMLElement; start: number; width: number; y: number; height: number; expires: number }[] = [];
  private width = 0;
  private top = 0;
  private bottom = 0;
  private raf: number | null = null;
  private observer: ResizeObserver;
  private reducedMotion = false;
  constructor(private container: HTMLElement, private controls: { top?: HTMLElement | null; bottom?: HTMLElement | null } = {}) {
    container.setAttribute('aria-hidden', 'true');
    this.measure(); this.observer = new ResizeObserver(() => this.measure()); this.observer.observe(container);
    if (controls.top) this.observer.observe(controls.top);
    if (controls.bottom) this.observer.observe(controls.bottom);
  }
  private measure() {
    const box = this.container.getBoundingClientRect(), viewport = globalThis.innerHeight || box.height;
    const top = Math.max(0, -box.top, (this.controls.top?.getBoundingClientRect().bottom ?? box.top) - box.top) + 12;
    const bottom = Math.min(box.height, viewport - box.top, (this.controls.bottom?.getBoundingClientRect().top ?? box.top + box.height) - box.top) - 12;
    if (this.width !== box.width || this.top !== top || this.bottom !== bottom) this.clear();
    this.width = box.width; this.top = top; this.bottom = bottom;
  }
  setReducedMotion(value: boolean) { if (value === this.reducedMotion) return; this.clear(); this.reducedMotion = value; }
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
      this.active.shift()!.element.remove(); // Already acknowledged comments remain in the readable history.
      y = this.position(height);
    }
    if (this.active.length >= 6 || y + height > this.bottom) { element.remove(); return false; }
    const start = performance.now(), expires = start + (this.reducedMotion ? 4000 : 6500);
    element.style.transform = `translate3d(${this.reducedMotion ? Math.max(12, (this.width - width) / 2) : Math.max(12, this.width - width - 16)}px,${y}px,0)`;
    this.active.push({ element, start, width, height, y, expires });
    if (this.raf === null) this.raf = requestAnimationFrame(t => this.draw(t));
    return true;
  }
  private draw(time: number) {
    this.raf = null;
    this.active = this.active.filter(c => {
      if (time >= c.expires) { c.element.remove(); return false; }
      if (!this.reducedMotion) {
        const progress = Math.max(0, (time - c.start) / (c.expires - c.start));
        const origin = Math.max(12, this.width - c.width - 16);
        c.element.style.transform = `translate3d(${origin - (origin + c.width + 24) * progress}px,${c.y}px,0)`;
      }
      return true;
    });
    if (this.active.length) this.raf = requestAnimationFrame(t => this.draw(t));
  }
  clear() { if (this.raf !== null) cancelAnimationFrame(this.raf); this.raf = null; for (const c of this.active) c.element.remove(); this.active = []; }
  dispose() { this.clear(); this.observer.disconnect(); }
}
