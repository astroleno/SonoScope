import { createHash } from 'node:crypto';
import type { MosaicVisual, MosaicControls, MosaicAudioUniforms } from '../../app/visuals/mosaic';

class Color {
  constructor(public rgba: number[]) {}
  setAlpha(alpha: number) { this.rgba[3] = alpha; }
}
class DrawingTrace {
  width = 128; height = 96;
  RGB = 'rgb'; HSB = 'hsb'; CENTER = 'center'; CORNER = 'corner';
  commands: unknown[] = [];
  private seed = 0x98a31;
  private mode = this.RGB;
  private max = 255;
  private style = { x: 0, y: 0, rect: 'corner', fill: [0, 0, 0, 255] };
  private stack: typeof this.style[] = [];
  private transforms: [number, number][] = [];
  drawingContext = {
    save: () => { this.transforms.push([this.style.x, this.style.y]); },
    translate: (x: number, y: number) => this.translate(x, y),
    restore: () => { [this.style.x, this.style.y] = this.transforms.pop()!; },
  };
  random(values?: number | string[]) {
    this.seed ^= this.seed << 13; this.seed ^= this.seed >>> 17; this.seed ^= this.seed << 5;
    const n = (this.seed >>> 0) / 4294967296;
    return Array.isArray(values) ? values[Math.floor(n * values.length)] : n * (values ?? 1);
  }
  noise(...values: number[]) { const x = Math.sin(values.reduce((s, v, i) => s + v * (12.9898 + i * 78.233), 0)) * 43758.5453; return x - Math.floor(x); }
  sin = Math.sin;
  constrain(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
  map(v: number, a: number, b: number, c: number, d: number) { return c + (v - a) / (b - a) * (d - c); }
  colorMode(mode: string, max: number) { this.mode = mode; this.max = max; }
  color(value: string | Color | number, s?: number, v?: number, alpha = this.max): Color {
    if (value instanceof Color) return value;
    if (typeof value === 'string') {
      const hex = value.slice(1); return new Color([0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)).concat(hex.length === 8 ? parseInt(hex.slice(6), 16) : 255));
    }
    if (this.mode === this.HSB) {
      const h = ((value % 1) + 1) % 1 * 6, sat = s!, val = v!, f = h - Math.floor(h), p = val * (1 - sat), q = val * (1 - sat * f), t = val * (1 - sat * (1 - f));
      return new Color([[val, t, p], [q, val, p], [p, val, t], [p, q, val], [t, p, val], [val, p, q]][Math.floor(h)].map(x => x * 255).concat(alpha * 255));
    }
    return new Color([value, s!, v!, alpha]);
  }
  lerpColor(a: Color, b: Color, t: number) { return new Color(a.rgba.map((x, i) => x + (b.rgba[i] - x) * Math.max(0, Math.min(1, t)))); }
  fill(color: Color) { this.style.fill = color.rgba.slice(); }
  noStroke() {}
  push() { this.stack.push({ ...this.style, fill: this.style.fill.slice() }); }
  pop() { this.style = this.stack.pop()!; }
  rectMode(mode: string) { this.style.rect = mode; }
  translate(x: number, y: number) { this.style.x += x; this.style.y += y; }
  private record(shape: string, values: number[]) { this.commands.push([shape, values, this.style.fill.slice()]); }
  rect(x: number, y: number, w: number, h: number) { const center = this.style.rect === this.CENTER; this.record('rect', [this.style.x + x - (center ? w / 2 : 0), this.style.y + y - (center ? h / 2 : 0), w, h]); }
  ellipse(x: number, y: number, w: number, h: number) { this.record('ellipse', [this.style.x + x, this.style.y + y, w, h]); }
  triangle(...xy: number[]) { this.record('triangle', xy.map((v, i) => v + (i % 2 ? this.style.y : this.style.x))); }
}

/** Frozen old-renderer trace: random order, geometry, colors, ghosts, and state. */
export function traceMosaic(Visual: typeof MosaicVisual) {
  const p = new DrawingTrace(), visual = new Visual(p, { cellSize: 16, maxAge: 7, growthRate: .05, spawnRate: .2, colorScheme: 2, colorFlowSpeed: .01, alpha: .7 }, { level: 0, flux: 0, centroid: 0, flatness: 0, zcr: 0, mfcc: [0, 0, 0, 0] });
  const hash = createHash('sha256'), checkpoints: string[] = [];
  const digest = (v: unknown) => JSON.stringify(v, (_key, value) => typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 1e10) / 1e10 : value);
  for (let frame = 0; frame < 160; frame++) {
    const audio: MosaicAudioUniforms = { level: (frame % 13) / 13, flux: (frame % 7) / 7, centroid: (frame % 11) / 11, flatness: .3, zcr: .2, mfcc: [frame % 2, .2, .5, .8], pulse: frame % 9 / 9, bandLow: .7, bandMid: .4, bandHigh: .2 };
    const controls: MosaicControls = { cellSize: frame >= 80 ? 13 : 16, maxAge: 7, growthRate: .05, spawnRate: .2, colorScheme: Math.floor(frame / 40), colorFlowSpeed: .01, alpha: .7, spectrumMode: frame % 40 < 25, auroraMode: frame >= 120 };
    visual.syncState(controls, audio, { bandColumns: frame % 17 < 14 ? [.3, .7, .2, .9, .1, .8] : [] });
    if (frame === 90) { p.width = 113; p.height = 79; visual.resize(); }
    p.commands = []; visual.draw();
    const state = (visual as unknown as { grid: unknown }).grid;
    hash.update(digest([p.commands, state]));
    if (frame % 20 === 19) checkpoints.push(hash.copy().digest('hex'));
  }
  return { sha256: hash.digest('hex'), checkpoints };
}
