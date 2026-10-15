import { describe, expect, it } from 'vitest';
import { FeatureExtractor, TempoTracker, makeFrame, resample, summarizeFrames, validateGenerationRequest } from '@sonoscope/core';
import { request } from './fixtures';

describe('physical audio contracts', () => {
  it.each([16000, 44100, 48000])('centroid and rolloff stay in Hz at %s Hz sampling', rate => {
    const pcm = Float32Array.from({ length: 1024 }, (_, i) => 0.4 * Math.sin(2 * Math.PI * 1000 * i / rate));
    const extractor = new FeatureExtractor(), v = extractor.extract(pcm, rate, 0);
    expect(v.centroidHz).toBeCloseTo(1000, -1); expect(Math.abs(v.rolloffHz - 1000)).toBeLessThan(rate / 1024 * 3);
    expect(v.rms).toBeGreaterThan(0.27); expect(v.flux).toBe(0);
    const changed = Float32Array.from({ length: 1024 }, (_, i) => 0.4 * Math.sin(2 * Math.PI * 3000 * i / rate));
    expect(extractor.extract(changed, rate, 1).flux).toBeGreaterThan(0.2);
    expect(extractor.extract(changed, rate, 2).flux).toBeLessThan(0.01);
    expect(v.contrastDb).toHaveLength(6); expect(v.mfcc).toHaveLength(13); expect(v.chroma).toHaveLength(12);
  });
  it('silence does not manufacture tempo or model probabilities', () => {
    const v = new FeatureExtractor().extract(new Float32Array(1024), 48000, 0);
    const f = makeFrame('s', 0, 0, Date.now(), 48000, v);
    expect(v.tempo).toBeNull(); expect(v.hpss).toBeNull(); expect(f.model).toBeNull();
    expect(f.validity.centroidHz.state).toBe('unknown'); expect(f.validity.flux.state).toBe('unknown');
  });
  it.each([60, 90, 120, 150, 180])('synthetic onset train estimates %s BPM within 3', bpm => {
    const tracker = new TempoTracker(); let result: ReturnType<TempoTracker['update']> = null;
    const dt = 1024 / 44100;
    for (let t = 0; t < 12; t += dt) {
      const phase = t % (60 / bpm), pulse = phase < dt * 1.2;
      const candidate = tracker.update(t, pulse ? 0.3 : 0.005, pulse ? 0.35 : 0);
      if (candidate) result = candidate;
    }
    expect(result).not.toBeNull(); expect(Math.abs(result!.bpm - bpm)).toBeLessThanOrEqual(3);
  });
  it.each([60, 90, 120, 150, 180])('synthetic click PCM passes FFT/onset/tempo at %s BPM', bpm => {
    const rate = 44100, extractor = new FeatureExtractor(); let result: ReturnType<FeatureExtractor['extract']>;
    for (let seq = 0; seq * 1024 / rate < 8; seq++) {
      const pcm = Float32Array.from({ length: 1024 }, (_, i) => {
        const time = (seq * 1024 + i) / rate, phase = time % (60 / bpm);
        return .7 * Math.exp(-phase * 90) * Math.sin(2 * Math.PI * 6000 * time);
      });
      result = extractor.extract(pcm, rate, seq * 1024 / rate);
    }
    expect(result!.tempo).not.toBeNull(); expect(Math.abs(result!.tempo!.bpm - bpm)).toBeLessThanOrEqual(3);
    expect(extractor.extract(new Float32Array(1024), rate, 11).tempo).toBeNull();
  });
  it('resampling preserves a second of duration instead of stretching an arbitrary buffer', () => {
    const out = resample(new Float32Array(48000).fill(0.4), 48000, 16000);
    expect(out.length).toBe(16000); expect(out[8000]).toBeCloseTo(0.4);
  });
  it('model/provenance survives aggregation and stale model results expire', () => {
    const v = new FeatureExtractor().extract(new Float32Array(1024).fill(0.1), 44100, 0);
    const model = { version: 'yamnet-1', capturedAt: 1000, categories: [{ label: 'Speech', score: 0.8 }], voiceProbability: 0.8, instrument: null };
    const f = makeFrame('s', 1, 1, 2000, 44100, v, model);
    expect(summarizeFrames([f], 'snap')!.model).toEqual(model);
    expect(summarizeFrames([{ ...f, capturedAt: 5001 }], 'snap')!.model).toBeNull();
  });
  it('unknown silence does not bias frequency averages or erase valid observations in the window', () => {
    const extractor = new FeatureExtractor(), rate = 44100;
    const pcm = Float32Array.from({ length: 1024 }, (_, i) => .4 * Math.sin(2 * Math.PI * 1000 * i / rate));
    const tone = makeFrame('session', 1, 1, 1000, rate, extractor.extract(pcm, rate, 1));
    const quiet = makeFrame('session', 2, 2, 2000, rate, extractor.extract(new Float32Array(1024), rate, 2));
    const summary = summarizeFrames([tone, quiet], 'snapshot')!;
    expect(summary.stats.centroidHzMean).toBeCloseTo(1000, -1); expect(summary.stats.rmsMean).toBeCloseTo(tone.values.rms / 2);
    expect(summary.validity.centroidHz.state).toBe('valid'); expect(summarizeFrames([quiet], 'silent')!.validity.centroidHz.state).toBe('unknown');
  });
  it('rejects raw PCM, invalid units and unbounded user-supplied limits', () => {
    expect(validateGenerationRequest(request())).toBe(true);
    expect(validateGenerationRequest({ ...request(), needDanmu: 10000 })).toBe(false);
    const r = request(); r.snapshot.stats.centroidHzMean = 100000;
    expect(validateGenerationRequest(r)).toBe(false);
    expect(validateGenerationRequest({ ...request(), pcm: [1, 2] })).toBe(false);
  });
});
