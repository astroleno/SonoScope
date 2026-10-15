import { expect, it } from 'vitest';
import { RuntimeMetrics } from '../../packages/sdk/src/metrics';
import { frame } from './fixtures';
it('counts actual render callbacks and retains a full-run latency histogram with bounded storage', () => {
  const metrics = new RuntimeMetrics(), sample = frame(); metrics.reset('audio-1');
  for (let second = 0; second < 8; second++) for (let i = 0; i < 60; i++) {
    const t = 100000 + second * 1000 + i * 16;
    metrics.rendered({ ...sample, seq: second * 60 + i, capturedAt: t - 25 }, t);
  }
  const result = metrics.snapshot(); expect(result.visualP95Ms).toBe(25); expect(result.fpsMedian).toBe(60); expect(result.desktopFpsPassRate).toBe(1); expect(result.observedSeconds).toBe(6);
  metrics.rendered(frame('old-session'), Date.now()); expect(metrics.snapshot().visualSamples).toBe(result.visualSamples);
});
it('separates DSP compute, capture-to-feature delivery and main-thread draw waiting by current session and sequence', () => {
  const metrics = new RuntimeMetrics(), sample = frame(); metrics.reset('audio-1');
  metrics.featureReady({ audioSessionId: 'old', seq: 0, capturedAt: 0, readyAt: 999, dspComputeMs: 999, source: 'worker' });
  metrics.featureReady({ audioSessionId: 'audio-1', seq: 0, capturedAt: 1000, readyAt: 1007, dspComputeMs: 2.4, source: 'worker' });
  metrics.rendered({ ...sample, seq: 0, capturedAt: 1000 }, 1020);
  metrics.featureReady({ audioSessionId: 'audio-1', seq: 1, capturedAt: 1030, readyAt: 1035, dspComputeMs: 1.1, source: 'worker' });
  metrics.rendered({ ...sample, seq: 0, capturedAt: 1000 }, 1040);
  const result = metrics.snapshot(); expect(result.featureSamples).toBe(2); expect(result.visualSamples).toBe(1);
  expect(result.visualP95Ms).toBe(20); expect(result.dspComputeP95Ms).toBe(3);
  expect(result.captureToFeatureP95Ms).toBe(7); expect(result.featureToDrawP95Ms).toBe(13); expect(result.dspMode).toBe('worker');
});
it('includes zero-FPS tail seconds when rendering stops but the audio session is still running', () => {
  const metrics = new RuntimeMetrics(), sample = frame(); metrics.reset('audio-1');
  for (let second = 0; second < 4; second++) for (let i = 0; i < 60; i++) {
    const t = 100000 + second * 1000 + i * 16;
    metrics.rendered({ ...sample, seq: second * 60 + i, capturedAt: t - 25 }, t);
  }
  const healthy = metrics.snapshot(), stalled = metrics.snapshot(110000);
  expect(healthy.desktopFpsPassRate).toBe(1);
  expect(stalled.observedSeconds).toBe(9); expect(stalled.fpsMedian).toBe(0);
  expect(stalled.desktopFpsPassRate).toBeLessThan(.5); expect(stalled.visualSamples).toBe(healthy.visualSamples);
});
