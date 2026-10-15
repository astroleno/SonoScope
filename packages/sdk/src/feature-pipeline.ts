import { FeatureExtractor, makeFrame, summarizeFrames, type FeatureFrame, type FeatureSnapshot, type ModelResult, type AudioValues } from '@sonoscope/core';

export interface FeatureWorker {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  terminate(): void;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
}
export type FeatureStatus = { dsp: 'worker' | 'local'; model: 'loading' | 'ready' | 'unavailable'; message: string | null };
export interface FeatureTiming { audioSessionId: string; seq: number; capturedAt: number; readyAt: number; dspComputeMs: number | null; source: 'worker' | 'local' }
export interface FeaturePipelineOptions { workerFactory?: () => FeatureWorker; modelWorkerFactory?: () => FeatureWorker; workerAssets?: { wasmUrl: string; modelUrl: string; modelVersion: string }; now?: () => number }
export class FeaturePipeline {
  private worker: FeatureWorker | null = null;
  private modelWorker: FeatureWorker | null = null;
  private extractor = new FeatureExtractor();
  private frames: FeatureFrame[] = [];
  private seq = 0;
  private id: string | null = null;
  private pending = new Map<number, number>();
  private dspReady = false;
  private modelStage: 'boot' | 'loading' | 'ready' | null = null;
  private lastSnapshotAt = 0;
  private model: ModelResult | null = null;
  private modelPCM: Float32Array[] = [];
  private modelSamples = 0;
  private modelBusy = false;
  private status: FeatureStatus = { dsp: 'local', model: 'unavailable', message: null };
  private initTimer: ReturnType<typeof setTimeout> | null = null;
  private dspBootTimer: ReturnType<typeof setTimeout> | null = null;
  private dspTimer: ReturnType<typeof setTimeout> | null = null;
  private modelTimer: ReturnType<typeof setTimeout> | null = null;
  private frameListeners = new Set<(frame: FeatureFrame) => void>();
  private snapshotListeners = new Set<(snapshot: FeatureSnapshot) => void>();
  private statusListeners = new Set<(status: FeatureStatus) => void>();
  private timingListeners = new Set<(timing: FeatureTiming) => void>();
  private now: () => number;
  constructor(private options: FeaturePipelineOptions = {}) { this.now = options.now ?? Date.now; }
  onFrame(fn: (f: FeatureFrame) => void) { this.frameListeners.add(fn); return () => { this.frameListeners.delete(fn); }; }
  onSnapshot(fn: (f: FeatureSnapshot) => void) { this.snapshotListeners.add(fn); return () => { this.snapshotListeners.delete(fn); }; }
  onStatus(fn: (s: FeatureStatus) => void) { this.statusListeners.add(fn); fn(this.status); return () => { this.statusListeners.delete(fn); }; }
  onTiming(fn: (timing: FeatureTiming) => void) { this.timingListeners.add(fn); return () => { this.timingListeners.delete(fn); }; }
  private setStatus(status: FeatureStatus) { this.status = status; for (const fn of this.statusListeners) fn(status); }
  private failDsp(worker: FeatureWorker) {
    if (this.worker !== worker) return;
    if (this.dspBootTimer) clearTimeout(this.dspBootTimer); this.dspBootTimer = null;
    if (this.dspTimer) clearTimeout(this.dspTimer); this.dspTimer = null;
    if (this.dspReady) this.extractor = new FeatureExtractor();
    worker.terminate(); this.worker = null; this.dspReady = false; this.pending.clear();
    this.setStatus({ ...this.status, dsp: 'local', message: '后台分析不可用，已切换到基础分析。' });
  }
  private watchDsp(worker: FeatureWorker) {
    if (this.dspTimer) clearTimeout(this.dspTimer); this.dspTimer = null;
    const oldest = this.pending.values().next().value;
    if (oldest !== undefined) this.dspTimer = setTimeout(() => this.failDsp(worker), Math.max(0, oldest + 2000 - this.now()));
  }
  private failModel(worker: FeatureWorker) {
    if (this.modelWorker !== worker) return;
    if (this.initTimer) clearTimeout(this.initTimer); this.initTimer = null;
    if (this.modelTimer) clearTimeout(this.modelTimer); this.modelTimer = null;
    worker.terminate(); this.modelWorker = null; this.modelStage = null; this.modelBusy = false; this.model = null; this.modelPCM = []; this.modelSamples = 0;
    this.setStatus({ ...this.status, model: 'unavailable', message: '声音分类暂不可用；基础音频分析继续工作。' });
  }
  start(audioSessionId: string) {
    this.stop(); this.id = audioSessionId; this.extractor = new FeatureExtractor(); this.seq = 0; this.lastSnapshotAt = 0;
    if (this.options.workerFactory) {
      try {
        const worker = this.options.workerFactory(); this.worker = worker;
        this.setStatus({ dsp: 'local', model: this.options.modelWorkerFactory && this.options.workerAssets ? 'loading' : 'unavailable', message: null });
        worker.onmessage = e => {
          const msg = e.data;
          if (this.worker !== worker || msg.audioSessionId !== this.id) return;
          if (msg.type === 'dsp-ready' && !this.dspReady) {
            if (this.dspBootTimer) clearTimeout(this.dspBootTimer); this.dspBootTimer = null;
            this.dspReady = true; this.setStatus({ ...this.status, dsp: 'worker' });
          }
          if (msg.type === 'frame' && this.dspReady && this.pending.has(msg.seq)) {
            this.pending.delete(msg.seq);
            this.watchDsp(worker);
            this.publish(msg.seq, msg.audioTime, msg.capturedAt, msg.sampleRate, msg.values, msg.processingMs, 'worker');
          }
        };
        worker.onerror = () => this.failDsp(worker);
        this.dspBootTimer = setTimeout(() => this.failDsp(worker), 15000);
        worker.postMessage({ type: 'init', audioSessionId });
      } catch { if (this.worker) this.failDsp(this.worker); else this.setStatus({ dsp: 'local', model: 'unavailable', message: '后台分析不可用，已切换到基础分析。' }); }
    } else this.setStatus({ dsp: 'local', model: 'unavailable', message: null });
    if (this.options.modelWorkerFactory && this.options.workerAssets) {
      try {
        const worker = this.options.modelWorkerFactory(); this.modelWorker = worker; this.modelStage = 'boot';
        this.setStatus({ ...this.status, model: 'loading' });
        worker.onmessage = e => {
          const msg = e.data; if (this.modelWorker !== worker || msg.audioSessionId !== this.id) return;
          if (msg.type === 'model-loading' && this.modelStage === 'boot') {
            if (this.initTimer) clearTimeout(this.initTimer);
            this.modelStage = 'loading'; this.initTimer = setTimeout(() => this.failModel(worker), 15000);
          }
          if (msg.type === 'model-ready' && this.modelStage === 'loading') { if (this.initTimer) clearTimeout(this.initTimer); this.initTimer = null; this.modelStage = 'ready'; this.setStatus({ ...this.status, model: 'ready', message: null }); }
          if (msg.type === 'model-error') this.failModel(worker);
          if (msg.type === 'model-result') { if (this.modelTimer) clearTimeout(this.modelTimer); this.modelTimer = null; this.modelBusy = false; if (this.now() - msg.result.capturedAt <= 3000) this.model = msg.result; }
        };
        worker.onerror = () => this.failModel(worker);
        this.initTimer = setTimeout(() => { if (this.id === audioSessionId && this.status.model === 'loading') this.failModel(worker); }, 15000);
        worker.postMessage({ type: 'init', audioSessionId, ...this.options.workerAssets });
      } catch { if (this.modelWorker) this.failModel(this.modelWorker); else this.setStatus({ ...this.status, model: 'unavailable', message: '声音分类暂不可用；基础音频分析继续工作。' }); }
    }
  }
  feed(pcm: Float32Array, sampleRate: number, audioTime: number, audioSessionId: string) {
    if (audioSessionId !== this.id || !this.id) return;
    const capturedAt = this.now(), seq = this.seq++;
    if (this.worker && this.dspReady) {
      // Backpressure bounds the worker mailbox. Dropped capture frames remain explicit in seq.
      if (this.pending.size < 3) {
        const data = pcm.slice(); this.pending.set(seq, capturedAt);
        if (!this.dspTimer) this.watchDsp(this.worker);
        const worker = this.worker;
        try { worker.postMessage({ type: 'pcm', audioSessionId, seq, capturedAt, sampleRate, audioTime, pcm: data }, [data.buffer]); }
        catch { this.failDsp(worker); }
      }
    }
    if (!this.worker || !this.dspReady) {
      const started = performance.now(), values = this.extractor.extract(pcm, sampleRate, audioTime);
      this.publish(seq, audioTime, capturedAt, sampleRate, values, performance.now() - started, 'local');
    }
    if (this.modelWorker && this.status.model === 'ready' && !this.modelBusy) {
        this.modelPCM.push(pcm); this.modelSamples += pcm.length;
        if (this.modelSamples >= sampleRate) {
          const samples = new Float32Array(this.modelSamples); let offset = 0;
          for (const c of this.modelPCM) { samples.set(c, offset); offset += c.length; }
          this.modelPCM = []; this.modelSamples = 0; this.modelBusy = true;
          const worker = this.modelWorker; this.modelTimer = setTimeout(() => this.failModel(worker), 5000);
          try { worker.postMessage({ type: 'classify', audioSessionId, sampleRate, capturedAt, pcm: samples }, [samples.buffer]); }
          catch { this.failModel(worker); }
        }
      }
  }
  private publish(seq: number, audioTime: number, capturedAt: number, sampleRate: number, values: AudioValues, processingMs?: number, source: 'worker' | 'local' = 'local') {
    if (!this.id || this.now() - capturedAt > 1000 || (this.frames.length && seq <= this.frames[this.frames.length - 1].seq)) return;
    const model = this.model && capturedAt - this.model.capturedAt < 3000 ? this.model : null;
    const frame = makeFrame(this.id, seq, audioTime, capturedAt, sampleRate, values, model);
    this.frames.push(frame); this.frames = this.frames.filter(f => capturedAt - f.capturedAt <= 2200).slice(-120);
    const timing: FeatureTiming = { audioSessionId: this.id, seq, capturedAt, readyAt: this.now(), dspComputeMs: typeof processingMs === 'number' && Number.isFinite(processingMs) && processingMs >= 0 && processingMs <= 2000 ? processingMs : null, source };
    for (const fn of this.timingListeners) fn(timing);
    for (const fn of this.frameListeners) fn(frame);
    if (!this.lastSnapshotAt) this.lastSnapshotAt = capturedAt;
    if (capturedAt - this.lastSnapshotAt >= 2000) {
      const snapshot = summarizeFrames(this.frames, `${this.id}_${seq}`); this.lastSnapshotAt = capturedAt;
      if (snapshot) for (const fn of this.snapshotListeners) fn(snapshot);
    }
  }
  stop() { this.id = null; for (const timer of [this.initTimer, this.dspBootTimer, this.dspTimer, this.modelTimer]) if (timer) clearTimeout(timer); this.initTimer = this.dspBootTimer = this.dspTimer = this.modelTimer = null; this.worker?.terminate(); this.worker = null; this.dspReady = false; this.modelWorker?.terminate(); this.modelWorker = null; this.modelStage = null; this.pending.clear(); this.frames = []; this.model = null; this.modelBusy = false; this.modelSamples = 0; this.modelPCM = []; }
  dispose() { this.stop(); this.frameListeners.clear(); this.snapshotListeners.clear(); this.statusListeners.clear(); this.timingListeners.clear(); }
}
