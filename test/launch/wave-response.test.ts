import { expect, it, vi } from 'vitest';
import { applyWaveUniforms, WaveEnvelope, WAVE_QUIET_AMPLITUDE, type WaveAudioUniforms } from '../../app/visuals/wave';

const loud: WaveAudioUniforms = { level: .08, flux: .7, pulse: 1, centroid: .6, flatness: .1, zcr: .1, mfcc: [.2, .3, .1, .4] };
const noise: WaveAudioUniforms = { ...loud, level: .00037, flux: 1, pulse: 1 };

it('does not turn relative spectral changes in almost-silent input into a large wave', () => {
  const envelope = new WaveEnvelope();
  for (let ms = 0; ms <= 3000; ms += 20) {
    const response = envelope.update(noise, ms);
    expect(response.amplitude).toBe(WAVE_QUIET_AMPLITUDE); expect(response.audio.pulse).toBe(0); expect(response.audio.flux).toBe(0);
  }
});
it('lets a genuine sound attack respond, then settles within one second despite a noisy high-flux tail', () => {
  const envelope = new WaveEnvelope(), response = envelope.update(loud, 0, 1.5, true);
  expect(response.amplitude).toBeGreaterThan(.15);
  let amplitude = response.amplitude;
  for (let ms = 20; ms <= 1000; ms += 20) {
    const next = envelope.update(noise, ms);
    expect(next.amplitude).toBeLessThan(amplitude); amplitude = next.amplitude;
  }
  expect(amplitude).toBeLessThan(.02);
});
it('uses elapsed time so the same quiet tail decays equally at 15, 30 and 60 fps', () => {
  const results = [15, 30, 60].map(fps => {
    const envelope = new WaveEnvelope(); envelope.update(loud, 0, 1.5, true);
    let amplitude = 0;
    for (let n = 1; n <= fps; n++) amplitude = envelope.update(noise, n * 1000 / fps).amplitude;
    return amplitude;
  });
  expect(Math.max(...results) - Math.min(...results)).toBeLessThan(.00001); expect(Math.max(...results)).toBeLessThan(.02);
});
it('applies one authoritative amplitude and snaps a replay seek without retaining a prior loud frame', () => {
  const envelope = new WaveEnvelope(); envelope.update(loud, 10000, 1.5, true);
  const response = envelope.update(noise, 0, 1.5, true), uniforms = new Map<string, unknown>();
  const shader = { setUniform: vi.fn((key, value) => uniforms.set(key, value)) };
  applyWaveUniforms({ width: 1280, height: 800, millis: () => 0 }, shader, { ...loud, pulse: 1 }, 1.5, { amplitude: response.amplitude });
  expect(uniforms.get('uAmplitude')).toBe(WAVE_QUIET_AMPLITUDE);
});
