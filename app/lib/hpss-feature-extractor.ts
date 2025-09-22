/**
 * HPSS特征提取器
 * 基于HPSS分离结果提取谐波和打击乐特征
 */

import { HPSSResult, HPSSConfig } from './hpss-algorithm';

// HPSS特征接口
export interface HPSSFeatures {
  // 谐波特征
  harmonicFeatures: {
    spectralCentroid: number;      // 谐波频谱质心
    spectralBandwidth: number;     // 谐波频谱带宽
    spectralRolloff: number;       // 谐波频谱滚降
    harmonicEnergy: number;        // 谐波能量
    harmonicComplexity: number;    // 谐波复杂度
    pitchStrength: number;         // 音高强度
    tonalCentroid: number;         // 音调质心
  };
  
  // 打击乐特征
  percussiveFeatures: {
    percussiveEnergy: number;      // 打击乐能量
    attackStrength: number;        // 攻击强度
    rhythmRegularity: number;      // 节奏规律性
    percussiveComplexity: number;  // 打击乐复杂度
    transientDensity: number;      // 瞬态密度
    beatStrength: number;          // 节拍强度
  };
  
  // 分离质量特征
  separationFeatures: {
    harmonicRatio: number;         // 谐波占比
    percussiveRatio: number;       // 打击乐占比
    separationQuality: number;     // 分离质量
    energyPreservation: number;    // 能量保持度
    harmonicPercussiveRatio: number; // 谐波/打击乐比值
  };
  
  // 综合特征
  combinedFeatures: {
    musicStyle: string;            // 音乐风格预测
    instrumentType: string;        // 乐器类型预测
    complexity: number;            // 整体复杂度
    energy: number;                // 整体能量
    dynamics: number;              // 动态范围
  };
}

// 特征提取配置
export interface HPSSFeatureConfig {
  enableHarmonicFeatures: boolean;
  enablePercussiveFeatures: boolean;
  enableSeparationFeatures: boolean;
  enableCombinedFeatures: boolean;
  windowSize: number;
  hopSize: number;
  sampleRate: number;
}

class HPSSFeatureExtractor {
  private config: HPSSFeatureConfig;
  private previousFeatures: HPSSFeatures | null = null;

  constructor(config: Partial<HPSSFeatureConfig> = {}) {
    this.config = {
      enableHarmonicFeatures: true,
      enablePercussiveFeatures: true,
      enableSeparationFeatures: true,
      enableCombinedFeatures: true,
      windowSize: 2048,
      hopSize: 512,
      sampleRate: 44100,
      ...config
    };
  }

  /**
   * 从HPSS结果提取特征
   */
  public extractFeatures(hpssResult: HPSSResult): HPSSFeatures {
    const features: HPSSFeatures = {
      harmonicFeatures: {
        spectralCentroid: 0,
        spectralBandwidth: 0,
        spectralRolloff: 0,
        harmonicEnergy: 0,
        harmonicComplexity: 0,
        pitchStrength: 0,
        tonalCentroid: 0
      },
      percussiveFeatures: {
        percussiveEnergy: 0,
        attackStrength: 0,
        rhythmRegularity: 0,
        percussiveComplexity: 0,
        transientDensity: 0,
        beatStrength: 0
      },
      separationFeatures: {
        harmonicRatio: hpssResult.harmonicRatio,
        percussiveRatio: hpssResult.percussiveRatio,
        separationQuality: hpssResult.separationQuality,
        energyPreservation: 0,
        harmonicPercussiveRatio: 0
      },
      combinedFeatures: {
        musicStyle: 'Unknown',
        instrumentType: 'Unknown',
        complexity: 0,
        energy: 0,
        dynamics: 0
      }
    };

    try {
      // 提取谐波特征
      if (this.config.enableHarmonicFeatures) {
        features.harmonicFeatures = this.extractHarmonicFeatures(hpssResult.harmonic);
      }

      // 提取打击乐特征
      if (this.config.enablePercussiveFeatures) {
        features.percussiveFeatures = this.extractPercussiveFeatures(hpssResult.percussive);
      }

      // 提取分离质量特征
      if (this.config.enableSeparationFeatures) {
        features.separationFeatures = this.extractSeparationFeatures(hpssResult);
      }

      // 提取综合特征
      if (this.config.enableCombinedFeatures) {
        features.combinedFeatures = this.extractCombinedFeatures(features, hpssResult);
      }

      // 更新历史特征
      this.previousFeatures = features;

      return features;
    } catch (error) {
      console.error('HPSS特征提取失败:', error);
      return this.createFallbackFeatures(hpssResult);
    }
  }

