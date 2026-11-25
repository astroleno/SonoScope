import { afterEach, expect, it, vi } from 'vitest';
import { DanmuController } from '../../packages/danmu-pipeline/controller';
import type { CommentPresentation } from '../../packages/danmu-pipeline/comment-queue';
import { comment, frame } from './fixtures';

afterEach(() => vi.useRealTimers());

function setup(canShow = () => true) {
  vi.useFakeTimers();
  const shown: { text: string; at: number }[] = [];
  const controller = new DanmuController({
    show(comment) { if (!canShow()) return false; shown.push({ text: comment.text, at: Date.now() }); return true; },
    clear() {},
  }, { feedbackMode: 'acoustic' });
  controller.start('audio-1');
  const sound = frame();
  sound.values.rms = .06;
  sound.values.centroidHz = 220;
  sound.values.bands = { low: .7, mid: .2, high: .1, columns: [] };
  sound.values.hpss = { harmonic: .9, percussive: .1 };
  sound.validity.hpss.state = 'valid';
  sound.values.flux = .01;
  let seq = 0;
  const play = (ms: number) => {
    for (let t = 0; t < ms; t += 20) {
      controller.feedFrame({ ...sound, seq: seq++, capturedAt: Date.now() });
      vi.advanceTimersByTime(20);
    }
  };
  return { controller, shown, sound, play, skipFrame: () => seq++ };
}

it('uses 128 ms of consecutive strong frames for a grounded first continuity comment', () => {
  const t = setup(), start = Date.now();
  try {
    t.sound.values.centroidHz = 900;
    t.sound.values.bands = { low: .38, mid: .43, high: .19, columns: [] };
    t.sound.values.flatness = .1;
    t.play(140);
    expect(t.shown).toHaveLength(0);
    t.play(20);
    expect(t.shown).toEqual([{ text: '这段声音保持着连续', at: start + 140 }]);
  } finally { t.controller.dispose(); }
});

it('does not borrow weak audio for the first strong continuity window', () => {
  const t = setup();
  try {
    t.sound.values.centroidHz = 900;
    t.sound.values.bands = { low: .38, mid: .43, high: .19, columns: [] };
    t.sound.values.flatness = .1;
    t.sound.values.rms = .0025;
    t.play(100);
    t.sound.values.rms = .02;
    t.play(140);
    expect(t.shown).toHaveLength(0);
    t.play(20);
    expect(t.shown).toHaveLength(1);
  } finally { t.controller.dispose(); }
});

it('starts the strong evidence window over when a capture block is missing', () => {
  const t = setup(), start = Date.now();
  try {
    t.sound.values.centroidHz = 900;
    t.sound.values.bands = { low: .38, mid: .43, high: .19, columns: [] };
    t.sound.values.flatness = .1;
    t.play(80);
    t.skipFrame();
    t.play(140);
    expect(t.shown).toHaveLength(0);
    t.play(20);
    expect(t.shown).toEqual([{ text: '这段声音保持着连续', at: start + 220 }]);
  } finally { t.controller.dispose(); }
});

it('keeps the regular continuity window after the first comment has appeared', () => {
  const t = setup();
  try {
    t.sound.values.centroidHz = 900;
    t.sound.values.bands = { low: .38, mid: .43, high: .19, columns: [] };
    t.sound.values.flatness = .1;
    t.play(180);
    expect(t.shown).toHaveLength(1);
    t.sound.values.rms = 0;
    t.play(11000);
    t.sound.values.rms = .06;
    t.play(240);
    expect(t.shown).toHaveLength(1);
    t.play(20);
    expect(t.shown).toHaveLength(2);
  } finally { t.controller.dispose(); }
});

