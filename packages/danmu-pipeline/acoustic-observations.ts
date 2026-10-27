import { soundObservation, type FeatureFrame } from '@sonoscope/core';

/** Current, measurable sound properties. These do not claim a new event or an instrument. */
export function acousticObservations(frame: FeatureFrame, sustained: boolean): string[] {
  const { values: v, validity } = frame;
  if (v.rms < .008) return [];
  const first = soundObservation(frame), result = new Set<string>(first ? [first] : []);
  const add = (...texts: string[]) => { for (const text of texts) result.add(text); };
  if (validity.centroidHz.state === 'valid') {
    if (v.centroidHz <= 350) add('这段声音的低频比较明显', '低频的成分比较突出', '声音的重心偏向低处');
    else if (v.centroidHz >= 3200) add('这段声音的高频比较明显', '高频的成分比较突出', '声音的重心偏向高处');
  }
  const total = v.bands.low + v.bands.mid + v.bands.high;
  if (total > 0 && v.bands.mid / total >= .6) add('声音主要落在中频', '这一段以中频为主');
  if (validity.hpss.state === 'valid' && v.hpss) {
    if (v.hpss.harmonic >= .75) add('声音里有持续连贯的成分', '音色里有连贯的延续', '持续的声音比较明显');
    if (v.hpss.percussive >= .7) add('声音里有短促而细密的起伏', '短促的声音比较突出', '声音里带着颗粒般的起伏');
  }
  if (validity.flatness.state === 'valid' && v.flatness >= .45) add('声音里有细碎的质感', '这一段的声音比较细碎');
  if (validity.flux.state === 'valid' && v.flux >= .25) add('声音里有明显的起伏', '声音的细节变化比较快');
  if (sustained) add('声音还在延续着', '这段声音保持着连续');
  return [...result];
}
