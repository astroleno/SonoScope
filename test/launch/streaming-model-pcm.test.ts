import { describe, expect, it } from 'vitest';
import { MN10_MODEL_PROFILE, StreamingModelResampler } from '@sonoscope/core';
import { ModelPcmBuffer } from '../../packages/sdk/src/model-pcm-buffer';

function join(parts: Float32Array[]) {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0)); let at = 0;
  for (const part of parts) { out.set(part, at); at += part.length; }
  return out;
}
describe('continuous model PCM and bounded ownership', () => {
  it.each([8000, 16000, 32000, 44100, 48000, 88200, 96000, 192000])('preserves phase and true duration across arbitrary chunks at %s Hz', rate => {
    const pcm = Float32Array.from({ length: Math.floor(rate * .12) }, (_, i) => .3 * Math.sin(2 * Math.PI * 537 * i / rate) + .1 * Math.cos(2 * Math.PI * 173 * i / rate));
    const whole = new StreamingModelResampler(rate, 32000), stream = new StreamingModelResampler(rate, 32000);
    const expected = join([whole.push(pcm), whole.flush()]), parts: Float32Array[] = [];
    const sizes = [1, 127, 1024, 73, 4096]; let at = 0, index = 0;
    while (at < pcm.length) { const end = Math.min(pcm.length, at + sizes[index++ % sizes.length]); parts.push(stream.push(pcm.subarray(at, end))); at = end; expect(stream.retainedPcmBytes).toBeLessThanOrEqual(776); }
    parts.push(stream.flush());
    expect(join(parts)).toEqual(expected); expect(expected.length).toBe(Math.floor(pcm.length * 32000 / rate));
    expect(stream.flush()).toHaveLength(0); expect(() => stream.push(new Float32Array([1]))).toThrow('already ended');
  });
  it('preserves a real 5kHz tone while rejecting a 20kHz alias', () => {
    const rate = 48000, pcm = Float32Array.from({ length: 7200 }, (_, i) => .5 * Math.sin(2 * Math.PI * 5000 * i / rate) + .5 * Math.sin(2 * Math.PI * 20000 * i / rate));
    const resampler = new StreamingModelResampler(rate, 32000), output = join([resampler.push(pcm), resampler.flush()]); let error = 0, n = 0;
    for (let i = 600; i < output.length - 600; i++) { error += (output[i] - .5 * Math.sin(2 * Math.PI * 5000 * i / 32000)) ** 2; n++; }
    expect(Math.sqrt(error / n)).toBeLessThan(.001);
  });
  it('requires genuine context plus filter lookahead and keeps an exact400ms hop', () => {
    const buffer = new ModelPcmBuffer(44100, MN10_MODEL_PROFILE);
    buffer.append(new Float32Array(88200).fill(.2)); expect(buffer.take()).toBeNull();
    buffer.append(new Float32Array(1024).fill(.2));
    const first = buffer.take()!; expect(first.pcm.length).toBe(64000); expect(first.sourceEndTime).toBe(2); expect(first.sampleRate).toBe(32000);
    buffer.append(new Float32Array(17640).fill(.2)); const next = buffer.take()!;
    expect(next.sourceEndTime).toBe(2.4); expect(next.pcm.subarray(0, 51200)).toEqual(first.pcm.subarray(12800));
  });
  it('bounds an oversized source block without retaining its backing storage', () => {
    const buffer = new ModelPcmBuffer(32000, MN10_MODEL_PROFILE), input = Float32Array.from({ length: 640000 }, (_, i) => i / 640000);
    buffer.append(input); input.fill(NaN);
    expect(buffer.bufferedSamples).toBeLessThanOrEqual(128000);
    const first = buffer.take()!, next = buffer.take()!;
    expect(buffer.retainedPcmBytes + first.pcm.byteLength).toBeLessThan(1024 ** 2);
    expect(first.sourceEndTime).toBeGreaterThanOrEqual(18); expect(first.sourceEndTime).toBeLessThanOrEqual(20);
    expect(first.pcm[0]).toBeCloseTo((first.sourceEndTime - 2) / 20, 6);
    expect(next.sourceEndTime - first.sourceEndTime).toBeCloseTo(.4, 9);
    expect(next.pcm.subarray(0, 51200)).toEqual(first.pcm.subarray(12800));
  });
  it.each([0, -1, NaN, Infinity, 192001])('rejects an invalid source rate %s', rate => {
    expect(() => new StreamingModelResampler(rate, 32000)).toThrow('sample rate');
  });
});
