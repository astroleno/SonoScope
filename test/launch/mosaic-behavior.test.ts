import { readFileSync } from 'node:fs';
import { describe, it, expect, vi } from 'vitest';
import { MosaicVisual } from '../../app/visuals/mosaic';
import { traceMosaic } from './mosaic-trace';

describe('Mosaic rendering and cellular evolution', () => {
  it('preserves the frozen original trace across audio, ghosts, palettes, and resize', () => {
    const logging = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const golden = JSON.parse(readFileSync(new URL('../artifacts/mosaic-behavior-20261022.json', import.meta.url), 'utf8'));
      expect(traceMosaic(MosaicVisual)).toEqual(golden.trace);
    } finally { logging.mockRestore(); }
  });
});
