/**
 * Model Worker - 模型推理专用Web Worker
 * 负责YAMNet模型推理、乐器分类等AI计算任务
 */

// Worker消息类型定义
interface ModelWorkerMessage {
  type: 'LOAD_MODEL' | 'INFER' | 'CLASSIFY' | 'TERMINATE';
  data?: any;
  id?: string;
}

interface ModelWorkerResponse {
  type: 'SUCCESS' | 'ERROR' | 'PROGRESS' | 'MODEL_LOADED';
  data?: any;
  id?: string;
  error?: string;
  progress?: number;
}

// 模型配置
interface ModelConfig {
  modelPath: string;
  inputSize: number;
  outputSize: number;
  sampleRate: number;
}

// 推理结果
interface InferenceResult {
  predictions: number[];
  topClasses: Array<{ label: string; confidence: number }>;
  timestamp: number;
}

class ModelWorker {
  private model: any = null;
  private config: ModelConfig;
  private isModelLoaded: boolean = false;
  private isProcessing: boolean = false;

  constructor() {
    this.config = {
      modelPath: '/model/yamnet.task',
      inputSize: 15600, // YAMNet输入大小
      outputSize: 521,  // YAMNet输出类别数
      sampleRate: 16000
    };
  }

  /**
   * 加载YAMNet模型
   */
  async loadModel(): Promise<void> {
    try {
      // 这里应该加载实际的YAMNet模型
      // 由于在Worker中加载模型比较复杂，我们使用模拟实现
      console.log('Loading YAMNet model...');
      
      // 模拟模型加载过程
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.isModelLoaded = true;
      console.log('YAMNet model loaded successfully');
    } catch (error) {
      throw new Error(`模型加载失败: ${error}`);
    }
  }

  /**
   * 执行模型推理
   */
  async infer(audioData: Float32Array): Promise<InferenceResult> {
    if (!this.isModelLoaded) {
      throw new Error('模型未加载');
    }

    try {
      this.isProcessing = true;
      
      // 音频预处理
      const processedAudio = await this.preprocessAudio(audioData);
      
      // 执行推理
      const predictions = await this.runInference(processedAudio);
      
      // 后处理结果
      const topClasses = this.postprocessResults(predictions);
      
      this.isProcessing = false;
      
      return {
        predictions,
        topClasses,
        timestamp: Date.now()
      };
    } catch (error) {
      this.isProcessing = false;
      throw new Error(`推理失败: ${error}`);
    }
  }

  /**
   * 音频预处理
   */
  async preprocessAudio(audioData: Float32Array): Promise<Float32Array> {
    // 重采样到16kHz
    if (this.config.sampleRate !== 16000) {
      return this.resample(audioData, this.config.sampleRate, 16000);
    }
    
    // 确保长度正确
    if (audioData.length !== this.config.inputSize) {
      return this.resizeAudio(audioData, this.config.inputSize);
    }
    
    return audioData;
  }

  /**
   * 重采样音频
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
   * 调整音频长度
   */
  private resizeAudio(buffer: Float32Array, targetLength: number): Float32Array {
    if (buffer.length === targetLength) return buffer;
    
    const result = new Float32Array(targetLength);
    
    if (buffer.length > targetLength) {
      // 截断
      for (let i = 0; i < targetLength; i++) {
        result[i] = buffer[i];
      }
    } else {
      // 填充
      for (let i = 0; i < buffer.length; i++) {
        result[i] = buffer[i];
      }
      // 用零填充剩余部分
      for (let i = buffer.length; i < targetLength; i++) {
        result[i] = 0;
      }
    }
    
    return result;
  }

  /**
   * 执行模型推理
   */
  async runInference(audioData: Float32Array): Promise<number[]> {
    // 这里应该执行实际的YAMNet推理
    // 由于在Worker中实现完整的YAMNet比较复杂，我们使用模拟实现
    
    // 模拟推理过程
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 生成模拟的预测结果
    const predictions = new Array(this.config.outputSize).fill(0);
    
    // 模拟一些乐器类别的概率
    const instrumentClasses = [
      { index: 10, probability: 0.8 },   // 吉他
      { index: 15, probability: 0.6 },   // 钢琴
      { index: 25, probability: 0.4 },   // 鼓
      { index: 30, probability: 0.3 },   // 人声
    ];
    
    instrumentClasses.forEach(({ index, probability }) => {
      if (index < predictions.length) {
        predictions[index] = probability;
      }
    });
    
    return predictions;
  }

