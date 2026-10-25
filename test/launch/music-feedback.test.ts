import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FeatureExtractor, makeFrame, type FeatureSnapshot } from '@sonoscope/core';
import { DanmuController } from '../../packages/danmu-pipeline/controller';
import { feedbackEvidence, isGroundedComment, promptFor } from '../../app/lib/server/provider';
import { frame, request } from './fixtures';
afterEach(() => vi.useRealTimers());
const realExamples = JSON.parse(readFileSync(new URL('../artifacts/music-ai-grounding-examples-20261021.json', import.meta.url), 'utf8')) as { cases: { name: string; snapshot: FeatureSnapshot; comments: string[] }[] };
describe('specific musical feedback', () => {
  it('tiered local feedback waits for measured sound, avoids unsupported music and instrument claims, and makes no AI call', () => {
    vi.useFakeTimers();
    const show = vi.fn().mockReturnValue(true), generate = vi.fn();
    const controller = new DanmuController({ show, clear() {} }, { feedbackMode: 'tiered', generate });
    const extractor = new FeatureExtractor();
    try {
      controller.setCloudEnabled(true);
      expect(controller.current.cloud).toBe('off');
      controller.start('audio-1');
      for (let seq = 0; seq < 10; seq++) {
        const pcm = Float32Array.from({ length: 1024 }, (_, i) => .2 * Math.sin(2 * Math.PI * 440 * (seq * 1024 + i) / 44100));
        const values = extractor.extract(pcm, 44100, seq * 1024 / 44100);
        controller.feedFrame(makeFrame('audio-1', seq, seq * 1024 / 44100, Date.now(), 44100, values));
        vi.advanceTimersByTime(50);
      }
      expect(show).toHaveBeenCalled();
      expect(show.mock.calls[0][0].text).not.toBe('声音进来了，开始听这一段');
      expect(show.mock.calls[0][0].text).toMatch(/声音/);
      vi.advanceTimersByTime(1500);
      const base = frame('audio-1', 11), model = { version: 'yamnet', capturedAt: Date.now(), categories: [{ label: 'Speech', score: .95 }], voiceProbability: .95, instrument: { label: 'Piano', confidence: .99 } };
      controller.feedFrame(makeFrame('audio-1', 11, 1, Date.now(), 44100, { ...base.values, tempo: { bpm: 120, confidence: .99 } }, model));
      expect(show.mock.calls.map(([c]) => c.text).join(' ')).not.toMatch(/钢琴|节拍|音乐/);
      expect(generate).not.toHaveBeenCalled();
    } finally { controller.dispose(); expect(vi.getTimerCount()).toBe(0); }
  });
  it.each(realExamples.cases)('$name retains the grounded comments from the bounded real-provider run', example => {
    for (const text of example.comments) expect(isGroundedComment(example.snapshot, text)).toBe(true);
  });
  it('a fresh instrument and then reliable tempo take priority over generic onset changes', () => {
    vi.useFakeTimers(); const show = vi.fn().mockReturnValue(true), controller = new DanmuController({ show, clear() {} });
    try {
      controller.start('audio-1'); controller.feedFrame(frame()); vi.advanceTimersByTime(1000);
      const base = frame(), values = { ...base.values, rms: .4, flux: .5, tempo: { bpm: 129, confidence: .9 } };
      const model = { version: 'yamnet', capturedAt: Date.now(), categories: [{ label: 'Music', score: .99 }], voiceProbability: .01, instrument: { label: 'Piano', confidence: .5 } };
      controller.feedFrame(makeFrame('audio-1', 1, 1, Date.now(), 44100, values, model));
      expect(show.mock.calls.at(-1)![0].text).toContain('钢琴');
      vi.advanceTimersByTime(1000); controller.feedFrame(makeFrame('audio-1', 2, 2, Date.now(), 44100, values, { ...model, capturedAt: Date.now() }));
      expect(show.mock.calls.at(-1)![0].text).toBe('节拍大约 129 BPM');
    } finally { controller.dispose(); expect(vi.getTimerCount()).toBe(0); }
  });
  it('stale and future classifications cannot produce an instrument comment', () => {
    vi.useFakeTimers(); const show = vi.fn().mockReturnValue(true), controller = new DanmuController({ show, clear() {} });
    try {
      controller.start('audio-1'); controller.feedFrame(frame()); vi.advanceTimersByTime(2000);
      const base = frame(), model = { version: 'yamnet', capturedAt: Date.now() - 3001, categories: [{ label: 'Music', score: .99 }], voiceProbability: .01, instrument: { label: 'Piano', confidence: .9 } };
      controller.feedFrame(makeFrame('audio-1', 1, 2, Date.now(), 44100, base.values, model));
      controller.feedFrame(makeFrame('audio-1', 2, 2.1, Date.now(), 44100, base.values, { ...model, capturedAt: Date.now() + 1000 }));
      expect(show).toHaveBeenCalledOnce();
    } finally { controller.dispose(); }
  });
  it('a periodic speech or noise window cannot be described as a music beat', () => {
    for (const label of ['Speech', 'Noise']) {
      const snapshot = request().snapshot; snapshot.stats.tempo = { bpm: 120, confidence: .99 }; snapshot.validity.tempo.state = 'valid';
      snapshot.model = { version: 'yamnet', capturedAt: snapshot.endAt, categories: [{ label, score: .99 }], voiceProbability: label === 'Speech' ? .99 : 0, instrument: null }; snapshot.validity.classification.state = 'valid';
      expect(feedbackEvidence(snapshot).reliableTempo).toBe(false); expect(isGroundedComment(snapshot, '这一段节拍大约120 BPM')).toBe(false);
    }
  });
  it('prioritizes actual instrument evidence, keeps tentative language, and rejects another instrument', () => {
    const r = request(), s = r.snapshot; s.validity.classification.state = 'valid';
    s.model = { version: 'yamnet-float32-1-temporal-1', capturedAt: s.endAt, categories: [{ label: 'Music', score: .99 }], voiceProbability: 0, instrument: { label: 'Piano', confidence: .26171875 } };
    expect(feedbackEvidence(s).instrumentTentative).toBe(true);
    expect(isGroundedComment(s, '听起来像是钢琴在轻轻演奏')).toBe(true); expect(isGroundedComment(s, '钢琴在这里轻轻地演奏')).toBe(false);
    expect(isGroundedComment(s, '听起来像是吉他的拨弦声')).toBe(false);
    const prompt = JSON.parse(promptFor(r)[1].content);
    expect(prompt.priorities[0]).toMatchObject({ type: 'instrument', name: 'Piano', tentative: true, requiredPrefix: '听起来像是' });
    expect(prompt.forbiddenTopics).toContain('音高、音调、调性、和弦、音阶');
    expect(prompt.forbiddenTopics).toContain('节奏、节拍、律动、BPM');
  });
  it('a broad percussion result does not authorize a specific drum kit or bass guitar', () => {
    const s = request().snapshot; s.validity.classification.state = 'valid'; s.model = { version: 'yamnet', capturedAt: s.endAt, categories: [{ label: 'Music', score: .99 }], voiceProbability: 0, instrument: { label: 'Percussion', confidence: .8 } };
    expect(isGroundedComment(s, '听起来像是打击乐的敲击声')).toBe(true); expect(isGroundedComment(s, '架子鼓的声音十分清晰')).toBe(false); expect(isGroundedComment(s, '贝斯的声音听起来很厚实')).toBe(false);
    expect(isGroundedComment(s, '这一段琴声听起来很轻巧')).toBe(false); expect(isGroundedComment(s, '琴槌敲击的声音十分清晰')).toBe(false);
  });
  it('generic piano/string wording still requires actual instrument evidence', () => {
    const s = request().snapshot;
    expect(isGroundedComment(s, '这一段琴声听起来很轻巧')).toBe(false); expect(isGroundedComment(s, '轻轻拨弦的声音十分清晰')).toBe(false);
  });
  it('rejects invented numeric tempo even when a reliable tempo is available', () => {
    const s = request().snapshot; s.stats.tempo = { bpm: 129, confidence: .9 }; s.validity.tempo.state = 'valid';
    expect(isGroundedComment(s, '节拍大约 130 BPM')).toBe(true); expect(isGroundedComment(s, '节拍大约 180 BPM')).toBe(false);
    expect(isGroundedComment(s, '每分钟约180拍的节拍')).toBe(false); expect(isGroundedComment(s, '每分钟约129拍的节拍')).toBe(true);
  });
});