  /**
   * 提取谐波特征
   */
  private extractHarmonicFeatures(harmonicSignal: Float32Array): HPSSFeatures['harmonicFeatures'] {
    // 计算频谱
    const spectrum = this.computeSpectrum(harmonicSignal);
    
    return {
      spectralCentroid: this.computeSpectralCentroid(spectrum),
      spectralBandwidth: this.computeSpectralBandwidth(spectrum),
      spectralRolloff: this.computeSpectralRolloff(spectrum),
      harmonicEnergy: this.computeEnergy(harmonicSignal),
      harmonicComplexity: this.computeHarmonicComplexity(spectrum),
      pitchStrength: this.computePitchStrength(spectrum),
      tonalCentroid: this.computeTonalCentroid(spectrum)
    };
  }

  /**
   * 提取打击乐特征
   */
  private extractPercussiveFeatures(percussiveSignal: Float32Array): HPSSFeatures['percussiveFeatures'] {
    return {
      percussiveEnergy: this.computeEnergy(percussiveSignal),
      attackStrength: this.computeAttackStrength(percussiveSignal),
      rhythmRegularity: this.computeRhythmRegularity(percussiveSignal),
      percussiveComplexity: this.computePercussiveComplexity(percussiveSignal),
      transientDensity: this.computeTransientDensity(percussiveSignal),
      beatStrength: this.computeBeatStrength(percussiveSignal)
    };
  }

  /**
   * 提取分离质量特征
   */
  private extractSeparationFeatures(hpssResult: HPSSResult): HPSSFeatures['separationFeatures'] {
    const harmonicEnergy = this.computeEnergy(hpssResult.harmonic);
    const percussiveEnergy = this.computeEnergy(hpssResult.percussive);
    const residualEnergy = this.computeEnergy(hpssResult.residual);
    const totalEnergy = harmonicEnergy + percussiveEnergy + residualEnergy;

    return {
      harmonicRatio: hpssResult.harmonicRatio,
      percussiveRatio: hpssResult.percussiveRatio,
      separationQuality: hpssResult.separationQuality,
      energyPreservation: totalEnergy > 0 ? (harmonicEnergy + percussiveEnergy) / totalEnergy : 0,
      harmonicPercussiveRatio: percussiveEnergy > 0 ? harmonicEnergy / percussiveEnergy : 0
    };
  }

  /**
   * 提取综合特征
   */
  private extractCombinedFeatures(features: HPSSFeatures, hpssResult: HPSSResult): HPSSFeatures['combinedFeatures'] {
    const { harmonicFeatures, percussiveFeatures, separationFeatures } = features;
    
    // 计算整体复杂度
    const complexity = (harmonicFeatures.harmonicComplexity + percussiveFeatures.percussiveComplexity) / 2;
    
    // 计算整体能量
    const energy = (harmonicFeatures.harmonicEnergy + percussiveFeatures.percussiveEnergy) / 2;
    
    // 计算动态范围
    const dynamics = this.computeDynamics(hpssResult.harmonic, hpssResult.percussive);
    
    // 预测音乐风格
    const musicStyle = this.predictMusicStyle(features);
    
    // 预测乐器类型
    const instrumentType = this.predictInstrumentType(features);

    return {
      musicStyle,
      instrumentType,
      complexity,
      energy,
      dynamics
    };
  }

  /**
   * 计算频谱
   */
  private computeSpectrum(signal: Float32Array): Float32Array {
    const fftSize = this.config.windowSize;
    const spectrum = new Float32Array(fftSize / 2);
    
    // 简化的FFT计算
    for (let k = 0; k < fftSize / 2; k++) {
      let real = 0;
      let imag = 0;
      
      for (let n = 0; n < Math.min(signal.length, fftSize); n++) {
        const angle = -2 * Math.PI * k * n / fftSize;
        real += signal[n] * Math.cos(angle);
        imag += signal[n] * Math.sin(angle);
      }
      
      spectrum[k] = Math.sqrt(real * real + imag * imag);
    }
    
    return spectrum;
  }

  /**
   * 计算频谱质心
   */
  private computeSpectralCentroid(spectrum: Float32Array): number {
    let weightedSum = 0;
    let magnitudeSum = 0;
    
    for (let i = 0; i < spectrum.length; i++) {
      const frequency = i * this.config.sampleRate / (spectrum.length * 2);
      weightedSum += frequency * spectrum[i];
      magnitudeSum += spectrum[i];
    }
    
    return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
  }

  /**
   * 计算频谱带宽
   */
  private computeSpectralBandwidth(spectrum: Float32Array): number {
    const centroid = this.computeSpectralCentroid(spectrum);
    let weightedSum = 0;
    let magnitudeSum = 0;
    
    for (let i = 0; i < spectrum.length; i++) {
      const frequency = i * this.config.sampleRate / (spectrum.length * 2);
      const diff = frequency - centroid;
      weightedSum += diff * diff * spectrum[i];
      magnitudeSum += spectrum[i];
    }
    
    return magnitudeSum > 0 ? Math.sqrt(weightedSum / magnitudeSum) : 0;
  }

