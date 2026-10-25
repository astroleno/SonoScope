import { afterEach, describe, expect, it, vi } from 'vitest';
import { FeaturePipeline, type FeatureWorker } from '../../packages/sdk/src/feature-pipeline';
import { frame } from './fixtures';
import { MN10_MODEL_VERSION } from '@sonoscope/core';

const assets = { wasmUrl: '/vendor/wasm', modelUrl: '/model/yamnet.tflite', modelVersion: 'yamnet-1' };
function worker() { return { postMessage: vi.fn(), terminate: vi.fn(), onmessage: null, onerror: null } as FeatureWorker & { postMessage: ReturnType<typeof vi.fn>; terminate: ReturnType<typeof vi.fn> }; }
function send(w: FeatureWorker, type: string, rest: object = {}) {
  const sent = (w.postMessage as ReturnType<typeof vi.fn>).mock.calls.filter(([m]) => m.type === 'classify').at(-1)?.[0];
  w.onmessage!({ data: { type, audioSessionId: 'audio', ...(type === 'model-result' && sent ? { requestId: sent.requestId, sourceEpoch: sent.sourceEpoch } : {}), ...rest } } as MessageEvent);
}
const pcm = () => new Float32Array(1024).fill(.1);
afterEach(() => vi.useRealTimers());

