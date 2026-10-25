import { readFileSync } from 'node:fs';
import { AudioClassificationTracker } from '@sonoscope/core';
import { expect, it } from 'vitest';

type Recording = { id: string; expectedInstrument: string | null; observations: { sampleEndMs: number; playbackTime: number; categories: { label: string; score: number }[] }[] };
const corpus = JSON.parse(readFileSync(new URL('../artifacts/instrument-development-traces-20261022.json', import.meta.url), 'utf8')) as { recordings: Recording[] };
it.each(corpus.recordings)('replays native development observations without inventing an instrument: $id', recording => {
  const tracker = new AudioClassificationTracker();
  const results = recording.observations.map(row => ({ ...row, instrument: tracker.update(row.categories, row.sampleEndMs) }));
  for (const row of results) if (row.instrument) expect(row.instrument.label).toBe(recording.expectedInstrument);
  if (recording.expectedInstrument === null) expect(results.every(row => row.instrument === null)).toBe(true);
  else {
    const eligible = results.filter(row => row.playbackTime >= 3);
    expect(eligible.filter(row => row.instrument?.label === recording.expectedInstrument).length / eligible.length).toBeGreaterThanOrEqual(.8);
  }
});
