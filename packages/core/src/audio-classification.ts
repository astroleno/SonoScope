import type { ModelResult } from './contracts';
import { hasValidatedTemporalEvidence, YAMNET_MODEL_PROFILE, type AudioModelProfile } from './audio-model-profiles';

export const AUDIO_MODEL_SAMPLE_RATE = 16000;
export const AUDIO_MODEL_SAMPLES = 15600;
export const AUDIO_MODEL_HOP_SAMPLES = 3840;
export const MIN_INSTRUMENT_SCORE = .08;
export function instrumentEvidence(model: ModelResult | null): ModelResult['instrument'] {
  const value = model?.instrument;
  return value && (value.confidence >= .4 || (hasValidatedTemporalEvidence(model!.version) && value.confidence >= MIN_INSTRUMENT_SCORE)) ? value : null;
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
// AudioSet places Rattle (instrument), including Maraca, under Percussion.
// Ordinary Rattle remains an environmental sound. Keep the released YAMNet policy.
const mn10Instruments = instruments.map(instrument => instrument.label === 'Percussion' ? { ...instrument, names: [...instrument.names, 'Rattle (instrument)'] } : instrument);
const mn10OtherInstruments = otherInstruments.filter(label => label !== 'Rattle (instrument)');
export function instrumentComment(label: string): string | null { return instruments.find(i => i.label === label)?.text ?? null; }

/** Ignore incomplete padded chunks and merge by class, retaining the score's original scale. */
export function aggregateAudioCategories(results: AudioClassification[], samples: number, profile: AudioModelProfile = YAMNET_MODEL_PROFILE): Category[] {
  const windows = results.filter(r => Math.round((r.timestampMs ?? 0) * profile.sampleRate / 1000) + profile.windowSamples <= samples);
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

type Observation = { at: number; scores: Map<string, number> };
function rankInstruments(history: Observation[], mn10 = false) {
  return (mn10 ? mn10Instruments : instruments).map(instrument => {
    const values = history.map(h => Math.max(0, ...instrument.names.map(n => h.scores.get(n) ?? 0)));
    return { ...instrument, mean: values.reduce((a, b) => a + b, 0) / values.length, peak: Math.max(...values), support: values.filter(v => v >= .12).length, weakSupport: values.filter(v => v >= .05).length, present: values.filter(v => v >= .015).length, current: values.at(-1)! };
  }).sort((a, b) => b.mean - a.mean);
}
function unsupportedMean(history: Observation[], mn10 = false) {
  return Math.max(0, ...(mn10 ? mn10OtherInstruments : otherInstruments).map(label => history.reduce((sum, h) => sum + (h.scores.get(label) ?? 0), 0) / history.length));
}
function sustainedQuietChoice(history: Observation[], capturedAt: number) {
  const recent = history.slice(-7);
  if (recent.length < 7 || capturedAt - recent[0].at < 2200) return null;
  const music = recent.map(h => h.scores.get('Music') ?? 0);
  if (Math.min(...music) < .75 || Math.max(...music) < .9 || music.reduce((a, b) => a + b, 0) / music.length < .85) return null;
  if (recent.some(h => [...h.scores].some(([label, score]) => /speech|singing|vocal|choir|humming|whistling/i.test(label) && score >= .05))) return null;
  if (recent.reduce((n, h) => n + (h.scores.get('Musical instrument') ?? 0), 0) / recent.length < .1) return null;
  const candidates = rankInstruments(recent, true), choice = candidates[0];
  const rival = Math.max(candidates[1].mean, unsupportedMean(recent, true));
  return choice.peak < .4 && choice.peak >= .12 && choice.mean >= .06 && choice.weakSupport >= 5 && choice.present >= 6 && choice.current >= .06 && choice.mean - rival >= .05 && choice.mean >= rival * 3.5 ? choice : null;
}
function recentStrongChoice(history: Observation[], capturedAt: number) {
  if (history.length < 3) return null;
  let start = history.length - 3;
  while (start > 0 && capturedAt - history[start].at < 800) start--;
  const recent = history.slice(start), candidates = rankInstruments(recent, true), choice = candidates[0];
  const full = rankInstruments(history, true);
  return capturedAt - recent[0].at >= 800 && choice.peak >= .4 && choice.mean >= .3 && choice.support >= 3 && choice.current >= .12
    && choice.mean >= Math.max(candidates[1].mean, unsupportedMean(recent, true)) * 1.5
    && full[0].label === choice.label && full[0].mean >= .15 && full[0].mean >= Math.max(full[1].mean, unsupportedMean(history, true)) * 1.5 ? choice : null;
}
export class AudioClassificationTracker {
  private history: Observation[] = [];
  private active: { label: string; supportedAt: number } | null = null;
  constructor(private readonly policy: AudioModelProfile['id'] = 'yamnet') {}
  update(categories: Category[], capturedAt: number): ModelResult['instrument'] {
    const last = this.history.at(-1)?.at;
    if (last !== undefined && (capturedAt <= last || capturedAt - last > 1500)) { this.history = []; this.active = null; }
    const scores = new Map(categories.map(c => [c.label, c.score]));
    // A fresh non-musical window clears both active and historical support.
    const mn10 = this.policy === 'mn10-v6';
    if (mn10 ? Math.max(scores.get('Music') ?? 0, scores.get('Musical instrument') ?? 0) < .2 : (scores.get('Music') ?? 0) < .5) { this.history = []; this.active = null; return null; }
    this.history.push({ at: capturedAt, scores });
    this.history = this.history.filter(h => capturedAt - h.at <= 2500).slice(-12);
    if (this.history.length < 2) return null;
    const ranked = rankInstruments(this.history, mn10);
    const best = ranked[0], runner = ranked[1];
    const other = unsupportedMean(this.history, mn10);
    if (this.active) {
      const active = ranked.find(i => i.label === this.active!.label)!;
      const challenger = Math.max(0, ...ranked.filter(i => i !== active).map(i => i.current), ...(mn10 ? mn10OtherInstruments : otherInstruments).map(label => scores.get(label) ?? 0));
      const sustainedChallenge = ranked.some(other => other !== active && other.mean >= .18 && other.mean > active.mean * 1.7 && other.support >= 3);
      const voiceReplacedInstrument = active.current < .05 && [...scores].some(([label, score]) => /speech|singing|vocal|choir|humming|whistling/i.test(label) && score >= .5);
      if (challenger >= .8 || sustainedChallenge || voiceReplacedInstrument) this.active = null;
      else {
        if (active.current >= .12 && active.current >= challenger * (mn10 ? 1.1 : 2)) this.active.supportedAt = capturedAt;
        if (capturedAt - this.active.supportedAt <= 3000 && active.current >= .015 && active.peak >= MIN_INSTRUMENT_SCORE && active.current >= challenger * (challenger >= .18 ? 1.1 : .8)) return { label: active.label, confidence: active.peak };
        if (capturedAt - this.active.supportedAt > 3000) this.active = null;
      }
    }
    const tentative = best.peak < .4;
    const span = capturedAt - this.history[0].at;
    const usual = mn10
      ? span >= (tentative ? 400 : 800) && best.peak >= .18 && best.mean >= (tentative ? .15 : .3) && best.support >= 3 && best.current >= (tentative ? .05 : .12) && best.mean >= Math.max(runner.mean, other) * (tentative ? 2.5 : 1.5)
      : span >= 400 && best.peak >= .18 && best.mean >= .15 && best.support >= (tentative ? 3 : 2) && best.current >= .05 && best.mean >= Math.max(runner.mean, other) * (tentative ? 2.5 : 1.7);
    let choice = best;
    if (!usual) {
      // Use the shortest recent suffix that still spans real elapsed evidence.
      // Earlier quiet note tails must not delay a new sustained observation.
      let start = Math.max(0, this.history.length - 6);
      while (start > 0 && capturedAt - this.history[start].at < 1400) start--;
      const recent = this.history.slice(start), candidates = rankInstruments(recent, mn10);
      choice = candidates[0];
      const cautious = choice.peak < .4 && recent.length >= 6 && capturedAt - recent[0].at >= 1400
        && recent.every(h => (h.scores.get('Music') ?? 0) >= .9 && ![...h.scores].some(([label, score]) => /speech|singing|vocal|choir|humming|whistling/i.test(label) && score >= .1))
        && choice.peak >= MIN_INSTRUMENT_SCORE && choice.mean >= .04 && choice.weakSupport >= 2 && choice.present >= Math.ceil(recent.length * .7) && choice.current >= .03 && choice.mean >= Math.max(candidates[1].mean, unsupportedMean(recent, mn10)) * 4;
      if (!cautious) {
        const admitted = mn10 ? sustainedQuietChoice(this.history, capturedAt) ?? recentStrongChoice(this.history, capturedAt) : null;
        if (!admitted) return null;
        choice = admitted;
      }
    }
    this.active = { label: choice.label, supportedAt: capturedAt };
    // Confidence is an observed peak, not a sum of correlated parent labels or an invented probability.
    return { label: choice.label, confidence: choice.peak };
  }
}
