/**
 * CREPE音高检测器
 * 基于CREPE模型进行精确音高检测
 */

export interface PitchDetectionResult {
  fundamentalFreq: number;        // 基频 (Hz)
  pitchConfidence: number;        // 音高置信度 (0-1)
  pitchClass: string;            // 音级 (C, D, E, F, G, A, B)
  octave: number;                // 八度 (0-8)
  cents: number;                 // 音分偏移 (-50 to +50)
  harmonicity: number;           // 谐波性 (0-1)
  isVoiced: boolean;             // 是否有音高
}

export interface PitchFrame {
  timestamp: number;
  pitch: PitchDetectionResult;
}

// 音级映射表
const PITCH_CLASSES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// 音高检测配置
interface PitchDetectorConfig {
  sampleRate: number;
  hopLength: number;
  frameLength: number;
  confidenceThreshold: number;
  minFreq: number;
  maxFreq: number;
}

export class PitchDetector {
  private config: PitchDetectorConfig;
  private isInitialized: boolean = false;
  private model: any = null;

  constructor(config?: Partial<PitchDetectorConfig>) {
    this.config = {
      sampleRate: 16000,
      hopLength: 160,
      frameLength: 1024,
      confidenceThreshold: 0.3,
      minFreq: 50,
      maxFreq: 2000,
      ...config,
    };
  }

  /**
   * 初始化CREPE模型
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // 检查是否在浏览器环境
      if (typeof window === 'undefined') {
        console.warn('PitchDetector: 不在浏览器环境，使用模拟模式');
        this.isInitialized = true;
        return;
      }

      // 动态导入TensorFlow.js
      const tf = await import('@tensorflow/tfjs');
      
      // 加载CREPE模型 (这里使用预训练的模型)
      // 注意：实际项目中需要下载并托管CREPE模型文件
      try {
        this.model = await tf.loadLayersModel('/models/crepe/model.json');
        console.log('PitchDetector: CREPE模型加载成功');
      } catch (error) {
        console.warn('PitchDetector: CREPE模型加载失败，使用启发式方法', error);
        this.model = null;
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('PitchDetector: 初始化失败', error);
      this.isInitialized = true; // 允许使用降级方案
    }
  }

  /**
   * 检测音高
   */
  async detectPitch(audioBuffer: Float32Array): Promise<PitchDetectionResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // 如果模型可用，使用CREPE进行检测
    if (this.model) {
      try {
        return await this.detectPitchWithCREPE(audioBuffer);
      } catch (error) {
        console.warn('PitchDetector: CREPE检测失败，使用启发式方法', error);
      }
    }

