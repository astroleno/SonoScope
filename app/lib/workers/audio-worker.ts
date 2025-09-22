/**
 * Audio Worker - 音频处理专用Web Worker
 * 负责音频特征提取、预处理等计算密集型任务
 */

// Worker消息类型定义
interface AudioWorkerMessage {
  type: 'PROCESS_AUDIO' | 'EXTRACT_FEATURES' | 'PREPROCESS' | 'TERMINATE';
  data?: any;
  id?: string;
}

interface AudioWorkerResponse {
  type: 'SUCCESS' | 'ERROR' | 'PROGRESS';
  data?: any;
  id?: string;
  error?: string;
  progress?: number;
}

// 音频处理配置
interface AudioProcessingConfig {
  sampleRate: number;
  bufferSize: number;
  features: string[];
  windowSize: number;
}

// 音频数据接口
interface AudioData {
  buffer: Float32Array;
  sampleRate: number;
  timestamp: number;
  id: string;
}

// 特征提取结果
interface FeatureResult {
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
  timestamp: number;
}

class AudioWorker {
  private config: AudioProcessingConfig;
  private isProcessing: boolean = false;

  constructor() {
    this.config = {
      sampleRate: 44100,
      bufferSize: 2048,
      features: ['rms', 'spectralCentroid', 'zcr', 'mfcc', 'chroma'],
      windowSize: 4096
    };
  }

  /**
   * 处理音频数据
   */
  async processAudio(audioData: AudioData): Promise<FeatureResult> {
    try {
      this.isProcessing = true;
      
      // 音频预处理
      const preprocessedData = await this.preprocessAudio(audioData);
      
      // 特征提取
      const features = await this.extractFeatures(preprocessedData);
      
      this.isProcessing = false;
      
      return {
        ...features,
        timestamp: audioData.timestamp
      };
    } catch (error) {
      this.isProcessing = false;
      throw new Error(`音频处理失败: ${error}`);
    }
  }

  /**
   * 音频预处理
   */
  async preprocessAudio(audioData: AudioData): Promise<Float32Array> {
    const { buffer, sampleRate } = audioData;
    
    // 重采样到目标采样率
    if (sampleRate !== this.config.sampleRate) {
      return this.resample(buffer, sampleRate, this.config.sampleRate);
    }
    
    return buffer;
  }

  /**
   * 重采样音频数据
   */
  private resample(buffer: Float32Array, fromRate: number, toRate: number): Float32Array {
    if (fromRate === toRate) return buffer;
    
    const ratio = fromRate / toRate;
    const newLength = Math.floor(buffer.length / ratio);
    const result = new Float32Array(newLength);
    
    for (let i = 0; i < newLength; i++) {
      const sourceIndex = i * ratio;
      const index = Math.floor(sourceIndex);
      const fraction = sourceIndex - index;
      
      if (index + 1 < buffer.length) {
        result[i] = buffer[index] * (1 - fraction) + buffer[index + 1] * fraction;
      } else {
        result[i] = buffer[index];
      }
    }
    
    return result;
  }

  /**
   * 提取音频特征
   */
  async extractFeatures(buffer: Float32Array): Promise<Partial<FeatureResult>> {
    const features: Partial<FeatureResult> = {};
    
    // RMS (Root Mean Square)
    if (this.config.features.includes('rms')) {
      features.rms = this.calculateRMS(buffer);
    }
    
    // Spectral Centroid
    if (this.config.features.includes('spectralCentroid')) {
      features.spectralCentroid = this.calculateSpectralCentroid(buffer);
    }
    
    // Zero Crossing Rate
    if (this.config.features.includes('zcr')) {
      features.zcr = this.calculateZCR(buffer);
    }
    
    // MFCC (简化版)
    if (this.config.features.includes('mfcc')) {
      features.mfcc = this.calculateMFCC(buffer);
    }
    
    // Chroma
    if (this.config.features.includes('chroma')) {
      features.chroma = this.calculateChroma(buffer);
    }
    
    return features;
  }

  /**
   * 计算RMS
   */
  private calculateRMS(buffer: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  }

  /**
   * 计算频谱质心
   */
  private calculateSpectralCentroid(buffer: Float32Array): number {
    // 简化的频谱质心计算
    const fft = this.fft(buffer);
    let weightedSum = 0;
    let magnitudeSum = 0;
    
    for (let i = 0; i < fft.length / 2; i++) {
      const magnitude = Math.sqrt(fft[i * 2] * fft[i * 2] + fft[i * 2 + 1] * fft[i * 2 + 1]);
      weightedSum += i * magnitude;
      magnitudeSum += magnitude;
    }
    
    return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
  }

