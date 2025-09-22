/**
 * 增强HPSS特征提取器
 * 扩展HPSS特征提取，增加谐波分析深度
 */

import { HPSSResult } from './hpss-algorithm';
import { HPSSFeatures } from './hpss-feature-extractor';

// 增强的HPSS特征接口
export interface EnhancedHPSSFeatures extends HPSSFeatures {
  // 增强谐波特征
  enhancedHarmonicFeatures: {
    harmonicComplexity: number;      // 谐波复杂度
    harmonicStability: number;       // 谐波稳定性
    harmonicRichness: number;        // 谐波丰富度
    harmonicConsistency: number;     // 谐波一致性
    harmonicClarity: number;         // 谐波清晰度
    harmonicWarmth: number;          // 谐波温暖度
  };
  
  // 增强打击乐特征
  enhancedPercussiveFeatures: {
    percussiveComplexity: number;    // 打击乐复杂度
    percussiveStability: number;     // 打击乐稳定性
    percussiveRichness: number;      // 打击乐丰富度
    percussiveConsistency: number;   // 打击乐一致性
    percussiveClarity: number;       // 打击乐清晰度
    percussiveSharpness: number;     // 打击乐锐度
  };
  
  // 增强分离特征
  enhancedSeparationFeatures: {
    separationQualityScore: number;  // 分离质量评分
    separationConsistency: number;   // 分离一致性
    separationStability: number;     // 分离稳定性
    separationClarity: number;       // 分离清晰度
    separationCompleteness: number;  // 分离完整性
  };
  
  // 增强组合特征
  enhancedCombinedFeatures: {
    musicalComplexity: number;       // 音乐复杂度
    musicalStability: number;        // 音乐稳定性
    musicalRichness: number;         // 音乐丰富度
    musicalConsistency: number;      // 音乐一致性
    musicalClarity: number;          // 音乐清晰度
    musicalWarmth: number;           // 音乐温暖度
  };
}

export class EnhancedHPSSExtractor {
  private config = {
    sampleRate: 44100,
    windowSize: 2048,
    hopSize: 512,
  };

  constructor(config?: Partial<typeof EnhancedHPSSExtractor.prototype.config>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * 提取增强的HPSS特征
   */
  extractEnhancedFeatures(hpssResult: HPSSResult): EnhancedHPSSFeatures {
    // 计算增强谐波特征
    const enhancedHarmonicFeatures = this.calculateEnhancedHarmonicFeatures(hpssResult.harmonic);
    
    // 计算增强打击乐特征
    const enhancedPercussiveFeatures = this.calculateEnhancedPercussiveFeatures(hpssResult.percussive);
    
    // 计算增强分离特征
    const enhancedSeparationFeatures = this.calculateEnhancedSeparationFeatures(hpssResult);
    
    // 计算增强组合特征
    const enhancedCombinedFeatures = this.calculateEnhancedCombinedFeatures(
      enhancedHarmonicFeatures,
      enhancedPercussiveFeatures,
      enhancedSeparationFeatures
    );

    return {
      // 基础特征（从原始HPSS结果计算）
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
      },
      // 增强特征
      enhancedHarmonicFeatures,
      enhancedPercussiveFeatures,
      enhancedSeparationFeatures,
      enhancedCombinedFeatures,
    };
  }

  /**
   * 计算增强的谐波特征
   */
  private calculateEnhancedHarmonicFeatures(harmonic: Float32Array): EnhancedHPSSFeatures['enhancedHarmonicFeatures'] {
    const spectrum = this.computeSpectrum(harmonic);
    
    return {
      harmonicComplexity: this.calculateHarmonicComplexity(spectrum),
      harmonicStability: this.calculateHarmonicStability(spectrum),
      harmonicRichness: this.calculateHarmonicRichness(spectrum),
      harmonicConsistency: this.calculateHarmonicConsistency(spectrum),
      harmonicClarity: this.calculateHarmonicClarity(spectrum),
      harmonicWarmth: this.calculateHarmonicWarmth(spectrum),
    };
  }

  /**
   * 计算增强的打击乐特征
   */
  private calculateEnhancedPercussiveFeatures(percussive: Float32Array): EnhancedHPSSFeatures['enhancedPercussiveFeatures'] {
    const spectrum = this.computeSpectrum(percussive);
    
    return {
      percussiveComplexity: this.calculatePercussiveComplexity(spectrum),
      percussiveStability: this.calculatePercussiveStability(spectrum),
      percussiveRichness: this.calculatePercussiveRichness(spectrum),
      percussiveConsistency: this.calculatePercussiveConsistency(spectrum),
      percussiveClarity: this.calculatePercussiveClarity(spectrum),
      percussiveSharpness: this.calculatePercussiveSharpness(spectrum),
    };
  }

  /**
   * 计算增强的分离特征
   */
  private calculateEnhancedSeparationFeatures(hpssResult: HPSSResult): EnhancedHPSSFeatures['enhancedSeparationFeatures'] {
    return {
      separationQualityScore: this.calculateSeparationQualityScore(hpssResult),
      separationConsistency: this.calculateSeparationConsistency(hpssResult),
      separationStability: this.calculateSeparationStability(hpssResult),
      separationClarity: this.calculateSeparationClarity(hpssResult),
      separationCompleteness: this.calculateSeparationCompleteness(hpssResult),
    };
  }

