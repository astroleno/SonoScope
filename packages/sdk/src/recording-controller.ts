import { RECORDING_VERSION, DEFAULT_RECORDING_CONTROLS, recordingVisual, type FeatureFrame, type RecordingControls, type RecordingEvent, type RecordingManifest } from '@sonoscope/core';
import type { CommentPresentation, CommentSink } from '@sonoscope/danmu-pipeline';
import type { AudioSession, RecordingTap } from './audio-session';
import { RecordingClock } from './recording-clock';
import { createBrowserRecorder, verifyRecordedMedia, type RecorderFactory, type RecorderHandle } from './recorder-backend';
import { RecordingWriteQueue, type RecordingStore } from './recording-store';
import { crcUpdate, crcResult } from './recording-checksum';

export interface RecordingState { status: 'idle' | 'arming' | 'recording' | 'finalizing' | 'saved' | 'error'; id: string | null; durationMs: number; bytes: number; pendingBytes: number; message: string | null }
type EventData = RecordingEvent extends infer E ? E extends RecordingEvent ? Omit<E, 'seq' | 'atMs'> : never : never;
interface Run {
  id: string; tap: RecordingTap; clock: RecordingClock; backend: RecorderHandle; queue: RecordingWriteQueue;
  seq: number; chunk: number; events: RecordingEvent[]; seen: Set<string>; lastVisualMs: number; bytes: number; crc: number; error: Error | null;
}
export interface RecordingOptions { recorder?: RecorderFactory; verifyMedia?: (blob: Blob, expectedMs: number) => Promise<number>; id?: () => string; now?: () => number }
export class RecordingController {
  private state: RecordingState = { status: 'idle', id: null, durationMs: 0, bytes: 0, pendingBytes: 0, message: null };
  private listeners = new Set<(state: RecordingState) => void>();
  private run: Run | null = null;
  private starting: Promise<void> | null = null;
  private finishing: Promise<RecordingManifest | null> | null = null;
  private cancelStart = false;
  private disposed = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private controls = { ...DEFAULT_RECORDING_CONTROLS };
  constructor(private audio: Pick<AudioSession, 'createRecordingTap'>, readonly store: RecordingStore, private sink: Pick<CommentSink, 'visibleComments'> = {}, private options: RecordingOptions = {}) {}
  get current() { return this.state; }
  subscribe(listener: (state: RecordingState) => void) { this.listeners.add(listener); listener(this.state); return () => { this.listeners.delete(listener); }; }
  private publish(patch: Partial<RecordingState>) { this.state = { ...this.state, ...patch }; for (const listener of this.listeners) listener(this.state); }
  setControls(controls: RecordingControls) {
    if (Object.keys(controls).every(key => controls[key as keyof RecordingControls] === this.controls[key as keyof RecordingControls])) return;
    this.controls = { ...controls }; this.event({ type: 'controls', controls: { ...controls } });
  }
  start() {
    if (this.starting) return this.starting;
    if (this.disposed) return Promise.reject(new Error('声音引擎已关闭。'));
    if (this.run || this.finishing) return Promise.reject(new Error('请先结束当前录播的保存。'));
    this.cancelStart = false;
    this.publish({ status: 'arming', id: null, durationMs: 0, bytes: 0, pendingBytes: 0, message: null });
    const work = async () => {
      let run: Run | null = null, reserved = false;
      try {
        const estimate = await globalThis.navigator?.storage?.estimate?.();
        if (estimate?.quota && estimate.quota - (estimate.usage ?? 0) < 1024 * 1024) throw new Error('本地空间不足，请先导出或删除一些录播。');
        if (this.cancelStart) return;
        const tap = this.audio.createRecordingTap(), clock = new RecordingClock(tap.sourceSeconds);
        const id = (this.options.id ?? (() => crypto.randomUUID()))();
        run = { id, tap, clock, backend: null as unknown as RecorderHandle, queue: new RecordingWriteQueue(), seq: 0, chunk: 0, events: [], seen: new Set(), lastVisualMs: -Infinity, bytes: 0, crc: -1, error: null };
        const current = run;
        run.backend = (this.options.recorder ?? createBrowserRecorder)(tap, blob => this.media(current, blob), error => this.fail(current, error));
        const createdAt = (this.options.now ?? Date.now)();
        await this.store.create({ version: RECORDING_VERSION, id, title: `录播 ${new Date(createdAt).toLocaleString('zh-CN', { hour12: false })}`, createdAt, status: 'recording', durationMs: 0, bytes: 0, mimeType: run.backend.mimeType, sampleRate: tap.sampleRate, channels: tap.channels, sourceType: tap.sourceType, mediaStorage: 'indexeddb', lastEventSeq: 0, commentCount: 0, appVersion: 'ss-recording-1', message: null });
        reserved = true; this.run = run;
        if (this.cancelStart) throw new DOMException('Recording cancelled', 'AbortError');
        clock.start(); await run.backend.start();
        if (this.cancelStart || run.error) throw run.error ?? new DOMException('Recording cancelled', 'AbortError');
        this.publish({ status: 'recording', id });
        this.event({ type: 'controls', controls: { ...this.controls } }, 0);
        for (const visible of this.sink.visibleComments?.() ?? []) this.presentation({ type: 'show', comment: visible.comment, durationMs: visible.durationMs ?? visible.remainingMs, elapsedMs: (visible.durationMs ?? visible.remainingMs) - visible.remainingMs }, 0);
        this.timer = setInterval(() => { if (this.run !== current || this.state.status !== 'recording') return; this.flush(current); this.publish({ durationMs: clock.positionMs, bytes: current.bytes, pendingBytes: current.queue.pendingBytes }); }, 250);
      } catch (error) {
        if (run) {
          try { await run.backend?.stop(); } catch { /* original error is preserved */ }
          run.backend?.dispose(); run.tap.dispose();
          try { await run.queue.drain(); } catch { /* retain partial material */ }
          if (reserved) await this.store.finish(run.id, { status: 'interrupted', durationMs: run.clock.stop(), message: '录制在准备阶段结束。' }).catch(() => undefined);
        }
        this.run = null;
        const cancelled = error instanceof DOMException && error.name === 'AbortError';
        this.publish({ status: cancelled ? 'idle' : 'error', message: cancelled ? null : error instanceof Error ? error.message : '录制未能开始。' });
        if (!cancelled) throw error;
      } finally { if (this.cancelStart && !this.run && this.state.status === 'arming') this.publish({ status: 'idle' }); }
    };
    const pending = work().finally(() => { if (this.starting === pending) this.starting = null; });
    this.starting = pending; return pending;
  }
  private media(run: Run, blob: Blob) {
    if (this.run !== run || !blob.size || !['arming', 'recording', 'finalizing'].includes(this.state.status)) return;
    const chunk = run.chunk++;
    void run.queue.enqueue(blob.size, async () => {
      let crc = run.crc; const reader = blob.stream().getReader();
      try { for (;;) { const part = await reader.read(); if (part.done) break; crc = crcUpdate(crc, part.value); } } finally { reader.releaseLock(); }
      await this.store.appendMedia(run.id, chunk, blob); run.bytes += blob.size; run.crc = crc;
    }).catch(error => this.fail(run, error));
  }
  private fail(run: Run, error: Error) {
    if (run.error) return; run.error = error instanceof Error ? error : new Error('录播写入失败。');
    if (this.run !== run) return;
    this.publish({ message: run.error.message });
    if (this.state.status === 'arming') this.cancelStart = true;
    if (this.state.status === 'recording') void this.stop('storage-error');
  }
  private event(data: EventData, atMs?: number) {
    const run = this.run; if (!run || this.state.status !== 'recording') return;
    run.events.push({ ...data, atMs: atMs ?? run.clock.positionMs, seq: ++run.seq } as RecordingEvent);
    if (run.events.length >= 32) this.flush(run);
  }
  private flush(run: Run) {
    if (!run.events.length) return;
    const events = run.events; run.events = [];
    const bytes = JSON.stringify(events).length * 2;
    void run.queue.enqueue(bytes, () => this.store.appendEvents(run.id, events)).catch(error => this.fail(run, error));
  }
  presentation(event: CommentPresentation, atMs?: number) {
    const run = this.run; if (!run || this.state.status !== 'recording') return;
    if (event.type === 'show') {
      if (run.seen.has(event.comment.commentId)) return; run.seen.add(event.comment.commentId);
      this.event({ type: 'comment-show', id: event.comment.commentId, text: event.comment.text, source: event.comment.source, durationMs: Math.max(1, event.durationMs), elapsedMs: event.elapsedMs ?? 0 }, atMs);
    } else if (run.seen.has(event.comment.commentId)) { this.event({ type: 'comment-hide', id: event.comment.commentId }, atMs); run.seen.delete(event.comment.commentId); }
  }
  feedFrame(frame: FeatureFrame) {
    const run = this.run; if (!run || this.state.status !== 'recording') return;
    if (!run.clock.accepts(frame.audioTime)) return;
    const atMs = run.clock.at(frame.audioTime); if (atMs - run.lastVisualMs < 50) return;
    run.lastVisualMs = atMs; this.event({ type: 'visual', values: recordingVisual(frame.values), sampleRate: frame.sampleRate }, atMs);
  }
  stop(reason = 'user'): Promise<RecordingManifest | null> {
    if (this.finishing) return this.finishing;
    if (this.state.status === 'arming') { this.cancelStart = true; return (this.starting ?? Promise.resolve()).then(() => null, () => null); }
    const run = this.run; if (!run) return Promise.resolve(null);
    const normal = ['user', 'file-ended', 'sound-stopped'].includes(reason);
    if (!normal) this.event({ type: 'interruption', reason });
    const durationMs = run.clock.stop(); this.flush(run);
    if (this.timer) clearInterval(this.timer); this.timer = null;
    this.publish({ status: 'finalizing', durationMs });
    const work = async () => {
      try {
        await run.backend.stop(); run.tap.dispose(); await run.queue.drain();
        if (run.error) throw run.error;
        await this.store.finish(run.id, { status: 'finalizing', durationMs });
        const blob = await this.store.media(run.id);
        const verifiedDuration = await (this.options.verifyMedia ?? verifyRecordedMedia)(blob, durationMs);
        const manifest = await this.store.finish(run.id, { status: normal ? 'saved' : 'interrupted', durationMs: verifiedDuration, mediaCrc32: crcResult(run.crc), message: normal ? null : '录制已中断，已保留可播放内容。' });
        this.publish({ status: 'saved', durationMs: manifest.durationMs, bytes: manifest.bytes, pendingBytes: 0, message: manifest.message }); return manifest;
      } catch (error) {
        const message = error instanceof Error ? error.message : '录播保存未完成。';
        await this.store.finish(run.id, { status: 'failed', durationMs, message }).catch(() => undefined);
        this.publish({ status: 'error', bytes: run.bytes, pendingBytes: 0, message }); return null;
      } finally { run.backend.dispose(); run.tap.dispose(); if (this.run === run) this.run = null; }
    };
    const pending = work().finally(() => { if (this.finishing === pending) this.finishing = null; });
    this.finishing = pending; return pending;
  }
  dispose() {
    this.disposed = true;
    void this.stop('dispose').finally(() => { this.store.dispose(); this.listeners.clear(); });
  }
}
