/** A recording uses the AudioContext source clock, never the wall clock or Blob cadence. */
export class RecordingClock {
  private origin: number | null = null;
  private cutoff: number | null = null;
  private latest = 0;
  constructor(private sourceSeconds: () => number) {}
  start() {
    const source = this.sourceSeconds();
    if (!Number.isFinite(source) || source < 0) throw new Error('音频时钟尚未就绪。');
    this.origin = source; this.cutoff = null; this.latest = 0;
  }
  at(sourceSeconds: number) {
    if (this.origin === null || !Number.isFinite(sourceSeconds)) return 0;
    const ms = Math.max(0, (sourceSeconds - this.origin) * 1000);
    return this.cutoff === null ? ms : Math.min(ms, this.cutoff);
  }
  accepts(sourceSeconds: number) { return this.origin !== null && Number.isFinite(sourceSeconds) && sourceSeconds >= this.origin && (this.cutoff === null || (sourceSeconds - this.origin) * 1000 <= this.cutoff); }
  get positionMs() {
    if (this.cutoff !== null) return this.cutoff;
    this.latest = Math.max(this.latest, this.at(this.sourceSeconds()));
    return this.latest;
  }
  stop() { if (this.cutoff === null) this.cutoff = this.positionMs; return this.cutoff; }
}