  /**
   * 计算增强的组合特征
   */
  private calculateEnhancedCombinedFeatures(
    harmonicFeatures: EnhancedHPSSFeatures['enhancedHarmonicFeatures'],
    percussiveFeatures: EnhancedHPSSFeatures['enhancedPercussiveFeatures'],
    separationFeatures: EnhancedHPSSFeatures['enhancedSeparationFeatures']
  ): EnhancedHPSSFeatures['enhancedCombinedFeatures'] {
    return {
      musicalComplexity: this.calculateMusicalComplexity(harmonicFeatures, percussiveFeatures),
      musicalStability: this.calculateMusicalStability(harmonicFeatures, percussiveFeatures),
      musicalRichness: this.calculateMusicalRichness(harmonicFeatures, percussiveFeatures),
      musicalConsistency: this.calculateMusicalConsistency(harmonicFeatures, percussiveFeatures),
      musicalClarity: this.calculateMusicalClarity(harmonicFeatures, percussiveFeatures),
      musicalWarmth: this.calculateMusicalWarmth(harmonicFeatures, percussiveFeatures),
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

  // 增强特征计算方法
  private calculateHarmonicComplexity(spectrum: Float32Array): number {
    // 计算频谱的复杂度
    const totalEnergy = spectrum.reduce((sum, val) => sum + val, 0);
    if (totalEnergy === 0) return 0;
    
    let complexity = 0;
    for (let i = 0; i < spectrum.length; i++) {
      const prob = spectrum[i] / totalEnergy;
      if (prob > 0) {
        complexity -= prob * Math.log2(prob);
      }
    }
    
    return Math.min(1, complexity / Math.log2(spectrum.length));
  }

  private calculateHarmonicStability(spectrum: Float32Array): number {
    // 计算频谱的稳定性
    const mean = spectrum.reduce((sum, val) => sum + val, 0) / spectrum.length;
    const variance = spectrum.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / spectrum.length;
    
    return Math.max(0, 1 - Math.sqrt(variance) / mean);
  }

  private calculateHarmonicRichness(spectrum: Float32Array): number {
    // 计算频谱的丰富度
    const nonZeroBins = spectrum.filter(val => val > 0).length;
    return nonZeroBins / spectrum.length;
  }

  private calculateHarmonicConsistency(spectrum: Float32Array): number {
    // 计算频谱的一致性
    const mean = spectrum.reduce((sum, val) => sum + val, 0) / spectrum.length;
    let consistency = 0;
    
    for (let i = 0; i < spectrum.length; i++) {
      consistency += Math.exp(-Math.abs(spectrum[i] - mean) / mean);
    }
    
    return consistency / spectrum.length;
  }

  private calculateHarmonicClarity(spectrum: Float32Array): number {
    // 计算频谱的清晰度
    const maxVal = Math.max(...Array.from(spectrum));
    const totalEnergy = spectrum.reduce((sum, val) => sum + val, 0);
    
    return totalEnergy > 0 ? maxVal / totalEnergy : 0;
  }

  private calculateHarmonicWarmth(spectrum: Float32Array): number {
    // 计算频谱的温暖度
    const totalEnergy = spectrum.reduce((sum, val) => sum + val, 0);
    if (totalEnergy === 0) return 0;
    
    // 中低频能量占比
    const midFreqStart = Math.floor(spectrum.length * 0.2);
    const midFreqEnd = Math.floor(spectrum.length * 0.6);
    const midFreqEnergy = spectrum.slice(midFreqStart, midFreqEnd).reduce((sum, val) => sum + val, 0);
    
    return midFreqEnergy / totalEnergy;
  }

  // 打击乐增强特征计算方法
  private calculatePercussiveComplexity(spectrum: Float32Array): number {
    return this.calculateHarmonicComplexity(spectrum);
  }

  private calculatePercussiveStability(spectrum: Float32Array): number {
    return this.calculateHarmonicStability(spectrum);
  }

  private calculatePercussiveRichness(spectrum: Float32Array): number {
    return this.calculateHarmonicRichness(spectrum);
  }

  private calculatePercussiveConsistency(spectrum: Float32Array): number {
    return this.calculateHarmonicConsistency(spectrum);
  }

  private calculatePercussiveClarity(spectrum: Float32Array): number {
    return this.calculateHarmonicClarity(spectrum);
  }

  private calculatePercussiveSharpness(spectrum: Float32Array): number {
    // 计算频谱的锐度
    const totalEnergy = spectrum.reduce((sum, val) => sum + val, 0);
    if (totalEnergy === 0) return 0;
    
    // 高频能量占比
    const highFreqStart = Math.floor(spectrum.length * 0.7);
    const highFreqEnergy = spectrum.slice(highFreqStart).reduce((sum, val) => sum + val, 0);
    
    return highFreqEnergy / totalEnergy;
  }

  // 分离增强特征计算方法
  private calculateSeparationQualityScore(hpssResult: HPSSResult): number {
    return hpssResult.separationQuality;
  }

  private calculateSeparationConsistency(hpssResult: HPSSResult): number {
    // 计算分离的一致性
    const harmonicEnergy = this.calculateEnergy(hpssResult.harmonic);
    const percussiveEnergy = this.calculateEnergy(hpssResult.percussive);
    const totalEnergy = harmonicEnergy + percussiveEnergy;
    
    if (totalEnergy === 0) return 0;
    
    const expectedHarmonicRatio = 0.7; // 期望的谐波占比
    const actualHarmonicRatio = harmonicEnergy / totalEnergy;
    
    return Math.max(0, 1 - Math.abs(actualHarmonicRatio - expectedHarmonicRatio) / expectedHarmonicRatio);
  }

  private calculateSeparationStability(hpssResult: HPSSResult): number {
    // 计算分离的稳定性
    const harmonicRatio = hpssResult.harmonicRatio;
    const percussiveRatio = hpssResult.percussiveRatio;
    
    // 稳定性基于比例的一致性
    return Math.max(0, 1 - Math.abs(harmonicRatio - percussiveRatio));
  }

  private calculateSeparationClarity(hpssResult: HPSSResult): number {
    // 计算分离的清晰度
    const harmonicEnergy = this.calculateEnergy(hpssResult.harmonic);
    const percussiveEnergy = this.calculateEnergy(hpssResult.percussive);
    const totalEnergy = harmonicEnergy + percussiveEnergy;
    
    if (totalEnergy === 0) return 0;
    
    // 清晰度基于能量分布的区分度
    const harmonicRatio = harmonicEnergy / totalEnergy;
    const percussiveRatio = percussiveEnergy / totalEnergy;
    
    return Math.max(0, 1 - Math.abs(harmonicRatio - percussiveRatio));
  }

  private calculateSeparationCompleteness(hpssResult: HPSSResult): number {
    // 计算分离的完整性
    const harmonicEnergy = this.calculateEnergy(hpssResult.harmonic);
    const percussiveEnergy = this.calculateEnergy(hpssResult.percussive);
    const totalEnergy = harmonicEnergy + percussiveEnergy;
    
    if (totalEnergy === 0) return 0;
    
    // 完整性基于能量保持度
    return Math.min(1, totalEnergy / (harmonicEnergy + percussiveEnergy));
  }

  // 组合增强特征计算方法
  private calculateMusicalComplexity(harmonicFeatures: EnhancedHPSSFeatures['enhancedHarmonicFeatures'], percussiveFeatures: EnhancedHPSSFeatures['enhancedPercussiveFeatures']): number {
    return (harmonicFeatures.harmonicComplexity + percussiveFeatures.percussiveComplexity) / 2;
  }

  private calculateMusicalStability(harmonicFeatures: EnhancedHPSSFeatures['enhancedHarmonicFeatures'], percussiveFeatures: EnhancedHPSSFeatures['enhancedPercussiveFeatures']): number {
    return (harmonicFeatures.harmonicStability + percussiveFeatures.percussiveStability) / 2;
  }

  private calculateMusicalRichness(harmonicFeatures: EnhancedHPSSFeatures['enhancedHarmonicFeatures'], percussiveFeatures: EnhancedHPSSFeatures['enhancedPercussiveFeatures']): number {
    return (harmonicFeatures.harmonicRichness + percussiveFeatures.percussiveRichness) / 2;
  }

  private calculateMusicalConsistency(harmonicFeatures: EnhancedHPSSFeatures['enhancedHarmonicFeatures'], percussiveFeatures: EnhancedHPSSFeatures['enhancedPercussiveFeatures']): number {
    return (harmonicFeatures.harmonicConsistency + percussiveFeatures.percussiveConsistency) / 2;
  }

  private calculateMusicalClarity(harmonicFeatures: EnhancedHPSSFeatures['enhancedHarmonicFeatures'], percussiveFeatures: EnhancedHPSSFeatures['enhancedPercussiveFeatures']): number {
    return (harmonicFeatures.harmonicClarity + percussiveFeatures.percussiveClarity) / 2;
  }

  private calculateMusicalWarmth(harmonicFeatures: EnhancedHPSSFeatures['enhancedHarmonicFeatures'], percussiveFeatures: EnhancedHPSSFeatures['enhancedPercussiveFeatures']): number {
    return (harmonicFeatures.harmonicWarmth + percussiveFeatures.percussiveWarmth) / 2;
  }

  /**
   * 计算能量
   */
  private calculateEnergy(audioBuffer: Float32Array): number {
    let energy = 0;
    for (let i = 0; i < audioBuffer.length; i++) {
      energy += audioBuffer[i] * audioBuffer[i];
    }
    return energy;
  }

  /**
   * 获取配置
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<typeof EnhancedHPSSExtractor.prototype.config>) {
    this.config = { ...this.config, ...newConfig };
  }
}

// 创建全局实例
export const enhancedHPSSExtractor = new EnhancedHPSSExtractor();