it('sparsely reaffirms a stable sound without cycling through paraphrases', () => {
  const t = setup(), onset = Date.now();
  try {
    t.play(38000);
    expect(t.shown).toHaveLength(4);
    expect(t.shown[0].at - onset).toBeLessThanOrEqual(150);
    expect(t.shown.map(c => c.text)).toEqual(Array(4).fill('这段声音的低频比较明显'));
    for (let i = 1; i < t.shown.length; i++) expect(t.shown[i].at - t.shown[i - 1].at).toBeGreaterThanOrEqual(12000);
    expect(t.controller.current.queued).toBe(0);
  } finally { t.controller.dispose(); expect(vi.getTimerCount()).toBe(0); }
});

it('retries an expired first observation when display space returns', () => {
  let room = false;
  const t = setup(() => room);
  try {
    t.play(3300);
    expect(t.shown).toHaveLength(0);
    expect(t.controller.current.queued).toBe(1);
    room = true;
    const openedAt = Date.now();
    t.play(200);
    expect(t.shown).toHaveLength(1);
    expect(t.shown[0].at - openedAt).toBeLessThanOrEqual(200);
    t.play(11700);
    expect(t.shown).toHaveLength(1);
    t.play(400);
    expect(t.shown).toHaveLength(2);
    expect(t.shown[1].at - t.shown[0].at).toBeGreaterThanOrEqual(12000);
  } finally { t.controller.dispose(); }
});

it('uses the asynchronous presentation acknowledgement and ignores an expired observation', () => {
  vi.useFakeTimers();
  let listener!: (event: CommentPresentation) => void;
  const offered: CommentPresentation[] = [];
  const controller = new DanmuController({
    show(candidate) { offered.push({ type: 'show', comment: candidate, durationMs: 4000 }); return true; },
    clear() {},
    subscribePresentation(fn) { listener = fn; return () => {}; },
  }, { feedbackMode: 'acoustic' });
  controller.start('audio-1');
  const sound = frame();
  Object.assign(sound.values, { rms: .07, centroidHz: 200, bands: { low: .8, mid: .1, high: .1, columns: [] } });
  let seq = 0;
  const play = (ms: number) => {
    for (let t = 0; t < ms; t += 20) {
      controller.feedFrame({ ...sound, seq: seq++, capturedAt: Date.now() });
      vi.advanceTimersByTime(20);
    }
  };
  try {
    play(3300);
    expect(offered).toHaveLength(2);
    expect(controller.current.localDisplayed).toBe(0);
    listener(offered[0]);
    expect(controller.current.localDisplayed).toBe(0);
    listener(offered[1]);
    expect(controller.current.localDisplayed).toBe(1);
    expect(controller.current.metrics.localFirstMs).toBe(3300);
    play(11900);
    expect(offered).toHaveLength(2);
    play(200);
    expect(offered).toHaveLength(3);
  } finally { controller.dispose(); }
});

it('replaces an unheard queued observation after silence separates two sounds', () => {
  let room = false;
  const t = setup(() => room);
  try {
    t.play(400);
    expect(t.controller.current.queued).toBe(1);
    t.sound.values.rms = 0;
    t.play(800);
    expect(t.controller.current.queued).toBe(0);
    t.sound.values.rms = .07;
    t.sound.values.centroidHz = 4400;
    t.sound.values.bands = { low: .02, mid: .03, high: .8, columns: [] };
    t.play(800);
    room = true;
    t.play(200);
    expect(t.shown.map(c => c.text)).toEqual(['这段声音的高频比较明显']);
  } finally { t.controller.dispose(); }
});

it('reports confirmed frequency changes in both directions without waiting for a steady reminder', () => {
  const t = setup();
  try {
    t.play(4000);
    const up = Date.now();
    t.sound.values.centroidHz = 4300;
    t.sound.values.bands = { low: .03, mid: .04, high: .8, columns: [] };
    t.play(4000);
    expect(t.shown[1].text).toBe('高频的声音更明显了');
    expect(t.shown[1].at - up).toBeLessThanOrEqual(1000);
    const down = Date.now();
    t.sound.values.centroidHz = 220;
    t.sound.values.bands = { low: .7, mid: .2, high: .1, columns: [] };
    t.play(600);
    expect(t.shown[2].text).toBe('低频的声音更明显了');
    expect(t.shown[2].at - down).toBeLessThanOrEqual(1000);
  } finally { t.controller.dispose(); }
});

