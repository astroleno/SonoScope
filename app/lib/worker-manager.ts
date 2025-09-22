/**
 * Worker Manager - Web Worker管理器
 * 负责管理Audio Worker和Model Worker的生命周期和通信
 */

import type { 
  AudioWorkerMessage, 
  AudioWorkerResponse, 
  AudioData, 
  FeatureResult 
} from './workers/audio-worker';
import type { 
  ModelWorkerMessage, 
  ModelWorkerResponse, 
  InferenceResult 
} from './workers/model-worker';

// Worker状态
interface WorkerStatus {
  isReady: boolean;
  isProcessing: boolean;
  lastError?: string;
  messageCount: number;
}

// Worker管理器配置
interface WorkerManagerConfig {
  maxRetries: number;
  timeout: number;
  autoRestart: boolean;
}

class WorkerManager {
  private audioWorker: Worker | null = null;
  private modelWorker: Worker | null = null;
  private audioWorkerStatus: WorkerStatus = {
    isReady: false,
    isProcessing: false,
    messageCount: 0
  };
  private modelWorkerStatus: WorkerStatus = {
    isReady: false,
    isProcessing: false,
    messageCount: 0
  };
  private config: WorkerManagerConfig;
  private messageHandlers: Map<string, (response: any) => void> = new Map();
  private messageIdCounter: number = 0;

  constructor(config: Partial<WorkerManagerConfig> = {}) {
    this.config = {
      maxRetries: 3,
      timeout: 10000,
      autoRestart: true,
      ...config
    };
  }

  private canUseWorkers(): boolean {
    // 仅在浏览器环境且支持 Worker 时启用
    return typeof window !== 'undefined' && typeof Worker !== 'undefined';
  }

  /**
   * 初始化所有Worker
   */
  public async initialize(): Promise<void> {
    if (!this.canUseWorkers()) {
      // 在SSR环境或不支持Worker时静默跳过，避免报错
      console.warn('Worker不可用（SSR或环境不支持），跳过初始化。');
      return;
    }
    try {
      await this.initializeAudioWorker();
      await this.initializeModelWorker();
      console.log('所有Worker初始化完成');
    } catch (error) {
      console.error('Worker初始化失败:', error);
      // 不抛出，让上层按主线程降级逻辑继续运行
    }
  }

  /**
   * 初始化Audio Worker
   */
  private async initializeAudioWorker(): Promise<void> {
    if (!this.canUseWorkers()) {
      console.warn('Audio Worker不可用（SSR或环境不支持），跳过。');
      return;
    }
    try {
      this.audioWorker = new Worker(
        new URL('./workers/audio-worker.ts', import.meta.url),
        { type: 'module' }
      );

      this.audioWorker.onmessage = (event: MessageEvent<AudioWorkerResponse>) => {
        this.handleAudioWorkerMessage(event.data);
      };

      this.audioWorker.onerror = (error) => {
        console.error('Audio Worker错误:', error);
        this.audioWorkerStatus.lastError = error.message;
        this.handleWorkerError('audio');
      };

      this.audioWorkerStatus.isReady = true;
      console.log('Audio Worker初始化成功');
    } catch (error) {
      console.error('Audio Worker初始化失败:', error);
      // 不抛出，留给调用方降级
    }
  }

  /**
   * 初始化Model Worker
   */
  private async initializeModelWorker(): Promise<void> {
    if (!this.canUseWorkers()) {
      console.warn('Model Worker不可用（SSR或环境不支持），跳过。');
      return;
    }
    try {
      this.modelWorker = new Worker(
        new URL('./workers/model-worker.ts', import.meta.url),
        { type: 'module' }
      );

      this.modelWorker.onmessage = (event: MessageEvent<ModelWorkerResponse>) => {
        this.handleModelWorkerMessage(event.data);
      };

      this.modelWorker.onerror = (error) => {
        console.error('Model Worker错误:', error);
        this.modelWorkerStatus.lastError = error.message;
        this.handleWorkerError('model');
      };

      // 加载模型
      await this.loadModel();
      
      this.modelWorkerStatus.isReady = true;
      console.log('Model Worker初始化成功');
    } catch (error) {
      console.error('Model Worker初始化失败:', error);
      // 不抛出，留给调用方降级
    }
  }

  /**
   * 加载YAMNet模型
   */
  private async loadModel(): Promise<void> {
    if (!this.modelWorker) {
      throw new Error('Model Worker未初始化');
    }

    return new Promise((resolve, reject) => {
      const messageId = this.generateMessageId();
      
      const timeout = setTimeout(() => {
        reject(new Error('模型加载超时'));
      }, this.config.timeout);

      this.messageHandlers.set(messageId, (response: ModelWorkerResponse) => {
        clearTimeout(timeout);
        this.messageHandlers.delete(messageId);
        
        if (response.type === 'MODEL_LOADED') {
          resolve();
        } else {
          reject(new Error(response.error || '模型加载失败'));
        }
      });

      const message: ModelWorkerMessage = {
        type: 'LOAD_MODEL',
        id: messageId
      };

      this.modelWorker.postMessage(message);
    });
  }

  /**
   * 处理音频数据
   */
  public async processAudio(audioData: AudioData): Promise<FeatureResult> {
    if (!this.audioWorker || !this.audioWorkerStatus.isReady) {
      throw new Error('Audio Worker未就绪');
    }

    this.audioWorkerStatus.isProcessing = true;

    try {
      const result = await this.sendMessageToAudioWorker('PROCESS_AUDIO', audioData);
      return result as FeatureResult;
    } finally {
      this.audioWorkerStatus.isProcessing = false;
    }
  }

