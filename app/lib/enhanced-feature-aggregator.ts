/**
 * 增强特征聚合器
 * 集成所有增强的音频特征提取器
 */

import { FeatureAggregator, FeatureFrame, FeatureWindow } from './feature-aggregator';
import { PitchDetector, PitchDetectionResult } from './pitch-detector';
import { TempoDetector, TempoDetectionResult } from './tempo-detector';
import { TimbreAnalyzer, TimbreAnalysisResult } from './timbre-analyzer';
import { MusicnnClassifier, InstrumentRecognitionResult } from './musicnn-classifier';
import { EnhancedHPSSExtractor, EnhancedHPSSFeatures } from './enhanced-hpss-extractor';
import { HPSSResult } from './hpss-algorithm';

// 增强的特征帧接口
export interface EnhancedFeatureFrame extends FeatureFrame {
  // 音高特征
  pitch?: PitchDetectionResult;
  
  // 节拍特征
  tempo?: TempoDetectionResult;
  
  // 音色特征
  timbre?: TimbreAnalysisResult;
  
  // 乐器识别特征
  instruments?: InstrumentRecognitionResult;
  
  // 增强HPSS特征
  enhancedHPSS?: EnhancedHPSSFeatures;
}

// 增强的特征窗口接口
export interface EnhancedFeatureWindow extends FeatureWindow {
  // 音高统计
  pitchStats?: {
    avgFundamentalFreq: number;
    pitchStability: number;
    pitchRange: number;
    dominantPitch: string;
    pitchConfidence: number;
  };
  
  // 节拍统计
  tempoStats?: {
    avgBpm: number;
    tempoStability: number;
    tempoRange: number;
    dominantTimeSignature: string;
    tempoConfidence: number;
  };
  
  // 音色统计
  timbreStats?: {
    avgBrightness: number;
    avgWarmth: number;
    avgRoughness: number;
    dominantTimbre: string;
    timbreConfidence: number;
  };
  
  // 乐器统计
  instrumentStats?: {
    dominantInstrument: string;
    instrumentCount: number;
    polyphony: number;
    instrumentDiversity: number;
    instrumentConfidence: number;
  };
  
  // 增强HPSS统计
  enhancedHPSSStats?: {
    avgMusicalComplexity: number;
    avgMusicalStability: number;
    avgMusicalRichness: number;
    avgSeparationQuality: number;
    enhancedFeatureCount: number;
  };
}

export class EnhancedFeatureAggregator extends FeatureAggregator {
  private pitchDetector: PitchDetector;
  private tempoDetector: TempoDetector;
  private timbreAnalyzer: TimbreAnalyzer;
  private musicnnClassifier: MusicnnClassifier;
  private enhancedHPSSExtractor: EnhancedHPSSExtractor;
  
  private enhancedFrames: EnhancedFeatureFrame[] = [];
  private enhancedWindows: EnhancedFeatureWindow[] = [];

  constructor() {
    super();
    
    // 初始化增强特征提取器
    this.pitchDetector = new PitchDetector();
    this.tempoDetector = new TempoDetector();
    this.timbreAnalyzer = new TimbreAnalyzer();
    this.musicnnClassifier = new MusicnnClassifier();
    this.enhancedHPSSExtractor = new EnhancedHPSSExtractor();
  }

  /**
   * 初始化增强特征聚合器
   */
  async initialize(): Promise<void> {
    // 初始化增强特征提取器
    await Promise.all([
      this.pitchDetector.initialize(),
      this.tempoDetector.initialize(),
      this.timbreAnalyzer.initialize(),
      this.musicnnClassifier.initialize(),
    ]);
    
    console.log('EnhancedFeatureAggregator: 所有增强特征提取器初始化完成');
  }