describe('worker readiness and bounded processing', () => {
  it.each([16000, 44100, 48000])('sends complete non-padded model windows at %s Hz without losing the remainder', rate => {
    vi.useFakeTimers(); const w = worker(), pipeline = new FeaturePipeline({ modelWorkerFactory: () => w, workerAssets: assets });
    try {
      pipeline.start('audio'); send(w, 'model-loading');
      for (let i = 0; i < Math.ceil(rate / 1024); i++) pipeline.feed(new Float32Array(1024).fill(i), rate, i * 1024 / rate, 'audio');
      expect(w.postMessage.mock.calls.filter(([m]) => m.type === 'classify')).toHaveLength(0);
      send(w, 'model-ready'); pipeline.feed(new Float32Array(1024).fill(100), rate, 1.1, 'audio');
      const first = w.postMessage.mock.calls.at(-1)![0];
      expect(first.type).toBe('classify'); expect(first.pcm.length).toBe(Math.ceil(rate * .975));
      const overlapValue = first.pcm[Math.round(rate * .24)];
      send(w, 'model-result', { result: { capturedAt: Date.now(), categories: [], voiceProbability: 0, instrument: null } });
      for (let i = 0; i < Math.ceil(rate / 1024); i++) pipeline.feed(new Float32Array(1024).fill(200 + i), rate, 1.2 + i * 1024 / rate, 'audio');
      const next = w.postMessage.mock.calls.filter(([m]) => m.type === 'classify')[1][0];
      expect(next.pcm.length).toBe(first.pcm.length); expect(next.pcm[0]).toBe(overlapValue);
      expect(next.capturedAt).toBeLessThanOrEqual(Date.now());
    } finally { pipeline.dispose(); expect(vi.getTimerCount()).toBe(0); }
  });
  it('bounds PCM accumulated behind an in-flight classification and keeps the capture timestamp truthful', () => {
    vi.useFakeTimers(); const w = worker(), pipeline = new FeaturePipeline({ modelWorkerFactory: () => w, workerAssets: assets });
    try {
      pipeline.start('audio'); send(w, 'model-loading'); send(w, 'model-ready');
      for (let i = 0; i < 80; i++) pipeline.feed(new Float32Array(1024).fill(i), 16000, i * .064, 'audio');
      expect(w.postMessage.mock.calls.filter(([m]) => m.type === 'classify')).toHaveLength(1);
      send(w, 'model-result', { result: { capturedAt: Date.now(), categories: [], voiceProbability: 0, instrument: null } });
      pipeline.feed(pcm(), 16000, 5.2, 'audio');
      const next = w.postMessage.mock.calls.filter(([m]) => m.type === 'classify')[1][0];
      expect(next.pcm[0]).toBeGreaterThan(40); expect(next.pcm.length).toBe(15600);
      expect(Date.now() - next.capturedAt).toBeGreaterThan(0); expect(Date.now() - next.capturedAt).toBeLessThan(1000);
    } finally { pipeline.dispose(); }
  });
  it('produces local frames during cold script loading and switches only after the DSP handshake', async () => {
    vi.useFakeTimers(); const w = worker(), pipeline = new FeaturePipeline({ workerFactory: () => w }), timing = vi.fn();
    pipeline.onTiming(timing);
    try {
      pipeline.start('audio'); pipeline.feed(pcm(), 44100, 0, 'audio');
      await vi.advanceTimersByTimeAsync(3500); pipeline.feed(pcm(), 44100, 3.5, 'audio');
      expect(timing.mock.calls.map(([t]) => t.source)).toEqual(['local', 'local']); expect(w.terminate).not.toHaveBeenCalled();
      expect(w.postMessage.mock.calls.map(([m]) => m.type)).toEqual(['init']);
      send(w, 'dsp-ready'); pipeline.feed(pcm(), 44100, 3.6, 'audio');
      const message = w.postMessage.mock.calls.at(-1)![0]; expect(message.type).toBe('pcm');
      send(w, 'frame', { ...message, type: 'frame', values: frame().values, processingMs: 2 });
      expect(timing.mock.calls.at(-1)![0].source).toBe('worker');
    } finally { pipeline.dispose(); expect(vi.getTimerCount()).toBe(0); }
  });
  it('terminates a DSP script that never becomes ready while local feedback continues', async () => {
    vi.useFakeTimers(); const w = worker(), pipeline = new FeaturePipeline({ workerFactory: () => w }), listener = vi.fn(); pipeline.onFrame(listener);
    try {
      pipeline.start('audio'); await vi.advanceTimersByTimeAsync(15000); expect(w.terminate).toHaveBeenCalledOnce();
      send(w, 'dsp-ready'); pipeline.feed(pcm(), 44100, 15, 'audio');
      expect(listener).toHaveBeenCalledOnce(); expect(w.postMessage).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
    } finally { pipeline.dispose(); }
  });
  it('a newer DSP result cannot extend the deadline of an older stuck frame', async () => {
    vi.useFakeTimers(); const w = worker(), pipeline = new FeaturePipeline({ workerFactory: () => w });
    try {
      pipeline.start('audio'); send(w, 'dsp-ready'); pipeline.feed(pcm(), 44100, 0, 'audio');
      await vi.advanceTimersByTimeAsync(1000); pipeline.feed(pcm(), 44100, 1, 'audio');
      const newer = w.postMessage.mock.calls.at(-1)![0];
      await vi.advanceTimersByTimeAsync(500); send(w, 'frame', { ...newer, type: 'frame', values: frame().values });
      await vi.advanceTimersByTimeAsync(500); expect(w.terminate).toHaveBeenCalledOnce();
    } finally { pipeline.dispose(); expect(vi.getTimerCount()).toBe(0); }
  });
  it('times DSP service from dispatch while keeping late source frames stale', async () => {
    vi.useFakeTimers(); const w = worker(), frames = vi.fn(), pipeline = new FeaturePipeline({ workerFactory: () => w }); pipeline.onFrame(frames);
    try {
      pipeline.start('audio'); send(w, 'dsp-ready');
      const oldCapture = Date.now() - 3000;
      pipeline.feed(pcm(), 44100, 0, 'audio', oldCapture);
      const late = w.postMessage.mock.calls.at(-1)![0];
      expect(late.capturedAt).toBe(oldCapture);
      await vi.advanceTimersByTimeAsync(20);
      expect(w.terminate).not.toHaveBeenCalled();
      send(w, 'frame', { ...late, type: 'frame', values: frame().values, processingMs: 20 });
      expect(frames).not.toHaveBeenCalled();
      pipeline.feed(pcm(), 44100, 3.02, 'audio', Date.now());
      const fresh = w.postMessage.mock.calls.at(-1)![0];
      await vi.advanceTimersByTimeAsync(20);
      send(w, 'frame', { ...fresh, type: 'frame', values: frame().values, processingMs: 20 });
      expect(frames).toHaveBeenCalledOnce(); expect(frames.mock.calls[0][0].capturedAt).toBe(fresh.capturedAt);
      expect(w.terminate).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
    } finally { pipeline.dispose(); }
  });
  it('gives model assets their own bounded phase after a delayed worker boot', async () => {
    vi.useFakeTimers(); const w = worker(), pipeline = new FeaturePipeline({ modelWorkerFactory: () => w, workerAssets: assets }), status = vi.fn(); pipeline.onStatus(status);
    try {
      pipeline.start('audio'); await vi.advanceTimersByTimeAsync(14000); send(w, 'model-loading');
      await vi.advanceTimersByTimeAsync(14000); expect(w.terminate).not.toHaveBeenCalled(); send(w, 'model-ready');
      expect(status.mock.calls.at(-1)![0].model).toBe('ready'); expect(vi.getTimerCount()).toBe(0);
    } finally { pipeline.dispose(); }
  });
  it('an unbooted model worker cannot skip its handshake or wait indefinitely', async () => {
    vi.useFakeTimers(); const w = worker(), pipeline = new FeaturePipeline({ modelWorkerFactory: () => w, workerAssets: assets }), status = vi.fn(); pipeline.onStatus(status);
    try {
      pipeline.start('audio'); send(w, 'model-ready'); expect(status.mock.calls.at(-1)![0].model).toBe('loading');
      await vi.advanceTimersByTimeAsync(15000); expect(w.terminate).toHaveBeenCalledOnce(); expect(status.mock.calls.at(-1)![0].model).toBe('unavailable'); expect(vi.getTimerCount()).toBe(0);
    } finally { pipeline.dispose(); }
  });
  it('keeps the separate five-second inference deadline after model readiness', async () => {
    vi.useFakeTimers(); const w = worker(), pipeline = new FeaturePipeline({ modelWorkerFactory: () => w, workerAssets: assets });
    try {
      pipeline.start('audio'); send(w, 'model-loading'); send(w, 'model-ready'); for (let i = 0; i < 16; i++) pipeline.feed(pcm(), 16000, i * 1024 / 16000, 'audio');
      expect(w.postMessage.mock.calls.at(-1)![0].type).toBe('classify'); await vi.advanceTimersByTimeAsync(5000);
      expect(w.terminate).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
    } finally { pipeline.dispose(); }
  });
  it('bounds the DSP mailbox at three and ignores replies for tasks that were never sent', async () => {
    vi.useFakeTimers(); const w = worker(), pipeline = new FeaturePipeline({ workerFactory: () => w });
    try {
      pipeline.start('audio'); send(w, 'dsp-ready'); for (let i = 0; i < 20; i++) pipeline.feed(pcm(), 44100, i / 43, 'audio');
      expect(w.postMessage.mock.calls.filter(([m]) => m.type === 'pcm')).toHaveLength(3);
      await vi.advanceTimersByTimeAsync(1000); send(w, 'frame', { seq: 999, capturedAt: Date.now(), values: frame().values });
      await vi.advanceTimersByTimeAsync(1000); expect(w.terminate).toHaveBeenCalledOnce();
    } finally { pipeline.dispose(); expect(vi.getTimerCount()).toBe(0); }
  });
  it('duplicate loading messages cannot keep a stalled model alive', async () => {
    vi.useFakeTimers(); const w = worker(), pipeline = new FeaturePipeline({ modelWorkerFactory: () => w, workerAssets: assets }), status = vi.fn(); pipeline.onStatus(status);
    try {
      pipeline.start('audio'); send(w, 'model-loading'); await vi.advanceTimersByTimeAsync(14000); send(w, 'model-loading');
      await vi.advanceTimersByTimeAsync(1000); expect(w.terminate).toHaveBeenCalledOnce(); send(w, 'model-ready');
      expect(status.mock.calls.at(-1)![0].model).toBe('unavailable'); expect(vi.getTimerCount()).toBe(0);
    } finally { pipeline.dispose(); }
  });
  it('stop during model boot or asset loading clears deadlines and rejects late ready messages', async () => {
    vi.useFakeTimers(); const workers: FeatureWorker[] = [], status = vi.fn();
    const pipeline = new FeaturePipeline({ modelWorkerFactory: () => { const w = worker(); workers.push(w); return w; }, workerAssets: assets }); pipeline.onStatus(status);
    try {
      pipeline.start('old'); const old = workers[0].onmessage!; pipeline.start('audio');
      old({ data: { type: 'model-loading', audioSessionId: 'old' } } as MessageEvent);
      send(workers[1], 'model-loading'); pipeline.stop(); const count = status.mock.calls.length;
      send(workers[1], 'model-ready'); await vi.advanceTimersByTimeAsync(30000);
      expect(status).toHaveBeenCalledTimes(count); expect(vi.getTimerCount()).toBe(0);
      expect(workers.every(w => (w.terminate as ReturnType<typeof vi.fn>).mock.calls.length === 1)).toBe(true);
    } finally { pipeline.dispose(); }
  });
  it('releases workers and deadlines when initialization messages fail', () => {
    vi.useFakeTimers(); const dsp = worker(), model = worker(); dsp.postMessage.mockImplementation(() => { throw new Error('closed'); }); model.postMessage.mockImplementation(() => { throw new Error('closed'); });
    const pipeline = new FeaturePipeline({ workerFactory: () => dsp, modelWorkerFactory: () => model, workerAssets: assets });
    try {
      expect(() => pipeline.start('audio')).not.toThrow(); expect(dsp.terminate).toHaveBeenCalledOnce(); expect(model.terminate).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
    } finally { pipeline.dispose(); }
  });
  it('a failed PCM transfer falls back for that same frame instead of throwing into capture', () => {
    vi.useFakeTimers(); const w = worker(), pipeline = new FeaturePipeline({ workerFactory: () => w }), frames = vi.fn(); pipeline.onFrame(frames);
    try {
      pipeline.start('audio'); send(w, 'dsp-ready'); w.postMessage.mockImplementation(() => { throw new Error('closed'); });
      expect(() => pipeline.feed(pcm(), 44100, 0, 'audio')).not.toThrow(); expect(frames).toHaveBeenCalledOnce(); expect(w.terminate).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
    } finally { pipeline.dispose(); }
  });
  it('fallback after worker processing does not compare new audio with stale startup spectrum', () => {
    vi.useFakeTimers(); const w = worker(), pipeline = new FeaturePipeline({ workerFactory: () => w }), frames = vi.fn(); pipeline.onFrame(frames);
    try {
      pipeline.start('audio'); pipeline.feed(Float32Array.from({ length: 1024 }, (_, i) => .2 * Math.sin(2 * Math.PI * 440 * i / 44100)), 44100, 0, 'audio');
      send(w, 'dsp-ready'); w.onerror!({} as ErrorEvent);
      pipeline.feed(Float32Array.from({ length: 1024 }, (_, i) => .2 * Math.sin(2 * Math.PI * 2000 * i / 44100)), 44100, 10, 'audio');
      expect(frames.mock.calls.at(-1)![0].values.flux).toBe(0); expect(frames.mock.calls.at(-1)![0].values.tempo).toBeNull();
    } finally { pipeline.dispose(); }
  });
});

