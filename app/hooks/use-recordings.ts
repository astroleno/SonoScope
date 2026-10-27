'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_RECORDING_CONTROLS, makeFrame, type FeatureFrame, type RecordingControls, type RecordingManifest, type RecordingEvent } from '@sonoscope/core';
import type { SonoRuntime, RecordingState, PlaybackController, PlaybackState, ReplayRenderClock, RuntimeMetrics } from '@sonoscope/sdk';
import type { ReplayCommentSink } from '@sonoscope/danmu-pipeline';

const initialRecording: RecordingState = { status: 'idle', id: null, durationMs: 0, bytes: 0, pendingBytes: 0, message: null };
const initialPlayback: PlaybackState = { status: 'idle', id: null, title: '', positionMs: 0, durationMs: 0, rate: 1, message: null };
type StoredComment = Extract<RecordingEvent, { type: 'comment-show' }>;
export function useRecordings(engine: SonoRuntime | null, container: React.RefObject<HTMLDivElement | null>, reducedMotion: boolean) {
  const [recording, setRecording] = useState(initialRecording), [playback, setPlayback] = useState(initialPlayback);
  const [recordings, setRecordings] = useState<RecordingManifest[]>([]), [controls, setControls] = useState<RecordingControls>(DEFAULT_RECORDING_CONTROLS);
  const [comments, setComments] = useState<StoredComment[]>([]), [hasMoreComments, setHasMoreComments] = useState(false);
  const [message, setMessage] = useState<string | null>(null), [busy, setBusy] = useState<string | null>(null), [supported, setSupported] = useState(false);
  const [revision, setRevision] = useState(0), [metrics, setMetrics] = useState<ReturnType<RuntimeMetrics['snapshot']> | null>(null);
  const player = useRef<PlaybackController | null>(null), renderer = useRef<ReplayCommentSink | null>(null), replayMetrics = useRef<RuntimeMetrics | null>(null);
  const replayFrame = useRef<FeatureFrame | null>(null), clock = useRef<ReplayRenderClock | null>(null);
  const active = useRef(true), busyRef = useRef(false), commentsRef = useRef<StoredComment[]>([]), currentId = useRef<string | null>(null);
  const exports = useRef<{ url: string; dispose(): Promise<void>; timer: ReturnType<typeof setTimeout> }[]>([]);
  const controlsRef = useRef(DEFAULT_RECORDING_CONTROLS), epoch = useRef(0), previousPosition = useRef<number | null>(null);
  const engineRef = useRef(engine), motionRef = useRef(reducedMotion), operation = useRef<AbortController | null>(null);
  useEffect(() => { engineRef.current = engine; motionRef.current = reducedMotion; }, [engine, reducedMotion]);
  const refresh = useCallback(async () => {
    if (!engine) return;
    try { const rows = await engine.recording.store.list(); if (active.current && engineRef.current === engine) setRecordings(rows); }
    catch (error) { if (active.current && engineRef.current === engine) setMessage(error instanceof Error ? error.message : '录播库暂时不可用。'); }
  }, [engine]);
  useEffect(() => {
    active.current = true; if (!engine || !container.current) return;
    let disposed = false; const cleanups: (() => void)[] = [];
    cleanups.push(engine.recording.subscribe(state => { if (disposed) return; setRecording(state); if (state.status === 'saved' || state.status === 'error') void refresh(); }));
    void (async () => {
      const [{ PlaybackController: Player, RuntimeMetrics: Metrics }, { ReplayCommentSink: Sink }] = await Promise.all([import('@sonoscope/sdk/runtime'), import('@sonoscope/danmu-pipeline')]);
      if (disposed || !container.current) return;
      setSupported(typeof MediaRecorder !== 'undefined' && typeof indexedDB !== 'undefined');
      const experience = container.current.parentElement;
      const sink = new Sink(container.current, { top: experience?.querySelector<HTMLElement>('[data-danmu-top-boundary]'), bottom: experience?.querySelector<HTMLElement>('footer') }); renderer.current = sink; sink.setReducedMotion(motionRef.current);
      const p = new Player(engine.recording.store), m = new Metrics(); player.current = p; replayMetrics.current = m;
      let metricId: string | null = null, lastSample = 0;
      cleanups.push(p.subscribe(state => {
        if (disposed) return; setPlayback(state); currentId.current = state.id;
        if (state.id !== metricId) { metricId = state.id; if (state.id) m.reset(`replay_${state.id}`); }
        if (performance.now() - lastSample > 1000) { lastSample = performance.now(); setMetrics(m.snapshot(Date.now())); }
      }));
      cleanups.push(p.onView(view => {
        if (disposed) return;
        if (!view) { replayFrame.current = null; clock.current = null; previousPosition.current = null; sink.clear(); return; }
        const changed = previousPosition.current === null || view.atMs < previousPosition.current || view.atMs - previousPosition.current > 1500;
        if (changed) { ++epoch.current; setRevision(epoch.current); }
        previousPosition.current = view.atMs;
        clock.current = { positionMs: view.atMs, epoch: epoch.current, playing: p.current.status === 'playing', warmup: changed ? view.warmup : clock.current?.warmup ?? [] };
        replayFrame.current = view.visual ? makeFrame(`replay_${p.current.id}`, view.visual.seq, view.atMs / 1000, Date.now(), view.visual.sampleRate, view.visual.values) : null;
        if (Object.keys(view.controls).some(key => view.controls[key as keyof RecordingControls] !== controlsRef.current[key as keyof RecordingControls])) { controlsRef.current = view.controls; setControls(view.controls); }
        sink.setReducedMotion(motionRef.current || view.controls.pausedMotion);
        sink.render(view.comments, view.atMs);
      }));
      await refresh();
    })().catch(error => { if (!disposed) setMessage(error instanceof Error ? error.message : '回看引擎未能加载。'); });
    return () => {
      disposed = true; active.current = false; operation.current?.abort(); operation.current = null; busyRef.current = false; for (const cleanup of cleanups) cleanup(); player.current?.dispose(); player.current = null; renderer.current?.dispose(); renderer.current = null; replayFrame.current = null; clock.current = null;
      for (const output of exports.current) { clearTimeout(output.timer); URL.revokeObjectURL(output.url); void output.dispose().catch(() => undefined); } exports.current = [];
    };
  // Only the engine/container lifetime owns the player; motion changes are applied below.
  }, [engine, container, refresh]);
  useEffect(() => { renderer.current?.setReducedMotion(reducedMotion || controlsRef.current.pausedMotion); }, [reducedMotion]);
  const perform = useCallback(async <T,>(key: string, work: (signal: AbortSignal) => Promise<T>) => {
    if (busyRef.current || !active.current) return;
    const cancellation = new AbortController(); operation.current = cancellation; busyRef.current = true; setBusy(key); setMessage(null);
    try { return await work(cancellation.signal); } catch (error) { if (active.current && !cancellation.signal.aborted) setMessage(error instanceof Error ? error.message : '操作未完成，请重试。'); }
    finally { if (operation.current === cancellation) { operation.current = null; busyRef.current = false; if (active.current) setBusy(null); } }
  }, []);
  const loadComments = useCallback(async (id: string, reset = true) => {
    if (!engine) return;
    const previous = reset ? [] : commentsRef.current, last = previous.at(-1);
    const rows = await engine.recording.store.comments(id, last?.atMs, last?.seq, 50);
    if (currentId.current !== id || !active.current || engineRef.current !== engine) return;
    const next = [...previous, ...rows]; commentsRef.current = next; setComments(next); setHasMoreComments(rows.length === 50);
  }, [engine]);
  const openPlayback = useCallback((id: string) => perform(`open:${id}`, async () => {
    if (!engine || !player.current) return;
    if (['arming', 'recording', 'finalizing'].includes(engine.recording.current.status)) throw new Error('请先停止并保存当前录播，再打开回看。');
    engine.stop(); await player.current.open(id); await loadComments(id);
    return player.current.current.status === 'ready';
  }), [engine, perform, loadComments]);
  const closePlayback = useCallback(() => { player.current?.close(); commentsRef.current = []; setComments([]); setHasMoreComments(false); setMessage(null); }, []);
  const startRecording = useCallback(async () => { if (!engine) return; closePlayback(); try { await engine.recording.start(); } catch { /* Controller publishes the recording error. */ } }, [engine, closePlayback]);
  const finishRecording = useCallback(async () => { await engine?.recording.stop(); await refresh(); }, [engine, refresh]);
  const remove = useCallback((id: string) => perform(`remove:${id}`, async () => { if (!engine) return; if (player.current?.current.id === id) closePlayback(); await engine.recording.store.remove(id); await refresh(); }), [engine, closePlayback, perform, refresh]);
  const backup = useCallback((id: string) => perform(`export:${id}`, async signal => {
    if (!engine) return;
    const { exportRecording } = await import('@sonoscope/sdk/recording-archive'); const output = await exportRecording(engine.recording.store, id, signal);
    if (signal.aborted) { await output.dispose(); return; }
    const url = URL.createObjectURL(output.blob), link = document.createElement('a'); link.href = url; link.download = `SonoScope-${id}.ssrec.zip`; document.body.append(link); link.click(); link.remove();
    const entry = { url, dispose: output.dispose, timer: setTimeout(() => { URL.revokeObjectURL(url); void output.dispose().catch(() => undefined); exports.current = exports.current.filter(item => item !== entry); }, 60000) }; exports.current.push(entry);
    setMessage('备份已交给浏览器下载。请确认文件已保存。');
  }), [engine, perform]);
  const restore = useCallback((file: File) => perform('restore', async signal => { if (!engine) return; const { restoreRecording } = await import('@sonoscope/sdk/recording-archive'); await restoreRecording(engine.recording.store, file, undefined, signal); await refresh(); if (!signal.aborted) setMessage('录播已恢复。'); }), [engine, perform, refresh]);
  const recover = useCallback((id: string) => perform(`recover:${id}`, async signal => { if (!engine) return; const { recoverRecording } = await import('@sonoscope/sdk/recording-archive'); await recoverRecording(engine.recording.store, id, undefined, signal); await refresh(); if (!signal.aborted) setMessage('已生成恢复副本，原始材料仍保留。'); }), [engine, perform, refresh]);
  const setRecordingControls = useCallback((value: RecordingControls) => engine?.recording.setControls(value), [engine]);
  const play = useCallback(() => { void player.current?.play(); }, []), pause = useCallback(() => player.current?.pause(), []);
  const seek = useCallback((position: number) => player.current?.seek(position), []), setRate = useCallback((rate: number) => player.current?.setRate(rate), []);
  const loadMoreComments = useCallback(() => { const id = currentId.current; if (id) void loadComments(id, false).catch(error => setMessage(String(error))); }, [loadComments]);
  const recordReplayRender = useCallback((frame: FeatureFrame | null, at: number) => replayMetrics.current?.rendered(frame, at), []);
  return { recording, recordings, playback, replayFrame, playbackClock: clock, replayControls: controls, replayRevision: revision, replayMetrics: metrics, recordingSupported: supported, recordingMessage: message, recordingBusy: busy, replayComments: comments, hasMoreComments, refreshRecordings: refresh, startRecording, finishRecording, openPlayback, closePlayback, removeRecording: remove, exportRecording: backup, restoreRecording: restore, recoverRecording: recover, setRecordingControls, play, pause, seek, setRate, loadMoreComments, recordReplayRender };
}
