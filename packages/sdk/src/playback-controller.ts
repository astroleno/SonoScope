import type { RecordingStore } from './recording-store';
import { ReplayTimeline, type ReplayView } from './replay-timeline';

export interface PlaybackState { status: 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'buffering' | 'ended' | 'error'; id: string | null; title: string; positionMs: number; durationMs: number; rate: number; message: string | null }
export type PlaybackMedia = Pick<HTMLMediaElement, 'currentTime' | 'duration' | 'playbackRate' | 'paused' | 'play' | 'pause' | 'addEventListener' | 'removeEventListener'>;
export interface PlaybackEnvironment { open(blob: Blob): Promise<{ media: PlaybackMedia; dispose(): void }>; requestFrame(callback: FrameRequestCallback): number; cancelFrame(id: number): void }
export function browserPlaybackEnvironment(): PlaybackEnvironment {
  return {
    requestFrame: callback => requestAnimationFrame(callback), cancelFrame: id => cancelAnimationFrame(id),
    open: blob => new Promise((resolve, reject) => {
      const audio = new Audio(), url = URL.createObjectURL(blob);
      const dispose = () => { clearTimeout(timer); audio.onloadedmetadata = null; audio.onerror = null; audio.pause(); audio.removeAttribute('src'); audio.load(); URL.revokeObjectURL(url); };
      const timer = setTimeout(() => { dispose(); reject(new Error('打开录播超时。')); }, 10000);
      audio.onloadedmetadata = () => { clearTimeout(timer); audio.onloadedmetadata = null; audio.onerror = null; resolve({ media: audio, dispose }); };
      audio.onerror = () => { clearTimeout(timer); dispose(); reject(new Error('这个设备暂时无法播放该录音格式。')); };
      audio.preload = 'metadata'; audio.src = url;
    })
  };
}
export class PlaybackController {
  private state: PlaybackState = { status: 'idle', id: null, title: '', positionMs: 0, durationMs: 0, rate: 1, message: null };
  private listeners = new Set<(state: PlaybackState) => void>();
  private viewers = new Set<(view: ReplayView | null) => void>();
  private handle: { media: PlaybackMedia; dispose(): void } | null = null;
  private timeline: ReplayTimeline | null = null;
  private epoch = 0;
  private seekAbort: AbortController | null = null;
  private raf: number | null = null;
  private publishedAt = -Infinity;
  private requestedPlaying = false;
  private notice: string | null = null;
  private unlisten: (() => void) | null = null;
  constructor(readonly store: RecordingStore, private environment = browserPlaybackEnvironment()) {}
  get current() { return this.state; }
  subscribe(listener: (state: PlaybackState) => void) { this.listeners.add(listener); listener(this.state); return () => { this.listeners.delete(listener); }; }
  onView(listener: (view: ReplayView | null) => void) { this.viewers.add(listener); return () => { this.viewers.delete(listener); }; }
  private publish(patch: Partial<PlaybackState>, force = true) {
    this.state = { ...this.state, ...patch };
    const now = performance.now(); if (!force && now - this.publishedAt < 250) return;
    this.publishedAt = now; for (const listener of this.listeners) listener(this.state);
  }
  private render() { const view = this.timeline?.contains(this.state.positionMs) ? this.timeline.view(this.state.positionMs) : null; for (const listener of this.viewers) listener(view); }
  async open(id: string) {
    this.close(); const epoch = ++this.epoch;
    this.publish({ status: 'loading', id, message: null });
    let handle: typeof this.handle = null;
    try {
      const manifest = await this.store.get(id);
      if (!manifest || !['saved', 'interrupted'].includes(manifest.status) || !manifest.bytes) throw new Error('这段录播还没有完成保存。');
      const blob = await this.store.media(id); if (epoch !== this.epoch) return;
      handle = await this.environment.open(blob); if (epoch !== this.epoch) { handle.dispose(); return; }
      this.handle = handle; this.timeline = new ReplayTimeline(this.store, id, manifest.durationMs);
      await this.timeline.prepare(0); if (epoch !== this.epoch) return;
      const ended = () => { this.requestedPlaying = false; this.publish({ status: 'ended', positionMs: manifest.durationMs }); this.render(); this.cancelFrame(); };
      const error = () => this.fail(new Error('录播播放中断。'));
      handle.media.addEventListener('ended', ended); handle.media.addEventListener('error', error);
      const media = handle.media; this.unlisten = () => { media.removeEventListener('ended', ended); media.removeEventListener('error', error); };
      this.notice = manifest.status === 'interrupted' ? manifest.message ?? '这段录播曾中断，可能缺少部分内容。' : null;
      this.publish({ status: 'ready', id, title: manifest.title, durationMs: manifest.durationMs, positionMs: 0, rate: 1, message: this.notice }); this.render();
    } catch (error) { if (epoch === this.epoch) { handle?.dispose(); this.handle = null; this.fail(error); } }
  }
  async play() {
    const handle = this.handle; if (!handle || !this.timeline) return;
    this.requestedPlaying = true;
    try {
      if (this.state.status === 'ended') { this.seek(0); return; }
      if (!this.timeline.contains(handle.media.currentTime * 1000)) await this.timeline.prepare(handle.media.currentTime * 1000);
      if (this.handle !== handle || !this.requestedPlaying) return;
      await handle.media.play(); if (this.handle !== handle || !this.requestedPlaying) return;
      this.publish({ status: 'playing', message: this.notice }); this.schedule();
    } catch (error) { if (this.handle === handle) { this.requestedPlaying = false; this.publish({ status: 'paused', message: error instanceof Error ? error.message : '请再次点击播放。' }); } }
  }
  pause() { this.requestedPlaying = false; this.handle?.media.pause(); this.cancelFrame(); if (this.handle) { this.publish({ status: 'paused', positionMs: this.handle.media.currentTime * 1000 }); this.render(); } }
  seek(positionMs: number) {
    const handle = this.handle, timeline = this.timeline; if (!handle || !timeline) return;
    positionMs = Math.max(0, Math.min(this.state.durationMs, positionMs));
    this.seekAbort?.abort(); const cancellation = new AbortController(); this.seekAbort = cancellation;
    this.cancelFrame(); handle.media.pause(); this.publish({ status: 'buffering', positionMs, message: this.notice });
    for (const viewer of this.viewers) viewer(null);
    const seeking = waitForSeek(handle.media, positionMs / 1000, cancellation.signal);
    void Promise.all([seeking, timeline.prepare(positionMs, true)]).then(async () => {
      if (cancellation.signal.aborted || this.handle !== handle) return;
      this.publish({ positionMs: handle.media.currentTime * 1000, status: this.requestedPlaying ? 'playing' : 'paused' }); this.render();
      if (this.requestedPlaying) { await handle.media.play(); this.schedule(); }
    }).catch(error => { if (!cancellation.signal.aborted && this.handle === handle) this.fail(error); });
  }
  setRate(rate: number) { if (![.5, 1, 1.5, 2].includes(rate) || !this.handle) return; this.handle.media.playbackRate = rate; this.publish({ rate }); this.render(); }
  private schedule() { if (this.raf === null && this.requestedPlaying) this.raf = this.environment.requestFrame(() => this.tick()); }
  private tick() {
    this.raf = null; const handle = this.handle, timeline = this.timeline; if (!handle || !timeline || !this.requestedPlaying) return;
    const positionMs = Math.min(this.state.durationMs, handle.media.currentTime * 1000);
    if (!timeline.contains(positionMs)) {
      handle.media.pause(); this.publish({ status: 'buffering', positionMs });
      for (const viewer of this.viewers) viewer(null);
      void timeline.prepare(positionMs).then(() => { if (this.handle === handle && this.requestedPlaying) return this.play(); }).catch(error => { if (this.handle === handle) this.fail(error); }); return;
    }
    this.publish({ positionMs }, false); this.render();
    if (timeline.needsPrefetch(positionMs)) void timeline.prepare(positionMs).catch(error => { if (this.handle === handle) this.fail(error); });
    this.schedule();
  }
  private cancelFrame() { if (this.raf !== null) this.environment.cancelFrame(this.raf); this.raf = null; }
  private fail(error: unknown) { this.requestedPlaying = false; this.handle?.media.pause(); this.cancelFrame(); this.publish({ status: 'error', message: error instanceof Error ? error.message : '回看暂时不可用。' }); for (const viewer of this.viewers) viewer(null); }
  close() {
    ++this.epoch; this.requestedPlaying = false; this.notice = null; this.seekAbort?.abort(); this.seekAbort = null; this.cancelFrame(); this.unlisten?.(); this.unlisten = null;
    this.handle?.dispose(); this.handle = null; this.timeline?.close(); this.timeline = null;
    this.publish({ status: 'idle', id: null, title: '', positionMs: 0, durationMs: 0, rate: 1, message: null }); for (const viewer of this.viewers) viewer(null);
  }
  dispose() { this.close(); this.listeners.clear(); this.viewers.clear(); }
}

function waitForSeek(media: PlaybackMedia, position: number, signal: AbortSignal): Promise<void> {
  if (Math.abs(media.currentTime - position) < .001) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const finish = (error?: Error) => { clearTimeout(timer); media.removeEventListener('seeked', seeked); media.removeEventListener('error', failed); signal.removeEventListener('abort', cancelled); if (error) reject(error); else resolve(); };
    const seeked = () => { if (Math.abs(media.currentTime - position) <= .2) finish(); };
    const failed = () => finish(new Error('录播定位失败。')), cancelled = () => finish(new DOMException('Seek cancelled', 'AbortError'));
    const timer = setTimeout(() => finish(new Error('录播定位超时。')), 8000);
    media.addEventListener('seeked', seeked); media.addEventListener('error', failed); signal.addEventListener('abort', cancelled, { once: true });
    if (signal.aborted) cancelled(); else { try { media.currentTime = position; } catch { failed(); } }
  });
}
