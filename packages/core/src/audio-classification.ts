import type { ModelResult } from './contracts';

export const AUDIO_MODEL_SAMPLE_RATE = 16000;
export const AUDIO_MODEL_SAMPLES = 15600;
export const AUDIO_MODEL_HOP_SAMPLES = 7680;
export const MIN_INSTRUMENT_SCORE = .08;
export function instrumentEvidence(model: ModelResult | null): ModelResult['instrument'] {
  const value = model?.instrument;
  return value && (value.confidence >= .4 || (model!.version.endsWith('-temporal-1') && value.confidence >= MIN_INSTRUMENT_SCORE)) ? value : null;
}
type Category = { label: string; score: number };
export interface AudioClassification {
  timestampMs?: number;
  classifications: { headIndex: number; categories: { index: number; categoryName?: string; score: number }[] }[];
}

// Parent and child probabilities are correlated: take their maximum, never add them.
const instruments: { label: string; names: string[]; text: string }[] = [
  { label: 'Piano', names: ['Piano', 'Electric piano'], text: '听起来像是钢琴在演奏' },
  { label: 'Guitar', names: ['Guitar', 'Acoustic guitar', 'Electric guitar', 'Steel guitar, slide guitar'], text: '听起来像是吉他的拨弦声' },
  { label: 'Bass guitar', names: ['Bass guitar'], text: '听起来像是贝斯的声音' },
  { label: 'Double bass', names: ['Double bass'], text: '听起来像是低音提琴的声音' },
  { label: 'Percussion', names: ['Percussion', 'Drum kit', 'Drum machine', 'Drum', 'Snare drum', 'Bass drum', 'Timpani', 'Tabla', 'Cymbal', 'Hi-hat', 'Wood block', 'Tambourine', 'Maraca'], text: '听起来像是打击乐的敲击声' },
  { label: 'Violin, fiddle', names: ['Violin, fiddle'], text: '听起来像是小提琴在演奏' },
  { label: 'Cello', names: ['Cello'], text: '听起来像是大提琴在演奏' },
  { label: 'Flute', names: ['Flute'], text: '听起来像是长笛的声音' },
  { label: 'Saxophone', names: ['Saxophone'], text: '听起来像是萨克斯在演奏' },
  { label: 'Trumpet', names: ['Trumpet'], text: '听起来像是小号的声音' },
  { label: 'Trombone', names: ['Trombone'], text: '听起来像是长号的声音' },
  { label: 'Synthesizer', names: ['Synthesizer'], text: '听起来像是合成器的声音' },
  { label: 'Organ', names: ['Organ', 'Electronic organ', 'Hammond organ'], text: '听起来像是风琴的声音' },
  { label: 'Harp', names: ['Harp'], text: '听起来像是竖琴在演奏' },
  { label: 'Harmonica', names: ['Harmonica'], text: '听起来像是口琴在演奏' },
  { label: 'Accordion', names: ['Accordion'], text: '听起来像是手风琴在演奏' },
  { label: 'Clarinet', names: ['Clarinet'], text: '听起来像是单簧管的声音' },
  { label: 'Ukulele', names: ['Ukulele'], text: '听起来像是尤克里里在演奏' },
  { label: 'Banjo', names: ['Banjo'], text: '听起来像是班卓琴的声音' },
  { label: 'Mandolin', names: ['Mandolin'], text: '听起来像是曼陀林在演奏' },
  { label: 'Mallet percussion', names: ['Mallet percussion', 'Marimba, xylophone', 'Glockenspiel', 'Vibraphone'], text: '听起来像是琴槌敲击的声音' },
];
const otherInstruments = ['Sitar', 'Zither', 'Harpsichord', 'Sampler', 'Rattle (instrument)', 'Gong', 'Tubular bells', 'Steelpan', 'French horn', 'Bagpipes', 'Didgeridoo', 'Shofar', 'Theremin', 'Singing bowl'];
export function instrumentComment(label: string): string | null { return instruments.find(i => i.label === label)?.text ?? null; }