  /**
   * 添加增强特征帧
   */
  async addEnhancedFrame(frame: EnhancedFeatureFrame): Promise<void> {
    // 添加基础特征帧
    await super.addFrame(frame);
    
    // 处理增强特征
    if (frame.audioBuffer && frame.sampleRate) {
      try {
        // 并行处理所有增强特征
        const [pitch, tempo, timbre, instruments] = await Promise.all([
          this.pitchDetector.detectPitch(frame.audioBuffer),
          this.tempoDetector.detectTempo(frame.audioBuffer),
          this.timbreAnalyzer.analyzeTimbre(frame.audioBuffer),
          this.musicnnClassifier.recognizeInstruments(frame.audioBuffer),
        ]);
        
        // 更新帧的增强特征
        frame.pitch = pitch;
        frame.tempo = tempo;
        frame.timbre = timbre;
        frame.instruments = instruments;
        
        // 如果有HPSS结果，处理增强HPSS特征
        if (frame.hpssResult) {
          frame.enhancedHPSS = this.enhancedHPSSExtractor.extractEnhancedFeatures(frame.hpssResult);
        }
        
        // 添加到增强帧数组
        this.enhancedFrames.push(frame);
        
        // 检查是否需要计算窗口特征
        if (this.enhancedFrames.length >= this.config.windowSize) {
          await this.computeEnhancedWindowFeatures();
        }
        
      } catch (error) {
        console.error('EnhancedFeatureAggregator: 增强特征提取失败', error);
      }
    }
  }

  /**
   * 计算增强窗口特征
   */
  private async computeEnhancedWindowFeatures(): Promise<void> {
    if (this.enhancedFrames.length < this.config.windowSize) {
      return;
    }
    
    // 获取窗口内的帧
    const windowFrames = this.enhancedFrames.slice(-this.config.windowSize);
    
    // 计算基础窗口特征
    const baseWindow = this.computeWindowFeatures(windowFrames);
    
    // 计算增强窗口特征
    const enhancedWindow: EnhancedFeatureWindow = {
      ...baseWindow,
      pitchStats: this.computePitchStats(windowFrames),
      tempoStats: this.computeTempoStats(windowFrames),
      timbreStats: this.computeTimbreStats(windowFrames),
      instrumentStats: this.computeInstrumentStats(windowFrames),
      enhancedHPSSStats: this.computeEnhancedHPSSStats(windowFrames),
    };
    
    // 添加到窗口数组
    this.enhancedWindows.push(enhancedWindow);
    
    // 保持窗口数量在合理范围内
    if (this.enhancedWindows.length > 10) {
      this.enhancedWindows.shift();
    }
    
    // 清理旧的帧
    if (this.enhancedFrames.length > this.config.windowSize * 2) {
      this.enhancedFrames.splice(0, this.enhancedFrames.length - this.config.windowSize);
    }
  }

  /**
   * 计算音高统计
   */
  private computePitchStats(frames: EnhancedFeatureFrame[]): EnhancedFeatureWindow['pitchStats'] {
    const pitchFrames = frames.filter(f => f.pitch && f.pitch.isVoiced);
    
    if (pitchFrames.length === 0) {
      return {
        avgFundamentalFreq: 0,
        pitchStability: 0,
        pitchRange: 0,
        dominantPitch: 'C',
        pitchConfidence: 0,
      };
    }
    
    const frequencies = pitchFrames.map(f => f.pitch!.fundamentalFreq);
    const confidences = pitchFrames.map(f => f.pitch!.pitchConfidence);
    const pitchClasses = pitchFrames.map(f => f.pitch!.pitchClass);
    
    // 计算平均基频
    const avgFundamentalFreq = frequencies.reduce((sum, freq) => sum + freq, 0) / frequencies.length;
    
    // 计算音高稳定性
    const meanFreq = avgFundamentalFreq;
    const variance = frequencies.reduce((sum, freq) => sum + Math.pow(freq - meanFreq, 2), 0) / frequencies.length;
    const pitchStability = Math.max(0, 1 - Math.sqrt(variance) / meanFreq);
    
    // 计算音高范围
    const pitchRange = Math.max(...frequencies) - Math.min(...frequencies);
    
    // 找到主导音级
    const pitchClassCounts: Record<string, number> = {};
    pitchClasses.forEach(pitchClass => {
      pitchClassCounts[pitchClass] = (pitchClassCounts[pitchClass] || 0) + 1;
    });
    const dominantPitch = Object.entries(pitchClassCounts).reduce((a, b) => a[1] > b[1] ? a : b)[0];
    
    // 计算平均置信度
    const pitchConfidence = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
    
    return {
      avgFundamentalFreq,
      pitchStability,
      pitchRange,
      dominantPitch,
      pitchConfidence,
    };
  }

