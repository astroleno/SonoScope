/**
 * aubio节拍检测器
 * 基于aubio算法进行精确BPM检测和节拍跟踪
 */

export interface TempoDetectionResult {
  bpm: number;                   // 精确BPM
  tempoConfidence: number;       // 节拍置信度 (0-1)
  beatPositions: number[];       // 节拍位置 (秒)
  timeSignature: [number, number]; // 拍号 [分子, 分母]
  rhythmPattern: string;         // 节奏模式
  tempoStability: number;        // 节拍稳定性 (0-1)
  isSteady: boolean;             // 是否稳定节拍
}

export interface TempoFrame {
  timestamp: number;
  tempo: TempoDetectionResult;
}

// 节拍检测配置
interface TempoDetectorConfig {
  sampleRate: number;
  hopLength: number;
  frameLength: number;
  minBpm: number;
  maxBpm: number;
  confidenceThreshold: number;
  tempoWindow: number;           // 节拍窗口大小 (秒)
}

export class TempoDetector {
  private config: TempoDetectorConfig;
  private isInitialized: boolean = false;
  private tempoHistory: number[] = [];
  private beatHistory: number[] = [];
  private lastBeatTime: number = 0;

  constructor(config?: Partial<TempoDetectorConfig>) {
    this.config = {
      sampleRate: 44100,
      hopLength: 512,
      frameLength: 1024,
      minBpm: 60,
      maxBpm: 200,
      confidenceThreshold: 0.3,
      tempoWindow: 4.0,
      ...config,
    };
  }

