import { describe, expect, it } from 'vitest';
import { aggregateAudioCategories, AudioClassificationTracker, instrumentEvidence, type AudioClassification } from '@sonoscope/core';
const window = (timestampMs: number, labels: Record<string, number>): AudioClassification => ({ timestampMs, classifications: [{ headIndex: 0, categories: Object.entries(labels).map(([categoryName, score], index) => ({ index, categoryName, score })) }] });
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
    expect(instrumentEvidence(raw)).toBeNull(); expect(instrumentEvidence({ ...raw, version: 'yamnet-float32-1-temporal-1' })?.confidence).toBe(.08203125);
  });
});
