/**
 * 特征聚合器 - 处理2-4s窗口统计和稳定度检测
 */

export interface FeatureFrame {
  timestamp: number;
  rms?: number;
  spectralCentroid?: number;
  zcr?: number;
  mfcc?: number[];
  spectralFlatness?: number;
  spectralFlux?: number;
  chroma?: number[];
  spectralBandwidth?: number;
  spectralRolloff?: number;
  spectralContrast?: number[];
  spectralSpread?: number;
  spectralSkewness?: number;
  spectralKurtosis?: number;
  loudness?: number;
  perceptualSpread?: number;
  perceptualSharpness?: number;
  voiceProb?: number;
  percussiveRatio?: number;
  harmonicRatio?: number;
}

export interface FeatureWindow {
  window_ms: number;
  features: {
    rms_mean: number;
    rms_variance: number;
    rms_peak: number;
    zcr_mean: number;
    centroid_mean: number;
    centroid_variance: number;
    bandwidth_mean: number;
    rolloff_pct: number;
    flatness_mean: number;
    flatness_variance: number;
    flux_mean: number;
    flux_variance: number;
    chroma_mean: number[];
    chroma_variance: number[];
    contrast_mean: number[];
    contrast_variance: number[];
    spread_mean: number;
    skewness_mean: number;
    kurtosis_mean: number;
    loudness_lkfs: number;
    perceptual_spread_mean: number;
    perceptual_sharpness_mean: number;
    mfcc_mean: number[];
    mfcc_variance: number[];
    voiceProb_mean: number;
    voiceProb_variance: number;
    percussiveRatio_mean: number;
    percussiveRatio_variance: number;
    harmonicRatio_mean: number;
    harmonicRatio_variance: number;
    tempo_bpm: number;
    beat_strength: number;
    dynamic_range: number;
  };
}

export interface StabilityMetrics {
  centroid_stable: boolean;
  chroma_stable: boolean;
  tempo_stable: boolean;
  overall_stable: boolean;
  stability_duration: number;
  confidence: number;
}

export class FeatureAggregator {
  private frames: FeatureFrame[] = [];
  private readonly maxWindowMs: number;
  private readonly minWindowMs: number;
  private readonly stabilityThresholds = {
    centroid_variance: 0.2, // 放宽阈值
    chroma_variance: 0.1, // 放宽阈值
    tempo_change: 20, // BPM，放宽阈值
    min_stability_duration: 500, // ms，降低到500ms
  };

  constructor(maxWindowMs: number = 4000, minWindowMs: number = 2000) {
    this.maxWindowMs = maxWindowMs;
    this.minWindowMs = minWindowMs;
  }

  /**
   * 添加新的特征帧
   */
         addFrame(frame: FeatureFrame): void {
           this.frames.push(frame);
           this.cleanupOldFrames();
           if (this.frames.length % 10 === 0) { // 每10帧显示一次
             console.log(`特征聚合器: 添加帧 ${this.frames.length}, RMS: ${frame.rms?.toFixed(4)}`);
           }
         }

  /**
   * 清理过期帧
   */
  private cleanupOldFrames(): void {
    const now = Date.now();
    this.frames = this.frames.filter(
      frame => now - frame.timestamp < this.maxWindowMs
    );
  }

  /**
   * 计算窗口统计特征
   */
         computeWindowFeatures(): FeatureWindow | null {
           if (this.frames.length < 1) {
             if (!(window as any).__lastFrameCountLog || Date.now() - (window as any).__lastFrameCountLog > 3000) {
               (window as any).__lastFrameCountLog = Date.now();
               console.log(`特征聚合器: 帧数不足 ${this.frames.length}/1`);
             }
             return null; // 降低到1帧
           }

    const now = Date.now();
    const validFrames = this.frames.filter(
      frame => now - frame.timestamp < this.minWindowMs
    );

           if (validFrames.length < 1) {
             console.log(`特征聚合器: 有效帧数不足 ${validFrames.length}/1`);
             return null; // 降低到1帧
           }

    console.log(`特征聚合器: 计算窗口特征，有效帧数: ${validFrames.length}`);

    const features = this.calculateStatistics(validFrames);
    const tempo = this.estimateTempo(validFrames);
    const beatStrength = this.calculateBeatStrength(validFrames);

    return {
      window_ms: this.minWindowMs,
      features: {
        ...features,
        tempo_bpm: tempo,
        beat_strength: beatStrength,
        dynamic_range: this.calculateDynamicRange(validFrames),
      },
    };
  }