  /**
   * 初始化节拍检测器
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // 检查是否在浏览器环境
      if (typeof window === 'undefined') {
        console.warn('TempoDetector: 不在浏览器环境，使用模拟模式');
        this.isInitialized = true;
        return;
      }

      // 这里可以加载aubio的WASM版本
      // 目前使用启发式方法实现
      console.log('TempoDetector: 使用启发式节拍检测算法');
      this.isInitialized = true;
    } catch (error) {
      console.error('TempoDetector: 初始化失败', error);
      this.isInitialized = true; // 允许使用降级方案
    }
  }

  /**
   * 检测节拍
   */
  async detectTempo(audioBuffer: Float32Array): Promise<TempoDetectionResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // 使用启发式方法检测节拍
    return this.detectTempoHeuristic(audioBuffer);
  }

  /**
   * 启发式节拍检测方法
   */
  private detectTempoHeuristic(audioBuffer: Float32Array): TempoDetectionResult {
    // 计算能量包络
    const energyEnvelope = this.computeEnergyEnvelope(audioBuffer);
    
    // 检测节拍点
    const beatPositions = this.detectBeats(energyEnvelope);
    
    // 计算BPM
    const bpm = this.calculateBPM(beatPositions);
    
    // 计算节拍置信度
    const tempoConfidence = this.calculateTempoConfidence(beatPositions, bpm);
    
    // 分析拍号
    const timeSignature = this.analyzeTimeSignature(beatPositions, bpm);
    
    // 分析节奏模式
    const rhythmPattern = this.analyzeRhythmPattern(beatPositions, bpm);
    
    // 计算节拍稳定性
    const tempoStability = this.calculateTempoStability(bpm);
    
    // 更新历史记录
    this.updateTempoHistory(bpm);
    this.updateBeatHistory(beatPositions);

    return {
      bpm,
      tempoConfidence,
      beatPositions,
      timeSignature,
      rhythmPattern,
      tempoStability,
      isSteady: tempoStability > 0.7,
    };
  }

  /**
   * 计算能量包络
   */
  private computeEnergyEnvelope(audioBuffer: Float32Array): Float32Array {
    const hopLength = this.config.hopLength;
    const frameLength = this.config.frameLength;
    const numFrames = Math.floor((audioBuffer.length - frameLength) / hopLength) + 1;
    const envelope = new Float32Array(numFrames);

    for (let i = 0; i < numFrames; i++) {
      const start = i * hopLength;
      const end = Math.min(start + frameLength, audioBuffer.length);
      let energy = 0;

      for (let j = start; j < end; j++) {
        energy += audioBuffer[j] * audioBuffer[j];
      }

      envelope[i] = Math.sqrt(energy / (end - start));
    }

    return envelope;
  }

  /**
   * 检测节拍点
   */
  private detectBeats(energyEnvelope: Float32Array): number[] {
    const beats: number[] = [];
    const threshold = this.calculateBeatThreshold(energyEnvelope);
    
    // 使用峰值检测找到节拍点
    for (let i = 1; i < energyEnvelope.length - 1; i++) {
      if (energyEnvelope[i] > threshold &&
          energyEnvelope[i] > energyEnvelope[i - 1] &&
          energyEnvelope[i] > energyEnvelope[i + 1]) {
        
        const timeInSeconds = (i * this.config.hopLength) / this.config.sampleRate;
        beats.push(timeInSeconds);
      }
    }

    return beats;
  }

  /**
   * 计算节拍阈值
   */
  private calculateBeatThreshold(energyEnvelope: Float32Array): number {
    // 计算动态阈值
    let sum = 0;
    let count = 0;
    
    for (let i = 0; i < energyEnvelope.length; i++) {
      sum += energyEnvelope[i];
      count++;
    }
    
    const mean = sum / count;
    
    // 计算标准差
    let variance = 0;
    for (let i = 0; i < energyEnvelope.length; i++) {
      variance += Math.pow(energyEnvelope[i] - mean, 2);
    }
    const stdDev = Math.sqrt(variance / count);
    
    return mean + 0.5 * stdDev;
  }

  /**
   * 计算BPM
   */
  private calculateBPM(beatPositions: number[]): number {
    if (beatPositions.length < 2) {
      return 120; // 默认BPM
    }

    // 计算节拍间隔
    const intervals: number[] = [];
    for (let i = 1; i < beatPositions.length; i++) {
      intervals.push(beatPositions[i] - beatPositions[i - 1]);
    }

    // 计算平均间隔
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    
    // 转换为BPM
    const bpm = 60 / avgInterval;
    
    // 限制在合理范围内
    return Math.max(this.config.minBpm, Math.min(this.config.maxBpm, bpm));
  }

  /**
   * 计算节拍置信度
   */
  private calculateTempoConfidence(beatPositions: number[], bpm: number): number {
    if (beatPositions.length < 2) {
      return 0;
    }

    // 计算节拍间隔的一致性
    const intervals: number[] = [];
    for (let i = 1; i < beatPositions.length; i++) {
      intervals.push(beatPositions[i] - beatPositions[i - 1]);
    }

    const expectedInterval = 60 / bpm;
    let consistency = 0;
    
    for (const interval of intervals) {
      const deviation = Math.abs(interval - expectedInterval) / expectedInterval;
      consistency += Math.max(0, 1 - deviation);
    }
    
    return Math.min(1, consistency / intervals.length);
  }

  /**
   * 分析拍号
   */
  private analyzeTimeSignature(beatPositions: number[], bpm: number): [number, number] {
    if (beatPositions.length < 4) {
      return [4, 4]; // 默认4/4拍
    }

    // 分析强拍模式
    const intervals = this.calculateBeatIntervals(beatPositions);
    const strongBeatPattern = this.detectStrongBeatPattern(intervals);
    
    // 根据强拍模式确定拍号
    switch (strongBeatPattern) {
      case '4/4':
        return [4, 4];
      case '3/4':
        return [3, 4];
      case '2/4':
        return [2, 4];
      case '6/8':
        return [6, 8];
      default:
        return [4, 4];
    }
  }

  /**
   * 计算节拍间隔
   */
  private calculateBeatIntervals(beatPositions: number[]): number[] {
    const intervals: number[] = [];
    for (let i = 1; i < beatPositions.length; i++) {
      intervals.push(beatPositions[i] - beatPositions[i - 1]);
    }
    return intervals;
  }

  /**
   * 检测强拍模式
   */
  private detectStrongBeatPattern(intervals: number[]): string {
    if (intervals.length < 4) {
      return '4/4';
    }

    // 分析间隔模式
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    
    // 检测是否有规律的重音模式
    let strongBeatCount = 0;
    for (let i = 0; i < intervals.length; i++) {
      if (intervals[i] > avgInterval * 1.2) {
        strongBeatCount++;
      }
    }

    // 根据强拍数量判断拍号
    if (strongBeatCount >= intervals.length * 0.25) {
      return '3/4'; // 三拍子
    } else if (strongBeatCount >= intervals.length * 0.15) {
      return '6/8'; // 六拍子
    } else {
      return '4/4'; // 四拍子
    }
  }

  /**
   * 分析节奏模式
   */
  private analyzeRhythmPattern(beatPositions: number[], bpm: number): string {
    if (beatPositions.length < 4) {
      return 'simple';
    }

    const intervals = this.calculateBeatIntervals(beatPositions);
    const expectedInterval = 60 / bpm;
    
    // 分析节奏复杂度
    let complexity = 0;
    for (const interval of intervals) {
      const ratio = interval / expectedInterval;
      if (ratio > 1.5) complexity += 1; // 长音
      else if (ratio < 0.7) complexity += 1; // 短音
    }
    
    const complexityRatio = complexity / intervals.length;
    
    if (complexityRatio > 0.3) {
      return 'complex';
    } else if (complexityRatio > 0.1) {
      return 'moderate';
    } else {
      return 'simple';
    }
  }

  /**
   * 计算节拍稳定性
   */
  private calculateTempoStability(currentBpm: number): number {
    if (this.tempoHistory.length === 0) {
      return 1.0;
    }

    // 计算BPM变化的标准差
    const allBpms = [...this.tempoHistory, currentBpm];
    const mean = allBpms.reduce((sum, bpm) => sum + bpm, 0) / allBpms.length;
    const variance = allBpms.reduce((sum, bpm) => sum + Math.pow(bpm - mean, 2), 0) / allBpms.length;
    const stdDev = Math.sqrt(variance);
    
    // 稳定性 = 1 - (标准差 / 平均BPM)
    const stability = Math.max(0, 1 - (stdDev / mean));
    return stability;
  }

  /**
   * 更新节拍历史
   */
  private updateTempoHistory(bpm: number): void {
    this.tempoHistory.push(bpm);
    
    // 保持历史记录在合理范围内
    const maxHistory = Math.floor(this.config.tempoWindow * 2); // 2倍窗口大小
    if (this.tempoHistory.length > maxHistory) {
      this.tempoHistory.shift();
    }
  }

  /**
   * 更新节拍历史
   */
  private updateBeatHistory(beatPositions: number[]): void {
    this.beatHistory.push(...beatPositions);
    
    // 保持历史记录在合理范围内
    const maxHistory = Math.floor(this.config.tempoWindow * 4); // 4倍窗口大小
    if (this.beatHistory.length > maxHistory) {
      this.beatHistory.splice(0, this.beatHistory.length - maxHistory);
    }
  }

  /**
   * 批量检测节拍
   */
  async detectTempoBatch(audioFrames: Float32Array[]): Promise<TempoFrame[]> {
    const results: TempoFrame[] = [];
    
    for (let i = 0; i < audioFrames.length; i++) {
      const tempo = await this.detectTempo(audioFrames[i]);
      results.push({
        timestamp: Date.now() + i * (this.config.hopLength / this.config.sampleRate) * 1000,
        tempo,
      });
    }
    
    return results;
  }

  /**
   * 获取配置信息
   */
  getConfig(): TempoDetectorConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<TempoDetectorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 重置历史记录
   */
  reset(): void {
    this.tempoHistory = [];
    this.beatHistory = [];
    this.lastBeatTime = 0;
  }
}

// 创建全局实例
export const tempoDetector = new TempoDetector();
