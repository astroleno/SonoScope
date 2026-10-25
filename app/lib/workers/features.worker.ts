import { AudioClassifier, FilesetResolver } from '@mediapipe/tasks-audio';
import { FeatureExtractor, resample, audioModelProfile, aggregateAudioCategories, AudioClassificationTracker, Mn10InputConditioner } from '@sonoscope/core';

let sessionId: string | null = null;
let extractor = new FeatureExtractor();
let classifier: AudioClassifier | null = null;
let version = '';
let profile = audioModelProfile();
let sourceEpoch = 0;
let observations = new AudioClassificationTracker();
let inputConditioner: Mn10InputConditioner | null = null;
const send = (data: object) => globalThis.postMessage({ ...data, audioSessionId: sessionId });
globalThis.onmessage = async (event: MessageEvent) => {
  const msg = event.data;
  if (msg.type === 'init') {
    sessionId = msg.audioSessionId; extractor = new FeatureExtractor(); version = msg.modelVersion; profile = audioModelProfile(version); sourceEpoch = 0; observations = new AudioClassificationTracker(profile.id); inputConditioner = profile.id === 'mn10-v6' ? new Mn10InputConditioner() : null;
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
  if (msg.type === 'reset-model-evidence') { sourceEpoch = msg.sourceEpoch; observations = new AudioClassificationTracker(profile.id); inputConditioner?.reset(); return; }
  if (msg.type === 'pcm') {
    try { const values = extractor.extract(msg.pcm, msg.sampleRate, msg.audioTime); send({ type: 'frame', seq: msg.seq, sampleRate: msg.sampleRate, capturedAt: msg.capturedAt, audioTime: msg.audioTime, values }); }
    catch { send({ type: 'model-error' }); }
  }
  if (msg.type === 'classify' && classifier) {
    try {
      const started = performance.now();
      if (msg.sourceEpoch !== sourceEpoch || !Number.isSafeInteger(msg.requestId)) throw new Error('Invalid model request');
      if (profile.id === 'mn10-v6' && (msg.sampleRate !== profile.sampleRate || msg.pcm.length !== profile.windowSamples)) throw new Error('Invalid model-rate window');
      const pcm = profile.id === 'mn10-v6' ? msg.pcm as Float32Array : resample(msg.pcm, msg.sampleRate, profile.sampleRate);
      if (pcm.length < profile.windowSamples) throw new Error('Incomplete model window');
      const complete = pcm.subarray(0, Math.floor(pcm.length / profile.windowSamples) * profile.windowSamples);
      const inputMode = inputConditioner?.prepareInPlace(complete) ?? 'raw';
      const results = classifier.classify(complete, profile.sampleRate);
      if (profile.id === 'mn10-v6' && results.length !== 1) throw new Error('Unexpected model window count');
      const allCategories = aggregateAudioCategories(results, complete.length, profile);
      const categories = allCategories.slice(0, 16);
      const voice = allCategories.filter(c => /speech|singing|vocal|choir/i.test(c.label));
      const instrument = observations.update(allCategories, msg.capturedAt);
      inputConditioner?.observe(allCategories, instrument);
      send({ type: 'model-result', requestId: msg.requestId, sourceEpoch: msg.sourceEpoch, inputMode, processingMs: performance.now() - started, result: { version, capturedAt: msg.capturedAt, categories, voiceProbability: Math.max(0, ...voice.map(c => c.score)), instrument } });
    } catch { send({ type: 'model-error' }); }
  }
};
