import { afterEach, expect, it, vi } from 'vitest';
import { DanmuController } from '../../packages/danmu-pipeline/controller';
import { frame } from './fixtures';

afterEach(() => vi.useRealTimers());
function setup() {
  let serial = 0;
  const show = vi.fn().mockReturnValue(true), controller = new DanmuController({ show, clear() {} }, { feedbackMode: 'acoustic', id: () => `id-${serial++}` });
  controller.start('audio-1');
  const sound = frame(); sound.values.rms = .06; sound.values.centroidHz = 220; sound.values.bands = { low: .7, mid: .2, high: .1, columns: [] };
  sound.values.hpss = { harmonic: .9, percussive: .1 }; sound.validity.hpss.state = 'valid'; sound.values.flux = .01;
  let seq = 0;
  return { controller, show, sound, feed: () => controller.feedFrame({ ...sound, seq: seq++, capturedAt: Date.now() }) };
}
it('keeps grounded observations flowing during sustained audio without repeating text inside the dedup window', () => {
  vi.useFakeTimers(); const t = setup(), times: number[] = [];
  t.show.mockImplementation(() => { times.push(Date.now()); return true; });
  try {
    for (let n = 0; n < 100; n++) { t.feed(); vi.advanceTimersByTime(100); }
    expect(t.show.mock.calls.length).toBeGreaterThanOrEqual(7); expect(t.show.mock.calls.length).toBeLessThanOrEqual(9);
    const texts = t.show.mock.calls.map(([c]) => c.text); expect(new Set(texts).size).toBe(texts.length);
    expect(texts.join(' ')).not.toMatch(/BPM|钢琴|吉他|人声|音乐|变得|变轻|变强/);
    for (let n = 1; n < times.length; n++) expect(times[n] - times[n - 1]).toBeGreaterThanOrEqual(1300);
    expect(t.controller.current.queued).toBeLessThanOrEqual(1);
  } finally { t.controller.dispose(); expect(vi.getTimerCount()).toBe(0); }
});
it('does not create new comments from silence or high-flux background noise after the sound ends', () => {
  vi.useFakeTimers(); const t = setup();
  try {
    for (let n = 0; n < 40; n++) { t.feed(); vi.advanceTimersByTime(100); }
    const count = t.show.mock.calls.length; expect(count).toBeGreaterThan(1);
    t.sound.values.rms = .00037; t.sound.values.flux = 1;
    for (let n = 0; n < 150; n++) { t.feed(); vi.advanceTimersByTime(100); }
    expect(t.show).toHaveBeenCalledTimes(count); expect(t.controller.current.queued).toBe(0);
  } finally { t.controller.dispose(); }
});
it('requires a continuous measured window for continuity comments and resets it across sessions', () => {
  vi.useFakeTimers(); const t = setup();
  try {
    t.sound.values.bands = { low: 0, mid: 0, high: 0, columns: [] }; t.sound.values.hpss = null;
    for (const value of Object.values(t.sound.validity)) value.state = 'unknown';
    for (let n = 0; n < 5; n++) { t.feed(); vi.advanceTimersByTime(1000); }
    expect(t.show).not.toHaveBeenCalled();
    for (let n = 0; n < 8; n++) { t.feed(); vi.advanceTimersByTime(100); }
    expect(t.show).toHaveBeenCalledOnce(); expect(t.show.mock.calls[0][0].text).toMatch(/延续|连续/);
    t.controller.stop(); t.controller.start('audio-2'); t.feed(); expect(t.show).toHaveBeenCalledOnce(); expect(t.controller.current.history).toHaveLength(0);
  } finally { t.controller.dispose(); }
});
