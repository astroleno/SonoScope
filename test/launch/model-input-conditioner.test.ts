import { describe, expect, it } from 'vitest';
import { Mn10InputConditioner } from '@sonoscope/core';
const uncertain = [{ label: 'Music', score: .88 }, { label: 'Musical instrument', score: .1 }];
describe('same mn10 conditional model input', () => {
  it('leaves the first full-band window intact and forces a raw probe after two conditioned windows', () => {
    const c = new Mn10InputConditioner(), pcm = Float32Array.from({ length: 64000 }, (_, i) => Math.sin(i));
    const original = pcm.slice(); expect(c.prepareInPlace(pcm)).toBe('raw'); expect(pcm).toEqual(original);
    c.observe(uncertain, null);
    for (let i = 0; i < 2; i++) { expect(c.prepareInPlace(pcm.slice())).toBe('lowpass-3k'); c.observe(uncertain, null); }
    expect(c.prepareInPlace(pcm)).toBe('raw'); expect(pcm).toEqual(original);
  });
  it('returns to raw input immediately after confirmation or a source reset', () => {
    const c = new Mn10InputConditioner(), pcm = new Float32Array(64000);
    c.observe(uncertain, null); expect(c.prepareInPlace(pcm)).toBe('lowpass-3k');
    c.observe(uncertain, { label: 'Guitar', confidence: .2 }); expect(c.prepareInPlace(pcm)).toBe('raw');
    c.observe(uncertain, null); c.reset(); expect(c.prepareInPlace(pcm)).toBe('raw');
  });
  it('does not condition nonmusic, voice, clear instruments or uninformative music', () => {
    for (const cs of [[{ label: 'Music', score: .7 }, uncertain[1]], [uncertain[0], { label: 'Musical instrument', score: .5 }], [uncertain[0]], [...uncertain, { label: 'Singing', score: .05 }]]) {
      const c = new Mn10InputConditioner(); c.observe(cs, null); expect(c.prepareInPlace(new Float32Array(64000))).toBe('raw');
    }
  });
  it('preserves low musical tones while attenuating high-frequency input only on selected windows', () => {
    const levels = [1000, 8000].map(frequency => {
      const pcm = Float32Array.from({ length: 64000 }, (_, i) => .5 * Math.sin(2 * Math.PI * frequency * i / 32000));
      const c = new Mn10InputConditioner(); c.observe(uncertain, null); c.prepareInPlace(pcm);
      return Math.sqrt(pcm.subarray(1000).reduce((sum, value) => sum + value * value, 0) / (pcm.length - 1000)) / (.5 / Math.SQRT2);
    });
    expect(levels[0]).toBeGreaterThan(.97); expect(levels[0]).toBeLessThan(1.01); expect(levels[1]).toBeLessThan(.01);
  });
});
