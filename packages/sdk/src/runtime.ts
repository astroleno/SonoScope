import type { FeatureFrame } from '@sonoscope/core';
import { DanmuController, type CommentSink, type ControllerOptions } from '@sonoscope/danmu-pipeline';
import { AudioSession, browserAudioEnvironment, type AudioEnvironment } from './audio-session';
import { FeaturePipeline, type FeaturePipelineOptions } from './feature-pipeline';
import type { AudioSource } from './types';
import { RuntimeMetrics } from './metrics';
import { RecordingController } from './recording-controller';
import { BrowserRecordingStore, type RecordingStore } from './recording-store';
export { PlaybackController } from './playback-controller';
export { RuntimeMetrics } from './metrics';
export { BrowserRecordingStore } from './recording-store';

export interface RuntimeOptions extends FeaturePipelineOptions, ControllerOptions { audioEnvironment?: AudioEnvironment; workletUrl?: string; sink: CommentSink; recordingStore?: RecordingStore; recordingWorkerFactory?: () => Worker }
export class SonoRuntime {
  readonly audio: AudioSession;
  readonly features: FeaturePipeline;
  readonly danmu: DanmuController;
  readonly metrics = new RuntimeMetrics();
  readonly recording: RecordingController;
  private unsubscribePresentation?: () => void;
  private removeLifecycle?: () => void;
  private enabled = true;
  private disposed = false;
  private frame: FeatureFrame | null = null;
  constructor(options: RuntimeOptions) {
    this.audio = new AudioSession(options.audioEnvironment ?? browserAudioEnvironment(options.workletUrl ?? '/audio/capture-worklet.js'), options.now);
    this.features = new FeaturePipeline(options.feedbackMode === 'acoustic' ? { ...options, modelWorkerFactory: undefined, workerAssets: undefined } : options); this.danmu = new DanmuController(options.sink, options);
    this.recording = new RecordingController(this.audio, options.recordingStore ?? new BrowserRecordingStore(undefined, options.recordingWorkerFactory), options.sink);
    this.unsubscribePresentation = options.sink.subscribePresentation?.(event => this.recording.presentation(event));
    this.audio.beforeStop(reason => { void this.recording.stop(reason); });
    if (typeof document !== 'undefined') {
      const hidden = () => { if (document.visibilityState === 'hidden' && this.audio.current.status === 'running') this.stop('page-hidden'); };
      const leaving = () => { if (this.audio.current.status === 'running') this.stop('page-hidden'); };
      document.addEventListener('visibilitychange', hidden); document.addEventListener('freeze', leaving); globalThis.addEventListener?.('pagehide', leaving);
      this.removeLifecycle = () => { document.removeEventListener('visibilitychange', hidden); document.removeEventListener('freeze', leaving); globalThis.removeEventListener?.('pagehide', leaving); };
    }
    this.audio.subscribeState(state => {
      if (state.status === 'running' && state.audioSessionId) { this.metrics.reset(state.audioSessionId); this.features.start(state.audioSessionId); if (this.enabled) this.danmu.start(state.audioSessionId); }
      else { this.features.stop(); this.danmu.stop(); this.frame = null; }
    });
    this.audio.onPCM((pcm, rate, time, id, capturedAt) => this.features.feed(pcm, rate, time, id, capturedAt));
    this.features.onTiming(timing => this.metrics.featureReady(timing));
    this.features.onFrame(frame => { this.frame = frame; this.recording.feedFrame(frame); if (this.enabled) this.danmu.feedFrame(frame); });
    this.features.onSnapshot(snapshot => { if (this.enabled) void this.danmu.feedSnapshot(snapshot); });
    let localRun: string | null = null, aiSnapshot: string | null = null;
    this.danmu.subscribe(state => {
      if (state.danmuRunId !== localRun && state.metrics.localFirstMs !== null) { localRun = state.danmuRunId; this.metrics.comment('local', state.metrics.localFirstMs); }
      if (state.metrics.aiFirstMs !== null && state.metrics.aiFirstSnapshotId !== aiSnapshot) { aiSnapshot = state.metrics.aiFirstSnapshotId; this.metrics.comment('ai', state.metrics.aiFirstMs); }
    });
  }
  start(source?: AudioSource) { if (this.disposed) return Promise.reject(new Error('Runtime disposed')); return this.audio.start(source); }
  stop(reason = 'user') { void this.recording.stop(reason); this.danmu.stop(); this.features.stop(); this.audio.stop(reason); }
  setDanmuEnabled(enabled: boolean) { this.enabled = enabled; const id = this.audio.current.audioSessionId; if (enabled && this.audio.current.status === 'running' && id) this.danmu.start(id); else this.danmu.stop(); }
  setCloudEnabled(enabled: boolean) { this.danmu.setCloudEnabled(enabled); }
  get latestFrame() { return this.frame; }
  dispose() { if (this.disposed) return; this.disposed = true; this.removeLifecycle?.(); this.unsubscribePresentation?.(); this.recording.dispose(); this.audio.dispose(); this.features.dispose(); this.danmu.dispose(); }
}
