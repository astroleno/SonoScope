/**
 * Musicnn乐器分类器
 * 基于Musicnn模型进行具体乐器识别和分类
 */

export interface InstrumentRecognitionResult {
  instruments: Array<{
    name: string;                // 乐器名称
    confidence: number;          // 置信度 (0-1)
    category: string;            // 乐器类别
    subcategory: string;         // 子类别
  }>;
  dominantInstrument: string;    // 主导乐器
  instrumentCount: number;       // 乐器数量
  polyphony: number;             // 复调性 (0-1)
  instrumentDiversity: number;   // 乐器多样性 (0-1)
}

export interface InstrumentFrame {
  timestamp: number;
  instruments: InstrumentRecognitionResult;
}

// 乐器分类配置
interface MusicnnClassifierConfig {
  sampleRate: number;
  hopLength: number;
  frameLength: number;
  confidenceThreshold: number;
  maxInstruments: number;
}

// 乐器类别定义
const INSTRUMENT_CATEGORIES = {
  'strings': {
    'violin': ['violin', 'fiddle'],
    'viola': ['viola'],
    'cello': ['cello'],
    'double_bass': ['double bass', 'upright bass'],
    'guitar': ['guitar', 'acoustic guitar', 'electric guitar'],
    'bass_guitar': ['bass guitar', 'electric bass'],
    'harp': ['harp'],
    'mandolin': ['mandolin'],
    'banjo': ['banjo'],
    'ukulele': ['ukulele'],
  },
  'woodwinds': {
    'flute': ['flute', 'piccolo'],
    'clarinet': ['clarinet'],
    'oboe': ['oboe'],
    'bassoon': ['bassoon'],
    'saxophone': ['saxophone', 'alto sax', 'tenor sax', 'baritone sax'],
    'recorder': ['recorder'],
  },
  'brass': {
    'trumpet': ['trumpet'],
    'trombone': ['trombone'],
    'french_horn': ['french horn', 'horn'],
    'tuba': ['tuba'],
    'cornet': ['cornet'],
    'flugelhorn': ['flugelhorn'],
  },
  'percussion': {
    'drum_kit': ['drum kit', 'drums', 'drum set'],
    'snare_drum': ['snare drum'],
    'bass_drum': ['bass drum', 'kick drum'],
    'hi_hat': ['hi-hat', 'hi hat'],
    'cymbal': ['cymbal', 'crash cymbal', 'ride cymbal'],
    'tom_tom': ['tom-tom', 'tom tom'],
    'timpani': ['timpani', 'kettle drum'],
    'xylophone': ['xylophone'],
    'marimba': ['marimba'],
    'vibraphone': ['vibraphone'],
    'glockenspiel': ['glockenspiel'],
  },
  'keyboards': {
    'piano': ['piano', 'grand piano', 'upright piano'],
    'electric_piano': ['electric piano', 'epiano', 'rhodes'],
    'organ': ['organ', 'hammond organ', 'church organ'],
    'synthesizer': ['synthesizer', 'synth', 'keyboard'],
    'harpsichord': ['harpsichord'],
    'celesta': ['celesta'],
  },
  'voice': {
    'male_voice': ['male voice', 'male vocal', 'tenor', 'baritone', 'bass'],
    'female_voice': ['female voice', 'female vocal', 'soprano', 'alto'],
    'choir': ['choir', 'chorus', 'vocal ensemble'],
  },
  'other': {
    'accordion': ['accordion'],
    'harmonica': ['harmonica'],
    'kazoo': ['kazoo'],
    'whistle': ['whistle'],
  },
};

export class MusicnnClassifier {
  private config: MusicnnClassifierConfig;
  private isInitialized: boolean = false;
  private model: any = null;

  constructor(config?: Partial<MusicnnClassifierConfig>) {
    this.config = {
      sampleRate: 22050,
      hopLength: 512,
      frameLength: 1024,
      confidenceThreshold: 0.3,
      maxInstruments: 5,
      ...config,
    };
  }

