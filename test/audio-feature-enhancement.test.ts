import { describe, expect, it, vi } from 'vitest';
import { FeatureExtractor, makeFrame, summarizeFrames, validateSnapshot } from '@sonoscope/core';
import { FeaturePipeline, type FeatureWorker } from '../packages/sdk/src/feature-pipeline';

// Migrated from legacy mock assertions to the actual v2 extraction/window implementation.
describe('v2 enhanced audio path', () => {
  it('calculates real spectral contrast, MFCC/chroma and median HPSS with consistent ratios', () => {
    const extractor = new FeatureExtractor(); let result: ReturnType<FeatureExtractor['extract']>;
    for (let seq = 0; seq < 20; seq++) {
      const pcm = Float32Array.from({ length: 1024 }, (_, i) => .2 * Math.sin(2 * Math.PI * 440 * (seq * 1024 + i) / 48000));
      result = extractor.extract(pcm, 48000, seq * 1024 / 48000);
    }
    expect(result!.hpss).not.toBeNull(); expect(result!.hpss!.harmonic + result!.hpss!.percussive).toBeCloseTo(1, 8);
    expect(result!.hpss!.harmonic).toBeGreaterThan(.5); expect(result!.contrastDb.every(Number.isFinite)).toBe(true);
    expect(result!.chroma).toHaveLength(12); expect(result!.mfcc).toHaveLength(13); expect(result!.contrastDb).toHaveLength(6);
  });
  it('aggregates a two-second window while retaining sample rate, actual units and unknown classification', () => {
    const extractor = new FeatureExtractor(), end = Date.now();
    const pcm = Float32Array.from({ length: 1024 }, (_, i) => .2 * Math.sin(2 * Math.PI * 440 * i / 44100));
    const values = extractor.extract(pcm, 44100, 0);
    const frames = Array.from({ length: 90 }, (_, seq) => {
      return makeFrame('session', seq, seq * 1024 / 44100, end - 2100 + seq * 23, 44100, values);
    });
    const snapshot = summarizeFrames(frames, 'snapshot')!;
    expect(validateSnapshot(snapshot)).toBe(true); expect(snapshot.stats.centroidHzMean).toBeCloseTo(440, -1); expect(snapshot.model).toBeNull();
    expect(snapshot.stats.tempo).toBeNull(); expect(snapshot.capabilities).not.toContain('yamnet');
  });
  it('bounds the DSP worker mailbox to three pending frames rather than accumulating PCM', () => {
    const worker = { onmessage: null, onerror: null, postMessage: vi.fn(), terminate: vi.fn() } as FeatureWorker;
    const pipeline = new FeaturePipeline({ workerFactory: () => worker }); pipeline.start('session');
    worker.onmessage!({ data: { type: 'dsp-ready', audioSessionId: 'session' } } as MessageEvent);
    for (let i = 0; i < 100; i++) pipeline.feed(new Float32Array(1024), 44100, i / 43, 'session');
    expect((worker.postMessage as ReturnType<typeof vi.fn>).mock.calls.filter(([message]) => message.type === 'pcm')).toHaveLength(3);
    pipeline.dispose(); expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it('a DSP worker failure produces explicit local fallback without a fake model result', () => {
    const worker = { onmessage: null, onerror: null, postMessage: vi.fn(), terminate: vi.fn() } as FeatureWorker;
    const pipeline = new FeaturePipeline({ workerFactory: () => worker }), statuses = vi.fn(), frames = vi.fn(); pipeline.onStatus(statuses); pipeline.onFrame(frames);
    pipeline.start('session'); worker.onerror!({} as ErrorEvent); pipeline.feed(new Float32Array(1024).fill(.1), 44100, 0, 'session');
    expect(statuses.mock.calls.at(-1)![0].dsp).toBe('local'); expect(frames.mock.calls.at(-1)![0].model).toBeNull(); pipeline.dispose();
  });
});