  /**
   * 计算频谱滚降
   */
  private computeSpectralRolloff(spectrum: Float32Array): number {
    const totalEnergy = spectrum.reduce((sum, val) => sum + val * val, 0);
    const threshold = 0.85 * totalEnergy;
    
    let cumulativeEnergy = 0;
    for (let i = 0; i < spectrum.length; i++) {
      cumulativeEnergy += spectrum[i] * spectrum[i];
      if (cumulativeEnergy >= threshold) {
        return i * this.config.sampleRate / (spectrum.length * 2);
      }
    }
    
    return this.config.sampleRate / 2;
  }

  /**
   * 计算能量
   */
  private computeEnergy(signal: Float32Array): number {
    let energy = 0;
    for (let i = 0; i < signal.length; i++) {
      energy += signal[i] * signal[i];
    }
    return energy / signal.length;
  }

  /**
   * 计算谐波复杂度
   */
  private computeHarmonicComplexity(spectrum: Float32Array): number {
    // 基于频谱的熵计算复杂度
    const totalEnergy = spectrum.reduce((sum, val) => sum + val, 0);
    if (totalEnergy === 0) return 0;
    
    let entropy = 0;
    for (let i = 0; i < spectrum.length; i++) {
      const probability = spectrum[i] / totalEnergy;
      if (probability > 0) {
        entropy -= probability * Math.log2(probability);
      }
    }
    
    return entropy / Math.log2(spectrum.length);
  }

  /**
   * 计算音高强度
   */
  private computePitchStrength(spectrum: Float32Array): number {
    // 简化的音高强度计算
    const maxMagnitude = Math.max(...Array.from(spectrum));
    const totalMagnitude = spectrum.reduce((sum, val) => sum + val, 0);
    
    return totalMagnitude > 0 ? maxMagnitude / totalMagnitude : 0;
  }

  /**
   * 计算音调质心
   */
  private computeTonalCentroid(spectrum: Float32Array): number {
    // 基于Chroma特征的音调质心
    const chroma = this.computeChroma(spectrum);
    let weightedSum = 0;
    let magnitudeSum = 0;
    
    for (let i = 0; i < chroma.length; i++) {
      weightedSum += i * chroma[i];
      magnitudeSum += chroma[i];
    }
    
    return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
  }

  /**
   * 计算Chroma特征
   */
  private computeChroma(spectrum: Float32Array): Float32Array {
    const chroma = new Float32Array(12);
    
    for (let i = 0; i < spectrum.length; i++) {
      const frequency = i * this.config.sampleRate / (spectrum.length * 2);
      const chromaIndex = Math.floor(12 * Math.log2(frequency / 440) + 9) % 12;
      if (chromaIndex >= 0 && chromaIndex < 12) {
        chroma[chromaIndex] += spectrum[i];
      }
    }
    
    // 归一化
    const sum = chroma.reduce((s, val) => s + val, 0);
    if (sum > 0) {
      for (let i = 0; i < 12; i++) {
        chroma[i] /= sum;
      }
    }
    
    return chroma;
  }

  /**
   * 计算攻击强度
   */
  private computeAttackStrength(signal: Float32Array): number {
    let maxAttack = 0;
    const windowSize = Math.min(1024, signal.length);
    
    for (let i = 0; i < signal.length - windowSize; i += windowSize) {
      let attack = 0;
      for (let j = 1; j < windowSize; j++) {
        attack += Math.abs(signal[i + j] - signal[i + j - 1]);
      }
      maxAttack = Math.max(maxAttack, attack / windowSize);
    }
    
    return maxAttack;
  }

  /**
   * 计算节奏规律性
   */
  private computeRhythmRegularity(signal: Float32Array): number {
    // 简化的节奏规律性计算
    const windowSize = 1024;
    const onsets: number[] = [];
    
    for (let i = windowSize; i < signal.length - windowSize; i += windowSize) {
      const energy = this.computeEnergy(signal.slice(i - windowSize, i + windowSize));
      if (energy > 0.1) { // 阈值检测
        onsets.push(i);
      }
    }
    
    if (onsets.length < 2) return 0;
    
    // 计算间隔的规律性
    const intervals: number[] = [];
    for (let i = 1; i < onsets.length; i++) {
      intervals.push(onsets[i] - onsets[i - 1]);
    }
    
    const meanInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    let regularity = 0;
    
    for (const interval of intervals) {
      regularity += 1 - Math.abs(interval - meanInterval) / meanInterval;
    }
    
    return regularity / intervals.length;
  }

