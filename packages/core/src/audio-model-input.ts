import type { ModelResult } from './contracts';

export type ModelInputMode = 'raw' | 'lowpass-3k';

/** One inference per real window. Uncertain music gets at most two conditioned
 * windows before a full-band probe; neither playback nor DSP/BPM is modified. */
export class Mn10InputConditioner {
  private remaining = 0;
  private lastMode: ModelInputMode = 'raw';
  private readonly b0: number;
  private readonly b1: number;
  private readonly a1: number;
  private readonly a2: number;
  constructor() {
    const w = 2 * Math.PI * 3000 / 32000, cosine = Math.cos(w), alpha = Math.sin(w) / Math.SQRT2, a0 = 1 + alpha;
    this.b0 = (1 - cosine) / 2 / a0; this.b1 = (1 - cosine) / a0;
    this.a1 = -2 * cosine / a0; this.a2 = (1 - alpha) / a0;
  }
  /** Mutates only the Worker's transferred model-window copy. */
  prepareInPlace(pcm: Float32Array): ModelInputMode {
    this.lastMode = this.remaining > 0 ? 'lowpass-3k' : 'raw';
    if (this.lastMode === 'raw') return this.lastMode;
    this.remaining--;
    for (let stage = 0; stage < 2; stage++) {
      let z1 = 0, z2 = 0;
      for (let i = 0; i < pcm.length; i++) {
        const x = pcm[i], y = this.b0 * x + z1;
        z1 = this.b1 * x - this.a1 * y + z2; z2 = this.b0 * x - this.a2 * y;
        pcm[i] = y;
      }
    }
    return this.lastMode;
  }
  observe(categories: readonly { label: string; score: number }[], instrument: ModelResult['instrument']) {
    if (instrument) { this.remaining = 0; return; }
    if (this.lastMode !== 'raw') return;
    let music = 0, generalInstrument = 0, voice = 0;
    for (const category of categories) {
      if (category.label === 'Music') music = category.score;
      if (category.label === 'Musical instrument') generalInstrument = category.score;
      if (/speech|singing|vocal|choir|humming|whistling/i.test(category.label)) voice = Math.max(voice, category.score);
    }
    this.remaining = music >= .75 && generalInstrument >= .03 && generalInstrument < .25 && voice < .05 ? 2 : 0;
  }
  reset() { this.remaining = 0; this.lastMode = 'raw'; }
}
