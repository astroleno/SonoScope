import {
  AudioClassifier,
  FilesetResolver,
} from '@mediapipe/tasks-audio';
import type { AudioClassifierResult } from '@mediapipe/tasks-audio';

export type InstrumentProbabilities = Record<string, number>;

export interface InstrumentDetectionResult {
  label: string;
  probability: number;
  probabilities: InstrumentProbabilities;
}

const TARGET_SAMPLE_RATE = 16000;
const MEDIAPIPE_VERSION = '0.10.16';
const WASM_BASE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-audio@${MEDIAPIPE_VERSION}/wasm`;
const YAMNET_TASK_URL = '/model/yamnet.task';

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  voice: ['speech', 'vocal', 'sing', 'choir', 'human', 'voice'],
  piano: ['piano', 'keyboard'],
  guitar: [
    'guitar',
    'electric guitar',
    'acoustic guitar',
    'banjo',
    'mandolin',
    'ukulele',
  ],
  strings: ['violin', 'string', 'cello', 'viola', 'fiddle'],
  drums: [
    'drum',
    'percussion',
    'snare',
    'kick',
    'cymbal',
    'hi-hat',
    'tom-tom',
    'beatboxing',
  ],
  synth: ['synth', 'synthesizer', 'electronic keyboard', 'organ'],
  bass: ['bass', 'double bass'],
  brass: ['trumpet', 'trombone', 'brass', 'horn'],
  woodwind: ['flute', 'clarinet', 'saxophone'],
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function resampleLinear(
  input: Float32Array,
  originalRate: number,
  targetRate: number
): Float32Array {
  if (!input.length) return input;
  if (Math.abs(originalRate - targetRate) < 1) {
    return input;
  }
  const ratio = targetRate / originalRate;
  const newLength = Math.max(1, Math.round(input.length * ratio));
  const output = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const t = i / ratio;
    const idx = Math.floor(t);
    const frac = t - idx;
    const v0 = input[idx] ?? 0;
    const v1 = input[idx + 1] ?? v0;
    output[i] = v0 + (v1 - v0) * frac;
  }
  return output;
}

function aggregateCategories(result: AudioClassifierResult | null) {
  if (!result?.classifications?.length) return null;
  const histogram: InstrumentProbabilities = {};
  for (const classification of result.classifications) {
    if (!classification.categories) continue;
    for (const category of classification.categories) {
      const name = category.categoryName?.toLowerCase();
      if (!name) continue;
      const score = clamp01(category.score ?? 0);
      if (score <= 0) continue;
      for (const [label, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        if (keywords.some(keyword => name.includes(keyword))) {
          histogram[label] = (histogram[label] ?? 0) + score;
          break;
        }
      }
    }
  }
  const total = Object.values(histogram).reduce((sum, val) => sum + val, 0);
  if (total <= 0) return null;
  let bestLabel = 'unknown';
  let bestProb = 0;
  for (const [label, value] of Object.entries(histogram)) {
    const prob = clamp01(value / total);
    histogram[label] = prob;
    if (prob > bestProb) {
      bestProb = prob;
      bestLabel = label;
    }
  }
  return {
    label: bestLabel,
    probability: bestProb,
    probabilities: histogram,
  } as InstrumentDetectionResult;
}

function computeHeuristicProbabilities(samples: Float32Array) {
  const length = samples.length;
  if (!length) return null;

  let sumSquares = 0;
  let peak = 0;
  let zeroCrossings = 0;
  let sumAbsDiff = 0;
  for (let i = 0; i < length; i++) {
    const sample = samples[i];
    sumSquares += sample * sample;
    const abs = Math.abs(sample);
    if (abs > peak) peak = abs;
    if (i > 0) {
      const prev = samples[i - 1];
      if ((sample >= 0 && prev < 0) || (sample < 0 && prev >= 0)) {
        zeroCrossings += 1;
      }
      sumAbsDiff += Math.abs(sample - prev);
    }
  }

  const rms = Math.sqrt(sumSquares / length);
  const crest = rms > 1e-6 ? peak / rms : peak / 1e-6;
  const zcr = zeroCrossings / Math.max(1, length - 1);
  const meanAbsDiff = sumAbsDiff / Math.max(1, length - 1);

  const score = (value: number, ideal: number, tolerance: number) => {
    const distance = Math.abs(value - ideal);
    const norm = tolerance <= 0 ? 0 : clamp01(1 - distance / tolerance);
    return norm * norm;
  };

  const probabilities: InstrumentProbabilities = {};
  const voiceScore =
    score(zcr, 0.08, 0.06) * 0.5 +
    score(crest, 3, 1.5) * 0.3 +
    clamp01(rms / 0.35) * 0.2;
  const pianoScore =
    score(zcr, 0.05, 0.04) * 0.4 +
    score(crest, 4.5, 2) * 0.4 +
    clamp01(rms / 0.4) * 0.2;
  const guitarScore =
    score(zcr, 0.15, 0.08) * 0.45 +
    score(meanAbsDiff, 0.25, 0.15) * 0.35 +
    clamp01(rms / 0.35) * 0.2;
  const stringsScore =
    score(zcr, 0.04, 0.03) * 0.45 +
    score(crest, 2.5, 1.2) * 0.35 +
    clamp01(rms / 0.3) * 0.2;
  const drumsScore =
    clamp01(meanAbsDiff / 0.4) * 0.5 +
    score(crest, 6, 3) * 0.3 +
    clamp01(rms / 0.5) * 0.2;
  const synthScore =
    score(zcr, 0.07, 0.05) * 0.35 +
    score(meanAbsDiff, 0.12, 0.08) * 0.35 +
    score(crest, 3, 1.5) * 0.3;
  const bassScore =
    score(zcr, 0.06, 0.04) * 0.3 +
    clamp01(rms / 0.45) * 0.4 +
    score(crest, 4, 2) * 0.3;

  const scores: Record<string, number> = {
    voice: voiceScore,
    piano: pianoScore,
    guitar: guitarScore,
    strings: stringsScore,
    drums: drumsScore,
    synth: synthScore,
    bass: bassScore,
  };

  let total = 0;
  for (const value of Object.values(scores)) {
    total += Math.max(0, value);
  }

  if (total <= 1e-6) return null;

  let bestLabel = 'unknown';
  let bestProb = 0;

  for (const [label, value] of Object.entries(scores)) {
    const prob = clamp01(value / total);
    probabilities[label] = prob;
    if (prob > bestProb) {
      bestProb = prob;
      bestLabel = label;
    }
  }

  return {
    label: bestLabel,
    probability: bestProb,
    probabilities,
  } as InstrumentDetectionResult;
}

async function createAudioClassifier(): Promise<AudioClassifier | null> {
  if (typeof window === 'undefined') return null;
  try {
    const filesetResolver = await FilesetResolver.forAudioTasks(WASM_BASE_URL);
    return AudioClassifier.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath: YAMNET_TASK_URL,
      },
      maxResults: 5,
      scoreThreshold: 0.05,
    });
  } catch (err) {
    console.warn(
      'InstrumentClassifier: failed to initialize Mediapipe AudioClassifier',
      err
    );
    return null;
  }
}

let sharedClassifier: InstrumentClassifier | null = null;

export function getSharedInstrumentClassifier(): InstrumentClassifier {
  if (!sharedClassifier) {
    sharedClassifier = new InstrumentClassifier();
  }
  return sharedClassifier;
}

export class InstrumentClassifier {
  private classifierPromise: Promise<AudioClassifier | null> | null = null;

  private async ensureClassifier(): Promise<AudioClassifier | null> {
    if (!this.classifierPromise) {
      this.classifierPromise = createAudioClassifier().catch(err => {
        console.warn('InstrumentClassifier: creation failed', err);
        this.classifierPromise = null;
        return null;
      });
    }
    return this.classifierPromise;
  }

  async classify(
    samples: Float32Array,
    sampleRate: number
  ): Promise<InstrumentDetectionResult | null> {
    if (!samples.length) return null;

    let result: InstrumentDetectionResult | null = null;
    const classifier = await this.ensureClassifier();
    if (classifier) {
      try {
        const resampled = resampleLinear(
          samples,
          sampleRate,
          TARGET_SAMPLE_RATE
        );
        const mpResults = await classifier.classify(
          resampled,
          TARGET_SAMPLE_RATE
        );
        result = aggregateCategories(mpResults[0] ?? null) ?? null;
      } catch (err) {
        console.warn(
          'InstrumentClassifier: classify via Mediapipe failed',
          err
        );
      }
    }

    if (!result) {
      const fallBack = computeHeuristicProbabilities(samples);
      if (fallBack) {
        result = fallBack;
      }
    }

    return result;
  }
}
