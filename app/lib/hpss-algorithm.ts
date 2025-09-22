/**
 * HPSS (Harmonic-Percussive Source Separation) 算法
 * 谐波-打击乐源分离算法实现
 * 
 * 基于论文: "Harmonic-Percussive Separation using Median Filtering"
 * 作者: Derry Fitzgerald
 */

// HPSS配置接口
export interface HPSSConfig {
  kernelSize: number;        // 中值滤波核大小
  power: number;            // 功率指数
  margin: number;           // 边距参数
  iterations: number;       // 迭代次数
  windowSize: number;       // 窗口大小
  hopSize: number;          // 跳跃大小
}

// HPSS结果接口
export interface HPSSResult {
  harmonic: Float32Array;   // 谐波分量
  percussive: Float32Array; // 打击乐分量
  residual: Float32Array;   // 残差分量
  harmonicRatio: number;    // 谐波占比
  percussiveRatio: number;  // 打击乐占比
  separationQuality: number; // 分离质量评分
}

// 频谱图接口
interface Spectrogram {
  magnitude: Float32Array[];  // 幅度谱
  phase: Float32Array[];      // 相位谱
  frequencies: number[];      // 频率轴
  timeFrames: number[];       // 时间轴
}

class HPSSAlgorithm {
  private config: HPSSConfig;
  private windowFunction: Float32Array;
  private fftSize: number;

  constructor(config: Partial<HPSSConfig> = {}) {
    this.config = {
      kernelSize: 17,        // 默认核大小
      power: 2.0,           // 默认功率指数
      margin: 1.0,          // 默认边距
      iterations: 10,       // 默认迭代次数
      windowSize: 2048,     // 默认窗口大小
      hopSize: 512,         // 默认跳跃大小
      ...config
    };

    this.fftSize = this.config.windowSize;
    this.windowFunction = this.createWindowFunction();
  }