  /**
   * 执行模型推理
   */
  public async inferModel(audioData: Float32Array): Promise<InferenceResult> {
    if (!this.modelWorker || !this.modelWorkerStatus.isReady) {
      throw new Error('Model Worker未就绪');
    }

    this.modelWorkerStatus.isProcessing = true;

    try {
      const result = await this.sendMessageToModelWorker('INFER', audioData);
      return result as InferenceResult;
    } finally {
      this.modelWorkerStatus.isProcessing = false;
    }
  }

  /**
   * 乐器分类
   */
  public async classifyInstruments(audioData: Float32Array): Promise<{
    dominantInstrument: string;
    instrumentProbabilities: Record<string, number>;
    confidence: number;
  }> {
    if (!this.modelWorker || !this.modelWorkerStatus.isReady) {
      throw new Error('Model Worker未就绪');
    }

    this.modelWorkerStatus.isProcessing = true;

    try {
      const result = await this.sendMessageToModelWorker('CLASSIFY', audioData);
      return result;
    } finally {
      this.modelWorkerStatus.isProcessing = false;
    }
  }

  /**
   * 发送消息到Audio Worker
   */
  private async sendMessageToAudioWorker(type: AudioWorkerMessage['type'], data?: any): Promise<any> {
    if (!this.audioWorker) {
      throw new Error('Audio Worker未初始化');
    }

    return new Promise((resolve, reject) => {
      const messageId = this.generateMessageId();
      
      const timeout = setTimeout(() => {
        this.messageHandlers.delete(messageId);
        reject(new Error('Audio Worker响应超时'));
      }, this.config.timeout);

      this.messageHandlers.set(messageId, (response: AudioWorkerResponse) => {
        clearTimeout(timeout);
        this.messageHandlers.delete(messageId);
        
        if (response.type === 'SUCCESS') {
          resolve(response.data);
        } else {
          reject(new Error(response.error || 'Audio Worker处理失败'));
        }
      });

      const message: AudioWorkerMessage = {
        type,
        data,
        id: messageId
      };

      this.audioWorker.postMessage(message);
      this.audioWorkerStatus.messageCount++;
    });
  }

  /**
   * 发送消息到Model Worker
   */
  private async sendMessageToModelWorker(type: ModelWorkerMessage['type'], data?: any): Promise<any> {
    if (!this.modelWorker) {
      throw new Error('Model Worker未初始化');
    }

    return new Promise((resolve, reject) => {
      const messageId = this.generateMessageId();
      
      const timeout = setTimeout(() => {
        this.messageHandlers.delete(messageId);
        reject(new Error('Model Worker响应超时'));
      }, this.config.timeout);

      this.messageHandlers.set(messageId, (response: ModelWorkerResponse) => {
        clearTimeout(timeout);
        this.messageHandlers.delete(messageId);
        
        if (response.type === 'SUCCESS') {
          resolve(response.data);
        } else {
          reject(new Error(response.error || 'Model Worker处理失败'));
        }
      });

      const message: ModelWorkerMessage = {
        type,
        data,
        id: messageId
      };

      this.modelWorker.postMessage(message);
      this.modelWorkerStatus.messageCount++;
    });
  }

  /**
   * 处理Audio Worker消息
   */
  private handleAudioWorkerMessage(response: AudioWorkerResponse): void {
    if (response.id && this.messageHandlers.has(response.id)) {
      const handler = this.messageHandlers.get(response.id);
      if (handler) {
        handler(response);
      }
    }
  }

  /**
   * 处理Model Worker消息
   */
  private handleModelWorkerMessage(response: ModelWorkerResponse): void {
    if (response.id && this.messageHandlers.has(response.id)) {
      const handler = this.messageHandlers.get(response.id);
      if (handler) {
        handler(response);
      }
    }
  }

  /**
   * 处理Worker错误
   */
  private handleWorkerError(workerType: 'audio' | 'model'): void {
    if (this.config.autoRestart) {
      console.log(`尝试重启${workerType} Worker...`);
      this.restartWorker(workerType);
    }
  }

  /**
   * 重启Worker
   */
  private async restartWorker(workerType: 'audio' | 'model'): Promise<void> {
    try {
      if (workerType === 'audio') {
        this.terminateAudioWorker();
        await this.initializeAudioWorker();
      } else {
        this.terminateModelWorker();
        await this.initializeModelWorker();
      }
      console.log(`${workerType} Worker重启成功`);
    } catch (error) {
      console.error(`${workerType} Worker重启失败:`, error);
    }
  }

  /**
   * 终止Audio Worker
   */
  private terminateAudioWorker(): void {
    if (this.audioWorker) {
      this.audioWorker.postMessage({ type: 'TERMINATE' });
      this.audioWorker.terminate();
      this.audioWorker = null;
      this.audioWorkerStatus.isReady = false;
    }
  }

  /**
   * 终止Model Worker
   */
  private terminateModelWorker(): void {
    if (this.modelWorker) {
      this.modelWorker.postMessage({ type: 'TERMINATE' });
      this.modelWorker.terminate();
      this.modelWorker = null;
      this.modelWorkerStatus.isReady = false;
    }
  }

  /**
   * 生成消息ID
   */
  private generateMessageId(): string {
    return `msg_${++this.messageIdCounter}_${Date.now()}`;
  }

  /**
   * 获取Worker状态
   */
  public getWorkerStatus(): {
    audio: WorkerStatus;
    model: WorkerStatus;
  } {
    return {
      audio: { ...this.audioWorkerStatus },
      model: { ...this.modelWorkerStatus }
    };
  }

  /**
   * 销毁所有Worker
   */
  public destroy(): void {
    this.terminateAudioWorker();
    this.terminateModelWorker();
    this.messageHandlers.clear();
    console.log('所有Worker已销毁');
  }
}

// 创建全局Worker管理器实例
export const workerManager = new WorkerManager();

export default WorkerManager;