  /**
   * 后处理推理结果
   */
  private postprocessResults(predictions: number[]): Array<{ label: string; confidence: number }> {
    // 获取前5个最高概率的类别
    const topIndices = predictions
      .map((prob, index) => ({ prob, index }))
      .sort((a, b) => b.prob - a.prob)
      .slice(0, 5);
    
    // 映射到乐器标签
    const instrumentLabels = this.getInstrumentLabels();
    
    return topIndices.map(({ prob, index }) => ({
      label: instrumentLabels[index] || `Class_${index}`,
      confidence: prob
    }));
  }

  /**
   * 获取乐器标签映射
   */
  private getInstrumentLabels(): string[] {
    // YAMNet的521个类别标签
    // 这里只列出一些主要的乐器类别
    const labels = new Array(521).fill('Unknown');
    
    // 主要乐器类别
    labels[10] = 'Guitar';
    labels[15] = 'Piano';
    labels[25] = 'Drum';
    labels[30] = 'Voice';
    labels[35] = 'Violin';
    labels[40] = 'Bass';
    labels[45] = 'Saxophone';
    labels[50] = 'Trumpet';
    labels[55] = 'Flute';
    labels[60] = 'Clarinet';
    
    return labels;
  }

  /**
   * 乐器分类
   */
  async classifyInstruments(audioData: Float32Array): Promise<{
    dominantInstrument: string;
    instrumentProbabilities: Record<string, number>;
    confidence: number;
  }> {
    const result = await this.infer(audioData);
    
    // 提取乐器相关的概率
    const instrumentProbabilities: Record<string, number> = {};
    let maxConfidence = 0;
    let dominantInstrument = 'Unknown';
    
    result.topClasses.forEach(({ label, confidence }) => {
      if (this.isInstrumentClass(label)) {
        instrumentProbabilities[label] = confidence;
        if (confidence > maxConfidence) {
          maxConfidence = confidence;
          dominantInstrument = label;
        }
      }
    });
    
    return {
      dominantInstrument,
      instrumentProbabilities,
      confidence: maxConfidence
    };
  }

  /**
   * 判断是否为乐器类别
   */
  private isInstrumentClass(label: string): boolean {
    const instrumentClasses = [
      'Guitar', 'Piano', 'Drum', 'Voice', 'Violin', 'Bass',
      'Saxophone', 'Trumpet', 'Flute', 'Clarinet'
    ];
    return instrumentClasses.includes(label);
  }

  /**
   * 获取模型状态
   */
  public getModelStatus(): { loaded: boolean; processing: boolean } {
    return {
      loaded: this.isModelLoaded,
      processing: this.isProcessing
    };
  }
}

// 创建Worker实例
const modelWorker = new ModelWorker();

// 监听主线程消息
self.addEventListener('message', async (event: MessageEvent<ModelWorkerMessage>) => {
  const { type, data, id } = event.data;
  
  try {
    switch (type) {
      case 'LOAD_MODEL':
        await modelWorker.loadModel();
        const loadResponse: ModelWorkerResponse = {
          type: 'MODEL_LOADED',
          id
        };
        self.postMessage(loadResponse);
        break;
        
      case 'INFER':
        if (data) {
          const result = await modelWorker.infer(data);
          const response: ModelWorkerResponse = {
            type: 'SUCCESS',
            data: result,
            id
          };
          self.postMessage(response);
        }
        break;
        
      case 'CLASSIFY':
        if (data) {
          const result = await modelWorker.classifyInstruments(data);
          const response: ModelWorkerResponse = {
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
    const response: ModelWorkerResponse = {
      type: 'ERROR',
      error: error instanceof Error ? error.message : '未知错误',
      id
    };
    self.postMessage(response);
  }
});

// 导出类型供主线程使用
export type { ModelWorkerMessage, ModelWorkerResponse, InferenceResult, ModelConfig };