  /**
   * 计算打击乐复杂度
   */
  private computePercussiveComplexity(signal: Float32Array): number {
    // 基于瞬态密度的复杂度
    const transientDensity = this.computeTransientDensity(signal);
    const energy = this.computeEnergy(signal);
    
    return transientDensity * energy;
  }

  /**
   * 计算瞬态密度
   */
  private computeTransientDensity(signal: Float32Array): number {
    let transientCount = 0;
    const threshold = 0.1;
    
    for (let i = 1; i < signal.length; i++) {
      if (Math.abs(signal[i] - signal[i - 1]) > threshold) {
        transientCount++;
      }
    }
    
    return transientCount / signal.length;
  }

  /**
   * 计算节拍强度
   */
  private computeBeatStrength(signal: Float32Array): number {
    // 简化的节拍强度计算
    const energy = this.computeEnergy(signal);
    const attackStrength = this.computeAttackStrength(signal);
    
    return energy * attackStrength;
  }

  /**
   * 计算动态范围
   */
  private computeDynamics(harmonic: Float32Array, percussive: Float32Array): number {
    const harmonicMax = Math.max(...Array.from(harmonic).map(Math.abs));
    const harmonicMin = Math.min(...Array.from(harmonic).map(Math.abs));
    const percussiveMax = Math.max(...Array.from(percussive).map(Math.abs));
    const percussiveMin = Math.min(...Array.from(percussive).map(Math.abs));
    
    const harmonicRange = harmonicMax - harmonicMin;
    const percussiveRange = percussiveMax - percussiveMin;
    
    return (harmonicRange + percussiveRange) / 2;
  }

  /**
   * 预测音乐风格
   */
  private predictMusicStyle(features: HPSSFeatures): string {
    const { harmonicFeatures, percussiveFeatures, separationFeatures } = features;
    
    // 基于特征的简单风格分类
    if (percussiveFeatures.beatStrength > 0.7 && separationFeatures.percussiveRatio > 0.4) {
      return 'Electronic';
    } else if (harmonicFeatures.pitchStrength > 0.6 && separationFeatures.harmonicRatio > 0.6) {
      return 'Classical';
    } else if (percussiveFeatures.rhythmRegularity > 0.5) {
      return 'Rock';
    } else if (harmonicFeatures.tonalCentroid > 0.5) {
      return 'Jazz';
    } else {
      return 'Ambient';
    }
  }

  /**
   * 预测乐器类型
   */
  private predictInstrumentType(features: HPSSFeatures): string {
    const { harmonicFeatures, percussiveFeatures, separationFeatures } = features;
    
    // 基于特征的简单乐器分类
    if (separationFeatures.percussiveRatio > 0.6) {
      return 'Percussion';
    } else if (harmonicFeatures.pitchStrength > 0.7) {
      return 'String';
    } else if (harmonicFeatures.spectralCentroid > 2000) {
      return 'Wind';
    } else if (harmonicFeatures.spectralCentroid < 1000) {
      return 'Bass';
    } else {
      return 'Mixed';
    }
  }

  /**
   * 创建降级特征
   */
  private createFallbackFeatures(hpssResult: HPSSResult): HPSSFeatures {
    return {
      harmonicFeatures: {
        spectralCentroid: 1000,
        spectralBandwidth: 500,
        spectralRolloff: 2000,
        harmonicEnergy: hpssResult.harmonicRatio,
        harmonicComplexity: 0.5,
        pitchStrength: 0.5,
        tonalCentroid: 0.5
      },
      percussiveFeatures: {
        percussiveEnergy: hpssResult.percussiveRatio,
        attackStrength: 0.5,
        rhythmRegularity: 0.5,
        percussiveComplexity: 0.5,
        transientDensity: 0.5,
        beatStrength: 0.5
      },
      separationFeatures: {
        harmonicRatio: hpssResult.harmonicRatio,
        percussiveRatio: hpssResult.percussiveRatio,
        separationQuality: hpssResult.separationQuality,
        energyPreservation: 0.8,
        harmonicPercussiveRatio: hpssResult.harmonicRatio / Math.max(hpssResult.percussiveRatio, 0.01)
      },
      combinedFeatures: {
        musicStyle: 'Unknown',
        instrumentType: 'Unknown',
        complexity: 0.5,
        energy: 0.5,
        dynamics: 0.5
      }
    };
  }

  /**
   * 更新配置
   */
  public updateConfig(newConfig: Partial<HPSSFeatureConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 获取当前配置
   */
  public getConfig(): HPSSFeatureConfig {
    return { ...this.config };
  }
}

// 导出HPSS特征提取器实例
export const hpssFeatureExtractor = new HPSSFeatureExtractor();

export default HPSSFeatureExtractor;
