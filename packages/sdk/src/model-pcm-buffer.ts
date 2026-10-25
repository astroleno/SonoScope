import { StreamingModelResampler, type AudioModelProfile } from '@sonoscope/core';

/** A fixed model-rate ring; source chunks cannot retain a large backing array. */
export class ModelPcmBuffer {
  private readonly ring: Float32Array;
  private readonly resampler: StreamingModelResampler;
  private start = 0;
  private end = 0;
  constructor(sourceRate: number, private readonly profile: AudioModelProfile) {
    this.ring = new Float32Array(profile.windowSamples * 2);
    this.resampler = new StreamingModelResampler(sourceRate, profile.sampleRate);
  }
  append(pcm: Float32Array) {
    for (let at = 0; at < pcm.length; at += 4096) {
      const output = this.resampler.push(pcm.subarray(at, at + 4096));
      const offset = this.end % this.ring.length, first = Math.min(output.length, this.ring.length - offset);
      this.ring.set(output.subarray(0, first), offset);
      if (first < output.length) this.ring.set(output.subarray(first), 0);
      this.end += output.length;
      const excess = this.end - this.start - this.ring.length;
      if (excess > 0) this.start += Math.ceil(excess / this.profile.hopSamples) * this.profile.hopSamples;
    }
  }
  take() {
    if (this.end - this.start < this.profile.windowSamples) return null;
    const pcm = new Float32Array(this.profile.windowSamples), offset = this.start % this.ring.length;
    const first = Math.min(pcm.length, this.ring.length - offset);
    pcm.set(this.ring.subarray(offset, offset + first));
    if (first < pcm.length) pcm.set(this.ring.subarray(0, pcm.length - first), first);
    const sourceEndTime = (this.start + pcm.length) / this.profile.sampleRate;
    this.start += this.profile.hopSamples;
    return { pcm, sampleRate: this.profile.sampleRate, sourceEndTime };
  }
  get retainedPcmBytes() { return this.ring.byteLength + this.resampler.retainedPcmBytes; }
  get bufferedSamples() { return this.end - this.start; }
}
