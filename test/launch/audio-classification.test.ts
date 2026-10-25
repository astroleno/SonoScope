import { describe, expect, it } from 'vitest';
import { aggregateAudioCategories, AudioClassificationTracker, instrumentEvidence, MN10_MODEL_PROFILE, MN10_MODEL_VERSION, type AudioClassification } from '@sonoscope/core';
const window = (timestampMs: number, labels: Record<string, number>): AudioClassification => ({ timestampMs, classifications: [{ headIndex: 0, categories: Object.entries(labels).map(([categoryName, score], index) => ({ index, categoryName, score })) }] });

describe('validated mn10 profile', () => {
  it('requires all64000 genuine input samples instead of counting its internal padded tail', () => {
    const results = [window(0, { Piano: .8 }), window(2000, { Piano: .2 })];
    expect(aggregateAudioCategories(results, 63999, MN10_MODEL_PROFILE)).toEqual([]);
    expect(aggregateAudioCategories(results, 64000, MN10_MODEL_PROFILE)).toEqual([{ label: 'Piano', score: .8 }]);
    expect(aggregateAudioCategories(results, 128000, MN10_MODEL_PROFILE)).toEqual([{ label: 'Piano', score: .5 }]);
  });
  it('admits sustained quiet evidence only after seven real observations, without changing the YAMNet policy', () => {
    const mn10 = new AudioClassificationTracker('mn10-v6'), yamnet = new AudioClassificationTracker();
    const guitar = [.07, .14, .07, .07, .035, .08, .08], music = [.88, .91, .87, .86, .82, .82, .86];
    for (let i = 0; i < 7; i++) {
      const input = categories({ Music: music[i], 'Musical instrument': .12, Guitar: guitar[i], Maraca: .02 });
      const result = mn10.update(input, i * 400); expect(yamnet.update(input, i * 400)).toBeNull();
      expect(result).toEqual(i === 6 ? { label: 'Guitar', confidence: .14 } : null);
    }
  });
  it('rejects quiet guitar-like evidence accompanied by voice or a competing ukulele', () => {
    for (const extra of [{ Speech: .06 }, { Ukulele: .07 }]) {
      const tracker = new AudioClassificationTracker('mn10-v6');
      for (let i = 0; i < 7; i++) expect(tracker.update(categories({ Music: i === 1 ? .91 : .88, 'Musical instrument': .12, Guitar: i === 1 ? .14 : .07, ...extra }), i * 400)).toBeNull();
    }
  });
  it('keeps the strong gate while allowing a new clear phrase to replace earlier ambiguity', () => {
    const tracker = new AudioClassificationTracker('mn10-v6');
    for (let i = 0; i < 6; i++) expect(tracker.update(categories({ Music: .8, Piano: .1, Harp: .18 }), i * 400)).toBeNull();
    for (let i = 0; i < 3; i++) expect(tracker.update(categories({ Music: .8, Piano: .44 + i * .02, Harp: .01 }), 2400 + i * 400)).toEqual(i === 2 ? { label: 'Piano', confidence: .48 } : null);
  });
  it('does not trust an arbitrary model merely because its version ends in temporal-2', () => {
    const result = { version: MN10_MODEL_VERSION, capturedAt: 1000, categories: [], voiceProbability: 0, instrument: { label: 'Guitar', confidence: .14 } };
    expect(instrumentEvidence(result)?.label).toBe('Guitar'); expect(instrumentEvidence({ ...result, version: 'unvalidated-temporal-2' })).toBeNull();
  });
  it('retains the frozen quiet-evidence music peak and general instrument gates', () => {
    for (const [music, general, admitted] of [[Array(7).fill(.89), .12, false], [[.91, .88, .88, .88, .88, .88, .88], .12, true], [[.91, .88, .88, .88, .88, .88, .88], .09, false]] as [number[], number, boolean][]) {
      const tracker = new AudioClassificationTracker('mn10-v6'); let result = null;
      for (let i = 0; i < 7; i++) result = tracker.update(categories({ Music: music[i], 'Musical instrument': general, Guitar: i === 1 ? .14 : .07, Maraca: .02 }), i * 400);
      expect(result?.label ?? null).toBe(admitted ? 'Guitar' : null);
    }
  });
  it('groups instrumental rattles and maracas as percussion without adding their scores', () => {
    const tracker = new AudioClassificationTracker('mn10-v6'), yamnet = new AudioClassificationTracker(); let result = null;
    for (let i = 0; i < 3; i++) {
      const input = categories({ Music: .6, 'Rattle (instrument)': .5, Maraca: .45 });
      result = tracker.update(input, i * 400); expect(yamnet.update(input, i * 400)).toBeNull();
    }
    expect(result).toEqual({ label: 'Percussion', confidence: .5 });
  });
  it('does not promote a mechanical rattle or a nonmusical shake into percussion', () => {
    for (const input of [categories({ Music: .9, Rattle: .95 }), categories({ Music: .1, 'Musical instrument': .1, 'Rattle (instrument)': .95 })]) {
      const tracker = new AudioClassificationTracker('mn10-v6');
      for (let i = 0; i < 10; i++) expect(tracker.update(input, i * 400)).toBeNull();
    }
  });
});
const categories = (scores: Record<string, number>) => Object.entries(scores).map(([label, score]) => ({ label, score }));
describe('recorded-audio classification evidence', () => {
  it('excludes the padded tail of a one-second input and does not duplicate categories', () => {
    const results = [window(0, { Music: .9, Piano: .5 }), window(975, { Silence: .99, Music: .1 })];
    expect(aggregateAudioCategories(results, 16000)).toEqual([{ label: 'Music', score: .9 }, { label: 'Piano', score: .5 }]);
    expect(aggregateAudioCategories(results, 31200)).toEqual([{ label: 'Music', score: .5 }, { label: 'Silence', score: .495 }, { label: 'Piano', score: .25 }]);
    expect(aggregateAudioCategories(results, 15599)).toEqual([]);
  });
  it('ignores additional output heads and does not add correlated duplicate class scores', () => {
    const input = window(0, { Piano: .3 }); input.classifications[0].categories.push({ index: 1, categoryName: 'Piano', score: .2 });
    input.classifications.push({ headIndex: 1, categories: [{ index: 0, categoryName: 'Piano', score: .99 }] });
    expect(aggregateAudioCategories([input], 15600)).toEqual([{ label: 'Piano', score: .3 }]);
  });
  it('requires repeated evidence, preserving the observed score instead of inflating probability', () => {
    const tracker = new AudioClassificationTracker();
    expect(tracker.update(categories({ Music: .99, Piano: .5 }), 1000)).toBeNull();
    expect(tracker.update(categories({ Music: .99, Piano: .2 }), 1975)).toEqual({ label: 'Piano', confidence: .5 });
    expect(tracker.update(categories({ Speech: .99, Piano: .001 }), 2950)).toBeNull();
  });
  it('requires three dominant windows before exposing a tentative instrument', () => {
    const tracker = new AudioClassificationTracker(), input = categories({ Music: .99, Piano: .26171875 });
    expect(tracker.update(input, 1000)).toBeNull(); expect(tracker.update(input, 1975)).toBeNull();
    expect(tracker.update(input, 2950)).toEqual({ label: 'Piano', confidence: .26171875 });
  });
  it('qualifies quiet instruments only after six clearly musical, dominant, voiceless windows', () => {
    const tracker = new AudioClassificationTracker(), input = categories({ Music: .99, Guitar: .109375 });
    for (let i = 0; i < 5; i++) expect(tracker.update(input, 1000 + i * 480)).toBeNull();
    expect(tracker.update(input, 3400)).toEqual({ label: 'Guitar', confidence: .109375 });
  });
  it('does not treat faster overlapping inference as independent elapsed evidence', () => {
    const tracker = new AudioClassificationTracker(), input = categories({ Music: .99, Guitar: .109375 });
    for (let i = 0; i < 6; i++) expect(tracker.update(input, 1000 + i * 240)).toBeNull();
    expect(tracker.update(input, 2440)).toEqual({ label: 'Guitar', confidence: .109375 });
    const strong = new AudioClassificationTracker();
    expect(strong.update(categories({ Music: .99, Piano: .5 }), 1000)).toBeNull();
    expect(strong.update(categories({ Music: .99, Piano: .5 }), 1240)).toBeNull();
    expect(strong.update(categories({ Music: .99, Piano: .5 }), 1480)?.label).toBe('Piano');
  });
  it('recognizes intermittent quiet attacks without requiring every window to contain a loud note', () => {
    const tracker = new AudioClassificationTracker(), values = [.03125, .09375, .04296875, .01953125, .08203125, .03125, .05859375];
    const results = values.map((score, i) => tracker.update(categories({ Music: .99, Guitar: score, Ukulele: .00390625 }), 1000 + i * 240));
    expect(results.slice(0, 6).every(v => v === null)).toBe(true);
    expect(results[6]).toEqual({ label: 'Guitar', confidence: .09375 });
    expect(tracker.update(categories({ Speech: .99, Music: .1, Guitar: .03 }), 2680)).toBeNull();
  });
  it('keeps an isolated high score or a competitor in intermittent music unknown', () => {
    for (const competitor of [0, .02]) {
      const tracker = new AudioClassificationTracker(), scores = competitor ? [.03, .09, .04, .03, .09, .03, .05] : [.01, .01, .09, .01, .01, .01, .04];
      for (let i = 0; i < scores.length; i++) expect(tracker.update(categories({ Music: .99, Guitar: scores[i], Sitar: competitor }), 1000 + i * 240)).toBeNull();
    }
  });
  it('uses sufficient recent support without waiting for older quiet tails to expire', () => {
    const tracker = new AudioClassificationTracker();
    for (let i = 0; i < 5; i++) tracker.update(categories({ Music: .99, Guitar: .00390625 }), 1000 + i * 240);
    const scores = [.015625, .01953125, .03125, .08203125, .0078125, .03125, .109375];
    const results = scores.map((score, i) => tracker.update(categories({ Music: .99, Guitar: score }), 2200 + i * 240));
    expect(results.at(-1)).toEqual({ label: 'Guitar', confidence: .109375 });
  });
  it('clears retained weak instrument evidence when speech replaces it, even if Music remains high', () => {
    const tracker = new AudioClassificationTracker(), input = categories({ Music: .99, Guitar: .2 });
    for (let i = 0; i < 7; i++) tracker.update(input, 1000 + i * 240);
    expect(tracker.update(input, 2680)?.label).toBe('Guitar');
    expect(tracker.update(categories({ Music: .99, Speech: .9, Guitar: .03 }), 2920)).toBeNull();
  });
  it('cannot combine instrument support from opposite sides of a non-musical window', () => {
    const tracker = new AudioClassificationTracker(), music = categories({ Music: .99, Piano: .5 });
    tracker.update(music, 1000);
    expect(tracker.update(categories({ Speech: .99, Music: .1 }), 1240)).toBeNull();
    expect(tracker.update(music, 1480)).toBeNull();
    expect(tracker.update(music, 1720)).toBeNull();
    expect(tracker.update(music, 1960)?.label).toBe('Piano');
  });
  it.each([
    { Music: .89, Guitar: .109375 },
    { Music: .99, Guitar: .109375, Speech: .2 },
    { Music: .99, Guitar: .109375, Ukulele: .04 },
    { Music: .99, Guitar: .109375, Sitar: .04 },
  ])('does not promote a weak score with uncertain music, voice, or another instrument: %j', scores => {
    const tracker = new AudioClassificationTracker();
    for (let i = 0; i < 8; i++) expect(tracker.update(categories(scores), 1000 + i * 480)).toBeNull();
  });
  it('does not turn competing instruments or a bass drum into a bass guitar', () => {
    const tracker = new AudioClassificationTracker();
    for (const at of [1000, 1975, 2950]) expect(tracker.update(categories({ Music: .99, Piano: .5, Guitar: .45 }), at)).toBeNull();
    for (const at of [5000, 5975, 6950]) tracker.update(categories({ Music: .99, 'Bass drum': .8, Percussion: .7 }), at);
    expect(tracker.update(categories({ Music: .99, 'Bass drum': .8, Percussion: .7 }), 7925)?.label).toBe('Percussion');
  });
  it('does not select a supported instrument over a dominant unsupported instrument', () => {
    const tracker = new AudioClassificationTracker();
    for (const at of [1000, 1975, 2950]) expect(tracker.update(categories({ Music: .99, Sitar: .9, Guitar: .5 }), at)).toBeNull();
  });
  it('a long gap and a reversed clock clear old support', () => {
    const tracker = new AudioClassificationTracker(), input = categories({ Music: .99, Guitar: .8 });
    tracker.update(input, 1000); expect(tracker.update(input, 3000)).toBeNull(); expect(tracker.update(input, 3975)).not.toBeNull(); expect(tracker.update(input, 1000)).toBeNull();
  });
  it('continuity never raises the raw score, and continued weak evidence must qualify afresh', () => {
    const tracker = new AudioClassificationTracker();
    tracker.update(categories({ Music: .99, Guitar: .5 }), 1000);
    tracker.update(categories({ Music: .99, Guitar: .5 }), 1480);
    for (let at = 1960; at <= 3880; at += 480) tracker.update(categories({ Music: .99, Guitar: .08203125 }), at);
    expect(tracker.update(categories({ Music: .99, Guitar: .08203125 }), 4360)?.confidence).toBe(.08203125);
    expect(tracker.update(categories({ Music: .99, Guitar: .08203125 }), 4840)?.confidence).toBe(.08203125);
    expect(tracker.update(categories({ Music: .99, Guitar: .00390625 }), 5320)).toBeNull();
    expect(tracker.update(categories({ Silence: .99 }), 5800)).toBeNull();
    const raw = { version: 'yamnet', capturedAt: 1000, categories: [], voiceProbability: 0, instrument: { label: 'Guitar', confidence: .08203125 } };
    expect(instrumentEvidence(raw)).toBeNull();
    for (const version of ['yamnet-float32-1-temporal-1', 'yamnet-float32-1-temporal-2']) expect(instrumentEvidence({ ...raw, version })?.confidence).toBe(.08203125);
  });
});