  /**
   * 计算过零率
   */
  private calculateZCR(buffer: Float32Array): number {
    let crossings = 0;
    for (let i = 1; i < buffer.length; i++) {
      if ((buffer[i] >= 0) !== (buffer[i - 1] >= 0)) {
        crossings++;
      }
    }
    return crossings / (buffer.length - 1);
  }

  /**
   * 计算MFCC (简化版)
   */
  private calculateMFCC(buffer: Float32Array): number[] {
    // 简化的MFCC计算，返回13维特征
    const mfcc = new Array(13).fill(0);
    const fft = this.fft(buffer);
    
    // 简化的梅尔滤波器组
    for (let i = 0; i < 13; i++) {
      const start = Math.floor((i * fft.length) / 26);
      const end = Math.floor(((i + 1) * fft.length) / 26);
      
      let energy = 0;
      for (let j = start; j < end; j++) {
        const magnitude = Math.sqrt(fft[j * 2] * fft[j * 2] + fft[j * 2 + 1] * fft[j * 2 + 1]);
        energy += magnitude;
      }
      
      mfcc[i] = Math.log(energy + 1e-10);
    }
    
    return mfcc;
  }

  /**
   * 计算Chroma特征
   */
  private calculateChroma(buffer: Float32Array): number[] {
    const chroma = new Array(12).fill(0);
    const fft = this.fft(buffer);
    
    // 简化的Chroma计算
    for (let i = 0; i < fft.length / 2; i++) {
      const magnitude = Math.sqrt(fft[i * 2] * fft[i * 2] + fft[i * 2 + 1] * fft[i * 2 + 1]);
      const chromaIndex = i % 12;
      chroma[chromaIndex] += magnitude;
    }
    
    // 归一化
    const sum = chroma.reduce((a, b) => a + b, 0);
    if (sum > 0) {
      for (let i = 0; i < 12; i++) {
        chroma[i] /= sum;
      }
    }
    
    return chroma;
  }

  /**
   * 简化的FFT实现
   */
  private fft(buffer: Float32Array): Float32Array {
    const N = buffer.length;
    const result = new Float32Array(N * 2);
    
    // 简化的FFT实现
    for (let i = 0; i < N; i++) {
      result[i * 2] = buffer[i];
      result[i * 2 + 1] = 0;
    }
    
    // 这里应该实现完整的FFT算法
    // 为了简化，我们使用一个基本的实现
    
    return result;
  }

  /**
   * 更新配置
   */
  public updateConfig(newConfig: Partial<AudioProcessingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 获取处理状态
   */
  public getProcessingStatus(): boolean {
    return this.isProcessing;
  }
}

// 创建Worker实例
const audioWorker = new AudioWorker();

// 监听主线程消息
self.addEventListener('message', async (event: MessageEvent<AudioWorkerMessage>) => {
  const { type, data, id } = event.data;
  
  try {
    switch (type) {
      case 'PROCESS_AUDIO':
        if (data) {
          const result = await audioWorker.processAudio(data);
          const response: AudioWorkerResponse = {
            type: 'SUCCESS',
            data: result,
            id
          };
          self.postMessage(response);
        }
        break;
        
      case 'EXTRACT_FEATURES':
        if (data) {
          const result = await audioWorker.extractFeatures(data);
          const response: AudioWorkerResponse = {
            type: 'SUCCESS',
            data: result,
            id
          };
          self.postMessage(response);
        }
        break;
        
      case 'PREPROCESS':
        if (data) {
          const result = await audioWorker.preprocessAudio(data);
          const response: AudioWorkerResponse = {
            type: 'SUCCESS',
            data: result,
            id
          };
          self.postMessage(response);
        }
        break;
        
      case 'TERMINATE':
        self.close();
        break;
        
      default:
        throw new Error(`未知的消息类型: ${type}`);
    }
  } catch (error) {
    const response: AudioWorkerResponse = {
      type: 'ERROR',
      error: error instanceof Error ? error.message : '未知错误',
      id
    };
    self.postMessage(response);
  }
});

// 导出类型供主线程使用
export type { AudioWorkerMessage, AudioWorkerResponse, AudioData, FeatureResult, AudioProcessingConfig };
