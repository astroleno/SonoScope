/**
 * OpenL3音色分析器
 * 基于OpenL3模型进行音色特征提取和分析
 */

export interface TimbreAnalysisResult {
  timbreEmbedding: number[];     // 音色嵌入向量 (512维)
  timbreSimilarity: number;      // 音色相似度 (0-1)
  timbreCategory: string;        // 音色类别
  brightness: number;            // 亮度 (0-1)
  warmth: number;                // 温暖度 (0-1)
  roughness: number;             // 粗糙度 (0-1)
  sharpness: number;             // 锐度 (0-1)
  fullness: number;              // 饱满度 (0-1)
  timbreConfidence: number;      // 音色置信度 (0-1)
}

export interface TimbreFrame {
  timestamp: number;
  timbre: TimbreAnalysisResult;
}

// 音色分析配置
interface TimbreAnalyzerConfig {
  sampleRate: number;
  hopLength: number;
  frameLength: number;
  embeddingSize: number;
  confidenceThreshold: number;
}

// 音色类别定义
const TIMBRE_CATEGORIES = {
  'bright': ['bright', 'brilliant', 'sparkling', 'crisp'],
  'warm': ['warm', 'mellow', 'smooth', 'rich'],
  'harsh': ['harsh', 'rough', 'gritty', 'distorted'],
  'soft': ['soft', 'gentle', 'delicate', 'smooth'],
  'full': ['full', 'rich', 'thick', 'dense'],
  'thin': ['thin', 'light', 'airy', 'sparse'],
  'sharp': ['sharp', 'piercing', 'cutting', 'bright'],
  'mellow': ['mellow', 'warm', 'soft', 'smooth'],
};

export class TimbreAnalyzer {
  private config: TimbreAnalyzerConfig;
  private isInitialized: boolean = false;
  private model: any = null;
  private referenceEmbeddings: Map<string, number[]> = new Map();

  constructor(config?: Partial<TimbreAnalyzerConfig>) {
    this.config = {
      sampleRate: 48000,
      hopLength: 240,
      frameLength: 2048,
      embeddingSize: 512,
      confidenceThreshold: 0.3,
      ...config,
    };
  }

  /**
   * 初始化OpenL3模型
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // 检查是否在浏览器环境
      if (typeof window === 'undefined') {
        console.warn('TimbreAnalyzer: 不在浏览器环境，使用模拟模式');
        this.isInitialized = true;
        return;
      }

      // 动态导入TensorFlow.js
      const tf = await import('@tensorflow/tfjs');
      
      // 加载OpenL3模型
      try {
        this.model = await tf.loadLayersModel('/models/openl3/model.json');
        console.log('TimbreAnalyzer: OpenL3模型加载成功');
      } catch (error) {
        console.warn('TimbreAnalyzer: OpenL3模型加载失败，使用启发式方法', error);
        this.model = null;
      }

      // 初始化参考嵌入
      this.initializeReferenceEmbeddings();

      this.isInitialized = true;
    } catch (error) {
      console.error('TimbreAnalyzer: 初始化失败', error);
      this.isInitialized = true; // 允许使用降级方案
    }
  }

  /**
   * 分析音色
   */
  async analyzeTimbre(audioBuffer: Float32Array): Promise<TimbreAnalysisResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // 如果模型可用，使用OpenL3进行分析
    if (this.model) {
      try {
        return await this.analyzeTimbreWithOpenL3(audioBuffer);
      } catch (error) {
        console.warn('TimbreAnalyzer: OpenL3分析失败，使用启发式方法', error);
      }
    }