describe('mn10 continuous input and result ownership', () => {
  const mn10 = { ...assets, modelVersion: MN10_MODEL_VERSION };
  function response(w: ReturnType<typeof worker>, request: { requestId: number; sourceEpoch: number; capturedAt: number }, instrument = { label: 'Guitar', confidence: .14 }) {
    send(w, 'model-result', { requestId: request.requestId, sourceEpoch: request.sourceEpoch, processingMs: 35,
      result: { version: MN10_MODEL_VERSION, capturedAt: request.capturedAt, categories: [{ label: 'Music', score: .95 }], voiceProbability: 0, instrument } });
  }
  it('sends genuine 32k windows on a stable400ms sample timeline and records actual memory', () => {
    vi.useFakeTimers(); let now = 2000; const w = worker(), timing = vi.fn();
    const pipeline = new FeaturePipeline({ modelWorkerFactory: () => w, workerAssets: mn10, now: () => now }); pipeline.onModelTiming(timing);
    try {
      pipeline.start('audio'); send(w, 'model-loading'); send(w, 'model-ready');
      pipeline.feed(new Float32Array(64000).fill(.2), 32000, 2, 'audio');
      const first = w.postMessage.mock.calls.at(-1)![0]; expect(first.pcm.length).toBe(64000); expect(first.sampleRate).toBe(32000); expect(first.capturedAt).toBe(2000);
      now = 2035; response(w, first); expect(timing.mock.calls[0][0]).toMatchObject({ accepted: true, processingMs: 35, roundTripMs: 35 });
      expect(timing.mock.calls[0][0].retainedPcmBytes).toBeLessThan(1024 ** 2);
      now = 2417; pipeline.feed(new Float32Array(12800).fill(.2), 32000, 2.4, 'audio');
      const next = w.postMessage.mock.calls.at(-1)![0]; expect(next.capturedAt - first.capturedAt).toBe(400);
      expect(next.pcm.subarray(0, 51200)).toEqual(first.pcm.subarray(12800));
    } finally { pipeline.dispose(); expect(vi.getTimerCount()).toBe(0); }
  });
  it('rate changes drain one old request without admitting it or allowing its duplicate to free a new one', () => {
    vi.useFakeTimers(); let now = 2000; const w = worker(), timing = vi.fn(), frames = vi.fn();
    const pipeline = new FeaturePipeline({ modelWorkerFactory: () => w, workerAssets: mn10, now: () => now }); pipeline.onModelTiming(timing); pipeline.onFrame(frames);
    try {
      pipeline.start('audio'); send(w, 'model-loading'); send(w, 'model-ready'); pipeline.feed(new Float32Array(64000).fill(.2), 32000, 2, 'audio');
      const old = w.postMessage.mock.calls.at(-1)![0]; now = 4000;
      pipeline.feed(new Float32Array(96000).fill(.2), 48000, 4, 'audio');
      expect(w.postMessage.mock.calls.filter(([m]) => m.type === 'classify')).toHaveLength(1);
      response(w, old); expect(timing.mock.calls.at(-1)![0].accepted).toBe(false); expect(pipeline.modelDiagnostics.inFlight).toBe(0);
      now = 4022; pipeline.feed(new Float32Array(1024).fill(.2), 48000, 4.022, 'audio');
      const current = w.postMessage.mock.calls.at(-1)![0]; expect(current.type).toBe('classify'); expect(current.sourceEpoch).not.toBe(old.sourceEpoch);
      response(w, old); expect(pipeline.modelDiagnostics.inFlight).toBe(1); expect(timing).toHaveBeenCalledOnce();
      now = 4057; response(w, current); expect(pipeline.modelDiagnostics.inFlight).toBe(0); expect(timing.mock.calls.at(-1)![0].accepted).toBe(true);
      now = 4100; pipeline.feed(new Float32Array(1024).fill(.2), 48000, 4.1, 'audio');
      expect(frames.mock.calls.at(-1)![0].model?.instrument?.label).toBe('Guitar');
    } finally { pipeline.dispose(); expect(pipeline.modelDiagnostics.retainedPcmBytes).toBe(0); expect(vi.getTimerCount()).toBe(0); }
  });
  it('clears an already accepted instrument before publishing the first frame at a new rate', () => {
    vi.useFakeTimers(); let now = 2000; const w = worker(), frames = vi.fn();
    const pipeline = new FeaturePipeline({ modelWorkerFactory: () => w, workerAssets: mn10, now: () => now }); pipeline.onFrame(frames);
    try {
      pipeline.start('audio'); send(w, 'model-loading'); send(w, 'model-ready'); pipeline.feed(new Float32Array(64000).fill(.2), 32000, 2, 'audio');
      now = 2035; response(w, w.postMessage.mock.calls.at(-1)![0]); now = 2050; pipeline.feed(pcm(), 32000, 2.05, 'audio');
      expect(frames.mock.calls.at(-1)![0].model?.instrument?.label).toBe('Guitar');
      now = 2070; pipeline.feed(pcm(), 48000, 2.07, 'audio'); expect(frames.mock.calls.at(-1)![0].model).toBeNull();
      expect(frames.mock.calls.at(-1)![0].values.tempo).toBeNull();
    } finally { pipeline.dispose(); }
  });
  it('bounds one oversized capture and a slow in-flight backlog below1MiB', () => {
    vi.useFakeTimers(); let now = 20000; const w = worker();
    const pipeline = new FeaturePipeline({ modelWorkerFactory: () => w, workerAssets: mn10, now: () => now });
    try {
      pipeline.start('audio'); send(w, 'model-loading'); send(w, 'model-ready'); pipeline.feed(new Float32Array(640000).fill(.2), 32000, 20, 'audio');
      expect(pipeline.modelDiagnostics.retainedPcmBytes).toBeLessThan(1024 ** 2);
      now += 3000; pipeline.feed(new Float32Array(96000).fill(.2), 32000, 23, 'audio');
      expect(w.postMessage.mock.calls.filter(([m]) => m.type === 'classify')).toHaveLength(1);
      expect(pipeline.modelDiagnostics.retainedPcmBytes).toBeLessThan(1024 ** 2); expect(pipeline.modelDiagnostics.bufferedSamples).toBeLessThanOrEqual(128000);
    } finally { pipeline.dispose(); expect(vi.getTimerCount()).toBe(0); }
  });
});
