/**
 * 特征聚合器 - 处理2-4s窗口统计和稳定度检测
 * 支持Web Worker异步处理
 */

import { workerManager } from './worker-manager';
import { hpssAlgorithm, HPSSResult } from './hpss-algorithm';
import { hpssFeatureExtractor, HPSSFeatures } from './hpss-feature-extractor';

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
  instrumentProbabilities?: Record<string, number>;
  dominantInstrument?: string;
  instrumentConfidence?: number;
  // Worker支持
  audioBuffer?: Float32Array;
  sampleRate?: number;
  // HPSS支持
  hpssResult?: HPSSResult;
  hpssFeatures?: HPSSFeatures;
}

export interface FeatureWindow {
  window_ms: number;
  features: {
    rms_mean: number;
    rms_variance: number;
    rms_peak: number;
    zcr_mean: number;
    zcr_variance: number;
    spectralCentroid_mean: number;
    spectralCentroid_variance: number;
    spectralBandwidth_mean: number;
    spectralBandwidth_variance: number;
    spectralRolloff_mean: number;
    spectralRolloff_variance: number;
    spectralFlatness_mean: number;
    spectralFlatness_variance: number;
    spectralFlux_mean: number;
    spectralFlux_variance: number;
    chroma_mean: number[];
    chroma_variance: number[];
    spectralContrast_mean: number[];
    spectralContrast_variance: number[];
    spectralSpread_mean: number;
    spectralSpread_variance: number;
    spectralSkewness_mean: number;
    spectralSkewness_variance: number;
    spectralKurtosis_mean: number;
    spectralKurtosis_variance: number;
    loudness_mean: number;
    loudness_variance: number;
    perceptualSpread_mean: number;
    perceptualSpread_variance: number;
    perceptualSharpness_mean: number;
    perceptualSharpness_variance: number;
    mfcc_mean: number[];
    mfcc_variance: number[];
    voiceProb_mean: number;
    voiceProb_variance: number;
    percussiveRatio_mean: number;
    percussiveRatio_variance: number;
    harmonicRatio_mean: number;
    harmonicRatio_variance: number;
    instrumentConfidence_mean: number;
    instrumentConfidence_variance: number;
    dominantInstrument: string;
    instrumentHistogram: Record<string, number>;
    instrumentConfidence: number;
    tempo_bpm: number;
    beat_strength: number;
    dynamic_range: number;
    loudness_lkfs: number;
  };
}

export interface StabilityMetrics {
  centroid_stable: boolean;
  chroma_stable: boolean;
  tempo_stable: boolean;
  tempo_change: number;
  base_stable: boolean;
  meets_min_duration: boolean;
  overall_stable: boolean;
  stability_duration: number;
  confidence: number;
}

