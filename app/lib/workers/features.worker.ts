import { AudioClassifier, FilesetResolver } from '@mediapipe/tasks-audio';
import { FeatureExtractor, resample, AUDIO_MODEL_SAMPLE_RATE, AUDIO_MODEL_SAMPLES, aggregateAudioCategories, AudioClassificationTracker } from '@sonoscope/core';

let sessionId: string | null = null;
let extractor = new FeatureExtractor();
let classifier: AudioClassifier | null = null;
let version = '';
let observations = new AudioClassificationTracker();
const send = (data: object) => globalThis.postMessage({ ...data, audioSessionId: sessionId });
globalThis.onmessage = async (event: MessageEvent) => {
  const msg = event.data;
  if (msg.type === 'init') {
    sessionId = msg.audioSessionId; extractor = new FeatureExtractor(); observations = new AudioClassificationTracker(); version = msg.modelVersion;
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
      const pcm = resample(msg.pcm, msg.sampleRate, AUDIO_MODEL_SAMPLE_RATE);
      if (pcm.length < AUDIO_MODEL_SAMPLES) throw new Error('Incomplete model window');
      const complete = pcm.subarray(0, Math.floor(pcm.length / AUDIO_MODEL_SAMPLES) * AUDIO_MODEL_SAMPLES);
      const results = classifier.classify(complete, AUDIO_MODEL_SAMPLE_RATE);
      const allCategories = aggregateAudioCategories(results, complete.length);
      const categories = allCategories.slice(0, 16);
      const voice = allCategories.filter(c => /speech|singing|vocal|choir/i.test(c.label));
      const instrument = observations.update(allCategories, msg.capturedAt);
      send({ type: 'model-result', result: { version, capturedAt: msg.capturedAt, categories, voiceProbability: Math.max(0, ...voice.map(c => c.score)), instrument } });
    } catch { send({ type: 'model-error' }); }
  }
};
