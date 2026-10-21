import { CONTRACT_VERSION, type AudioValues, type FeatureFrame, type FeatureSnapshot, type ModelResult } from './contracts';

const clamp = (n: number) => Math.max(0, Math.min(1, n));
const median = (a: number[]) => {
  if (!a.length) return 0;
  const b = [...a].sort((x, y) => x - y);
  return b.length % 2 ? b[b.length >> 1] : (b[(b.length >> 1) - 1] + b[b.length >> 1]) / 2;
};
/** Radix-2 Hann-windowed FFT. The bin axis is always actual sampleRate / fftSize. */
export function spectrum(pcm: Float32Array): Float32Array {
  const n = pcm.length;
  if (n < 32 || (n & (n - 1))) throw new Error('FFT size must be a power of two');
  const re = new Float64Array(n), im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = pcm[i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1)));
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) [re[i], re[j]] = [re[j], re[i]];
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = -2 * Math.PI / len;
    for (let base = 0; base < n; base += len) {
      for (let j = 0; j < len / 2; j++) {
        const wr = Math.cos(angle * j), wi = Math.sin(angle * j);
        const a = base + j, b = a + len / 2;
        const r = re[b] * wr - im[b] * wi, t = re[b] * wi + im[b] * wr;
        re[b] = re[a] - r; im[b] = im[a] - t; re[a] += r; im[a] += t;
      }
    }
  }
  return Float32Array.from(re.subarray(0, n / 2), (v, i) => 2 * Math.hypot(v, im[i]) / n);
}

import { TempoTracker } from './tempo';
export { TempoTracker } from './tempo';

