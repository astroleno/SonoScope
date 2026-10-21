type Tempo = { bpm: number; confidence: number };
const rate = 100;

/** Periodicity of the onset envelope, not the intervals between arbitrary notes. */
export class TempoTracker {
  private envelope: number[] = [];
  private energyEnvelope: number[] = [];
  private previousTime = NaN;
  private previousValue = 0;
  private previousEnergy = 0;
  private nextSample = 0;
  private analyzedAt = -Infinity;
  private audibleAt = -Infinity;
  private peaks: number[] = [];
  private candidate: number | null = null;
  private stable = 0;
  private result: Tempo | null = null;
  private confirmed: { bpm: number; at: number } | null = null;

  private reset() {
    this.envelope = []; this.energyEnvelope = []; this.previousTime = NaN; this.previousValue = this.previousEnergy = 0;
    this.analyzedAt = this.audibleAt = -Infinity; this.peaks = [];
    this.candidate = null; this.stable = 0; this.result = null; this.confirmed = null;
  }

  update(timeSeconds: number, rms: number, flux: number): Tempo | null {
    if (![timeSeconds, rms, flux].every(Number.isFinite)) { this.reset(); return null; }
    if (timeSeconds <= this.previousTime || timeSeconds - this.previousTime > .25) this.reset();
    // A gentle energy weight stops quiet note changes outweighing accented attacks.
    const value = rms >= .001 ? Math.max(0, Math.min(1, flux * (rms / .02) ** .25)) : 0;
    if (rms >= .003) this.audibleAt = timeSeconds;
    if (value >= .05 && timeSeconds - (this.peaks.at(-1) ?? -Infinity) > .12) this.peaks.push(timeSeconds);
    this.peaks = this.peaks.filter(t => timeSeconds - t <= 12).slice(-100);
    if (!Number.isFinite(this.previousTime)) {
      this.previousTime = timeSeconds; this.nextSample = timeSeconds;
      this.previousValue = value;
      this.previousEnergy = rms;
    }
    // Resample timestamps, so sampling rate and occasional dropped frames do not alter BPM.
    while (this.nextSample <= timeSeconds) {
      const fraction = timeSeconds === this.previousTime ? 1 : (this.nextSample - this.previousTime) / (timeSeconds - this.previousTime);
      this.envelope.push(this.previousValue + fraction * (value - this.previousValue));
      this.energyEnvelope.push(this.previousEnergy + fraction * (rms - this.previousEnergy));
      this.nextSample += 1 / rate;
    }
    if (this.envelope.length > 12 * rate) { const extra = this.envelope.length - 12 * rate; this.envelope.splice(0, extra); this.energyEnvelope.splice(0, extra); }
    this.previousTime = timeSeconds; this.previousValue = value; this.previousEnergy = rms;
    if (timeSeconds - this.audibleAt > 2.5) { this.reset(); return null; }
    if (this.envelope.length < 6 * rate || timeSeconds - this.analyzedAt < .25) return this.result;
    this.analyzedAt = timeSeconds;
    const pulse = this.uniformPulse();
    if (pulse) { this.result = pulse; this.candidate = pulse.bpm; this.stable = 3; this.confirmed = { bpm: pulse.bpm, at: timeSeconds }; return pulse; }
    const mean = this.envelope.reduce((a, b) => a + b, 0) / this.envelope.length;
    const x = this.envelope.map(v => Math.max(0, v - mean));
    const energy = x.reduce((a, b) => a + b * b, 0);
    if (energy < .01 || Math.max(...x) < .025) return this.unknown();
    const ac = new Float64Array(605);
    for (let lag = 26; lag < ac.length; lag++) {
      let sum = 0, a = 0, b = 0;
      for (let i = lag; i < x.length; i++) { sum += x[i] * x[i - lag]; a += x[i] ** 2; b += x[i - lag] ** 2; }
      ac[lag] = a > 0 && b > 0 ? sum / Math.sqrt(a * b) : 0;
    }
    // A musical beat can have weak onsets itself but repeat across two, three or four beats.
    // Combining those lags reduces the common 3:2 syncopation and eighth-note errors.
    const comb = new Float64Array(153);
    for (let lag = 26; lag < comb.length; lag++) comb[lag] = .35 * ac[lag] + .3 * ac[lag * 2] + .15 * ac[lag * 3] + .2 * ac[lag * 4];
    const candidates: { bpm: number; strength: number; score: number }[] = [];
    for (let lag = 27; lag <= 150; lag++) {
      if (comb[lag] < comb[lag - 1] || comb[lag] <= comb[lag + 1]) continue;
      const denominator = comb[lag - 1] - 2 * comb[lag] + comb[lag + 1];
      const offset = denominator ? Math.max(-.5, Math.min(.5, .5 * (comb[lag - 1] - comb[lag + 1]) / denominator)) : 0;
      const bpm = 60 * rate / (lag + offset);
      const prior = Math.exp(-.5 * (Math.log2(bpm / 120) / .9) ** 2);
      if (bpm >= 40 && bpm <= 220) candidates.push({ bpm, strength: comb[lag], score: comb[lag] * prior });
    }
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    if (!best || best.strength < .23) return this.unknown();
    // A weak periodicity plus an equally plausible octave is not a resolved musical beat.
    if (best.strength < .3 && candidates.some(c => {
      const ratio = Math.max(c.bpm, best.bpm) / Math.min(c.bpm, best.bpm);
      return c !== best && [2, 1.5, 4 / 3].some(r => Math.abs(ratio - r) < .04) && c.strength >= best.strength * .8 && c.score >= best.score * .75;
    })) return this.unknown();
    const competitor = candidates.find(c => {
      const multiple = Math.max(c.bpm, best.bpm) / Math.min(c.bpm, best.bpm);
      return c !== best && Math.abs(multiple - Math.round(multiple)) > .06;
    });
    if (competitor && competitor.score > best.score * .94) return this.unknown();
    if (this.candidate !== null && Math.abs(best.bpm - this.candidate) / this.candidate < .04) this.stable++;
    else { this.stable = 1; this.result = null; }
    this.candidate = best.bpm;
    // Brief ambiguity hides BPM, but a recently confirmed rate can re-enter as soon
    // as fresh, non-ambiguous periodicity supports it. Never carry the old score.
    if (this.confirmed && timeSeconds - this.confirmed.at <= 1 && Math.abs(best.bpm - this.confirmed.bpm) / this.confirmed.bpm < .04) this.stable = Math.max(this.stable, 8);
    if (this.stable < 8) return null;
    const confidence = Math.min(.99, .5 + best.strength * .9);
    const bpm = this.result ? this.result.bpm * .7 + best.bpm * .3 : best.bpm;
    this.result = { bpm, confidence };
    this.confirmed = { bpm, at: timeSeconds };
    return this.result;
  }
  private uniformPulse(): Tempo | null {
    const e = this.energyEnvelope, order = [...e].sort((a, b) => a - b), high = order[Math.floor(order.length * .95)];
    if (!high || order[Math.floor(order.length * .75)] >= high * .1) return null;
    const peaks: number[] = [];
    for (let i = 10; i < e.length - 10; i++) {
      if (e[i] < high * .3 || e[i] < e[i - 1] || e[i] <= e[i + 1]) continue;
      const last = peaks.at(-1);
      if (last !== undefined && i - last < 15) { if (e[i] > e[last]) peaks[peaks.length - 1] = i; }
      else peaks.push(i);
    }
    if (peaks.length < 6) return null;
    const cv = (values: number[]) => {
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      return mean ? Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length) / mean : Infinity;
    };
    const intervals = peaks.slice(1).map((p, i) => (p - peaks[i]) / rate);
    if (cv(intervals) > .06) return null;
    const energies = peaks.map(p => e.slice(p - 8, p + 9).reduce((sum, v) => sum + v * v, 0));
    if (cv(peaks.map(p => e[p])) > .12 && cv(energies) > .12) return null;
    const bpm = 60 / (intervals.reduce((a, b) => a + b, 0) / intervals.length);
    return bpm >= 40 && bpm <= 220 ? { bpm, confidence: Math.min(.99, 1 - cv(intervals) * 2) } : null;
  }
  private unknown(): null { this.result = null; this.candidate = null; this.stable = 0; return null; }
  get onsetCount() { return this.peaks.length; }
}
