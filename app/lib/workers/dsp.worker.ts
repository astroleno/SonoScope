import { FeatureExtractor } from '@sonoscope/core';
let id: string | null = null;
let extractor = new FeatureExtractor();
globalThis.onmessage = (e: MessageEvent) => {
  const msg = e.data;
  if (msg.type === 'init') { id = msg.audioSessionId; extractor = new FeatureExtractor(); globalThis.postMessage({ type: 'dsp-ready', audioSessionId: id }); return; }
  if (msg.type === 'reset' && msg.audioSessionId === id) { extractor = new FeatureExtractor(); return; }
  if (msg.type === 'pcm' && msg.audioSessionId === id) {
    const started = performance.now();
    const values = extractor.extract(msg.pcm, msg.sampleRate, msg.audioTime);
    globalThis.postMessage({ type: 'frame', audioSessionId: id, seq: msg.seq, audioTime: msg.audioTime, capturedAt: msg.capturedAt, sampleRate: msg.sampleRate, values, processingMs: performance.now() - started });
  }
};
