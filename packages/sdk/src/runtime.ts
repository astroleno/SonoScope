import type { FeatureFrame } from '@sonoscope/core';
import { DanmuController, type CommentSink, type ControllerOptions } from '@sonoscope/danmu-pipeline';
import { AudioSession, browserAudioEnvironment, type AudioEnvironment } from './audio-session';
import { FeaturePipeline, type FeaturePipelineOptions } from './feature-pipeline';
import type { AudioSource } from './types';
import { RuntimeMetrics } from './metrics';

export interface RuntimeOptions extends FeaturePipelineOptions, ControllerOptions { audioEnvironment?: AudioEnvironment; workletUrl?: string; sink: CommentSink }
export class SonoRuntime {
  readonly audio: AudioSession;
  readonly features: FeaturePipeline;
  readonly danmu: DanmuController;
  readonly metrics = new RuntimeMetrics();
  private enabled = true;
  private disposed = false;
  private frame: FeatureFrame | null = null;
  constructor(options: RuntimeOptions) {
    this.audio = new AudioSession(options.audioEnvironment ?? browserAudioEnvironment(options.workletUrl ?? '/audio/capture-worklet.js'));
    this.features = new FeaturePipeline(options); this.danmu = new DanmuController(options.sink, options);
    this.audio.subscribeState(state => {
      if (state.status === 'running' && state.audioSessionId) { this.metrics.reset(state.audioSessionId); this.features.start(state.audioSessionId); if (this.enabled) this.danmu.start(state.audioSessionId); }
      else { this.features.stop(); this.danmu.stop(); this.frame = null; }
    });
    this.audio.onPCM((pcm, rate, time, id) => this.features.feed(pcm, rate, time, id));
    this.features.onTiming(timing => this.metrics.featureReady(timing));
    this.features.onFrame(frame => { this.frame = frame; if (this.enabled) this.danmu.feedFrame(frame); });
    this.features.onSnapshot(snapshot => { if (this.enabled) void this.danmu.feedSnapshot(snapshot); });
    let localRun: string | null = null, aiSnapshot: string | null = null;
    this.danmu.subscribe(state => {
      if (state.danmuRunId !== localRun && state.metrics.localFirstMs !== null) { localRun = state.danmuRunId; this.metrics.comment('local', state.metrics.localFirstMs); }
      if (state.metrics.aiFirstMs !== null && state.metrics.aiFirstSnapshotId !== aiSnapshot) { aiSnapshot = state.metrics.aiFirstSnapshotId; this.metrics.comment('ai', state.metrics.aiFirstMs); }
    });
  }
  start(source?: AudioSource) { if (this.disposed) return Promise.reject(new Error('Runtime disposed')); return this.audio.start(source); }
  stop(reason = 'user') { this.danmu.stop(); this.features.stop(); this.audio.stop(reason); }
  setDanmuEnabled(enabled: boolean) { this.enabled = enabled; const id = this.audio.current.audioSessionId; if (enabled && this.audio.current.status === 'running' && id) this.danmu.start(id); else this.danmu.stop(); }
  setCloudEnabled(enabled: boolean) { this.danmu.setCloudEnabled(enabled); }
  get latestFrame() { return this.frame; }
  dispose() { if (this.disposed) return; this.disposed = true; this.audio.dispose(); this.features.dispose(); this.danmu.dispose(); }
}