    // 降级到启发式方法
    return this.analyzeTimbreHeuristic(audioBuffer);
  }

  /**
   * 使用OpenL3模型分析音色
   */
  private async analyzeTimbreWithOpenL3(audioBuffer: Float32Array): Promise<TimbreAnalysisResult> {
    const tf = await import('@tensorflow/tfjs');
    
    // 预处理音频数据
    const preprocessed = this.preprocessAudioForOpenL3(audioBuffer);
    
    // 运行模型推理
    const prediction: any = (this.model as any).predict(preprocessed as any);
    const embedding = await prediction.data();
    
    // 后处理结果
    const result = this.postprocessOpenL3Result(embedding);
    
    // 清理内存
    if (typeof prediction.dispose === 'function') prediction.dispose();
    
    return result;
  }

  /**
   * 启发式音色分析方法
   */
  private analyzeTimbreHeuristic(audioBuffer: Float32Array): TimbreAnalysisResult {
    // 计算频谱特征
    const spectrum = this.computeSpectrum(audioBuffer);
    
    // 计算音色特征
    const brightness = this.calculateBrightness(spectrum);
    const warmth = this.calculateWarmth(spectrum);
    const roughness = this.calculateRoughness(spectrum);
    const sharpness = this.calculateSharpness(spectrum);
    const fullness = this.calculateFullness(spectrum);
    
    // 生成模拟嵌入向量
    const timbreEmbedding = this.generateMockEmbedding(brightness, warmth, roughness, sharpness, fullness);
    
    // 分类音色类别
    const timbreCategory = this.classifyTimbreCategory(brightness, warmth, roughness, sharpness, fullness);
    
    // 计算置信度
    const timbreConfidence = this.calculateTimbreConfidence(brightness, warmth, roughness, sharpness, fullness);
    
    // 计算相似度
    const timbreSimilarity = this.calculateTimbreSimilarity(timbreEmbedding, timbreCategory);

    return {
      timbreEmbedding,
      timbreSimilarity,
      timbreCategory,
      brightness,
      warmth,
      roughness,
      sharpness,
      fullness,
      timbreConfidence,
    };
  }

  /**
   * 计算频谱
   */
  private computeSpectrum(audioBuffer: Float32Array): Float32Array {
    // 使用FFT计算频谱
    const fftSize = 2048;
    const spectrum = new Float32Array(fftSize / 2);
    
    // 简化的FFT实现
    for (let i = 0; i < fftSize / 2; i++) {
      let real = 0;
      let imag = 0;
      
      for (let j = 0; j < fftSize && j < audioBuffer.length; j++) {
        const angle = -2 * Math.PI * i * j / fftSize;
        real += audioBuffer[j] * Math.cos(angle);
        imag += audioBuffer[j] * Math.sin(angle);
      }
      
      spectrum[i] = Math.sqrt(real * real + imag * imag);
    }
    
    return spectrum;
  }

  /**
   * 计算亮度
   */
  private calculateBrightness(spectrum: Float32Array): number {
    const totalEnergy = spectrum.reduce((sum, val) => sum + val, 0);
    if (totalEnergy === 0) return 0;
    
    // 高频能量占比
    const highFreqStart = Math.floor(spectrum.length * 0.7);
    const highFreqEnergy = spectrum.slice(highFreqStart).reduce((sum, val) => sum + val, 0);
    
    return highFreqEnergy / totalEnergy;
  }

  /**
   * 计算温暖度
   */
  private calculateWarmth(spectrum: Float32Array): number {
    const totalEnergy = spectrum.reduce((sum, val) => sum + val, 0);
    if (totalEnergy === 0) return 0;
    
    // 中低频能量占比
    const midFreqStart = Math.floor(spectrum.length * 0.2);
    const midFreqEnd = Math.floor(spectrum.length * 0.6);
    const midFreqEnergy = spectrum.slice(midFreqStart, midFreqEnd).reduce((sum, val) => sum + val, 0);
    
    return midFreqEnergy / totalEnergy;
  }

  /**
   * 计算粗糙度
   */
  private calculateRoughness(spectrum: Float32Array): number {
    // 计算频谱的方差
    const mean = spectrum.reduce((sum, val) => sum + val, 0) / spectrum.length;
    const variance = spectrum.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / spectrum.length;
    
    return Math.min(1, Math.sqrt(variance) / mean);
  }

  /**
   * 计算锐度
   */
  private calculateSharpness(spectrum: Float32Array): number {
    // 计算频谱的峰值尖锐度
    let sharpness = 0;
    for (let i = 1; i < spectrum.length - 1; i++) {
      if (spectrum[i] > spectrum[i - 1] && spectrum[i] > spectrum[i + 1]) {
        const peakHeight = spectrum[i];
        const avgNeighbor = (spectrum[i - 1] + spectrum[i + 1]) / 2;
        sharpness += (peakHeight - avgNeighbor) / peakHeight;
      }
    }
    
    return Math.min(1, sharpness / spectrum.length);
  }

  /**
   * 计算饱满度
   */
  private calculateFullness(spectrum: Float32Array): number {
    // 计算频谱的密度
    const totalEnergy = spectrum.reduce((sum, val) => sum + val, 0);
    const nonZeroBins = spectrum.filter(val => val > 0).length;
    
    return nonZeroBins / spectrum.length;
  }

  /**
   * 生成模拟嵌入向量
   */
  private generateMockEmbedding(brightness: number, warmth: number, roughness: number, sharpness: number, fullness: number): number[] {
    const embedding = new Array(this.config.embeddingSize).fill(0);
    
    // 基于音色特征生成嵌入向量
    for (let i = 0; i < this.config.embeddingSize; i++) {
      const feature = (i % 5);
      switch (feature) {
        case 0:
          embedding[i] = brightness;
          break;
        case 1:
          embedding[i] = warmth;
          break;
        case 2:
          embedding[i] = roughness;
          break;
        case 3:
          embedding[i] = sharpness;
          break;
        case 4:
          embedding[i] = fullness;
          break;
      }
      
      // 添加一些随机性
      embedding[i] += (Math.random() - 0.5) * 0.1;
      embedding[i] = Math.max(0, Math.min(1, embedding[i]));
    }
    
    return embedding;
  }

  /**
   * 分类音色类别
   */
  private classifyTimbreCategory(brightness: number, warmth: number, roughness: number, sharpness: number, fullness: number): string {
    // 基于特征值分类音色
    if (brightness > 0.7 && sharpness > 0.6) {
      return 'bright';
    } else if (warmth > 0.7 && roughness < 0.3) {
      return 'warm';
    } else if (roughness > 0.6 && sharpness > 0.5) {
      return 'harsh';
    } else if (brightness < 0.4 && warmth > 0.5) {
      return 'soft';
    } else if (fullness > 0.7 && warmth > 0.5) {
      return 'full';
    } else if (fullness < 0.4 && brightness < 0.5) {
      return 'thin';
    } else if (sharpness > 0.7) {
      return 'sharp';
    } else {
      return 'mellow';
    }
  }

  /**
   * 计算音色置信度
   */
  private calculateTimbreConfidence(brightness: number, warmth: number, roughness: number, sharpness: number, fullness: number): number {
    // 基于特征值的区分度计算置信度
    const features = [brightness, warmth, roughness, sharpness, fullness];
    const mean = features.reduce((sum, val) => sum + val, 0) / features.length;
    const variance = features.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / features.length;
    
    // 方差越大，特征越明显，置信度越高
    return Math.min(1, Math.sqrt(variance) * 2);
  }

  /**
   * 计算音色相似度
   */
  private calculateTimbreSimilarity(embedding: number[], category: string): number {
    const referenceEmbedding = this.referenceEmbeddings.get(category);
    if (!referenceEmbedding) {
      return 0.5; // 默认相似度
    }
    
    // 计算余弦相似度
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < embedding.length; i++) {
      dotProduct += embedding[i] * referenceEmbedding[i];
      normA += embedding[i] * embedding[i];
      normB += referenceEmbedding[i] * referenceEmbedding[i];
    }
    
    const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    return Math.max(0, Math.min(1, similarity));
  }

  /**
   * 初始化参考嵌入
   */
  private initializeReferenceEmbeddings(): void {
    // 为每个音色类别生成参考嵌入
    for (const [category, keywords] of Object.entries(TIMBRE_CATEGORIES)) {
      const referenceEmbedding = this.generateReferenceEmbedding(category);
      this.referenceEmbeddings.set(category, referenceEmbedding);
    }
  }

  /**
   * 生成参考嵌入
   */
  private generateReferenceEmbedding(category: string): number[] {
    const embedding = new Array(this.config.embeddingSize).fill(0);
    
    // 基于音色类别生成特征向量
    switch (category) {
      case 'bright':
        for (let i = 0; i < this.config.embeddingSize; i += 5) {
          embedding[i] = 0.8; // brightness
          embedding[i + 1] = 0.3; // warmth
          embedding[i + 2] = 0.4; // roughness
          embedding[i + 3] = 0.7; // sharpness
          embedding[i + 4] = 0.6; // fullness
        }
        break;
      case 'warm':
        for (let i = 0; i < this.config.embeddingSize; i += 5) {
          embedding[i] = 0.4; // brightness
          embedding[i + 1] = 0.8; // warmth
          embedding[i + 2] = 0.2; // roughness
          embedding[i + 3] = 0.3; // sharpness
          embedding[i + 4] = 0.7; // fullness
        }
        break;
      // 其他类别...
      default:
        for (let i = 0; i < this.config.embeddingSize; i += 5) {
          embedding[i] = 0.5; // brightness
          embedding[i + 1] = 0.5; // warmth
          embedding[i + 2] = 0.5; // roughness
          embedding[i + 3] = 0.5; // sharpness
          embedding[i + 4] = 0.5; // fullness
        }
    }
    
    return embedding;
  }

  /**
   * 为OpenL3预处理音频数据
   */
  private preprocessAudioForOpenL3(audioBuffer: Float32Array): any {
    // OpenL3期望的输入格式：[-1, 1]范围的浮点数
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
   * 后处理OpenL3结果
   */
  private postprocessOpenL3Result(embedding: Float32Array): TimbreAnalysisResult {
    // 将嵌入向量转换为音色特征
    const timbreEmbedding = Array.from(embedding);
    
    // 从嵌入向量中提取音色特征
    const brightness = this.extractFeatureFromEmbedding(timbreEmbedding, 0);
    const warmth = this.extractFeatureFromEmbedding(timbreEmbedding, 1);
    const roughness = this.extractFeatureFromEmbedding(timbreEmbedding, 2);
    const sharpness = this.extractFeatureFromEmbedding(timbreEmbedding, 3);
    const fullness = this.extractFeatureFromEmbedding(timbreEmbedding, 4);
    
    // 分类音色类别
    const timbreCategory = this.classifyTimbreCategory(brightness, warmth, roughness, sharpness, fullness);
    
    // 计算置信度
    const timbreConfidence = this.calculateTimbreConfidence(brightness, warmth, roughness, sharpness, fullness);
    
    // 计算相似度
    const timbreSimilarity = this.calculateTimbreSimilarity(timbreEmbedding, timbreCategory);

    return {
      timbreEmbedding,
      timbreSimilarity,
      timbreCategory,
      brightness,
      warmth,
      roughness,
      sharpness,
      fullness,
      timbreConfidence,
    };
  }

  /**
   * 从嵌入向量中提取特征
   */
  private extractFeatureFromEmbedding(embedding: number[], featureIndex: number): number {
    let sum = 0;
    let count = 0;
    
    for (let i = featureIndex; i < embedding.length; i += 5) {
      sum += embedding[i];
      count++;
    }
    
    return count > 0 ? sum / count : 0.5;
  }

  /**
   * 批量分析音色
   */
  async analyzeTimbreBatch(audioFrames: Float32Array[]): Promise<TimbreFrame[]> {
    const results: TimbreFrame[] = [];
    
    for (let i = 0; i < audioFrames.length; i++) {
      const timbre = await this.analyzeTimbre(audioFrames[i]);
      results.push({
        timestamp: Date.now() + i * (this.config.hopLength / this.config.sampleRate) * 1000,
        timbre,
      });
    }
    
    return results;
  }

  /**
   * 获取配置信息
   */
  getConfig(): TimbreAnalyzerConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<TimbreAnalyzerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// 创建全局实例
export const timbreAnalyzer = new TimbreAnalyzer();
