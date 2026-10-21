import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TempoTracker } from '@sonoscope/core';
const corpus = JSON.parse(readFileSync(new URL('../artifacts/guitarset-tempo-traces-20261021.json', import.meta.url), 'utf8')) as { traces: { name: string; role: string; bpm: number; beatTimes: number[]; frames: [number, number, number][] }[] };
describe('tempo from annotated real performances', () => {
  it.each(corpus.traces.filter(t => t.role === 'acceptance-regression'))('$name follows published beats without accepting a half/double tempo', trace => {
    const intervals = trace.beatTimes.slice(1).map((t, i) => t - trace.beatTimes[i]).sort((a, b) => a - b);
    const reference = 60 / intervals[Math.floor(intervals.length / 2)];
    expect(reference).toBeCloseTo(trace.bpm, 5);
    const tracker = new TempoTracker(); let eligible = 0, known = 0, correct = 0, octaveErrors = 0;
    for (const [time, rms, flux] of trace.frames) {
      const estimate = tracker.update(time, rms, flux);
      if (time < 8) continue;
      eligible++;
      if (estimate && estimate.confidence >= .7) {
        known++; correct += Number(Math.abs(estimate.bpm - reference) / reference <= .03);
        octaveErrors += Number(Math.abs(estimate.bpm / reference - .5) < .03 || Math.abs(estimate.bpm / reference - 2) < .06);
      }
    }
    expect(correct / eligible).toBeGreaterThanOrEqual(.8); expect(correct / known).toBeGreaterThanOrEqual(.95); expect(octaveErrors).toBe(0);
  });
  it.each(corpus.traces.filter(t => t.role === 'diagnostic-regression'))('$name may stay unknown rather than report a confident wrong beat', trace => {
    const tracker = new TempoTracker();
    for (const [time, rms, flux] of trace.frames) {
      const estimate = tracker.update(time, rms, flux);
      if (time >= 8 && estimate && estimate.confidence >= .7) expect(Math.abs(estimate.bpm - trace.bpm) / trace.bpm).toBeLessThanOrEqual(.03);
    }
  });
  it('discontinuities clear the old estimate, including a reversed timestamp', () => {
    const tracker = new TempoTracker(), trace = corpus.traces[0];
    for (const [time, rms, flux] of trace.frames) tracker.update(time, rms, flux);
    expect(tracker.update(100, .1, .3)).toBeNull(); expect(tracker.update(1, .1, .3)).toBeNull();
  });
});
