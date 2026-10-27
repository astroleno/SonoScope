import type { RecordedComment } from '@sonoscope/core';

/** Playback is driven exclusively by media position, including animation progress. */
export class ReplayCommentSink {
  private nodes = new Map<string, { element: HTMLElement; comment: RecordedComment; width: number; height: number }>();
  private reducedMotion = false;
  private dirty = true;
  private width = 0;
  private top = 0;
  private bottom = 0;
  private observer: ResizeObserver;
  private lastComments: RecordedComment[] = [];
  private lastAtMs = 0;
  constructor(private container: HTMLElement, private controls: { top?: HTMLElement | null; bottom?: HTMLElement | null } = {}) {
    container.setAttribute('aria-hidden', 'true');
    this.observer = new ResizeObserver(() => { this.dirty = true; if (this.lastComments.length) this.render(this.lastComments, this.lastAtMs); }); this.observer.observe(container);
    if (controls.top) this.observer.observe(controls.top); if (controls.bottom) this.observer.observe(controls.bottom);
  }
  setReducedMotion(value: boolean) { if (this.reducedMotion === value) return; this.reducedMotion = value; if (this.lastComments.length) this.render(this.lastComments, this.lastAtMs); }
  render(comments: RecordedComment[], atMs: number) {
    this.lastComments = comments; this.lastAtMs = atMs;
    const ids = new Set(comments.map(c => c.id));
    for (const [id, node] of this.nodes) if (!ids.has(id)) { node.element.remove(); this.nodes.delete(id); }
    for (const comment of [...comments].sort((a, b) => a.order - b.order)) {
      let node = this.nodes.get(comment.id);
      if (!node) {
        const element = document.createElement('div'); element.className = 'danmu-comment'; element.textContent = comment.text; element.dataset.source = comment.source; element.dataset.commentId = comment.id; this.container.append(element);
        node = { element, comment, width: 0, height: 0 }; this.nodes.set(comment.id, node);
        this.dirty = true;
      }
    }
    if (this.dirty) {
      const box = this.container.getBoundingClientRect(); this.width = box.width;
      const topControl = this.controls.top && !this.controls.top.hidden ? this.controls.top.getBoundingClientRect() : null;
      const bottomControl = this.controls.bottom && !this.controls.bottom.hidden ? this.controls.bottom.getBoundingClientRect() : null;
      this.top = Math.max(0, (topControl?.bottom ?? box.top) - box.top) + 12;
      this.bottom = Math.min(box.height, (globalThis.innerHeight || box.height) - box.top, (bottomControl?.top ?? box.top + box.height) - box.top) - 12;
      for (const node of this.nodes.values()) { node.element.style.maxWidth = `${Math.max(0, Math.min(580, this.width - 32))}px`; const box = node.element.getBoundingClientRect(); node.width = box.width; node.height = box.height; }
      this.dirty = false;
    }
    let top = this.top;
    for (const comment of [...comments].sort((a, b) => a.order - b.order)) {
      const node = this.nodes.get(comment.id)!;
      if (!this.width || top + node.height > this.bottom) { node.element.style.visibility = 'hidden'; continue; }
      node.element.style.visibility = '';
      const progress = Math.max(0, Math.min(1, (atMs - comment.startMs + comment.elapsedMs) / comment.durationMs));
      const origin = Math.max(12, this.width - node.width - 16), x = this.reducedMotion ? Math.max(12, (this.width - node.width) / 2) : origin - (origin + node.width + 24) * progress;
      node.element.style.transform = `translate3d(${x}px,${top}px,0)`; top += node.height + 10;
    }
  }
  clear() { for (const node of this.nodes.values()) node.element.remove(); this.nodes.clear(); this.dirty = true; this.lastComments = []; this.lastAtMs = 0; }
  dispose() { this.clear(); this.observer.disconnect(); }
}
