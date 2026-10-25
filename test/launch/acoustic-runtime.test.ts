import { expect, it, vi } from 'vitest';
import { SonoRuntime } from '../../packages/sdk/src/runtime';
import { frame } from './fixtures';
import { DanmuController } from '../../packages/danmu-pipeline/controller';

it('never constructs a classification worker in acoustic mode', () => {
  const classifier = vi.fn();
  const runtime = new SonoRuntime({ feedbackMode: 'acoustic', sink: { show: () => true, clear() {} }, modelWorkerFactory: classifier, workerAssets: { wasmUrl: '/wasm', modelUrl: '/model', modelVersion: 'yamnet' } });
  runtime.features.start('audio'); expect(classifier).not.toHaveBeenCalled(); runtime.dispose();
});

it('ignores even high-confidence music, voice, instrument and numeric tempo claims in acoustic feedback', () => {
  const shown: string[] = []; let now = 1000;
  const controller = new DanmuController({ show: c => { shown.push(c.text); return true; }, clear() {} }, { feedbackMode: 'acoustic', now: () => now });
  controller.start('audio-1'); const input = frame();
  input.values.rms = .1; input.values.centroidHz = 4000; input.values.tempo = { bpm: 100, confidence: 1 }; input.validity.tempo.state = 'valid';
  input.model = { version: 'test', capturedAt: input.capturedAt, categories: [{ label: 'Music', score: 1 }], voiceProbability: 1, instrument: { label: 'Piano', confidence: 1 } }; input.validity.classification.state = 'valid';
  controller.feedFrame(input); now += 2000; controller.feedFrame({ ...input, seq: 2 });
  expect(shown.length).toBeGreaterThan(0); expect(shown.join(' ')).not.toMatch(/BPM|人声|钢琴|音乐|节拍/); controller.dispose();
});