interface StabilityThresholds {
  centroid_variance: number;
  chroma_variance: number;
  tempo_change: number;
  min_stability_duration: number;
  min_confidence: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export class FeatureAggregator {
  private frames: FeatureFrame[] = [];
  private readonly maxWindowMs: number;
  private readonly minWindowMs: number;
  private stabilityThresholds: StabilityThresholds = {
    centroid_variance: 0.15,
    chroma_variance: 0.08,
    tempo_change: 18,
    min_stability_duration: 1500,
    min_confidence: 0.4,
  };
  private lastTempo: number | null = null;
  private stableSince: number | null = null;
  private useWorker: boolean = true; // 默认使用Worker
  private workerInitialized: boolean = false;

  constructor(maxWindowMs: number = 4000, minWindowMs: number = 2000) {
    this.maxWindowMs = maxWindowMs;
    this.minWindowMs = minWindowMs;
    this.initializeWorker();
  }

  /**
   * 初始化Worker
   */
  private async initializeWorker(): Promise<void> {
    if (this.useWorker && !this.workerInitialized) {
      try {
        await workerManager.initialize();
        this.workerInitialized = true;
        console.log('FeatureAggregator: Worker初始化成功');
      } catch (error) {
        console.warn('FeatureAggregator: Worker初始化失败，回退到主线程处理:', error);
        this.useWorker = false;
      }
    }
  }

  /**
   * 添加新的特征帧
   */
  addFrame(frame: FeatureFrame): void {
    this.addFrameSync(frame);
  }

  /**
   * 异步添加特征帧（使用Worker）
   */
  async addFrameAsync(frame: FeatureFrame): Promise<void> {
    if (this.useWorker && this.workerInitialized) {
      try {
        // 如果frame包含原始音频数据，使用Worker处理
        if (frame.audioBuffer) {
          const audioData = {
            buffer: frame.audioBuffer,
            sampleRate: frame.sampleRate || 44100,
            timestamp: frame.timestamp,
            id: `frame_${Date.now()}_${Math.random()}`
          };
          
          const processedFeatures = await workerManager.processAudio(audioData);
          
          // 合并Worker处理的特征
          const enhancedFrame: FeatureFrame = {
            ...frame,
            ...processedFeatures
          };
          
          this.addFrameSync(enhancedFrame);
        } else {
          // 没有原始音频数据，直接添加
          this.addFrameSync(frame);
        }
      } catch (error) {
        console.warn('Worker处理失败，回退到主线程:', error);
        this.addFrameSync(frame);
      }
    } else {
      this.addFrameSync(frame);
    }
  }

  /**
   * 同步添加特征帧（主线程处理）
   */
  private addFrameSync(frame: FeatureFrame): void {
    this.frames.push(frame);
    this.cleanupOldFrames();
    if (this.frames.length % 50 === 0) {
      // 每50帧显示一次，减少日志频率
      console.log(
        `特征聚合器: 添加帧 ${this.frames.length}, RMS: ${frame.rms?.toFixed(4)}`
      );
    }
  }

  /**
   * 更新稳定性阈值
   */
  updateStabilityThresholds(thresholds: Partial<StabilityThresholds>): void {
    this.stabilityThresholds = {
      ...this.stabilityThresholds,
      ...thresholds,
    };
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
      if (
        !(window as any).__lastFrameCountLog ||
        Date.now() - (window as any).__lastFrameCountLog > 3000
      ) {
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

    // 减少日志频率，避免刷屏
    if (
      !(window as any).__lastWindowLog ||
      Date.now() - (window as any).__lastWindowLog > 2000
    ) {
      (window as any).__lastWindowLog = Date.now();
      console.log(`特征聚合器: 计算窗口特征，有效帧数: ${validFrames.length}`);
    }

    const features = this.calculateStatistics(validFrames);
    const tempo = this.estimateTempo(validFrames);
    const beatStrength = this.calculateBeatStrength(validFrames);
    const instrumentStats = this.computeInstrumentStats(validFrames);

    return {
      window_ms: this.minWindowMs,
      features: {
        ...features,
        tempo_bpm: tempo,
        beat_strength: beatStrength,
        dynamic_range: this.calculateDynamicRange(validFrames),
        loudness_lkfs: this.calculateLoudness(validFrames),
        dominantInstrument: instrumentStats.dominant,
        instrumentHistogram: instrumentStats.histogram,
        instrumentConfidence: instrumentStats.confidence,
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
      'instrumentConfidence',
    ] as const;

    const arrayFeatures = ['mfcc', 'chroma', 'spectralContrast'] as const;

    const stats: any = {};

    // 计算数值特征的统计量
    for (const feature of numericFeatures) {
      const values = frames
        .map(f => f[feature])
        .filter((v): v is number => typeof v === 'number')
        .map(val => this.validateFeature(val, feature));

      if (values.length > 0) {
        stats[`${feature}_mean`] = this.validateFeature(this.mean(values), `${feature}_mean`);
        stats[`${feature}_variance`] = this.validateFeature(this.variance(values), `${feature}_variance`, 0, 10);
        if (feature === 'rms') {
          stats[`${feature}_peak`] = this.validateFeature(Math.max(...values), `${feature}_peak`);
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
            means[i] = this.validateFeature(this.mean(values), `${feature}_mean[${i}]`);
            variances[i] = this.validateFeature(this.variance(values), `${feature}_variance[${i}]`, 0, 10);
          }
        }

        stats[`${feature}_mean`] = this.validateFeatureArray(means, `${feature}_mean`, dim);
        stats[`${feature}_variance`] = this.validateFeatureArray(variances, `${feature}_variance`, dim);
      } else {
        // 如果没有有效的数组数据，设置默认值
        stats[`${feature}_mean`] = [];
        stats[`${feature}_variance`] = [];
      }
    }

    return stats;
  }

  private computeInstrumentStats(frames: FeatureFrame[]) {
    const histogram: Record<string, number> = {};
    let total = 0;

    frames.forEach(frame => {
      if (frame.instrumentProbabilities) {
        for (const [label, value] of Object.entries(
          frame.instrumentProbabilities
        )) {
          if (!isFinite(value) || value <= 0) continue;
          histogram[label] = (histogram[label] ?? 0) + value;
          total += value;
        }
      }
      if (frame.dominantInstrument) {
        const bonus = frame.instrumentConfidence ?? 0.1;
        histogram[frame.dominantInstrument] =
          (histogram[frame.dominantInstrument] ?? 0) + bonus;
        total += bonus;
      }
    });

    let dominant = 'unknown';
    let confidence = 0;
    if (total > 0) {
      for (const [label, value] of Object.entries(histogram)) {
        const normalized = value / total;
        histogram[label] = normalized;
        if (normalized > confidence) {
          confidence = normalized;
          dominant = label;
        }
      }
    }

    return { dominant, histogram, confidence: clamp01(confidence) };
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
   * 计算Loudness (LKFS) - 基于ITU-R BS.1770标准
   */
  private calculateLoudness(frames: FeatureFrame[]): number {
    if (frames.length === 0) return 0;

    const rmsValues = frames
      .map(f => f.rms)
      .filter((rms): rms is number => rms !== undefined);

    if (rmsValues.length === 0) return 0;

    // 简化的LKFS计算
    // 实际LKFS需要更复杂的心理声学模型，这里使用RMS的log变换作为近似
    const avgRms = rmsValues.reduce((sum, rms) => sum + rms, 0) / rmsValues.length;
    
    // 转换为dB，然后调整到LKFS范围 (-23 LKFS 是广播标准)
    const dbValue = 20 * Math.log10(Math.max(avgRms, 1e-10));
    
    // 调整到LKFS范围 (-70 到 -10 LKFS)
    const lkfs = Math.max(-70, Math.min(-10, dbValue - 20));
    
    return lkfs;
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
        tempo_change: 0,
        base_stable: false,
        meets_min_duration: false,
        overall_stable: false,
        stability_duration: 0,
        confidence: 0,
      };
    }

    const { features } = window;

    // 检查质心稳定性
    const centroid_stable =
      features.spectralCentroid_variance <=
      this.stabilityThresholds.centroid_variance;

    // 检查chroma稳定性
    const chroma_variance = this.mean(features.chroma_variance);
    const chroma_stable =
      chroma_variance <= this.stabilityThresholds.chroma_variance;

    // 检查节奏稳定性
    const tempo = features.tempo_bpm || this.lastTempo || 120;
    const previousTempo = this.lastTempo ?? tempo;
    const tempo_change = Math.abs(tempo - previousTempo);
    const tempo_stable =
      tempo_change <= this.stabilityThresholds.tempo_change ||
      !Number.isFinite(tempo_change);
    this.lastTempo = tempo;

    // 计算整体稳定性
    const base_stable = centroid_stable && chroma_stable && tempo_stable;

    // 计算稳定性持续时间
    let stability_duration = 0;
    if (base_stable) {
      if (!this.stableSince) {
        this.stableSince = Date.now();
      }
      stability_duration = Date.now() - this.stableSince;
    } else {
      this.stableSince = null;
    }

    const meets_min_duration =
      base_stable &&
      stability_duration >= this.stabilityThresholds.min_stability_duration;

    // 计算置信度
    const confidence = clamp01(
      this.calculateConfidence(features) - tempo_change / 400
    );
    const meets_confidence = confidence >= this.stabilityThresholds.min_confidence;

    const overall_stable = base_stable && meets_min_duration && meets_confidence;

    // 减少稳定性检测日志频率
    if (
      !(window as any).__lastStabilityDetectLog ||
      Date.now() - (window as any).__lastStabilityDetectLog > 3000
    ) {
      (window as any).__lastStabilityDetectLog = Date.now();
      console.log(
        `特征聚合器: 稳定性检测 - 质心:${centroid_stable}, Chroma:${chroma_stable}, 节拍:${tempo_stable}, 整体:${overall_stable}`
      );
    }

    return {
      centroid_stable,
      chroma_stable,
      tempo_stable,
      tempo_change,
      base_stable,
      meets_min_duration,
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
    if (features.chroma_mean && features.chroma_mean.length === 12)
      confidence += 0.1;
    if (features.mfcc_mean && features.mfcc_mean.length === 13)
      confidence += 0.1;
    if (
      features.spectralContrast_mean &&
      features.spectralContrast_mean.length === 6
    )
      confidence += 0.1;
    if (features.instrumentConfidence && features.instrumentConfidence > 0.4) {
      confidence += 0.05;
    }

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

  /**
   * 特征归一化 - 将特征值标准化到[0,1]范围
   */
  normalizeFeature(value: number, min: number, max: number): number {
    if (max === min) return 0.5; // 避免除零
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
  }

  /**
   * 批量归一化特征数组
   */
  normalizeFeatureArray(values: number[], min: number, max: number): number[] {
    return values.map(val => this.normalizeFeature(val, min, max));
  }

  /**
   * 特征验证和边界检查
   */
  validateFeature(value: number | undefined, name: string, min: number = 0, max: number = 1): number {
    if (value === undefined || value === null) {
      console.warn(`特征 ${name} 未定义，使用默认值 0`);
      return 0;
    }

    if (!Number.isFinite(value)) {
      console.warn(`特征 ${name} 不是有限数值: ${value}，使用默认值 0`);
      return 0;
    }

    if (value < min || value > max) {
      console.warn(`特征 ${name} 超出范围 [${min}, ${max}]: ${value}，进行截断`);
      return Math.max(min, Math.min(max, value));
    }

    return value;
  }

  /**
   * 验证特征数组
   */
  validateFeatureArray(values: number[] | undefined, name: string, expectedLength?: number): number[] {
    if (!values || !Array.isArray(values)) {
      console.warn(`特征数组 ${name} 无效，返回空数组`);
      return [];
    }

    if (expectedLength && values.length !== expectedLength) {
      console.warn(`特征数组 ${name} 长度不匹配，期望 ${expectedLength}，实际 ${values.length}`);
    }

    return values.map((val, index) => 
      this.validateFeature(val, `${name}[${index}]`)
    );
  }

  /**
   * 特征序列化 - 将FeatureWindow转换为JSON字符串
   */
  serializeFeatureWindow(window: FeatureWindow): string {
    try {
      return JSON.stringify(window, null, 2);
    } catch (error) {
      console.error('特征窗口序列化失败:', error);
      return '{}';
    }
  }

  /**
   * 特征反序列化 - 从JSON字符串恢复FeatureWindow
   */
  deserializeFeatureWindow(jsonString: string): FeatureWindow | null {
    try {
      const parsed = JSON.parse(jsonString);
      
      // 验证必要字段
      if (!parsed.window_ms || !parsed.features) {
        console.error('反序列化失败：缺少必要字段');
        return null;
      }

      return parsed as FeatureWindow;
    } catch (error) {
      console.error('特征窗口反序列化失败:', error);
      return null;
    }
  }

  /**
   * 获取特征统计信息
   */
  getFeatureStatistics(): {
    totalFrames: number;
    windowSize: number;
    stabilityThresholds: StabilityThresholds;
    lastUpdateTime: number;
    workerStatus: {
      useWorker: boolean;
      workerInitialized: boolean;
    };
  } {
    return {
      totalFrames: this.frames.length,
      windowSize: this.minWindowMs,
      stabilityThresholds: this.stabilityThresholds,
      lastUpdateTime: this.frames.length > 0 ? this.frames[this.frames.length - 1].timestamp : 0,
      workerStatus: {
        useWorker: this.useWorker,
        workerInitialized: this.workerInitialized
      }
    };
  }

  /**
   * 异步乐器分类
   */
  async classifyInstrumentsAsync(audioBuffer: Float32Array): Promise<{
    dominantInstrument: string;
    instrumentProbabilities: Record<string, number>;
    confidence: number;
  }> {
    if (this.useWorker && this.workerInitialized) {
      try {
        return await workerManager.classifyInstruments(audioBuffer);
      } catch (error) {
        console.warn('Worker乐器分类失败，回退到主线程:', error);
        return this.classifyInstrumentsSync(audioBuffer);
      }
    } else {
      return this.classifyInstrumentsSync(audioBuffer);
    }
  }

  /**
   * 执行HPSS分离
   */
  async performHPSSSeparation(audioBuffer: Float32Array): Promise<HPSSResult> {
    try {
      console.log('开始HPSS分离处理...');
      const hpssResult = hpssAlgorithm.separate(audioBuffer);
      console.log('HPSS分离完成:', {
        harmonicRatio: hpssResult.harmonicRatio.toFixed(3),
        percussiveRatio: hpssResult.percussiveRatio.toFixed(3),
        separationQuality: hpssResult.separationQuality.toFixed(3)
      });
      return hpssResult;
    } catch (error) {
      console.error('HPSS分离失败:', error);
      throw error;
    }
  }

  /**
   * 提取HPSS特征
   */
  async extractHPSSFeatures(hpssResult: HPSSResult): Promise<HPSSFeatures> {
    try {
      console.log('开始提取HPSS特征...');
      const hpssFeatures = hpssFeatureExtractor.extractFeatures(hpssResult);
      console.log('HPSS特征提取完成:', {
        musicStyle: hpssFeatures.combinedFeatures.musicStyle,
        instrumentType: hpssFeatures.combinedFeatures.instrumentType,
        complexity: hpssFeatures.combinedFeatures.complexity.toFixed(3)
      });
      return hpssFeatures;
    } catch (error) {
      console.error('HPSS特征提取失败:', error);
      throw error;
    }
  }

  /**
   * 异步添加特征帧（支持HPSS）
   */
  async addFrameWithHPSS(frame: FeatureFrame): Promise<void> {
    if (frame.audioBuffer) {
      try {
        // 执行HPSS分离
        const hpssResult = await this.performHPSSSeparation(frame.audioBuffer);
        
        // 提取HPSS特征
        const hpssFeatures = await this.extractHPSSFeatures(hpssResult);
        
        // 创建增强的特征帧
        const enhancedFrame: FeatureFrame = {
          ...frame,
          hpssResult,
          hpssFeatures,
          // 更新传统特征
          harmonicRatio: hpssResult.harmonicRatio,
          percussiveRatio: hpssResult.percussiveRatio,
          // 基于HPSS特征更新乐器信息
          dominantInstrument: hpssFeatures.combinedFeatures.instrumentType,
          instrumentConfidence: hpssResult.separationQuality
        };
        
        // 添加增强的特征帧
        this.addFrameSync(enhancedFrame);
        
        console.log('HPSS增强特征帧添加成功');
      } catch (error) {
        console.warn('HPSS处理失败，使用原始特征帧:', error);
        this.addFrameSync(frame);
      }
    } else {
      // 没有音频数据，直接添加
      this.addFrameSync(frame);
    }
  }

  /**
   * 同步乐器分类（主线程）
   */
  private classifyInstrumentsSync(audioBuffer: Float32Array): {
    dominantInstrument: string;
    instrumentProbabilities: Record<string, number>;
    confidence: number;
  } {
    // 简化的主线程分类逻辑
    const rms = this.calculateRMS(audioBuffer);
    const spectralCentroid = this.calculateSpectralCentroid(audioBuffer);
    
    // 基于特征的简单分类
    let dominantInstrument = 'Unknown';
    let confidence = 0.5;
    
    if (rms > 0.3 && spectralCentroid > 2000) {
      dominantInstrument = 'Guitar';
      confidence = 0.7;
    } else if (rms > 0.2 && spectralCentroid < 1500) {
      dominantInstrument = 'Piano';
      confidence = 0.6;
    } else if (rms > 0.4) {
      dominantInstrument = 'Drum';
      confidence = 0.8;
    }
    
    return {
      dominantInstrument,
      instrumentProbabilities: {
        [dominantInstrument]: confidence
      },
      confidence
    };
  }

  /**
   * 计算RMS（主线程）
   */
  private calculateRMS(buffer: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  }

  /**
   * 计算频谱质心（主线程）
   */
  private calculateSpectralCentroid(buffer: Float32Array): number {
    // 简化的频谱质心计算
    let weightedSum = 0;
    let magnitudeSum = 0;
    
    for (let i = 0; i < buffer.length; i++) {
      const magnitude = Math.abs(buffer[i]);
      weightedSum += i * magnitude;
      magnitudeSum += magnitude;
    }
    
    return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
  }
}
