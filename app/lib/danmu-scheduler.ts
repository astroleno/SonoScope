export type SchedulerConfig = {
  minIntervalSec?: number; // absolute min
  baseMinSec?: number; // jitter min
  baseMaxSec?: number; // jitter max
  maxConcurrency?: number;
  upThreshold?: number; // hysteresis up
  downThreshold?: number; // hysteresis down
};

export class DanmuScheduler {
  private config: Required<SchedulerConfig>;
  private currentConcurrency = 1;
  private highState = false;
  private lastSwitchTs = 0;

  constructor(cfg?: SchedulerConfig) {
    this.config = {
      minIntervalSec: 2.5,
      baseMinSec: 3.0,
      baseMaxSec: 8.0,
      maxConcurrency: 3,
      upThreshold: 0.65,
      downThreshold: 0.4,
      ...cfg,
    } as Required<SchedulerConfig>;
  }

  // drive in [0,1]
  nextIntervalSec(drive: number): number {
    const base = this.randomUniform(
      this.config.baseMinSec,
      this.config.baseMaxSec
    );
    const factor = 1.0 - 0.55 * this.clamp01(drive);
    const interval = Math.max(
      this.config.minIntervalSec,
      Math.min(base * factor, this.config.baseMaxSec)
    );
    return interval;
  }

  concurrency(drive: number, now: number = Date.now()): number {
    const d = this.clamp01(drive);
    const wantHigh = d > this.config.upThreshold;
    const wantLow = d < this.config.downThreshold;

    if (!this.highState && wantHigh) {
      // promote after short confirmation window
      if (now - this.lastSwitchTs > 400) {
        this.highState = true;
        this.lastSwitchTs = now;
      }
    } else if (this.highState && wantLow) {
      if (now - this.lastSwitchTs > 800) {
        this.highState = false;
        this.lastSwitchTs = now;
      }
    }

    const baseConc = 1 + Math.floor(2.5 * d);
    this.currentConcurrency = Math.max(
      1,
      Math.min(this.config.maxConcurrency, baseConc)
    );
    return this.currentConcurrency;
  }

  driveFromRms(rms: number): number {
    // simple mapping: rms [0,1] to drive, conservative curve
    const clamped = this.clamp01(rms);
    return Math.pow(clamped, 0.8);
  }

  private randomUniform(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  private clamp01(x: number): number {
    return Math.max(0, Math.min(1, x));
  }
}
