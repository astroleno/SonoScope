import { AudioClassifier, FilesetResolver } from '@mediapipe/tasks-audio';
import { FeatureExtractor, resample } from '@sonoscope/core';

let sessionId: string | null = null;
let extractor = new FeatureExtractor();
let classifier: AudioClassifier | null = null;
let version = '';
const send = (data: object) => globalThis.postMessage({ ...data, audioSessionId: sessionId });
globalThis.onmessage = async (event: MessageEvent) => {
  const msg = event.data;
  if (msg.type === 'init') {
    sessionId = msg.audioSessionId; extractor = new FeatureExtractor(); version = msg.modelVersion;
    const current = sessionId;
    try {
      send({ type: 'model-loading' });
      const files = await FilesetResolver.forAudioTasks(msg.wasmUrl);
      const model = await AudioClassifier.createFromOptions(files, { baseOptions: { modelAssetPath: msg.modelUrl }, maxResults: -1, scoreThreshold: 0 });
      if (sessionId !== current) { model.close(); return; }
      classifier?.close(); classifier = model; send({ type: 'model-ready' });
    } catch { if (sessionId === current) send({ type: 'model-error' }); }
    return;
  }
  if (msg.audioSessionId !== sessionId) return;
  if (msg.type === 'pcm') {
    try { const values = extractor.extract(msg.pcm, msg.sampleRate, msg.audioTime); send({ type: 'frame', seq: msg.seq, sampleRate: msg.sampleRate, capturedAt: msg.capturedAt, audioTime: msg.audioTime, values }); }
    catch { send({ type: 'model-error' }); }
  }
  if (msg.type === 'classify' && classifier) {
    try {
      const pcm = resample(msg.pcm, msg.sampleRate, 16000);
      const results = classifier.classify(pcm, 16000);
      const allCategories = results.flatMap(r => r.classifications.flatMap(c => c.categories)).map(c => ({ label: c.categoryName ?? `class-${c.index}`, score: c.score })).sort((a, b) => b.score - a.score);
      const categories = allCategories.slice(0, 16);
      const voice = allCategories.filter(c => /speech|singing|vocal|choir/i.test(c.label));
      const instrument = categories.find(c => c.score >= .4 && /piano|guitar|violin|drum|bass|flute|saxophone|synthesizer|trumpet/i.test(c.label));
      send({ type: 'model-result', result: { version, capturedAt: msg.capturedAt, categories, voiceProbability: Math.max(0, ...voice.map(c => c.score)), instrument: instrument ? { label: instrument.label, confidence: instrument.score } : null } });
    } catch { send({ type: 'model-error' }); }
  }
};
