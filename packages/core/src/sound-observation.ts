import type { FeatureFrame } from './contracts';

/** A local observation about measured sound, with no music or instrument claim. */
export function soundObservation(frame: FeatureFrame): string | null {
  const { values, validity } = frame;
  if (values.rms < .008) return null;
  if (validity.centroidHz?.state === 'valid') {
    if (values.centroidHz >= 3200) return '这段声音的高频比较明显';
    if (values.centroidHz <= 350) return '这段声音的低频比较明显';
  }
  if (validity.hpss?.state === 'valid' && values.hpss) {
    if (values.hpss.percussive >= .7) return '声音里有短促而细密的起伏';
    if (values.hpss.harmonic >= .75) return '声音里有持续连贯的成分';
  }
  if (validity.flatness?.state === 'valid' && values.flatness >= .45) return '声音里有细碎的质感';
  if (validity.flux?.state === 'valid' && values.flux >= .25) return '声音里有明显的起伏';
  return null;
}