export class FeatureExtractor {
  private previous: Float32Array | null = null;
  private spectra: Float32Array[] = [];
  private tempo = new TempoTracker();
  extract(pcm: Float32Array, sampleRate: number, audioTime: number): AudioValues {
    if (!Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000 || pcm.some(v => !Number.isFinite(v))) throw new Error('Invalid audio frame');
    const mag = spectrum(pcm), binHz = sampleRate / pcm.length;
    let squares = 0, crossings = 0, total = 0, weighted = 0, logSum = 0, delta = 0, prevTotal = 0;
    const bands = [0, 0, 0], columns = new Array<number>(32).fill(0), chroma = new Array<number>(12).fill(0);
    for (let i = 0; i < pcm.length; i++) {
      squares += pcm[i] ** 2;
      if (i && (pcm[i] >= 0) !== (pcm[i - 1] >= 0)) crossings++;
    }
    for (let i = 0; i < mag.length; i++) {
      const m = mag[i], hz = i * binHz;
      total += m; weighted += m * hz; logSum += Math.log(m + 1e-12);
      if (this.previous) { delta += Math.max(0, m - this.previous[i]); prevTotal += this.previous[i]; }
      const band = hz < 250 ? 0 : hz < 2000 ? 1 : 2;
      bands[band] += m * m;
      const col = Math.min(31, Math.max(0, Math.floor(Math.log2(1 + hz / 30) / Math.log2(1 + sampleRate / 60) * 32)));
      columns[col] += m * m;
      if (hz >= 55 && hz <= 5000) chroma[((Math.round(69 + 12 * Math.log2(hz / 440)) % 12) + 12) % 12] += m * m;
    }
    const rms = clamp(Math.sqrt(squares / pcm.length));
    const audible = rms > 0.00001 && total > 1e-8;
    const centroidHz = audible ? weighted / total : 0;
    let variance = 0, cumulative = 0, rolloffHz = 0;
    for (let i = 0; i < mag.length; i++) {
      variance += mag[i] * (i * binHz - centroidHz) ** 2;
      cumulative += mag[i];
      if (!rolloffHz && cumulative >= total * 0.85) rolloffHz = i * binHz;
    }
    const flux = this.previous && audible ? clamp(delta / Math.max(1e-8, total + prevTotal)) : 0;
    this.previous = mag;
    this.spectra.push(mag); if (this.spectra.length > 15) this.spectra.shift();
    let harmonicPower = 0, percussivePower = 0;
    // Silence still advances the spectral history, but its HPSS result is unknown.
    if (audible && this.spectra.length >= 7) {
      for (let i = 0; i < mag.length; i++) {
        const harmonic = median(this.spectra.map(s => s[i]));
        const percussive = median(Array.from(mag.subarray(Math.max(0, i - 7), Math.min(mag.length, i + 8))));
        const hp = harmonic ** 2, pp = percussive ** 2, denom = hp + pp + 1e-12;
        harmonicPower += mag[i] ** 2 * hp / denom;
        percussivePower += mag[i] ** 2 * pp / denom;
      }
    }
    const hTotal = harmonicPower + percussivePower;
    const contrastDb = Array.from({ length: 6 }, (_, b) => {
      const lo = Math.floor((80 * 2 ** b) / binHz), hi = Math.min(mag.length, Math.ceil((160 * 2 ** b) / binHz));
      const a = Array.from(mag.subarray(lo, hi)).sort((x, y) => x - y);
      return a.length ? Math.max(0, 20 * Math.log10((a[Math.floor((a.length - 1) * 0.9)] + 1e-9) / (a[Math.floor((a.length - 1) * 0.1)] + 1e-9))) : 0;
    });
    const mel = (hz: number) => 2595 * Math.log10(1 + hz / 700);
    const hzFromMel = (m: number) => 700 * (10 ** (m / 2595) - 1);
    const melMax = mel(sampleRate / 2);
    const points = Array.from({ length: 28 }, (_, i) => hzFromMel(i / 27 * melMax) / binHz);
    const logFilters = Array.from({ length: 26 }, (_, j) => {
      let power = 0;
      for (let k = Math.floor(points[j]); k <= Math.min(mag.length - 1, Math.ceil(points[j + 2])); k++) {
        const weight = k < points[j + 1] ? (k - points[j]) / (points[j + 1] - points[j]) : (points[j + 2] - k) / (points[j + 2] - points[j + 1]);
        power += mag[k] ** 2 * Math.max(0, weight);
      }
      return Math.log(power + 1e-12);
    });
    const mfcc = Array.from({ length: 13 }, (_, k) => logFilters.reduce((a, v, n) => a + v * Math.cos(Math.PI * k * (n + 0.5) / 26), 0));
    const chromaMax = Math.max(...chroma, 1e-12);
    return {
      rms, zcr: crossings / (pcm.length - 1), centroidHz,
      bandwidthHz: audible ? Math.sqrt(variance / total) : 0, rolloffHz: audible ? rolloffHz : 0,
      flatness: audible ? clamp(Math.exp(logSum / mag.length) / (total / mag.length)) : 0, flux,
      bands: { low: clamp(Math.sqrt(bands[0]) * 3), mid: clamp(Math.sqrt(bands[1]) * 3), high: clamp(Math.sqrt(bands[2]) * 3), columns: columns.map(v => clamp(Math.sqrt(v) * 3)) },
      chroma: chroma.map(v => v / chromaMax), mfcc, contrastDb,
      tempo: this.tempo.update(audioTime, rms, flux),
      hpss: audible && hTotal > 1e-10 ? { harmonic: harmonicPower / hTotal, percussive: percussivePower / hTotal } : null,
    };
  }
}

