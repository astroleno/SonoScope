import { makeFrame, type CommentCandidate, type RecordingEvent } from '@sonoscope/core';
import { DomCommentSink, ReplayCommentSink } from '@sonoscope/danmu-pipeline';
import { BrowserRecordingStore } from '../../packages/sdk/src/recording-store';
import { RecordingController } from '../../packages/sdk/src/recording-controller';
import { PlaybackController } from '../../packages/sdk/src/playback-controller';
import { exportRecording, restoreRecording } from '../../packages/sdk/src/recording-archive';
import { FeatureExtractor } from '../../packages/core/src/dsp';
import type { RecordingTap } from '../../packages/sdk/src/audio-session';
import { verifyRecordedMedia } from '../../packages/sdk/src/recorder-backend';

const result = document.querySelector<HTMLPreElement>('#result')!, progress = document.querySelector<HTMLElement>('#progress')!;
const button = document.querySelector<HTMLButtonElement>('#run')!, layer = document.querySelector<HTMLDivElement>('#layer')!;
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
function check(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
async function until(test: () => boolean, deadline = 10000) { const start = performance.now(); while (!test()) { if (performance.now() - start > deadline) throw new Error('Integration deadline'); await delay(20); } }
const allEvents = async (store: BrowserRecordingStore, id: string) => { const events: RecordingEvent[] = []; for (;;) { const page = await store.events(id, events.at(-1)?.seq ?? 0); if (!page.length) return events; events.push(...page); } };

button.onclick = async () => {
  button.disabled = true;
  const report: Record<string, unknown> = { startedAt: new Date().toISOString(), userAgent: navigator.userAgent, errors: [], checks: {} };
  const checks = report.checks as Record<string, unknown>, ids: { store: BrowserRecordingStore; id: string }[] = [], controllers: RecordingController[] = [];
  const name = new URL(location.href).searchParams.get('report') ?? 'native-integration-browser';
  report.initialVisibility = document.visibilityState;
  const publish = () => fetch('/__recording-probe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, report }) }).catch(() => undefined);
  report.phase = 'starting'; void publish();
  let context: AudioContext | null = null, oscillator: OscillatorNode | null = null, player: PlaybackController | null = null, replay: ReplayCommentSink | null = null;
  let frames: ReturnType<typeof setInterval> | null = null, shown: ReturnType<typeof setInterval> | null = null, liveWorkers = 0;
  const worker = () => { const native = new Worker(new URL('./recording-storage.worker.js', import.meta.url), { type: 'module' }); ++liveWorkers; const terminate = native.terminate.bind(native); let closed = false; native.terminate = () => { if (!closed) { closed = true; --liveWorkers; } terminate(); }; return native; };
  const primary = new BrowserRecordingStore(undefined, worker), fallback = new BrowserRecordingStore();
  const sink = new DomCommentSink(layer, { top: document.querySelector('header'), bottom: progress });
  const presentations: string[] = [];
  let current: RecordingController | null = null;
  const unsubscribe = sink.subscribePresentation(event => { current?.presentation(event); if (event.type === 'show') presentations.push(event.comment.commentId); });
  try {
    const nativeOnly = new URL(location.href).searchParams.get('nativeOnly') === '1';
    report.nativeOnly = nativeOnly;
    check(nativeOnly || document.visibilityState === 'visible', 'Test page is hidden; activate its window before testing visible presentation');
    context = new AudioContext(); await context.resume();
    const gain = context.createGain(); gain.gain.value = .12; oscillator = context.createOscillator(); oscillator.frequency.value = 440; oscillator.connect(gain); oscillator.start();
    const audio = { createRecordingTap: (): RecordingTap => {
      const ctx = context!, destination = ctx.createMediaStreamDestination(); gain.connect(destination); let closed = false;
      return { stream: destination.stream, sampleRate: ctx.sampleRate, channels: 2, sourceSeconds: () => ctx.currentTime, dispose() { if (closed) return; closed = true; gain.disconnect(destination); destination.disconnect(); destination.stream.getTracks().forEach(track => track.stop()); } };
    } };
    const take = async (store: BrowserRecordingStore) => {
      const id = `qa-${crypto.randomUUID()}`; ids.push({ store, id });
      const controller = new RecordingController(audio, store, sink, { id: () => id, verifyMedia: async (blob, expected) => {
        const probe: Record<string, unknown> = { id, expectedMs: expected, bytes: blob.size, mimeType: blob.type };
        report.mediaProbes ??= [];
        (report.mediaProbes as unknown[]).push(probe);
        try { const duration = await verifyRecordedMedia(blob, expected); probe.durationMs = duration; return duration; }
        catch (error) {
          probe.error = error instanceof Error ? error.message : String(error);
          await fetch(`/__recording-audio/${id}.mp4`, { method: 'POST', body: blob }).catch(() => undefined);
          throw error;
        } finally { void publish(); }
      } }); controllers.push(controller); current = controller; await controller.start(); report.phase = 'recording'; void publish(); return { id, controller };
    };
    const offer = (id: string) => {
      const candidate: CommentCandidate = { commentId: id, audioSessionId: 'qa', danmuRunId: 'qa', snapshotId: id, source: 'local', kind: 'regular', text: `测试标记弹幕 ${id}`, createdAt: Date.now(), expiresAt: Date.now() + 10000 };
      check(sink.show(candidate, { priority: true }), 'Test comment did not fit');
    };
    progress.textContent = '正在录制 22 条真实呈现的标记弹幕…'; offer('carry-in'); await delay(250);
    const first = await take(primary); const extractor = new FeatureExtractor(); let seq = 0, comments = 0;
    const pcm = Float32Array.from({ length: 1024 }, (_, i) => .12 * Math.sin(2 * Math.PI * 440 * i / context!.sampleRate));
    frames = setInterval(() => { const time = context!.currentTime; first.controller.feedFrame(makeFrame('qa', ++seq, time, Date.now(), context!.sampleRate, extractor.extract(pcm, context!.sampleRate, time))); }, 60);
    shown = setInterval(() => { if (comments < 21) offer(`qa-comment-${++comments}`); }, 1000);
    await delay(22500); clearInterval(frames); frames = null; clearInterval(shown); shown = null;
    const manifest = await first.controller.stop(); sink.clear(); current = null;
    check(manifest?.status === 'saved', first.controller.current.message ?? 'Recording did not save');
    const events = await allEvents(primary, first.id), commentsRecorded = events.filter(event => event.type === 'comment-show');
    report.presentation = { offered: comments + 1, displayed: [...presentations], recorded: commentsRecorded.map(event => ({ id: event.id, atMs: event.atMs })), visibility: document.visibilityState, viewport: { width: innerWidth, height: innerHeight } };
    checks.presentation = { pass: commentsRecorded.length === 22, required: 22, recorded: commentsRecorded.length, visible: document.visibilityState === 'visible' };
    if (nativeOnly && commentsRecorded.length !== 22) (report.errors as string[]).push(`Visible presentation not verified: ${commentsRecorded.length}/22; page visibility ${document.visibilityState}`);
    else check(commentsRecorded.length === 22, `Full displayed transcript is incomplete: ${commentsRecorded.length}/22; ${presentations.length} displayed, ${comments + 1} offered`);
    check(commentsRecorded.map(event => event.id).join('|') === presentations.join('|'), 'Displayed and stored comment order differs');
    check(events.every((event, i) => event.seq === i + 1), 'Event sequence has gaps');
    checks.primary = { storage: manifest.mediaStorage, bytes: manifest.bytes, durationMs: manifest.durationMs, commentCount: manifest.commentCount, eventCount: events.length, mimeType: manifest.mimeType };
    report.phase = 'playback'; void publish();
    progress.textContent = '检查原生播放、暂停、向前／向后定位与倍速…';
    replay = new ReplayCommentSink(layer, { top: document.querySelector('header'), bottom: progress }); player = new PlaybackController(primary);
    player.onView(view => { if (view) replay!.render(view.comments, view.atMs); else replay!.clear(); });
    await player.open(first.id); check(player.current.status === 'ready', player.current.message ?? 'Playback did not open');
    const rerun = button.onclick;
    button.textContent = '播放并继续检查'; button.disabled = false;
    report.phase = 'awaiting-playback-gesture'; void publish();
    await new Promise<void>((resolve, reject) => { button.onclick = () => { button.disabled = true; button.onclick = rerun; void player!.play().then(resolve, reject); }; });
    check(player.current.status === 'playing', player.current.message ?? 'Playback did not start');
    await delay(500); player.pause(); check(player.current.positionMs > 0, 'Native media clock did not advance');
    const paused = player.current.positionMs, positions = [...layer.children].map(node => (node as HTMLElement).style.transform);
    await delay(250); check(player.current.positionMs === paused && positions.join() === [...layer.children].map(node => (node as HTMLElement).style.transform).join(), 'Paused media or comments moved');
    player.seek(5000); await until(() => player!.current.status === 'paused'); check(Math.abs(player.current.positionMs - 5000) <= 200, 'Forward seek drifted');
    player.seek(1500); await until(() => player!.current.status === 'paused'); check(Math.abs(player.current.positionMs - 1500) <= 200, 'Backward seek drifted');
    player.setRate(2); await player.play(); check(player.current.status === 'playing', player.current.message ?? 'Rate playback did not start'); const rateStart = player.current.positionMs; await delay(700); player.pause();
    check(player.current.positionMs - rateStart >= 700, 'Double-speed native clock did not advance');
    checks.playback = { pausedMs: paused, forwardMs: 5000, backwardMs: 1500, rate: player.current.rate, rateAdvanceMs: player.current.positionMs - rateStart };
    player.dispose(); player = null; replay.dispose(); replay = null;
    progress.textContent = '检查 ZIP 备份、重复／损坏拒绝及完整恢复…';
    const backup = await exportRecording(primary, first.id);
    try {
      let duplicate = false, damaged = false;
      try { await restoreRecording(primary, backup.blob); } catch { duplicate = true; }
      try { await restoreRecording(primary, backup.blob.slice(0, backup.blob.size - 10)); } catch { damaged = true; }
      check(duplicate && damaged, 'Invalid archive was accepted');
      await primary.remove(first.id); const restored = await restoreRecording(primary, backup.blob);
      check(JSON.stringify(await allEvents(primary, first.id)) === JSON.stringify(events), 'Restored event data differs');
      check(restored.mediaCrc32 === manifest.mediaCrc32 && restored.bytes === manifest.bytes, 'Restored audio differs');
      checks.archive = { duplicateRejected: duplicate, damagedRejected: damaged, bytes: backup.blob.size, restoredCommentCount: restored.commentCount };
    } finally { await backup.dispose(); }
    progress.textContent = '检查 IndexedDB 降级存储…';
    const second = await take(fallback); await delay(650); const secondManifest = await second.controller.stop(); current = null;
    check(secondManifest?.status === 'saved' && secondManifest.mediaStorage === 'indexeddb', 'IndexedDB fallback failed'); checks.fallback = secondManifest;
    progress.textContent = '检查 20 次原生录制启停与资源释放…';
    const lifecycle: unknown[] = [];
    for (let i = 0; i < 20; i++) {
      const cycle = await take(primary); await delay(300); const saved = await cycle.controller.stop(); current = null;
      check(saved?.status === 'saved', cycle.controller.current.message ?? 'Lifecycle recording failed');
      check(liveWorkers === 0, 'Recording worker remained after save'); lifecycle.push({ id: cycle.id, durationMs: saved.durationMs, bytes: saved.bytes });
    }
    checks.lifecycle = { count: lifecycle.length, liveWorkers, takes: lifecycle }; checks.pass = (checks.presentation as { pass: boolean }).pass;
  } catch (error) { (report.errors as string[]).push(error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error)); report.controllerStates = controllers.map(controller => controller.current); }
  finally {
    if (frames) clearInterval(frames); if (shown) clearInterval(shown); unsubscribe(); sink.dispose(); player?.dispose(); replay?.dispose();
    for (const controller of controllers) await controller.stop('test-finish');
    for (const { store, id } of ids) await store.remove(id).catch(error => (report.errors as string[]).push(`Cleanup ${id}: ${String(error)}`));
    for (const controller of controllers) controller.dispose();
    primary.dispose(); fallback.dispose(); oscillator?.stop(); await context?.close(); report.finishedAt = new Date().toISOString(); report.liveWorkersAfterCleanup = liveWorkers;
    (window as unknown as { recordingIntegration: unknown }).recordingIntegration = report; result.textContent = JSON.stringify(report, null, 2); progress.textContent = checks.pass && !(report.errors as string[]).length ? '集成检查通过。' : '检查有未通过项，见结果。'; button.textContent = '运行约 45 秒检查'; button.disabled = false;
    report.phase = 'finished'; await publish();
  }
};