  /**
   * 计算节拍统计
   */
  private computeTempoStats(frames: EnhancedFeatureFrame[]): EnhancedFeatureWindow['tempoStats'] {
    const tempoFrames = frames.filter(f => f.tempo && f.tempo.isSteady);
    
    if (tempoFrames.length === 0) {
      return {
        avgBpm: 120,
        tempoStability: 0,
        tempoRange: 0,
        dominantTimeSignature: '4/4',
        tempoConfidence: 0,
      };
    }
    
    const bpms = tempoFrames.map(f => f.tempo!.bpm);
    const confidences = tempoFrames.map(f => f.tempo!.tempoConfidence);
    const timeSignatures = tempoFrames.map(f => f.tempo!.timeSignature);
    
    // 计算平均BPM
    const avgBpm = bpms.reduce((sum, bpm) => sum + bpm, 0) / bpms.length;
    
    // 计算节拍稳定性
    const meanBpm = avgBpm;
    const variance = bpms.reduce((sum, bpm) => sum + Math.pow(bpm - meanBpm, 2), 0) / bpms.length;
    const tempoStability = Math.max(0, 1 - Math.sqrt(variance) / meanBpm);
    
    // 计算节拍范围
    const tempoRange = Math.max(...bpms) - Math.min(...bpms);
    
    // 找到主导拍号
    const timeSignatureCounts: Record<string, number> = {};
    timeSignatures.forEach(ts => {
      const key = `${ts[0]}/${ts[1]}`;
      timeSignatureCounts[key] = (timeSignatureCounts[key] || 0) + 1;
    });
    const dominantTimeSignature = Object.entries(timeSignatureCounts).reduce((a, b) => a[1] > b[1] ? a : b)[0];
    
    // 计算平均置信度
    const tempoConfidence = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
    
    return {
      avgBpm,
      tempoStability,
      tempoRange,
      dominantTimeSignature,
      tempoConfidence,
    };
  }

  /**
   * 计算音色统计
   */
  private computeTimbreStats(frames: EnhancedFeatureFrame[]): EnhancedFeatureWindow['timbreStats'] {
    const timbreFrames = frames.filter(f => f.timbre);
    
    if (timbreFrames.length === 0) {
      return {
        avgBrightness: 0.5,
        avgWarmth: 0.5,
        avgRoughness: 0.5,
        dominantTimbre: 'mellow',
        timbreConfidence: 0,
      };
    }
    
    const brightnesses = timbreFrames.map(f => f.timbre!.brightness);
    const warmths = timbreFrames.map(f => f.timbre!.warmth);
    const roughnesses = timbreFrames.map(f => f.timbre!.roughness);
    const timbreCategories = timbreFrames.map(f => f.timbre!.timbreCategory);
    const confidences = timbreFrames.map(f => f.timbre!.timbreConfidence);
    
    // 计算平均音色特征
    const avgBrightness = brightnesses.reduce((sum, val) => sum + val, 0) / brightnesses.length;
    const avgWarmth = warmths.reduce((sum, val) => sum + val, 0) / warmths.length;
    const avgRoughness = roughnesses.reduce((sum, val) => sum + val, 0) / roughnesses.length;
    
    // 找到主导音色类别
    const timbreCategoryCounts: Record<string, number> = {};
    timbreCategories.forEach(category => {
      timbreCategoryCounts[category] = (timbreCategoryCounts[category] || 0) + 1;
    });
    const dominantTimbre = Object.entries(timbreCategoryCounts).reduce((a, b) => a[1] > b[1] ? a : b)[0];
    
    // 计算平均置信度
    const timbreConfidence = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
    
    return {
      avgBrightness,
      avgWarmth,
      avgRoughness,
      dominantTimbre,
      timbreConfidence,
    };
  }

  /**
   * 计算乐器统计
   */
  private computeInstrumentStats(frames: EnhancedFeatureFrame[]): EnhancedFeatureWindow['instrumentStats'] {
    const instrumentFrames = frames.filter(f => f.instruments && f.instruments.instruments.length > 0);
    
    if (instrumentFrames.length === 0) {
      return {
        dominantInstrument: 'unknown',
        instrumentCount: 0,
        polyphony: 0,
        instrumentDiversity: 0,
        instrumentConfidence: 0,
      };
    }
    
    const dominantInstruments = instrumentFrames.map(f => f.instruments!.dominantInstrument);
    const instrumentCounts = instrumentFrames.map(f => f.instruments!.instrumentCount);
    const polyphonies = instrumentFrames.map(f => f.instruments!.polyphony);
    const diversities = instrumentFrames.map(f => f.instruments!.instrumentDiversity);
    const confidences = instrumentFrames.map(f => f.instruments!.instruments[0]?.confidence || 0);
    
    // 找到主导乐器
    const instrumentCountsMap: Record<string, number> = {};
    dominantInstruments.forEach(instrument => {
      instrumentCountsMap[instrument] = (instrumentCountsMap[instrument] || 0) + 1;
    });
    const dominantInstrument = Object.entries(instrumentCountsMap).reduce((a, b) => a[1] > b[1] ? a : b)[0];
    
    // 计算平均统计值
    const instrumentCount = instrumentCounts.reduce((sum, count) => sum + count, 0) / instrumentCounts.length;
    const polyphony = polyphonies.reduce((sum, poly) => sum + poly, 0) / polyphonies.length;
    const instrumentDiversity = diversities.reduce((sum, div) => sum + div, 0) / diversities.length;
    const instrumentConfidence = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
    
    return {
      dominantInstrument,
      instrumentCount,
      polyphony,
      instrumentDiversity,
      instrumentConfidence,
    };
  }

