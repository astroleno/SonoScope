import type { FeatureFrame } from '@sonoscope/core';

const quietRms = .002;
const strongRms = .008;
const steadyIntervalMs = 12000;
const changeIntervalMs = 4000;
const bandHoldMs = 65;
const evidenceGapMs = 350;
const phraseGapMs = 500;

const bandText = {
  low: '这段声音的低频比较明显',
  mid: '声音主要落在中频',
  high: '这段声音的高频比较明显',
};
type Band = keyof typeof bandText;
type Change = 'low' | 'high' | 'louder' | 'quieter' | 'onset';
type AcousticObservation = { text: string; startedAt: number; change?: Change };

const changeText: Record<Change, string> = {
  low: '低频的声音更明显了',
  high: '高频的声音更明显了',
  louder: '声音变得更有力了',
  quieter: '声音轻了下来',
  onset: '声音刚刚有了新的变化',
};

function dominantBand(frame: FeatureFrame): Band | null {
  const { values, validity } = frame;
  const { low, mid, high } = values.bands;
  const total = low + mid + high;
  if (!total) return null;
  if (validity.centroidHz.state === 'valid') {
    if (values.centroidHz <= 350 && low / total >= .48) return 'low';
    if (values.centroidHz >= 3200 && high / total >= .58) return 'high';
  }
  return mid / total >= .65 ? 'mid' : null;
}

/** Session-local evidence and pacing for acoustic feedback. */
export class AcousticFeedback {
  private lastFrame = -Infinity;
  private lastAudible = -Infinity;
  private startedAt: number | null = null;
  private continuousSince: number | null = null;
  private level = 0;
  private phraseFeedback = false;
  private lastFeedback = -Infinity;
  private lastChange: Partial<Record<Change, number>> = {};
  private band: Band | null = null;
  private bandSince = 0;
  private confirmedBand: { band: Band; at: number } | null = null;
  private spectralChange: { band: 'low' | 'high'; at: number } | null = null;
  private energyChange: 'louder' | 'quieter' | null = null;
  private energySince = 0;

  private resetPhrase() {
    this.startedAt = null;
    this.continuousSince = null;
    this.level = 0;
    this.phraseFeedback = false;
    this.clearBand();
    this.energyChange = null;
  }

  private clearBand() {
    this.band = null;
    this.confirmedBand = null;
    this.spectralChange = null;
  }

  private observeBand(band: Band | null, at: number) {
    if (band !== this.band) {
      this.band = band;
      this.bandSince = at;
      this.spectralChange = null;
    }
    if (!band || at - this.bandSince < bandHoldMs) return null;
    const previous = this.confirmedBand;
    if (previous && previous.band !== band && at - previous.at <= 1500 && band !== 'mid') {
      this.spectralChange = { band, at };
    }
    this.confirmedBand = { band, at };
    return band;
  }

  observe(frame: FeatureFrame, now: number): AcousticObservation | null {
    const at = frame.capturedAt;
    if (at < this.lastFrame || at - this.lastFrame > evidenceGapMs) {
      this.resetPhrase();
      this.lastAudible = -Infinity;
    }
    const delta = at - this.lastFrame;
    this.lastFrame = at;
    const rms = frame.validity.rms.state === 'valid' ? frame.values.rms : 0;
    const priorLevel = this.level;
    const alpha = Number.isFinite(delta) && delta > 0 ? 1 - Math.exp(-delta / 300) : .08;
    this.level = this.continuousSince === null ? rms : priorLevel + (rms - priorLevel) * alpha;
    if (rms < quietRms * .75) {
      this.continuousSince = null;
      this.clearBand();
      this.energyChange = null;
      if (this.startedAt !== null && at - this.lastAudible >= phraseGapMs) this.resetPhrase();
      return null;
    }
    if (this.startedAt === null) {
      if (rms < quietRms) return null;
      this.startedAt = at;
    }
    this.continuousSince ??= at;
    this.lastAudible = at;
    const elapsed = at - this.continuousSince;
    const strong = rms >= strongRms;
    const band = this.observeBand(strong ? dominantBand(frame) : null, at);
    const onset = rms >= .03 && rms > priorLevel * 1.8 && frame.validity.flux.state === 'valid' && frame.values.flux >= .42;
    const energy = strong && rms > Math.max(.03, priorLevel * 1.8) ? 'louder'
      : rms >= quietRms && priorLevel > .03 && rms < priorLevel * .52 ? 'quieter' : null;
    if (energy !== this.energyChange) {
      this.energyChange = energy;
      this.energySince = at;
    }
    if (now - this.lastFeedback < 950) return null;
    if (this.phraseFeedback) {
      const spectral = this.spectralChange;
      const change = spectral && at - spectral.at <= 900 ? spectral.band
        : energy && at - this.energySince >= bandHoldMs && at - this.energySince <= 900 ? energy
        : onset ? 'onset' : null;
      if (change && now - (this.lastChange[change] ?? -Infinity) >= changeIntervalMs) {
        return { text: changeText[change], startedAt: this.startedAt, change };
      }
      if (now - this.lastFeedback < steadyIntervalMs) return null;
    }
    if (band) return { text: bandText[band], startedAt: this.startedAt };
    if (onset && !this.phraseFeedback && now - (this.lastChange.onset ?? -Infinity) >= changeIntervalMs) {
      return { text: changeText.onset, startedAt: this.startedAt, change: 'onset' };
    }
    if (strong && elapsed >= 180 && frame.validity.flatness.state === 'valid' && frame.values.flatness >= .45) {
      return { text: '声音里有细碎的质感', startedAt: this.startedAt };
    }
    if (rms >= quietRms && this.level >= quietRms && elapsed >= (strong ? 240 : 300)) {
      return { text: strong ? '这段声音保持着连续' : '轻微的声音持续了一小段', startedAt: this.startedAt };
    }
    return null;
  }

  accepted(observation: AcousticObservation, now: number) {
    this.lastFeedback = now;
    this.phraseFeedback = true;
    if (observation.change) this.lastChange[observation.change] = now;
  }
}