    // 降级到启发式方法
    return this.detectPitchHeuristic(audioBuffer);
  }

  /**
   * 使用CREPE模型检测音高
   */
  private async detectPitchWithCREPE(audioBuffer: Float32Array): Promise<PitchDetectionResult> {
    const tf = await import('@tensorflow/tfjs');
    
    // 预处理音频数据
    const preprocessed = this.preprocessAudioForCREPE(audioBuffer);
    
    // 运行模型推理
    const prediction: any = (this.model as any).predict(preprocessed as any);
    const probabilities = await prediction.data();
    
    // 后处理结果
    const result = this.postprocessCREPEResult(probabilities);
    
    // 清理内存
    if (typeof prediction.dispose === 'function') prediction.dispose();
    
    return result;
  }

  /**
   * 启发式音高检测方法
   */
  private detectPitchHeuristic(audioBuffer: Float32Array): PitchDetectionResult {
    // 使用自相关方法检测基频
    const fundamentalFreq = this.detectFundamentalFreq(audioBuffer);
    
    if (fundamentalFreq < this.config.minFreq || fundamentalFreq > this.config.maxFreq) {
      return {
        fundamentalFreq: 0,
        pitchConfidence: 0,
        pitchClass: 'C',
        octave: 4,
        cents: 0,
        harmonicity: 0,
        isVoiced: false,
      };
    }

    // 计算音级和八度
    const { pitchClass, octave, cents } = this.freqToPitch(fundamentalFreq);
    
    // 计算谐波性
    const harmonicity = this.calculateHarmonicity(audioBuffer, fundamentalFreq);
    
    // 计算置信度
    const pitchConfidence = Math.min(1, harmonicity * 1.2);

    return {
      fundamentalFreq,
      pitchConfidence,
      pitchClass,
      octave,
      cents,
      harmonicity,
      isVoiced: pitchConfidence > this.config.confidenceThreshold,
    };
  }

  /**
   * 使用自相关方法检测基频
   */
  private detectFundamentalFreq(audioBuffer: Float32Array): number {
    const sampleRate = this.config.sampleRate;
    const minPeriod = Math.floor(sampleRate / this.config.maxFreq);
    const maxPeriod = Math.floor(sampleRate / this.config.minFreq);

    let bestPeriod = 0;
    let bestCorrelation = 0;

    // 计算自相关
    for (let period = minPeriod; period <= maxPeriod; period++) {
      let correlation = 0;
      for (let i = 0; i < audioBuffer.length - period; i++) {
        correlation += audioBuffer[i] * audioBuffer[i + period];
      }
      
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestPeriod = period;
      }
    }

    return bestPeriod > 0 ? sampleRate / bestPeriod : 0;
  }

  /**
   * 将频率转换为音级、八度和音分
   */
  private freqToPitch(freq: number): { pitchClass: string; octave: number; cents: number } {
    // A4 = 440Hz 作为参考
    const a4Freq = 440;
    const a4Midi = 69;
    
    // 计算MIDI音符号
    const midiNote = 12 * Math.log2(freq / a4Freq) + a4Midi;
    
    // 计算八度和音级
    const octave = Math.floor(midiNote / 12) - 1;
    const pitchClassIndex = Math.floor(midiNote) % 12;
    const pitchClass = PITCH_CLASSES[pitchClassIndex];
    
    // 计算音分偏移
    const cents = (midiNote - Math.floor(midiNote)) * 100;
    
    return { pitchClass, octave, cents };
  }

  /**
   * 计算谐波性
   */
  private calculateHarmonicity(audioBuffer: Float32Array, fundamentalFreq: number): number {
    const sampleRate = this.config.sampleRate;
    const fundamentalPeriod = sampleRate / fundamentalFreq;
    
    let harmonicEnergy = 0;
    let totalEnergy = 0;
    
    // 计算基频和谐波的能量
    for (let harmonic = 1; harmonic <= 5; harmonic++) {
      const period = fundamentalPeriod / harmonic;
      if (period < audioBuffer.length) {
        let energy = 0;
        for (let i = 0; i < audioBuffer.length - period; i++) {
          energy += Math.abs(audioBuffer[i] * audioBuffer[i + Math.floor(period)]);
        }
        harmonicEnergy += energy;
      }
    }
    
    // 计算总能量
    for (let i = 0; i < audioBuffer.length; i++) {
      totalEnergy += audioBuffer[i] * audioBuffer[i];
    }
    
    return totalEnergy > 0 ? harmonicEnergy / totalEnergy : 0;
  }

  /**
   * 为CREPE预处理音频数据
   */
  private preprocessAudioForCREPE(audioBuffer: Float32Array): any {
    // CREPE期望的输入格式：[-1, 1]范围的浮点数
    const normalized = new Float32Array(audioBuffer.length);
    let maxVal = 0;
    
    // 找到最大值进行归一化
    for (let i = 0; i < audioBuffer.length; i++) {
      maxVal = Math.max(maxVal, Math.abs(audioBuffer[i]));
    }
    
    // 归一化到[-1, 1]
    if (maxVal > 0) {
      for (let i = 0; i < audioBuffer.length; i++) {
        normalized[i] = audioBuffer[i] / maxVal;
      }
    }
    
    return normalized;
  }

  /**
   * 后处理CREPE结果
   */
  private postprocessCREPEResult(probabilities: Float32Array): PitchDetectionResult {
    // 找到概率最高的音高
    let maxProb = 0;
    let maxIndex = 0;
    
    for (let i = 0; i < probabilities.length; i++) {
      if (probabilities[i] > maxProb) {
        maxProb = probabilities[i];
        maxIndex = i;
      }
    }
    
    // 将索引转换为频率
    // CREPE模型输出360个频率bin，对应50Hz到2000Hz
    const minFreq = 50;
    const maxFreq = 2000;
    const freqStep = (maxFreq - minFreq) / 360;
    const fundamentalFreq = minFreq + maxIndex * freqStep;
    
    // 计算音级信息
    const { pitchClass, octave, cents } = this.freqToPitch(fundamentalFreq);
    
    return {
      fundamentalFreq,
      pitchConfidence: maxProb,
      pitchClass,
      octave,
      cents,
      harmonicity: maxProb,
      isVoiced: maxProb > this.config.confidenceThreshold,
    };
  }

  /**
   * 批量检测音高
   */
  async detectPitchBatch(audioFrames: Float32Array[]): Promise<PitchFrame[]> {
    const results: PitchFrame[] = [];
    
    for (let i = 0; i < audioFrames.length; i++) {
      const pitch = await this.detectPitch(audioFrames[i]);
      results.push({
        timestamp: Date.now() + i * (this.config.hopLength / this.config.sampleRate) * 1000,
        pitch,
      });
    }
    
    return results;
  }

  /**
   * 获取配置信息
   */
  getConfig(): PitchDetectorConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<PitchDetectorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// 创建全局实例
export const pitchDetector = new PitchDetector();
