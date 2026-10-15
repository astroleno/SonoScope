import type { AudioFeatures, AudioSource } from '../types';
import type { FeatureFrame } from '@sonoscope/core';
import { AudioSession, browserAudioEnvironment } from '../audio-session';
import { FeaturePipeline } from '../feature-pipeline';
export interface AudioAdapter { setSource(source: AudioSource): Promise<void>; start(): Promise<void>; stop(): void; onFeatures(callback: (features: AudioFeatures) => void): void; dispose(): void }
export function toLegacyFeatures(frame: FeatureFrame): AudioFeatures {
  const v = frame.values;
  return { rms: v.rms, spectralCentroid: v.centroidHz, spectralBandwidth: v.bandwidthHz, spectralRolloff: v.rolloffHz, spectralFlatness: v.flatness, spectralFlux: v.flux, zcr: v.zcr, chroma: v.chroma, mfcc: v.mfcc, spectralContrast: v.contrastDb, harmonicRatio: v.hpss?.harmonic, percussiveRatio: v.hpss?.percussive, voiceProb: frame.model?.voiceProbability, dominantInstrument: frame.model?.instrument?.label, instrumentConfidence: frame.model?.instrument?.confidence, ...(v.tempo ? { tempo: { bpm: v.tempo.bpm, tempoConfidence: v.tempo.confidence } } : {}) };
}
export class WebAudioAdapter implements AudioAdapter {
  private session: AudioSession;
  private pipeline = new FeaturePipeline();
  private source: AudioSource = { type: 'device' };
  constructor(workletUrl = '/audio/capture-worklet.js') {
    this.session = new AudioSession(browserAudioEnvironment(workletUrl));
    this.session.subscribeState(s => { if (s.status === 'running' && s.audioSessionId) this.pipeline.start(s.audioSessionId); else this.pipeline.stop(); });
    this.session.onPCM((pcm, rate, time, id) => this.pipeline.feed(pcm, rate, time, id));
  }
  async setSource(source: AudioSource) { this.stop(); this.source = source; }
  start() { return this.session.start(this.source); }
  stop() { this.session.stop(); }
  onFeatures(fn: (features: AudioFeatures) => void) { this.pipeline.onFrame(f => fn(toLegacyFeatures(f))); }
  dispose() { this.session.dispose(); this.pipeline.dispose(); }
}