  /**
   * 计算增强HPSS统计
   */
  private computeEnhancedHPSSStats(frames: EnhancedFeatureFrame[]): EnhancedFeatureWindow['enhancedHPSSStats'] {
    const hpssFrames = frames.filter(f => f.enhancedHPSS);
    
    if (hpssFrames.length === 0) {
      return {
        avgMusicalComplexity: 0.5,
        avgMusicalStability: 0.5,
        avgMusicalRichness: 0.5,
        avgSeparationQuality: 0.5,
        enhancedFeatureCount: 0,
      };
    }
    
    const complexities = hpssFrames.map(f => f.enhancedHPSS!.enhancedCombinedFeatures.musicalComplexity);
    const stabilities = hpssFrames.map(f => f.enhancedHPSS!.enhancedCombinedFeatures.musicalStability);
    const richnesses = hpssFrames.map(f => f.enhancedHPSS!.enhancedCombinedFeatures.musicalRichness);
    const separationQualities = hpssFrames.map(f => f.enhancedHPSS!.enhancedSeparationFeatures.separationQualityScore);
    
    // 计算平均统计值
    const avgMusicalComplexity = complexities.reduce((sum, val) => sum + val, 0) / complexities.length;
    const avgMusicalStability = stabilities.reduce((sum, val) => sum + val, 0) / stabilities.length;
    const avgMusicalRichness = richnesses.reduce((sum, val) => sum + val, 0) / richnesses.length;
    const avgSeparationQuality = separationQualities.reduce((sum, val) => sum + val, 0) / separationQualities.length;
    
    // 计算增强特征数量
    const enhancedFeatureCount = Object.keys(hpssFrames[0].enhancedHPSS!.enhancedCombinedFeatures).length +
                                 Object.keys(hpssFrames[0].enhancedHPSS!.enhancedHarmonicFeatures).length +
                                 Object.keys(hpssFrames[0].enhancedHPSS!.enhancedPercussiveFeatures).length +
                                 Object.keys(hpssFrames[0].enhancedHPSS!.enhancedSeparationFeatures).length;
    
    return {
      avgMusicalComplexity,
      avgMusicalStability,
      avgMusicalRichness,
      avgSeparationQuality,
      enhancedFeatureCount,
    };
  }

  /**
   * 获取增强特征统计
   */
  getEnhancedFeatureStatistics(): any {
    const baseStats = this.getFeatureStatistics();
    
    return {
      ...baseStats,
      enhancedFeatureCount: this.enhancedFrames.length,
      enhancedWindowCount: this.enhancedWindows.length,
      pitchDetectorStatus: this.pitchDetector.getConfig(),
      tempoDetectorStatus: this.tempoDetector.getConfig(),
      timbreAnalyzerStatus: this.timbreAnalyzer.getConfig(),
      musicnnClassifierStatus: this.musicnnClassifier.getConfig(),
      enhancedHPSSExtractorStatus: this.enhancedHPSSExtractor.getConfig(),
    };
  }

  /**
   * 获取最新的增强特征窗口
   */
  getLatestEnhancedWindow(): EnhancedFeatureWindow | null {
    return this.enhancedWindows.length > 0 ? this.enhancedWindows[this.enhancedWindows.length - 1] : null;
  }

  /**
   * 获取所有增强特征窗口
   */
  getAllEnhancedWindows(): EnhancedFeatureWindow[] {
    return [...this.enhancedWindows];
  }

  /**
   * 重置增强特征聚合器
   */
  reset(): void {
    super.reset();
    this.enhancedFrames = [];
    this.enhancedWindows = [];
  }
}

// 创建全局实例
export const enhancedFeatureAggregator = new EnhancedFeatureAggregator();
