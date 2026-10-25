function gcd(a: number, b: number): number { return b ? gcd(b, a % b) : a; }

/** Continuous Hann-sinc phase. Only the short FIR source history is retained. */
export class StreamingModelResampler {
  private total = 0;
  private emitted = 0;
  private history: Float32Array = new Float32Array();
  private closed = false;
  private readonly phases: number;
  private readonly step: number;
  private readonly radius: number;
  private readonly size: number;
  private readonly weights: Float64Array;

  constructor(private readonly from: number, private readonly to: number) {
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 8000 || from > 192000 || to < 8000 || to > 192000) throw new Error('Invalid sample rate');
    const div = gcd(from, to); this.phases = to / div; this.step = from / div;
    if (this.phases > 1024) throw new Error('Unsupported phase count');
    const cutoff = .99 * Math.min(1, to / from);
    this.radius = from === to ? 0 : Math.ceil(16 / cutoff); this.size = 2 * this.radius + 1;
    this.weights = new Float64Array(this.phases * this.size);
    for (let phase = 0; phase < this.phases; phase++) {
      const frac = (phase * this.step % this.phases) / this.phases; let sum = 0;
      for (let k = -this.radius; k <= this.radius; k++) {
        const t = (k - frac) * cutoff;
        const value = Math.abs(t) >= 16 ? 0 : cutoff * (Math.abs(t) < 1e-12 ? 1 : Math.sin(Math.PI * t) / (Math.PI * t)) * (.5 + .5 * Math.cos(Math.PI * t / 16));
        this.weights[phase * this.size + k + this.radius] = value; sum += value;
      }
      for (let k = 0; k < this.size; k++) this.weights[phase * this.size + k] /= sum;
    }
  }

  push(input: Float32Array, flush = false): Float32Array {
    if (this.closed) { if (flush && !input.length) return new Float32Array(); throw new Error('Resampler already ended'); }
    if (flush) this.closed = true;
    if (this.from === this.to) { this.total += input.length; this.emitted += input.length; return input.slice(); }
    const previous = this.total, historyStart = previous - this.history.length;
    this.total += input.length;
    const target = flush ? Math.floor(this.total * this.phases / this.step) : Math.max(0, Math.ceil((this.total - this.radius) * this.phases / this.step));
    const output = new Float32Array(Math.max(0, target - this.emitted));
    for (let i = 0; i < output.length; i++) {
      const at = this.emitted + i, center = Math.floor(at * this.step / this.phases), offset = at % this.phases * this.size; let sum = 0;
      for (let k = 0; k < this.size; k++) {
        const position = center - this.radius + k;
        const value = position < 0 ? 0 : position < previous ? (this.history[position - historyStart] ?? 0) : (input[position - previous] ?? 0);
        sum += value * this.weights[offset + k];
      }
      output[i] = sum;
    }
    this.emitted += output.length;
    const retain = Math.min(2 * this.radius, this.total), next = new Float32Array(retain), start = this.total - retain;
    for (let i = 0; i < retain; i++) { const position = start + i; next[i] = position < previous ? (this.history[position - historyStart] ?? 0) : input[position - previous]; }
    this.history = next; return output;
  }

  flush() { return this.push(new Float32Array(), true); }
  get retainedPcmBytes() { return this.history.byteLength; }
  get lookaheadMs() { return this.radius / this.from * 1000; }
}