it('needs continuity for weak audio and ignores silence, near-silence and isolated weak spikes', () => {
  const t = setup();
  try {
    t.sound.values.rms = .00057;
    t.sound.values.flux = 1;
    t.play(1000);
    for (let i = 0; i < 4; i++) {
      t.sound.values.rms = .0024;
      t.play(40);
      t.sound.values.rms = 0;
      t.play(400);
    }
    expect(t.shown).toHaveLength(0);
    t.sound.values.rms = .0024;
    t.play(240);
    expect(t.shown).toHaveLength(0);
    t.play(180);
    expect(t.shown.map(c => c.text)).toEqual(['轻微的声音持续了一小段']);
    t.sound.values.rms = 0;
    t.play(16000);
    expect(t.shown).toHaveLength(1);
  } finally { t.controller.dispose(); }
});

it('acknowledges a clear short onset before the continuous sound window can fill', () => {
  const t = setup(), start = Date.now();
  try {
    t.sound.values.rms = 0;
    t.play(100);
    t.sound.values.rms = .06;
    t.sound.values.flux = .9;
    t.sound.validity.flux.state = 'valid';
    t.play(20);
    t.sound.values.rms = 0;
    t.play(100);
    expect(t.shown).toEqual([{ text: '声音刚刚有了新的变化', at: start + 100 }]);
  } finally { t.controller.dispose(); }
});

it('keeps the first acoustic observation queued long enough after an AI comment', () => {
  const t = setup(), start = Date.now();
  try {
    const now = Date.now();
    t.controller.offer(comment({ danmuRunId: t.controller.current.danmuRunId!, requestStartedAt: now }));
    t.play(1100);
    expect(t.shown).toEqual([
      { text: '声音轻轻展开', at: start },
      { text: '这段声音的低频比较明显', at: start + 950 },
    ]);
  } finally { t.controller.dispose(); }
});

it('rejects transient high centroid and uncorroborated harmonic claims', () => {
  const t = setup();
  try {
    t.sound.values.centroidHz = 4700;
    t.sound.values.bands = { low: .3, mid: .38, high: .32, columns: [] };
    t.play(400);
    expect(t.shown.map(c => c.text)).toEqual(['这段声音保持着连续']);
    t.sound.values.bands = { low: .02, mid: .03, high: .8, columns: [] };
    t.play(40);
    t.sound.values.bands = { low: .3, mid: .38, high: .32, columns: [] };
    t.play(1000);
    expect(t.shown).toHaveLength(1);
  } finally { t.controller.dispose(); }
});

it('requires valid measurements and resets its evidence on capture gaps and session changes', () => {
  const t = setup();
  try {
    t.sound.validity.rms.state = 'unknown';
    t.play(1000);
    expect(t.shown).toHaveLength(0);
    t.sound.validity.rms.state = 'valid';
    t.sound.values.bands = { low: 0, mid: 0, high: 0, columns: [] };
    t.sound.validity.flatness.state = 'unknown';
    for (let n = 0; n < 5; n++) {
      t.play(20);
      vi.advanceTimersByTime(600);
    }
    expect(t.shown).toHaveLength(0);
    t.play(400);
    expect(t.shown).toHaveLength(1);
    t.controller.start('audio-2');
    t.play(400);
    expect(t.controller.current.history).toHaveLength(0);
    t.sound.audioSessionId = 'audio-2';
    t.play(100);
    expect(t.controller.current.history).toHaveLength(0);
    t.play(300);
    expect(t.controller.current.history).toHaveLength(1);
  } finally { t.controller.dispose(); }
});