  /**
   * 初始化Musicnn模型
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // 检查是否在浏览器环境
      if (typeof window === 'undefined') {
        console.warn('MusicnnClassifier: 不在浏览器环境，使用模拟模式');
        this.isInitialized = true;
        return;
      }

      // 动态导入TensorFlow.js
      const tf = await import('@tensorflow/tfjs');
      
      // 加载Musicnn模型
      try {
        this.model = await tf.loadLayersModel('/models/musicnn/model.json');
        console.log('MusicnnClassifier: Musicnn模型加载成功');
      } catch (error) {
        console.warn('MusicnnClassifier: Musicnn模型加载失败，使用启发式方法', error);
        this.model = null;
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('MusicnnClassifier: 初始化失败', error);
      this.isInitialized = true; // 允许使用降级方案
    }
  }

  /**
   * 识别乐器
   */
  async recognizeInstruments(audioBuffer: Float32Array): Promise<InstrumentRecognitionResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // 如果模型可用，使用Musicnn进行识别
    if (this.model) {
      try {
        return await this.recognizeInstrumentsWithMusicnn(audioBuffer);
      } catch (error) {
        console.warn('MusicnnClassifier: Musicnn识别失败，使用启发式方法', error);
      }
    }

    // 降级到启发式方法
    return this.recognizeInstrumentsHeuristic(audioBuffer);
  }

  /**
   * 使用Musicnn模型识别乐器
   */
  private async recognizeInstrumentsWithMusicnn(audioBuffer: Float32Array): Promise<InstrumentRecognitionResult> {
    // 动态导入TensorFlow.js
    const tf = await import('@tensorflow/tfjs');
    
    // 预处理音频数据
    const preprocessed = this.preprocessAudioForMusicnn(audioBuffer);
    
    // 运行模型推理
    const prediction: any = (this.model as any).predict(preprocessed as any);
    const probabilities = await prediction.data();
    
    // 后处理结果
    const result = this.postprocessMusicnnResult(probabilities);
    
    // 清理内存
    if (typeof prediction.dispose === 'function') prediction.dispose();
    
    return result;
  }

  /**
   * 启发式乐器识别方法
   */
  private recognizeInstrumentsHeuristic(audioBuffer: Float32Array): InstrumentRecognitionResult {
    // 计算音频特征
    const features = this.computeAudioFeatures(audioBuffer);
    
    // 基于特征识别乐器
    const instruments = this.classifyInstrumentsByFeatures(features);
    
    // 计算复调性和多样性
    const polyphony = this.calculatePolyphony(features);
    const instrumentDiversity = this.calculateInstrumentDiversity(instruments);
    
    // 找到主导乐器
    const dominantInstrument = this.findDominantInstrument(instruments);

    return {
      instruments,
      dominantInstrument,
      instrumentCount: instruments.length,
      polyphony,
      instrumentDiversity,
    };
  }

  /**
   * 计算音频特征
   */
  private computeAudioFeatures(audioBuffer: Float32Array): any {
    // 计算频谱特征
    const spectrum = this.computeSpectrum(audioBuffer);
    
    // 计算时域特征
    const timeFeatures = this.computeTimeFeatures(audioBuffer);
    
    // 计算频域特征
    const freqFeatures = this.computeFreqFeatures(spectrum);
    
    return {
      spectrum,
      timeFeatures,
      freqFeatures,
    };
  }

  /**
   * 计算频谱
   */
  private computeSpectrum(audioBuffer: Float32Array): Float32Array {
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
   * 计算时域特征
   */
  private computeTimeFeatures(audioBuffer: Float32Array): any {
    // RMS能量
    let rms = 0;
    for (let i = 0; i < audioBuffer.length; i++) {
      rms += audioBuffer[i] * audioBuffer[i];
    }
    rms = Math.sqrt(rms / audioBuffer.length);
    
    // 过零率
    let zcr = 0;
    for (let i = 1; i < audioBuffer.length; i++) {
      if ((audioBuffer[i] >= 0) !== (audioBuffer[i - 1] >= 0)) {
        zcr++;
      }
    }
    zcr = zcr / audioBuffer.length;
    
    // 峰值因子
    const maxVal = Math.max(...Array.from(audioBuffer).map(Math.abs));
    const peakFactor = maxVal / rms;
    
    return { rms, zcr, peakFactor };
  }

  /**
   * 计算频域特征
   */
  private computeFreqFeatures(spectrum: Float32Array): any {
    // 频谱质心
    let weightedSum = 0;
    let totalEnergy = 0;
    for (let i = 0; i < spectrum.length; i++) {
      weightedSum += i * spectrum[i];
      totalEnergy += spectrum[i];
    }
    const spectralCentroid = totalEnergy > 0 ? weightedSum / totalEnergy : 0;
    
    // 频谱带宽
    let bandwidth = 0;
    for (let i = 0; i < spectrum.length; i++) {
      bandwidth += Math.pow(i - spectralCentroid, 2) * spectrum[i];
    }
    bandwidth = totalEnergy > 0 ? Math.sqrt(bandwidth / totalEnergy) : 0;
    
    // 频谱滚降
    const totalEnergy95 = totalEnergy * 0.95;
    let cumulativeEnergy = 0;
    let spectralRolloff = 0;
    for (let i = 0; i < spectrum.length; i++) {
      cumulativeEnergy += spectrum[i];
      if (cumulativeEnergy >= totalEnergy95) {
        spectralRolloff = i;
        break;
      }
    }
    
    return { spectralCentroid, bandwidth, spectralRolloff };
  }

  /**
   * 基于特征分类乐器
   */
  private classifyInstrumentsByFeatures(features: any): Array<{name: string; confidence: number; category: string; subcategory: string}> {
    const instruments: Array<{name: string; confidence: number; category: string; subcategory: string}> = [];
    
    // 基于特征值识别乐器
    const { timeFeatures, freqFeatures } = features;
    
    // 识别钢琴
    if (freqFeatures.spectralCentroid > 1000 && freqFeatures.spectralCentroid < 3000 && 
        timeFeatures.peakFactor > 3) {
      instruments.push({
        name: 'piano',
        confidence: 0.8,
        category: 'keyboards',
        subcategory: 'piano'
      });
    }
    
    // 识别吉他
    if (freqFeatures.spectralCentroid > 800 && freqFeatures.spectralCentroid < 2500 && 
        timeFeatures.zcr > 0.1) {
      instruments.push({
        name: 'guitar',
        confidence: 0.7,
        category: 'strings',
        subcategory: 'guitar'
      });
    }
    
    // 识别鼓
    if (freqFeatures.spectralCentroid < 1000 && timeFeatures.peakFactor > 5) {
      instruments.push({
        name: 'drum_kit',
        confidence: 0.9,
        category: 'percussion',
        subcategory: 'drum_kit'
      });
    }
    
    // 识别人声
    if (freqFeatures.spectralCentroid > 1000 && freqFeatures.spectralCentroid < 4000 && 
        timeFeatures.zcr > 0.05 && timeFeatures.zcr < 0.2) {
      instruments.push({
        name: 'male_voice',
        confidence: 0.6,
        category: 'voice',
        subcategory: 'male_voice'
      });
    }
    
    // 识别小提琴
    if (freqFeatures.spectralCentroid > 2000 && freqFeatures.spectralCentroid < 5000 && 
        timeFeatures.peakFactor > 2 && timeFeatures.peakFactor < 4) {
      instruments.push({
        name: 'violin',
        confidence: 0.7,
        category: 'strings',
        subcategory: 'violin'
      });
    }
    
    // 识别萨克斯
    if (freqFeatures.spectralCentroid > 1500 && freqFeatures.spectralCentroid < 3500 && 
        timeFeatures.zcr > 0.08) {
      instruments.push({
        name: 'saxophone',
        confidence: 0.6,
        category: 'woodwinds',
        subcategory: 'saxophone'
      });
    }
    
    // 按置信度排序
    instruments.sort((a, b) => b.confidence - a.confidence);
    
    // 限制乐器数量
    return instruments.slice(0, this.config.maxInstruments);
  }

  /**
   * 计算复调性
   */
  private calculatePolyphony(features: any): number {
    // 基于频谱复杂度计算复调性
    const { spectrum } = features;
    const totalEnergy = spectrum.reduce((sum: number, val: number) => sum + val, 0);
    
    if (totalEnergy === 0) return 0;
    
    // 计算频谱的熵
    let entropy = 0;
    for (let i = 0; i < spectrum.length; i++) {
      const prob = spectrum[i] / totalEnergy;
      if (prob > 0) {
        entropy -= prob * Math.log2(prob);
      }
    }
    
    // 归一化到[0,1]
    return Math.min(1, entropy / Math.log2(spectrum.length));
  }

  /**
   * 计算乐器多样性
   */
  private calculateInstrumentDiversity(instruments: Array<{name: string; confidence: number; category: string; subcategory: string}>): number {
    if (instruments.length === 0) return 0;
    
    // 计算不同类别的数量
    const categories = new Set(instruments.map(inst => inst.category));
    const subcategories = new Set(instruments.map(inst => inst.subcategory));
    
    // 多样性 = (类别数 + 子类别数) / 2 / 最大可能数
    const maxCategories = Object.keys(INSTRUMENT_CATEGORIES).length;
    const maxSubcategories = Object.values(INSTRUMENT_CATEGORIES).reduce((sum, cat) => sum + Object.keys(cat).length, 0);
    
    const categoryDiversity = categories.size / maxCategories;
    const subcategoryDiversity = subcategories.size / maxSubcategories;
    
    return (categoryDiversity + subcategoryDiversity) / 2;
  }

  /**
   * 找到主导乐器
   */
  private findDominantInstrument(instruments: Array<{name: string; confidence: number; category: string; subcategory: string}>): string {
    if (instruments.length === 0) return 'unknown';
    
    // 返回置信度最高的乐器
    return instruments[0].name;
  }

  /**
   * 为Musicnn预处理音频数据
   */
  private preprocessAudioForMusicnn(audioBuffer: Float32Array): any {
    // Musicnn期望的输入格式：[-1, 1]范围的浮点数
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
   * 后处理Musicnn结果
   */
  private postprocessMusicnnResult(probabilities: Float32Array): InstrumentRecognitionResult {
    // 将概率数组转换为乐器识别结果
    const instruments: Array<{name: string; confidence: number; category: string; subcategory: string}> = [];
    
    // 这里需要根据Musicnn模型的输出格式进行解析
    // 假设模型输出每个乐器的概率
    const instrumentNames = this.getAllInstrumentNames();
    
    for (let i = 0; i < Math.min(probabilities.length, instrumentNames.length); i++) {
      const confidence = probabilities[i];
      if (confidence > this.config.confidenceThreshold) {
        const instrumentName = instrumentNames[i];
        const { category, subcategory } = this.getInstrumentCategory(instrumentName);
        
        instruments.push({
          name: instrumentName,
          confidence,
          category,
          subcategory,
        });
      }
    }
    
    // 按置信度排序
    instruments.sort((a, b) => b.confidence - a.confidence);
    
    // 限制乐器数量
    const limitedInstruments = instruments.slice(0, this.config.maxInstruments);
    
    // 计算复调性和多样性
    const polyphony = this.calculatePolyphonyFromProbabilities(probabilities);
    const instrumentDiversity = this.calculateInstrumentDiversity(limitedInstruments);
    
    // 找到主导乐器
    const dominantInstrument = limitedInstruments.length > 0 ? limitedInstruments[0].name : 'unknown';

    return {
      instruments: limitedInstruments,
      dominantInstrument,
      instrumentCount: limitedInstruments.length,
      polyphony,
      instrumentDiversity,
    };
  }

  /**
   * 获取所有乐器名称
   */
  private getAllInstrumentNames(): string[] {
    const names: string[] = [];
    for (const [category, instruments] of Object.entries(INSTRUMENT_CATEGORIES)) {
      for (const [name, keywords] of Object.entries(instruments)) {
        names.push(name);
      }
    }
    return names;
  }

  /**
   * 获取乐器类别
   */
  private getInstrumentCategory(instrumentName: string): { category: string; subcategory: string } {
    for (const [category, instruments] of Object.entries(INSTRUMENT_CATEGORIES)) {
      if (instruments[instrumentName]) {
        return { category, subcategory: instrumentName };
      }
    }
    return { category: 'other', subcategory: instrumentName };
  }

  /**
   * 从概率计算复调性
   */
  private calculatePolyphonyFromProbabilities(probabilities: Float32Array): number {
    // 计算概率分布的熵
    let entropy = 0;
    const totalProb = probabilities.reduce((sum, prob) => sum + prob, 0);
    
    if (totalProb === 0) return 0;
    
    for (let i = 0; i < probabilities.length; i++) {
      const prob = probabilities[i] / totalProb;
      if (prob > 0) {
        entropy -= prob * Math.log2(prob);
      }
    }
    
    // 归一化到[0,1]
    return Math.min(1, entropy / Math.log2(probabilities.length));
  }

  /**
   * 批量识别乐器
   */
  async recognizeInstrumentsBatch(audioFrames: Float32Array[]): Promise<InstrumentFrame[]> {
    const results: InstrumentFrame[] = [];
    
    for (let i = 0; i < audioFrames.length; i++) {
      const instruments = await this.recognizeInstruments(audioFrames[i]);
      results.push({
        timestamp: Date.now() + i * (this.config.hopLength / this.config.sampleRate) * 1000,
        instruments,
      });
    }
    
    return results;
  }

  /**
   * 获取配置信息
   */
  getConfig(): MusicnnClassifierConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<MusicnnClassifierConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// 创建全局实例
export const musicnnClassifier = new MusicnnClassifier();