  /**
   * 计算统计特征
   */
  private calculateStatistics(frames: FeatureFrame[]) {
    const numericFeatures = [
      'rms',
      'spectralCentroid',
      'zcr',
      'spectralBandwidth',
      'spectralRolloff',
      'spectralFlatness',
      'spectralFlux',
      'spectralSpread',
      'spectralSkewness',
      'spectralKurtosis',
      'loudness',
      'perceptualSpread',
      'perceptualSharpness',
      'voiceProb',
      'percussiveRatio',
      'harmonicRatio',
    ] as const;

    const arrayFeatures = ['mfcc', 'chroma', 'spectralContrast'] as const;

    const stats: any = {};

    // 计算数值特征的统计量
    for (const feature of numericFeatures) {
      const values = frames
        .map(f => f[feature])
        .filter((v): v is number => typeof v === 'number');

      if (values.length > 0) {
        stats[`${feature}_mean`] = this.mean(values);
        stats[`${feature}_variance`] = this.variance(values);
        if (feature === 'rms') {
          stats[`${feature}_peak`] = Math.max(...values);
        }
      }
      if (stats[`${feature}_mean`] === undefined) {
        stats[`${feature}_mean`] = 0;
      }
      if (stats[`${feature}_variance`] === undefined) {
        stats[`${feature}_variance`] = 0;
      }
      if (feature === 'rms' && stats[`${feature}_peak`] === undefined) {
        stats[`${feature}_peak`] = 0;
      }
    }

    // 计算数组特征的统计量
    for (const feature of arrayFeatures) {
      const arrays = frames
        .map(f => f[feature])
        .filter((v): v is number[] => Array.isArray(v));

      if (arrays.length > 0) {
        const dim = arrays[0].length;
        const means = new Array(dim).fill(0);
        const variances = new Array(dim).fill(0);

        // 计算每个维度的均值
        for (let i = 0; i < dim; i++) {
          const values = arrays.map(arr => arr[i]).filter(v => !isNaN(v));
          if (values.length > 0) {
            means[i] = this.mean(values);
            variances[i] = this.variance(values);
          }
        }

        stats[`${feature}_mean`] = means;
        stats[`${feature}_variance`] = variances;
      } else {
        // 如果没有有效的数组数据，设置默认值
        stats[`${feature}_mean`] = [];
        stats[`${feature}_variance`] = [];
      }
    }

    return stats;
  }

