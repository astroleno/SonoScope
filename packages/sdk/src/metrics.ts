import type { FeatureFrame } from '@sonoscope/core';
import type { FeatureTiming } from './feature-pipeline';
/** Bounded observations, measured at actual canvas draw and comment display callbacks. */
export class RuntimeMetrics {
  private audioId: string | null = null;
  private latencies = new Uint32Array(2002);
  private latencyCount = 0;
  private dsp = new Uint32Array(2002);
  private delivery = new Uint32Array(2002);
  private main = new Uint32Array(2002);
  private featureCount = 0;
  private dspCount = 0;
  private mainCount = 0;
  private latestReady: FeatureTiming | null = null;
  private windows: { second: number; frames: number }[] = [];
  private lastSeq = -1;
  private local: number[] = [];
  private ai: number[] = [];
  reset(audioId: string) { this.audioId = audioId; for (const histogram of [this.latencies, this.dsp, this.delivery, this.main]) histogram.fill(0); this.latencyCount = this.featureCount = this.dspCount = this.mainCount = 0; this.latestReady = null; this.windows = []; this.local = []; this.ai = []; this.lastSeq = -1; }
  private observe(histogram: Uint32Array, ms: number) { histogram[Math.min(2001, Math.max(0, Math.ceil(ms)))]++; }
  featureReady(timing: FeatureTiming) {
    if (timing.audioSessionId !== this.audioId) return;
    this.latestReady = timing; this.observe(this.delivery, timing.readyAt - timing.capturedAt); this.featureCount++;
    if (timing.dspComputeMs !== null) { this.observe(this.dsp, timing.dspComputeMs); this.dspCount++; }
  }
  rendered(frame: FeatureFrame | null, at: number) {
    if (!frame || frame.audioSessionId !== this.audioId) return;
    const second = Math.floor(at / 1000), last = this.windows.at(-1);
    if (last?.second === second) last.frames++;
    else {
      if (last) for (let s = Math.max(last.second + 1, second - 2000); s < second; s++) this.windows.push({ second: s, frames: 0 });
      this.windows.push({ second, frames: 1 }); this.windows = this.windows.slice(-2000);
    }
    if (frame.seq !== this.lastSeq) {
      this.lastSeq = frame.seq; this.observe(this.latencies, at - frame.capturedAt); this.latencyCount++;
      if (this.latestReady?.seq === frame.seq) { this.observe(this.main, at - this.latestReady.readyAt); this.mainCount++; }
    }
  }
  comment(source: 'local' | 'ai', ms: number) { const samples = source === 'local' ? this.local : this.ai; samples.push(ms); if (samples.length > 512) samples.shift(); }
  snapshot(at?: number) {
    const percentile = (values: number[], p: number) => { if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b); return sorted[Math.ceil(sorted.length * p) - 1]; };
    const observations = [...this.windows], last = observations.at(-1);
    if (last && at !== undefined && Number.isFinite(at)) {
      const second = Math.floor(at / 1000);
      for (let s = Math.max(last.second + 1, second - 2000); s <= second; s++) observations.push({ second: s, frames: 0 });
    }
    const windows = observations.slice(-2000).slice(1, -1); // discard partial boundary seconds, including a still-incomplete current second
    const p95 = (histogram: Uint32Array, count: number) => {
      if (!count) return null;
      let accumulated = 0;
      for (let ms = 0; ms < histogram.length; ms++) { accumulated += histogram[ms]; if (accumulated >= Math.ceil(count * .95)) return ms; }
      return null;
    };
    return { audioSessionId: this.audioId, observedSeconds: windows.length, visualSamples: this.latencyCount, visualP95Ms: p95(this.latencies, this.latencyCount), featureSamples: this.featureCount, dspComputeP95Ms: p95(this.dsp, this.dspCount), captureToFeatureP95Ms: p95(this.delivery, this.featureCount), featureToDrawP95Ms: p95(this.main, this.mainCount), dspMode: this.latestReady?.source ?? null, desktopFpsPassRate: windows.length ? windows.filter(w => w.frames >= 45).length / windows.length : null, mobileFpsPassRate: windows.length ? windows.filter(w => w.frames >= 30).length / windows.length : null, fpsMedian: percentile(windows.map(w => w.frames), .5), localFirstP95Ms: percentile(this.local, .95), aiFirstP95Ms: percentile(this.ai, .95) };
  }
}