/** Ignore incomplete padded chunks and merge by class, retaining the score's original scale. */
export function aggregateAudioCategories(results: AudioClassification[], samples: number): Category[] {
  const windows = results.filter(r => Math.round((r.timestampMs ?? 0) * AUDIO_MODEL_SAMPLE_RATE / 1000) + AUDIO_MODEL_SAMPLES <= samples);
  if (!windows.length) return [];
  const sums = new Map<string, number>();
  for (const window of windows) {
    const unique = new Map<string, number>();
    for (const head of window.classifications.filter(h => h.headIndex === 0)) for (const c of head.categories) {
      if (!Number.isFinite(c.score) || c.score < 0 || c.score > 1) continue;
      const label = c.categoryName || `class-${c.index}`;
      unique.set(label, Math.max(unique.get(label) ?? 0, c.score));
    }
    for (const [label, score] of unique) sums.set(label, (sums.get(label) ?? 0) + score);
  }
  return [...sums].map(([label, sum]) => ({ label, score: sum / windows.length })).sort((a, b) => b.score - a.score);
}

export class AudioClassificationTracker {
  private history: { at: number; scores: Map<string, number> }[] = [];
  private active: { label: string; supportedAt: number } | null = null;
  update(categories: Category[], capturedAt: number): ModelResult['instrument'] {
    const last = this.history.at(-1)?.at;
    if (last !== undefined && (capturedAt <= last || capturedAt - last > 1500)) { this.history = []; this.active = null; }
    const scores = new Map(categories.map(c => [c.label, c.score]));
    this.history.push({ at: capturedAt, scores });
    this.history = this.history.filter(h => capturedAt - h.at <= 2500).slice(-6);
    // A fresh non-musical window clears past instrument evidence immediately.
    if ((scores.get('Music') ?? 0) < .5) { this.active = null; return null; }
    if (this.history.length < 2) return null;
    const ranked = instruments.map(instrument => {
      const values = this.history.map(h => Math.max(0, ...instrument.names.map(n => h.scores.get(n) ?? 0)));
      return { ...instrument, mean: values.reduce((a, b) => a + b, 0) / values.length, peak: Math.max(...values), support: values.filter(v => v >= .12).length, weakSupport: values.filter(v => v >= .05).length, current: values.at(-1)! };
    }).sort((a, b) => b.mean - a.mean);
    const best = ranked[0], runner = ranked[1];
    const other = Math.max(0, ...otherInstruments.map(label => this.history.reduce((sum, h) => sum + (h.scores.get(label) ?? 0), 0) / this.history.length));
    if (this.active) {
      const active = ranked.find(i => i.label === this.active!.label)!;
      const challenger = Math.max(0, ...ranked.filter(i => i !== active).map(i => i.current), ...otherInstruments.map(label => scores.get(label) ?? 0));
      const sustainedChallenge = ranked.some(other => other !== active && other.mean >= .18 && other.mean > active.mean * 1.7 && other.support >= 3);
      if (challenger >= .8 || sustainedChallenge) this.active = null;
      else {
        if (active.current >= .12 && active.current >= challenger * 2) this.active.supportedAt = capturedAt;
        if (capturedAt - this.active.supportedAt <= 3000 && active.current >= .015 && active.peak >= MIN_INSTRUMENT_SCORE && active.current >= challenger * (challenger >= .18 ? 1.1 : .8)) return { label: active.label, confidence: active.peak };
        if (capturedAt - this.active.supportedAt > 3000) this.active = null;
      }
    }
    const tentative = best.peak < .4;
    const usual = best.peak >= .18 && best.mean >= .15 && best.support >= (tentative ? 3 : 2) && best.current >= .05 && best.mean >= Math.max(runner.mean, other) * (tentative ? 2.5 : 1.7);
    // Quiet instruments can have low independent sigmoid scores. Qualify a tentative
    // observation only after six musical windows, a wide relative lead and no voice.
    const cautious = tentative && this.history.length === 6
      && this.history.every(h => (h.scores.get('Music') ?? 0) >= .9 && ![...h.scores].some(([label, score]) => /speech|singing|vocal|choir|humming|whistling/i.test(label) && score >= .1))
      && best.peak >= MIN_INSTRUMENT_SCORE && best.mean >= MIN_INSTRUMENT_SCORE && best.weakSupport >= 5 && best.current >= .05 && best.mean >= Math.max(runner.mean, other) * 4;
    if (!usual && !cautious) return null;
    this.active = { label: best.label, supportedAt: capturedAt };
    // Confidence is an observed peak, not a sum of correlated parent labels or an invented probability.
    return { label: best.label, confidence: best.peak };
  }
}