  /**
   * 估计节拍
   */
  private estimateTempo(frames: FeatureFrame[]): number {
    // 基于spectral flux的峰值检测来估计BPM
    const fluxValues = frames
      .map(f => f.spectralFlux)
      .filter((v): v is number => typeof v === 'number');

    if (fluxValues.length < 10) return 120; // 默认BPM

    // 简单的峰值检测
    const peaks = this.detectPeaks(fluxValues);
    if (peaks.length < 2) return 120;

    // 计算峰值间隔
    const intervals = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i - 1]);
    }

    const avgInterval = this.mean(intervals);
    const bpm = (60 * 1000) / (avgInterval * 23.2); // 假设每帧23.2ms

    return Math.max(60, Math.min(180, bpm));
  }

  /**
   * 计算节拍强度
   */
  private calculateBeatStrength(frames: FeatureFrame[]): number {
    const fluxValues = frames
      .map(f => f.spectralFlux)
      .filter((v): v is number => typeof v === 'number');

    if (fluxValues.length === 0) return 0;

    const meanFlux = this.mean(fluxValues);
    const varianceFlux = this.variance(fluxValues);

    // 节拍强度基于flux的变异系数
    return Math.min(1, varianceFlux / (meanFlux + 0.001));
  }

  /**
   * 计算动态范围
   */
  private calculateDynamicRange(frames: FeatureFrame[]): number {
    const rmsValues = frames
      .map(f => f.rms)
      .filter((v): v is number => typeof v === 'number');

    if (rmsValues.length === 0) return 0;

    const maxRms = Math.max(...rmsValues);
    const minRms = Math.min(...rmsValues);

    return maxRms - minRms;
  }

  /**
   * 检测峰值
   */
  private detectPeaks(values: number[]): number[] {
    const peaks: number[] = [];
    const threshold = this.mean(values) + this.variance(values) * 0.5;

    for (let i = 1; i < values.length - 1; i++) {
      if (
        values[i] > threshold &&
        values[i] > values[i - 1] &&
        values[i] > values[i + 1]
      ) {
        peaks.push(i);
      }
    }

    return peaks;
  }

  /**
   * 检查稳定性
   */
  checkStability(): StabilityMetrics {
    const window = this.computeWindowFeatures();
    if (!window) {
      console.log('特征聚合器: 无法计算窗口特征，跳过稳定性检测');
      return {
        centroid_stable: false,
        chroma_stable: false,
        tempo_stable: false,
        overall_stable: false,
        stability_duration: 0,
        confidence: 0,
      };
    }

    const { features } = window;

    // 检查质心稳定性
    const centroid_stable =
      features.centroid_variance < this.stabilityThresholds.centroid_variance;

    // 检查chroma稳定性
    const chroma_variance = this.mean(features.chroma_variance);
    const chroma_stable =
      chroma_variance < this.stabilityThresholds.chroma_variance;

    // 检查节拍稳定性（简化版）
    const tempo_stable = true; // 暂时设为true，后续可以基于历史tempo变化

    // 计算整体稳定性
    const overall_stable = centroid_stable && chroma_stable && tempo_stable;
    
    // 计算稳定性持续时间
    const stability_duration = this.calculateStabilityDuration();
    
    // 计算置信度
    const confidence = this.calculateConfidence(features);

    console.log(`特征聚合器: 稳定性检测 - 质心:${centroid_stable}, Chroma:${chroma_stable}, 节拍:${tempo_stable}, 整体:${overall_stable}`);

    return {
      centroid_stable,
      chroma_stable,
      tempo_stable,
      overall_stable,
      stability_duration,
      confidence,
    };
  }

  /**
   * 计算稳定性持续时间
   */
  private calculateStabilityDuration(): number {
    // 简化实现，返回当前窗口大小
    return this.minWindowMs;
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(features: FeatureWindow['features']): number {
    // 基于特征质量和稳定性计算置信度
    let confidence = 0.5; // 基础置信度

    // 基于RMS质量
    if (features.rms_mean > 0.01) confidence += 0.2;

    // 基于特征完整性
    if (features.chroma_mean && features.chroma_mean.length === 12) confidence += 0.1;
    if (features.mfcc_mean && features.mfcc_mean.length === 13) confidence += 0.1;
    if (features.contrast_mean && features.contrast_mean.length === 6) confidence += 0.1;

    return Math.min(1, confidence);
  }

  /**
   * 工具函数：计算均值
   */
  private mean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * 工具函数：计算方差
   */
  private variance(values: number[]): number {
    const mean = this.mean(values);
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return this.mean(squaredDiffs);
  }

  /**
   * 重置聚合器
   */
  reset(): void {
    this.frames = [];
  }

  /**
   * 获取当前帧数
   */
  getFrameCount(): number {
    return this.frames.length;
  }
}
