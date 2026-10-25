import type { RecordingTap } from './audio-session';

export const RECORDING_MIME_CANDIDATES = ['audio/mp4;codecs=mp4a.40.2', 'audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'];
export interface RecorderHandle { mimeType: string; start(): Promise<void>; stop(): Promise<void>; dispose(): void }
export type RecorderFactory = (tap: RecordingTap, data: (blob: Blob) => void, failed: (error: Error) => void) => RecorderHandle;
export function createBrowserRecorder(tap: RecordingTap, data: (blob: Blob) => void, failed: (error: Error) => void, Recorder = globalThis.MediaRecorder): RecorderHandle {
  if (!Recorder) throw new Error('这个浏览器暂不支持录制，请使用支持录音的 Safari、Chrome 或 Edge。');
  let recorder: MediaRecorder | null = null;
  for (const mimeType of RECORDING_MIME_CANDIDATES) {
    try { if (Recorder.isTypeSupported(mimeType)) { recorder = new Recorder(tap.stream, { mimeType, audioBitsPerSecond: tap.channels === 1 ? 96000 : 128000 }); break; } } catch { /* Try the next native format. */ }
  }
  if (!recorder) throw new Error('这个浏览器没有可用的录音格式。');
  const native = recorder;
  let started = false, finished = false, stopPromise: Promise<void> | null = null;
  let startTimer: ReturnType<typeof setTimeout> | undefined, startReject: ((error: Error) => void) | undefined;
  let finishResolve: (() => void) | undefined, finishReject: ((error: Error) => void) | undefined;
  native.ondataavailable = event => { if (event.data.size) data(event.data); };
  native.onerror = event => { const error = (event as Event & { error?: Error }).error ?? new Error('声音录制中断。'); clearTimeout(startTimer); startReject?.(error); startReject = undefined; failed(error); finishReject?.(error); };
  native.onstop = () => { finished = true; finishResolve?.(); };
  return {
    mimeType: native.mimeType,
    start: () => new Promise<void>((resolve, reject) => {
      startReject = reject; startTimer = setTimeout(() => { startReject = undefined; reject(new Error('录音启动超时。')); }, 5000);
      native.onstart = () => { started = true; clearTimeout(startTimer); startReject = undefined; resolve(); };
      try { native.start(1000); } catch (error) { clearTimeout(startTimer); startReject = undefined; reject(error); }
    }),
    stop: () => {
      if (stopPromise) return stopPromise;
      stopPromise = new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => { finishResolve = undefined; finishReject = undefined; reject(new Error('录音收尾超时，已保存的材料仍会保留。')); }, 10000);
        finishResolve = () => { clearTimeout(timer); resolve(); }; finishReject = error => { clearTimeout(timer); reject(error); };
        if (finished || native.state === 'inactive' && !started) { finishResolve(); return; }
        try { if (native.state !== 'inactive') native.stop(); } catch (error) { clearTimeout(timer); reject(error); }
      });
      tap.finalizeAfter?.(stopPromise);
      return stopPromise;
    },
    dispose: () => { clearTimeout(startTimer); startReject?.(new DOMException('Recording cancelled', 'AbortError')); startReject = undefined; native.ondataavailable = null; native.onerror = null; native.onstart = null; native.onstop = null; if (native.state !== 'inactive') native.stop(); tap.dispose(); }
  };
}

/** Validate a file through the native player; never decode a long recording into PCM. */
export function verifyRecordedMedia(blob: Blob, expectedDurationMs?: number): Promise<number> {
  if (!blob.size) return Promise.reject(new Error('没有录到可保存的声音。'));
  return new Promise((resolve, reject) => {
    const audio = new Audio(), url = URL.createObjectURL(blob);
    let seeking = false;
    const timer = setTimeout(() => finish(new Error('这段录音暂时无法读取或定位，材料已保留。')), 10000);
    const finish = (error?: Error) => {
      clearTimeout(timer); const durationMs = audio.duration * 1000;
      audio.onloadedmetadata = null; audio.onseeked = null; audio.onerror = null; audio.removeAttribute('src'); audio.load(); URL.revokeObjectURL(url);
      if (error) reject(error); else resolve(durationMs);
    };
    audio.onerror = () => finish(new Error('这段录音暂时无法播放，材料已保留。'));
    audio.onloadedmetadata = () => {
      if (!Number.isFinite(audio.duration)) { seeking = true; audio.currentTime = Math.max(1e7, (expectedDurationMs ?? 0) / 1000 + 100); }
      else if (audio.duration > .05) { seeking = true; audio.currentTime = audio.duration / 2; }
      else finish(new Error('录音过短，无法保存完整会话。'));
    };
    audio.onseeked = () => {
      if (!seeking) return;
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) finish(new Error('这个录音格式暂不支持回看定位。'));
      else if (expectedDurationMs !== undefined && Math.abs(audio.duration * 1000 - expectedDurationMs) > 200) finish(new Error('录音与时间线发生偏移，已保留为中断材料。'));
      else finish();
    };
    audio.preload = 'metadata'; audio.src = url;
  });
}
