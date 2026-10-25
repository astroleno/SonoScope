import { expect, it } from 'vitest';
import { RecordingClock } from '../../packages/sdk/src/recording-clock';

it('anchors mid-session recording to audio time and freezes its end while the source continues', () => {
  let seconds = 42.5; const clock = new RecordingClock(() => seconds); clock.start();
  seconds = 44; expect(clock.positionMs).toBe(1500);
  expect(clock.at(40)).toBe(0);
  expect(clock.at(43)).toBe(500);
  expect(clock.stop()).toBe(1500);
  seconds = 100; expect(clock.positionMs).toBe(1500); expect(clock.at(100)).toBe(1500);
});

it('does not advance on a suspended audio clock or rewind on a delayed read', () => {
  let seconds = 1; const clock = new RecordingClock(() => seconds); clock.start();
  seconds = 2; expect(clock.positionMs).toBe(1000);
  seconds = 1.9; expect(clock.positionMs).toBe(1000);
  seconds = 2; expect(clock.positionMs).toBe(1000);
  seconds = NaN; expect(clock.positionMs).toBe(1000);
});
