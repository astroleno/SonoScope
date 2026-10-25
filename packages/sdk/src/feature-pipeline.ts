import { FeatureExtractor, makeFrame, summarizeFrames, audioModelProfile, type AudioModelProfile, type FeatureFrame, type FeatureSnapshot, type ModelResult, type AudioValues, type ModelInputMode } from '@sonoscope/core';
import { ModelPcmBuffer } from './model-pcm-buffer';

export interface FeatureWorker {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  terminate(): void;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
}
export type FeatureStatus = { dsp: 'worker' | 'local'; model: 'loading' | 'ready' | 'unavailable'; message: string | null };
export interface FeatureTiming { audioSessionId: string; seq: number; capturedAt: number; readyAt: number; dspComputeMs: number | null; source: 'worker' | 'local' }
export interface ModelTiming { audioSessionId: string; requestId: number; sourceEpoch: number; capturedAt: number; readyAt: number; processingMs: number | null; roundTripMs: number; retainedPcmBytes: number; accepted: boolean; inputMode: ModelInputMode | null }
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
  private modelSampleRate = 0;
  private modelBusy = false;
  private readonly modelProfile: AudioModelProfile;
  private modelBuffer: ModelPcmBuffer | null = null;
  private modelSourceStartedAt = 0;
  private modelEpoch = 0;
  private modelRequestSeq = 0;
  private modelRequest: { id: number; epoch: number; capturedAt: number; startedAt: number; pcmBytes: number } | null = null;
  private status: FeatureStatus = { dsp: 'local', model: 'unavailable', message: null };
  private initTimer: ReturnType<typeof setTimeout> | null = null;
  private dspBootTimer: ReturnType<typeof setTimeout> | null = null;
  private dspTimer: ReturnType<typeof setTimeout> | null = null;
  private modelTimer: ReturnType<typeof setTimeout> | null = null;
  private frameListeners = new Set<(frame: FeatureFrame) => void>();
  private snapshotListeners = new Set<(snapshot: FeatureSnapshot) => void>();
  private statusListeners = new Set<(status: FeatureStatus) => void>();
  private timingListeners = new Set<(timing: FeatureTiming) => void>();
  private modelTimingListeners = new Set<(timing: ModelTiming) => void>();
  private now: () => number;
  constructor(private options: FeaturePipelineOptions = {}) { this.now = options.now ?? Date.now; this.modelProfile = audioModelProfile(options.workerAssets?.modelVersion); }
  onFrame(fn: (f: FeatureFrame) => void) { this.frameListeners.add(fn); return () => { this.frameListeners.delete(fn); }; }
  onSnapshot(fn: (f: FeatureSnapshot) => void) { this.snapshotListeners.add(fn); return () => { this.snapshotListeners.delete(fn); }; }
  onStatus(fn: (s: FeatureStatus) => void) { this.statusListeners.add(fn); fn(this.status); return () => { this.statusListeners.delete(fn); }; }
  onTiming(fn: (timing: FeatureTiming) => void) { this.timingListeners.add(fn); return () => { this.timingListeners.delete(fn); }; }
  onModelTiming(fn: (timing: ModelTiming) => void) { this.modelTimingListeners.add(fn); return () => { this.modelTimingListeners.delete(fn); }; }
  get modelDiagnostics() {
    return { sourceEpoch: this.modelEpoch, inFlight: Number(this.modelBusy), bufferedSamples: this.modelBuffer?.bufferedSamples ?? this.modelSamples,
      retainedPcmBytes: (this.modelBuffer?.retainedPcmBytes ?? this.modelPCM.reduce((sum, pcm) => sum + pcm.byteLength, 0)) + (this.modelRequest?.pcmBytes ?? 0) };
  }
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
    worker.terminate(); this.modelWorker = null; this.modelStage = null; this.modelBusy = false; this.modelRequest = null; this.model = null; this.modelPCM = []; this.modelSamples = 0; this.modelBuffer = null; this.modelSampleRate = 0;
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
          if (msg.type === 'model-result') {
            const request = this.modelRequest;
            if (!request || msg.requestId !== request.id || msg.sourceEpoch !== request.epoch) return;
            const readyAt = this.now(), retainedPcmBytes = this.modelDiagnostics.retainedPcmBytes;
            if (this.modelTimer) clearTimeout(this.modelTimer); this.modelTimer = null; this.modelBusy = false; this.modelRequest = null;
            const age = readyAt - request.capturedAt;
            const accepted = request.epoch === this.modelEpoch && msg.result?.capturedAt === request.capturedAt && msg.result?.version === this.options.workerAssets?.modelVersion && age >= 0 && age <= 3000;
            if (accepted) this.model = msg.result;
            const processingMs = typeof msg.processingMs === 'number' && Number.isFinite(msg.processingMs) && msg.processingMs >= 0 && msg.processingMs <= 5000 ? msg.processingMs : null;
            const inputMode = msg.inputMode === 'raw' || msg.inputMode === 'lowpass-3k' ? msg.inputMode as ModelInputMode : null;
            const timing: ModelTiming = { audioSessionId, requestId: request.id, sourceEpoch: request.epoch, capturedAt: request.capturedAt, readyAt, processingMs, roundTripMs: readyAt - request.startedAt, retainedPcmBytes, accepted, inputMode };
            for (const fn of this.modelTimingListeners) fn(timing);
          }
        };
        worker.onerror = () => this.failModel(worker);
        this.initTimer = setTimeout(() => { if (this.id === audioSessionId && this.status.model === 'loading') this.failModel(worker); }, 15000);
        worker.postMessage({ type: 'init', audioSessionId, ...this.options.workerAssets });
      } catch { if (this.modelWorker) this.failModel(this.modelWorker); else this.setStatus({ ...this.status, model: 'unavailable', message: '声音分类暂不可用；基础音频分析继续工作。' }); }
    }
  }
  feed(pcm: Float32Array, sampleRate: number, audioTime: number, audioSessionId: string, captureTime?: number) {
    if (audioSessionId !== this.id || !this.id || !pcm.length || !Number.isFinite(sampleRate) || sampleRate <= 0) return;
    const capturedAt = typeof captureTime === 'number' && Number.isFinite(captureTime) ? captureTime : this.now(), seq = this.seq++;
    // Capture normally supplies1024 samples. Oversized/irregular adapters must
    // not throw in the FFT or monopolize the main thread. Classification below
    // still receives all genuine source samples on its continuous timeline.
    const dspSize = 2 ** Math.floor(Math.log2(Math.min(4096, pcm.length)));
    const dspPCM = pcm.length === dspSize ? pcm : pcm.subarray(pcm.length - dspSize);
    if (this.modelWorker && pcm.length && sampleRate !== this.modelSampleRate) {
      try {
        if (this.modelSampleRate) {
          this.frames = []; this.lastSnapshotAt = 0; this.extractor = new FeatureExtractor(); this.pending.clear();
          if (this.dspTimer) clearTimeout(this.dspTimer); this.dspTimer = null;
          if (this.worker && this.dspReady) {
            try { this.worker.postMessage({ type: 'reset', audioSessionId }); } catch { this.failDsp(this.worker); }
          }
        }
        this.modelPCM = []; this.modelSamples = 0; this.modelSampleRate = sampleRate; this.model = null; ++this.modelEpoch;
        this.modelSourceStartedAt = capturedAt - pcm.length / sampleRate * 1000;
        this.modelBuffer = this.modelProfile.id === 'mn10-v6' ? new ModelPcmBuffer(sampleRate, this.modelProfile) : null;
        this.modelWorker.postMessage({ type: 'reset-model-evidence', audioSessionId, sourceEpoch: this.modelEpoch });
      } catch { if (this.modelWorker) this.failModel(this.modelWorker); }
    }
    if (this.worker && this.dspReady) {
      // Backpressure bounds the worker mailbox. Dropped capture frames remain explicit in seq.
      if (this.pending.size < 3) {
        // Worker liveness starts at dispatch. Late capture delivery must not
        // consume its service deadline; publish still rejects stale source data.
        const data = dspPCM.slice(); this.pending.set(seq, this.now());
        if (!this.dspTimer) this.watchDsp(this.worker);
        const worker = this.worker;
        try { worker.postMessage({ type: 'pcm', audioSessionId, seq, capturedAt, sampleRate, audioTime, pcm: data }, [data.buffer]); }
        catch { this.failDsp(worker); }
      }
    }
    if (!this.worker || !this.dspReady) {
      const started = performance.now(), values = this.extractor.extract(dspPCM, sampleRate, audioTime);
      this.publish(seq, audioTime, capturedAt, sampleRate, values, performance.now() - started, 'local');
    }
    if (this.modelWorker && pcm.length) {
      try {
        if (this.modelBuffer) {
          this.modelBuffer.append(pcm);
          if (this.status.model === 'ready' && !this.modelBusy) {
            const window = this.modelBuffer.take();
            if (window) this.classify(window.pcm, window.sampleRate, this.modelSourceStartedAt + window.sourceEndTime * 1000, audioSessionId);
          }
          return;
        }
        this.modelPCM.push(pcm.slice()); this.modelSamples += pcm.length;
        const target = Math.ceil(sampleRate * this.modelProfile.windowSamples / this.modelProfile.sampleRate);
        // Continue collecting during inference, bounding the history to two windows.
        while (this.modelSamples > target * 2) {
          const chunk = this.modelPCM.shift()!, take = Math.min(chunk.length, this.modelSamples - target * 2);
          this.modelSamples -= take;
          if (take < chunk.length) this.modelPCM.unshift(chunk.slice(take));
        }
        if (this.status.model === 'ready' && !this.modelBusy && this.modelSamples >= target) {
          const samples = new Float32Array(target); let offset = 0;
          const windowEndAt = capturedAt - (this.modelSamples - target) / sampleRate * 1000;
          for (const chunk of this.modelPCM) {
            const take = Math.min(chunk.length, target - offset); samples.set(chunk.subarray(0, take), offset); offset += take;
            if (offset === target) break;
          }
          // Probe every 0.24s to catch short attacks; keep the full 0.975s context.
          let consume = Math.round(sampleRate * this.modelProfile.hopSamples / this.modelProfile.sampleRate);
          while (consume > 0) {
            const chunk = this.modelPCM.shift()!, take = Math.min(chunk.length, consume);
            consume -= take; this.modelSamples -= take;
            if (take < chunk.length) this.modelPCM.unshift(chunk.slice(take));
          }
          this.classify(samples, sampleRate, windowEndAt, audioSessionId);
        }
      } catch { if (this.modelWorker) this.failModel(this.modelWorker); }
    }
  }
  private classify(pcm: Float32Array, sampleRate: number, capturedAt: number, audioSessionId: string) {
    const worker = this.modelWorker;
    if (!worker || this.modelBusy) return;
    const request = { id: ++this.modelRequestSeq, epoch: this.modelEpoch, capturedAt, startedAt: this.now(), pcmBytes: pcm.byteLength };
    this.modelRequest = request; this.modelBusy = true;
    this.modelTimer = setTimeout(() => this.failModel(worker), 5000);
    try { worker.postMessage({ type: 'classify', audioSessionId, requestId: request.id, sourceEpoch: request.epoch, sampleRate, capturedAt, pcm }, [pcm.buffer]); }
    catch { this.failModel(worker); }
  }
  private publish(seq: number, audioTime: number, capturedAt: number, sampleRate: number, values: AudioValues, processingMs?: number, source: 'worker' | 'local' = 'local') {
    if (!this.id || this.now() - capturedAt > 1000 || (this.frames.length && seq <= this.frames[this.frames.length - 1].seq)) return;
    const model = this.model && capturedAt >= this.model.capturedAt && capturedAt - this.model.capturedAt < 3000 ? this.model : null;
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
  stop() { this.id = null; for (const timer of [this.initTimer, this.dspBootTimer, this.dspTimer, this.modelTimer]) if (timer) clearTimeout(timer); this.initTimer = this.dspBootTimer = this.dspTimer = this.modelTimer = null; this.worker?.terminate(); this.worker = null; this.dspReady = false; this.modelWorker?.terminate(); this.modelWorker = null; this.modelStage = null; this.pending.clear(); this.frames = []; this.model = null; this.modelBusy = false; this.modelRequest = null; this.modelRequestSeq = 0; this.modelEpoch = 0; this.modelSamples = 0; this.modelPCM = []; this.modelBuffer = null; this.modelSampleRate = 0; }
  dispose() { this.stop(); this.frameListeners.clear(); this.snapshotListeners.clear(); this.statusListeners.clear(); this.timingListeners.clear(); this.modelTimingListeners.clear(); }
}