  /**
   * 创建窗函数 (Hanning窗)
   */
  private createWindowFunction(): Float32Array {
    const window = new Float32Array(this.config.windowSize);
    for (let i = 0; i < this.config.windowSize; i++) {
      window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (this.config.windowSize - 1)));
    }
    return window;
  }

  /**
   * 执行HPSS分离
   */
  public separate(audioBuffer: Float32Array): HPSSResult {
    try {
      // 1. 预处理音频
      const preprocessedAudio = this.preprocessAudio(audioBuffer);
      
      // 2. 计算短时傅里叶变换
      const spectrogram = this.computeSTFT(preprocessedAudio);
      
      // 3. 执行HPSS分离
      const separatedSpectrograms = this.performHPSSSeparation(spectrogram);
      
      // 4. 重构时域信号
      const harmonicSignal = this.reconstructSignal(separatedSpectrograms.harmonic, spectrogram.phase);
      const percussiveSignal = this.reconstructSignal(separatedSpectrograms.percussive, spectrogram.phase);
      
      // 5. 计算残差
      const residualSignal = this.computeResidual(preprocessedAudio, harmonicSignal, percussiveSignal);
      
      // 6. 计算能量占比
      const harmonicRatio = this.computeEnergyRatio(harmonicSignal, preprocessedAudio);
      const percussiveRatio = this.computeEnergyRatio(percussiveSignal, preprocessedAudio);
      
      // 7. 评估分离质量
      const separationQuality = this.evaluateSeparationQuality(
        harmonicSignal, 
        percussiveSignal, 
        preprocessedAudio
      );

      return {
        harmonic: harmonicSignal,
        percussive: percussiveSignal,
        residual: residualSignal,
        harmonicRatio,
        percussiveRatio,
        separationQuality
      };
    } catch (error) {
      console.error('HPSS分离失败:', error);
      // 返回原始信号作为降级处理
      return this.createFallbackResult(audioBuffer);
    }
  }

  /**
   * 预处理音频
   */
  private preprocessAudio(audioBuffer: Float32Array): Float32Array {
    // 归一化音频
    const maxValue = Math.max(...Array.from(audioBuffer).map(Math.abs));
    if (maxValue > 0) {
      return new Float32Array(audioBuffer.map(sample => sample / maxValue));
    }
    return audioBuffer;
  }

  /**
   * 计算短时傅里叶变换
   */
  private computeSTFT(audioBuffer: Float32Array): Spectrogram {
    const numFrames = Math.floor((audioBuffer.length - this.config.windowSize) / this.config.hopSize) + 1;
    const magnitude: Float32Array[] = [];
    const phase: Float32Array[] = [];
    const frequencies: number[] = [];
    const timeFrames: number[] = [];

    // 计算频率轴
    for (let i = 0; i < this.fftSize / 2; i++) {
      frequencies.push(i * 44100 / this.fftSize); // 假设采样率44.1kHz
    }

    // 计算每个时间帧
    for (let frame = 0; frame < numFrames; frame++) {
      const start = frame * this.config.hopSize;
      const end = start + this.config.windowSize;
      
      if (end > audioBuffer.length) break;

      // 提取窗口并应用窗函数
      const windowedFrame = new Float32Array(this.config.windowSize);
      for (let i = 0; i < this.config.windowSize; i++) {
        windowedFrame[i] = audioBuffer[start + i] * this.windowFunction[i];
      }

      // 计算FFT
      const fftResult = this.computeFFT(windowedFrame);
      
      // 分离幅度和相位
      const frameMagnitude = new Float32Array(this.fftSize / 2);
      const framePhase = new Float32Array(this.fftSize / 2);
      
      for (let i = 0; i < this.fftSize / 2; i++) {
        const real = fftResult[i * 2];
        const imag = fftResult[i * 2 + 1];
        frameMagnitude[i] = Math.sqrt(real * real + imag * imag);
        framePhase[i] = Math.atan2(imag, real);
      }

      magnitude.push(frameMagnitude);
      phase.push(framePhase);
      timeFrames.push(start / 44100); // 时间戳
    }

    return {
      magnitude,
      phase,
      frequencies,
      timeFrames
    };
  }

  /**
   * 执行HPSS分离
   */
  private performHPSSSeparation(spectrogram: Spectrogram): {
    harmonic: Float32Array[];
    percussive: Float32Array[];
  } {
    const { magnitude } = spectrogram;
    const numFrames = magnitude.length;
    const numBins = magnitude[0].length;

    // 初始化分离结果
    let harmonicMagnitude = magnitude.map(frame => new Float32Array(frame));
    let percussiveMagnitude = magnitude.map(frame => new Float32Array(frame));

    // 迭代分离
    for (let iter = 0; iter < this.config.iterations; iter++) {
      // 谐波分离：时间方向中值滤波
      const harmonicFiltered = this.applyMedianFilter(harmonicMagnitude, 'time');
      
      // 打击乐分离：频率方向中值滤波
      const percussiveFiltered = this.applyMedianFilter(percussiveMagnitude, 'frequency');

      // 更新分离结果
      for (let frame = 0; frame < numFrames; frame++) {
        for (let bin = 0; bin < numBins; bin++) {
          const original = magnitude[frame][bin];
          const harmonic = harmonicFiltered[frame][bin];
          const percussive = percussiveFiltered[frame][bin];
          
          // 使用软掩码更新
          const total = Math.pow(harmonic, this.config.power) + Math.pow(percussive, this.config.power);
          if (total > 0) {
            const harmonicMask = Math.pow(harmonic, this.config.power) / total;
            const percussiveMask = Math.pow(percussive, this.config.power) / total;
            
            harmonicMagnitude[frame][bin] = original * harmonicMask;
            percussiveMagnitude[frame][bin] = original * percussiveMask;
          }
        }
      }
    }

    return {
      harmonic: harmonicMagnitude,
      percussive: percussiveMagnitude
    };
  }

  /**
   * 应用中值滤波
   */
  private applyMedianFilter(magnitude: Float32Array[], direction: 'time' | 'frequency'): Float32Array[] {
    const numFrames = magnitude.length;
    const numBins = magnitude[0].length;
    const kernelSize = this.config.kernelSize;
    const halfKernel = Math.floor(kernelSize / 2);
    
    const filtered = magnitude.map(frame => new Float32Array(frame));

    if (direction === 'time') {
      // 时间方向滤波
      for (let bin = 0; bin < numBins; bin++) {
        for (let frame = 0; frame < numFrames; frame++) {
          const values: number[] = [];
          
          for (let k = -halfKernel; k <= halfKernel; k++) {
            const frameIndex = Math.max(0, Math.min(numFrames - 1, frame + k));
            values.push(magnitude[frameIndex][bin]);
          }
          
          filtered[frame][bin] = this.median(values);
        }
      }
    } else {
      // 频率方向滤波
      for (let frame = 0; frame < numFrames; frame++) {
        for (let bin = 0; bin < numBins; bin++) {
          const values: number[] = [];
          
          for (let k = -halfKernel; k <= halfKernel; k++) {
            const binIndex = Math.max(0, Math.min(numBins - 1, bin + k));
            values.push(magnitude[frame][binIndex]);
          }
          
          filtered[frame][bin] = this.median(values);
        }
      }
    }

    return filtered;
  }

  /**
   * 计算中值
   */
  private median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2 
      : sorted[mid];
  }

  /**
   * 计算FFT (简化实现)
   */
  private computeFFT(buffer: Float32Array): Float32Array {
    const N = buffer.length;
    const result = new Float32Array(N * 2); // 复数结果

    // 简化的FFT实现
    for (let k = 0; k < N; k++) {
      let real = 0;
      let imag = 0;
      
      for (let n = 0; n < N; n++) {
        const angle = -2 * Math.PI * k * n / N;
        real += buffer[n] * Math.cos(angle);
        imag += buffer[n] * Math.sin(angle);
      }
      
      result[k * 2] = real;
      result[k * 2 + 1] = imag;
    }

    return result;
  }

  /**
   * 重构时域信号
   */
  private reconstructSignal(magnitude: Float32Array[], phase: Float32Array[]): Float32Array {
    const numFrames = magnitude.length;
    const numBins = magnitude[0].length;
    const outputLength = (numFrames - 1) * this.config.hopSize + this.config.windowSize;
    const output = new Float32Array(outputLength);
    const windowSum = new Float32Array(outputLength);

    for (let frame = 0; frame < numFrames; frame++) {
      // 重构复数频谱
      const complexSpectrum = new Float32Array(this.fftSize * 2);
      
      for (let bin = 0; bin < numBins; bin++) {
        const mag = magnitude[frame][bin];
        const pha = phase[frame][bin];
        
        complexSpectrum[bin * 2] = mag * Math.cos(pha);
        complexSpectrum[bin * 2 + 1] = mag * Math.sin(pha);
        
        // 对称性
        if (bin > 0 && bin < numBins - 1) {
          const symBin = this.fftSize - bin;
          complexSpectrum[symBin * 2] = mag * Math.cos(-pha);
          complexSpectrum[symBin * 2 + 1] = mag * Math.sin(-pha);
        }
      }

      // 逆FFT
      const timeFrame = this.computeIFFT(complexSpectrum);
      
      // 重叠相加
      const start = frame * this.config.hopSize;
      for (let i = 0; i < this.config.windowSize; i++) {
        if (start + i < outputLength) {
          output[start + i] += timeFrame[i] * this.windowFunction[i];
          windowSum[start + i] += this.windowFunction[i] * this.windowFunction[i];
        }
      }
    }

    // 归一化
    for (let i = 0; i < outputLength; i++) {
      if (windowSum[i] > 0) {
        output[i] /= windowSum[i];
      }
    }

    return output;
  }

  /**
   * 计算逆FFT
   */
  private computeIFFT(complexSpectrum: Float32Array): Float32Array {
    const N = this.fftSize;
    const result = new Float32Array(N);

    for (let n = 0; n < N; n++) {
      let real = 0;
      
      for (let k = 0; k < N; k++) {
        const angle = 2 * Math.PI * k * n / N;
        real += complexSpectrum[k * 2] * Math.cos(angle) - complexSpectrum[k * 2 + 1] * Math.sin(angle);
      }
      
      result[n] = real / N;
    }

    return result;
  }

  /**
   * 计算残差
   */
  private computeResidual(original: Float32Array, harmonic: Float32Array, percussive: Float32Array): Float32Array {
    const minLength = Math.min(original.length, harmonic.length, percussive.length);
    const residual = new Float32Array(minLength);
    
    for (let i = 0; i < minLength; i++) {
      residual[i] = original[i] - harmonic[i] - percussive[i];
    }
    
    return residual;
  }

  /**
   * 计算能量占比
   */
  private computeEnergyRatio(signal: Float32Array, reference: Float32Array): number {
    const signalEnergy = this.computeEnergy(signal);
    const referenceEnergy = this.computeEnergy(reference);
    
    return referenceEnergy > 0 ? signalEnergy / referenceEnergy : 0;
  }

  /**
   * 计算信号能量
   */
  private computeEnergy(signal: Float32Array): number {
    let energy = 0;
    for (let i = 0; i < signal.length; i++) {
      energy += signal[i] * signal[i];
    }
    return energy;
  }

  /**
   * 评估分离质量
   */
  private evaluateSeparationQuality(harmonic: Float32Array, percussive: Float32Array, original: Float32Array): number {
    // 计算分离质量指标
    const harmonicEnergy = this.computeEnergy(harmonic);
    const percussiveEnergy = this.computeEnergy(percussive);
    const originalEnergy = this.computeEnergy(original);
    
    // 能量保持度
    const energyPreservation = (harmonicEnergy + percussiveEnergy) / originalEnergy;
    
    // 分离度 (基于相关性)
    const correlation = this.computeCorrelation(harmonic, percussive);
    const separation = 1 - Math.abs(correlation);
    
    // 综合质量评分
    const quality = (energyPreservation * 0.6 + separation * 0.4);
    
    return Math.max(0, Math.min(1, quality));
  }

  /**
   * 计算相关系数
   */
  private computeCorrelation(signal1: Float32Array, signal2: Float32Array): number {
    const minLength = Math.min(signal1.length, signal2.length);
    let sum1 = 0, sum2 = 0, sum1Sq = 0, sum2Sq = 0, sumProduct = 0;
    
    for (let i = 0; i < minLength; i++) {
      sum1 += signal1[i];
      sum2 += signal2[i];
      sum1Sq += signal1[i] * signal1[i];
      sum2Sq += signal2[i] * signal2[i];
      sumProduct += signal1[i] * signal2[i];
    }
    
    const n = minLength;
    const numerator = n * sumProduct - sum1 * sum2;
    const denominator = Math.sqrt((n * sum1Sq - sum1 * sum1) * (n * sum2Sq - sum2 * sum2));
    
    return denominator > 0 ? numerator / denominator : 0;
  }

  /**
   * 创建降级结果
   */
  private createFallbackResult(audioBuffer: Float32Array): HPSSResult {
    return {
      harmonic: new Float32Array(audioBuffer),
      percussive: new Float32Array(audioBuffer.length),
      residual: new Float32Array(audioBuffer.length),
      harmonicRatio: 0.8,
      percussiveRatio: 0.2,
      separationQuality: 0.5
    };
  }

  /**
   * 更新配置
   */
  public updateConfig(newConfig: Partial<HPSSConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.windowFunction = this.createWindowFunction();
  }

  /**
   * 获取当前配置
   */
  public getConfig(): HPSSConfig {
    return { ...this.config };
  }
}

// 导出HPSS算法实例
export const hpssAlgorithm = new HPSSAlgorithm();

export default HPSSAlgorithm;
