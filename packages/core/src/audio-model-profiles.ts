export const MN10_MODEL_VERSION = 'efficientat-mn10-as-pad10-2s-mixed3-v1-alp3k1-temporal-6';

export interface AudioModelProfile {
  readonly id: 'yamnet' | 'mn10-v6';
  readonly sampleRate: number;
  readonly windowSamples: number;
  readonly hopSamples: number;
}

export const YAMNET_MODEL_PROFILE: AudioModelProfile = Object.freeze({ id: 'yamnet', sampleRate: 16000, windowSamples: 15600, hopSamples: 3840 });
export const MN10_MODEL_PROFILE: AudioModelProfile = Object.freeze({ id: 'mn10-v6', sampleRate: 32000, windowSamples: 64000, hopSamples: 12800 });

/** A known version selects its validated input and evidence policy together. */
export function audioModelProfile(version?: string): AudioModelProfile {
  return version === MN10_MODEL_VERSION ? MN10_MODEL_PROFILE : YAMNET_MODEL_PROFILE;
}

export function hasValidatedTemporalEvidence(version: string): boolean {
  return version === MN10_MODEL_VERSION || version === 'yamnet-float32-1-temporal-1' || version === 'yamnet-float32-1-temporal-2';
}