export function makeFrame(audioSessionId: string, seq: number, audioTime: number, capturedAt: number, sampleRate: number, values: AudioValues, model: ModelResult | null = null): FeatureFrame {
  const valid = (unit: string, state: 'valid' | 'unknown' = 'valid', source: 'dsp' | 'model' | 'heuristic' = 'dsp') => ({ state, source, unit });
  return { version: CONTRACT_VERSION, audioSessionId, seq, audioTime, capturedAt, sampleRate, values, model,
    validity: {
      rms: valid('0..1'), centroidHz: valid('Hz', values.rms > 0.00001 ? 'valid' : 'unknown'),
      bandwidthHz: valid('Hz', values.rms > 0.00001 ? 'valid' : 'unknown'), rolloffHz: valid('Hz', values.rms > 0.00001 ? 'valid' : 'unknown'),
      flatness: valid('0..1', values.rms > 0.00001 ? 'valid' : 'unknown'), flux: valid('0..1', seq > 0 ? 'valid' : 'unknown'),
      tempo: valid('BPM', values.tempo ? 'valid' : 'unknown', 'heuristic'), hpss: valid('ratio', values.hpss ? 'valid' : 'unknown'),
      classification: valid('score', model ? 'valid' : 'unknown', 'model'),
    }
  };
}
export function summarizeFrames(frames: FeatureFrame[], snapshotId: string): FeatureSnapshot | null {
  if (!frames.length) return null;
  const last = frames[frames.length - 1];
  const same = frames.filter(f => f.audioSessionId === last.audioSessionId && f.sampleRate === last.sampleRate);
  const avg = (get: (v: AudioValues) => number) => same.reduce((a, f) => a + get(f.values), 0) / same.length;
  const spectrumKeys = ['centroidHz', 'bandwidthHz', 'rolloffHz', 'flatness', 'flux'] as const;
  const validAverage = (key: typeof spectrumKeys[number], get: (v: AudioValues) => number) => {
    const measured = same.filter(f => f.validity[key].state === 'valid');
    return measured.length ? measured.reduce((sum, f) => sum + get(f.values), 0) / measured.length : 0;
  };
  const validity = { ...last.validity };
  for (const key of spectrumKeys) validity[key] = { ...validity[key], state: same.some(f => f.validity[key].state === 'valid') ? 'valid' : 'unknown' };
  const duration = Math.max(0.001, (last.capturedAt - same[0].capturedAt) / 1000);
  const onsets = same.filter(f => f.values.flux > 0.25).length;
  const model = last.model && last.capturedAt - last.model.capturedAt <= 3000 ? last.model : null;
  return { version: CONTRACT_VERSION, audioSessionId: last.audioSessionId, snapshotId,
    startAt: same[0].capturedAt, endAt: last.capturedAt, sampleRate: last.sampleRate, frames: same.length,
    stats: { rmsMean: avg(v => v.rms), rmsPeak: Math.max(...same.map(f => f.values.rms)), centroidHzMean: validAverage('centroidHz', v => v.centroidHz), bandwidthHzMean: validAverage('bandwidthHz', v => v.bandwidthHz), rolloffHzMean: validAverage('rolloffHz', v => v.rolloffHz), flatnessMean: validAverage('flatness', v => v.flatness), fluxMean: validAverage('flux', v => v.flux), onsetRate: Math.min(30, onsets / duration), tempo: last.values.tempo, hpss: last.values.hpss },
    validity: { ...validity, classification: { state: model ? 'valid' : 'unknown', source: 'model', unit: 'score' } }, model,
    capabilities: ['rms', 'spectrum.Hz', 'flux.normalized', 'mfcc', 'chroma', 'contrast.dB', 'tempo.heuristic', ...(last.values.hpss ? ['hpss.median'] : []), ...(model ? ['yamnet'] : [])]
  };
}

/** Fixed-time interpolation; duration is preserved using the real source sample rate. */
export function resample(input: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return input.slice();
  if (from <= 0 || to <= 0) throw new Error('Invalid sample rate');
  const ratio = from / to;
  const out = new Float32Array(Math.floor(input.length / ratio));
  // Integrate each target interval when downsampling to suppress aliasing.
  for (let i = 0; i < out.length; i++) {
    const pos = i * ratio;
    if (ratio > 1) {
      const end = Math.min(input.length, (i + 1) * ratio);
      let sum = 0;
      for (let k = Math.floor(pos); k < Math.ceil(end); k++) sum += (input[k] ?? 0) * (Math.min(k + 1, end) - Math.max(k, pos));
      out[i] = sum / (end - pos);
    } else {
      const k = Math.floor(pos), frac = pos - k;
      out[i] = (input[k] ?? 0) * (1 - frac) + (input[k + 1] ?? input[k] ?? 0) * frac;
    }
  }
  return out;
}
