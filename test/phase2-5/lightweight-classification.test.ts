import { describe, expect, it, vi } from 'vitest';
import { FeatureExtractor } from '@sonoscope/core';
import { FeaturePipeline, type FeatureWorker } from '../../packages/sdk/src/feature-pipeline';
import { promptFor } from '../../app/lib/server/provider';
import { request } from '../launch/fixtures';

// Genre/formant templates are no longer treated as real model predictions.
describe('model join and provenance', () => {
  it('loads a separate inference worker and sends a complete 975 ms actual-rate PCM window', () => {
    const dsp = { onmessage: null, onerror: null, postMessage: vi.fn(), terminate: vi.fn() } as FeatureWorker;
    const model = { onmessage: null, onerror: null, postMessage: vi.fn(), terminate: vi.fn() } as FeatureWorker;
    const pipeline = new FeaturePipeline({ workerFactory: () => dsp, modelWorkerFactory: () => model, workerAssets: { modelUrl: '/model', wasmUrl: '/wasm', modelVersion: 'test-model' } });
    pipeline.start('session'); dsp.onmessage!({ data: { type: 'dsp-ready', audioSessionId: 'session' } } as MessageEvent); model.onmessage!({ data: { type: 'model-loading', audioSessionId: 'session' } } as MessageEvent); model.onmessage!({ data: { type: 'model-ready', audioSessionId: 'session' } } as MessageEvent);
    const extractor = new FeatureExtractor();
    for (let seq = 0; seq < 9; seq++) {
      const pcm = new Float32Array(1024).fill(.1); pipeline.feed(pcm, 8000, seq * 1024 / 8000, 'session');
      dsp.onmessage!({ data: { type: 'frame', audioSessionId: 'session', seq, capturedAt: Date.now(), audioTime: seq * 1024 / 8000, sampleRate: 8000, values: extractor.extract(pcm, 8000, seq * 1024 / 8000) } } as MessageEvent);
    }
    const calls = (model.postMessage as ReturnType<typeof vi.fn>).mock.calls.filter(([msg]) => msg.type === 'classify');
    expect(calls).toHaveLength(1); expect(calls[0][0].sampleRate).toBe(8000); expect(calls[0][0].pcm).toHaveLength(7800);
    pipeline.dispose();
  });
  it('joins a real-format model response by session and exposes unknown when inference fails', () => {
    const worker = () => ({ onmessage: null, onerror: null, postMessage: vi.fn(), terminate: vi.fn() }) as FeatureWorker;
    const dsp = worker(), model = worker(), onFrame = vi.fn();
    const now = Date.now();
    const pipeline = new FeaturePipeline({ now: () => now, workerFactory: () => dsp, modelWorkerFactory: () => model, workerAssets: { modelUrl: '/model', wasmUrl: '/wasm', modelVersion: 'yamnet-float32-1' } });
    pipeline.onFrame(onFrame); pipeline.start('session');
    dsp.onmessage!({ data: { type: 'dsp-ready', audioSessionId: 'session' } } as MessageEvent); model.onmessage!({ data: { type: 'model-loading', audioSessionId: 'session' } } as MessageEvent); model.onmessage!({ data: { type: 'model-ready', audioSessionId: 'session' } } as MessageEvent);
    // A real response must correspond to a complete, actually issued request.
    pipeline.feed(new Float32Array(15600).fill(.1), 16000, .975, 'session');
    const sent = (model.postMessage as ReturnType<typeof vi.fn>).mock.calls.find(([msg]) => msg.type === 'classify')![0];
    const result = { version: 'yamnet-float32-1', capturedAt: sent.capturedAt, categories: [{ label: 'Speech', score: .8 }], voiceProbability: .8, instrument: null };
    model.onmessage!({ data: { type: 'model-result', audioSessionId: 'session', requestId: sent.requestId, sourceEpoch: sent.sourceEpoch, result } } as MessageEvent);
    const values = new FeatureExtractor().extract(new Float32Array(1024).fill(.1), 16000, .975);
    dsp.onmessage!({ data: { type: 'frame', audioSessionId: 'session', seq: 0, capturedAt: now, audioTime: .975, sampleRate: 16000, values } } as MessageEvent);
    expect(onFrame.mock.calls.at(-1)![0].model).toEqual(result); expect(onFrame.mock.calls.at(-1)![0].validity.classification.source).toBe('model');
    model.onmessage!({ data: { type: 'model-error', audioSessionId: 'session' } } as MessageEvent);
    pipeline.feed(new Float32Array(1024).fill(.1), 16000, 1.039, 'session');
    dsp.onmessage!({ data: { type: 'frame', audioSessionId: 'session', seq: 1, capturedAt: now, audioTime: 1.039, sampleRate: 16000, values } } as MessageEvent);
    expect(onFrame.mock.calls.at(-1)![0].model).toBeNull(); expect(onFrame.mock.calls.at(-1)![0].validity.classification.state).toBe('unknown'); pipeline.dispose();
  });
  it('DSP backpressure does not cut holes in the separate model PCM window', () => {
    const worker = () => ({ onmessage: null, onerror: null, postMessage: vi.fn(), terminate: vi.fn() }) as FeatureWorker;
    const dsp = worker(), model = worker(), pipeline = new FeaturePipeline({ workerFactory: () => dsp, modelWorkerFactory: () => model, workerAssets: { modelUrl: '/model', wasmUrl: '/wasm', modelVersion: 'test-model' } });
    pipeline.start('session'); dsp.onmessage!({ data: { type: 'dsp-ready', audioSessionId: 'session' } } as MessageEvent); model.onmessage!({ data: { type: 'model-loading', audioSessionId: 'session' } } as MessageEvent); model.onmessage!({ data: { type: 'model-ready', audioSessionId: 'session' } } as MessageEvent);
    for (let i = 0; i < 9; i++) pipeline.feed(new Float32Array(1024).fill((i + 1) / 10), 8000, i * 1024 / 8000, 'session');
    const messages = (model.postMessage as ReturnType<typeof vi.fn>).mock.calls.filter(([m]) => m.type === 'classify');
    expect(messages).toHaveLength(1); expect(messages[0][0].pcm).toHaveLength(7800); expect(messages[0][0].pcm[4096]).toBeCloseTo(.5); expect(messages[0][0].pcm.at(-1)).toBeCloseTo(.8);
    expect((dsp.postMessage as ReturnType<typeof vi.fn>).mock.calls.filter(([m]) => m.type === 'pcm')).toHaveLength(3); pipeline.dispose();
  });
  it('prompt transmits numeric model scores and provenance without claiming a genre or raw audio', () => {
    const r = request(); const prompt = promptFor(r); const payload = JSON.parse(prompt[1].content);
    expect(payload.model).toBeNull(); expect(payload.validity.classification.state).toBe('unknown'); expect(payload.features.tempo).toBeNull();
    expect(prompt[0].content).toContain('未知信息不要猜'); expect(JSON.stringify(payload)).not.toContain('pcm');
  });
  it('terminates an inference worker that stops replying and keeps basic DSP available', async () => {
    vi.useFakeTimers();
    const model = { onmessage: null, onerror: null, postMessage: vi.fn(), terminate: vi.fn() } as FeatureWorker;
    const pipeline = new FeaturePipeline({ modelWorkerFactory: () => model, workerAssets: { modelUrl: '/model', wasmUrl: '/wasm', modelVersion: 'test-model' } });
    const status = vi.fn(), frames = vi.fn(); pipeline.onStatus(status); pipeline.onFrame(frames);
    try {
      pipeline.start('session'); model.onmessage!({ data: { type: 'model-loading', audioSessionId: 'session' } } as MessageEvent); model.onmessage!({ data: { type: 'model-ready', audioSessionId: 'session' } } as MessageEvent);
      for (let i = 0; i < 16; i++) pipeline.feed(new Float32Array(1024).fill(.1), 16000, i * 1024 / 16000, 'session');
      await vi.advanceTimersByTimeAsync(5000);
      expect(model.terminate).toHaveBeenCalledOnce(); expect(status.mock.calls.at(-1)![0]).toMatchObject({ model: 'unavailable', dsp: 'local' });
      pipeline.feed(new Float32Array(1024).fill(.1), 16000, 1, 'session');
      expect(frames.mock.calls.at(-1)![0].model).toBeNull(); pipeline.dispose(); expect(vi.getTimerCount()).toBe(0);
    } finally { pipeline.dispose(); vi.useRealTimers(); }
  });
});
