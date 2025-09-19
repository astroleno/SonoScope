/**
 * 音频引擎 - M1 阶段实现
 * 负责音频捕获、特征提取和事件发送
 */

export interface FeatureTick {
  t: number;
  rms: number;
  centroid: number;
  flux: number;
  onsetRate: number;
  bpm?: number;
  pitch?: number;
  version: string;
}

export type AudioEngineEvent = 'featureTick' | 'error' | 'statusChange';

export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private animationFrameId: number | null = null;
  private isInitialized = false;
  private isActive = false;
  private listeners: Map<AudioEngineEvent, Function[]> = new Map();

  // 音频分析参数
  private readonly FFT_SIZE = 2048;
  private readonly HOP_LENGTH = 512;
  private readonly SMOOTHING_TIME_CONSTANT = 0.8;

  // 特征提取缓冲区
  private frequencyData: Float32Array;
  private timeData: Float32Array;
  private previousSpectrum: Float32Array;

  // 节拍检测
  private onsetHistory: number[] = [];
  private lastOnsetTime = 0;
  private onsetThreshold = 0.3;

  constructor() {
    this.frequencyData = new Float32Array(this.FFT_SIZE / 2);
    this.timeData = new Float32Array(this.FFT_SIZE);
    this.previousSpectrum = new Float32Array(this.FFT_SIZE / 2);
    
    // 初始化事件监听器
    this.listeners.set('featureTick', []);
    this.listeners.set('error', []);
    this.listeners.set('statusChange', []);
  }

  async initialize(): Promise<void> {
    try {
      // 检查浏览器支持
      if (!this.isWebAudioSupported()) {
        throw new Error('浏览器不支持 Web Audio API');
      }

      // 创建音频上下文
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // 创建分析器节点
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = this.FFT_SIZE;
      this.analyser.smoothingTimeConstant = this.SMOOTHING_TIME_CONSTANT;

      this.isInitialized = true;
      this.emit('statusChange', { initialized: true });
      console.log('音频引擎初始化成功');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('音频引擎未初始化');
    }

    if (this.isActive) {
      console.warn('音频引擎已在运行');
      return;
    }

    try {
      // 请求麦克风权限
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      });

      // 创建音频源节点
      this.microphone = this.audioContext!.createMediaStreamSource(this.stream);
      
      // 连接音频节点
      this.microphone.connect(this.analyser!);

      // 开始音频分析循环
      this.startAnalysisLoop();

      this.isActive = true;
      this.emit('statusChange', { active: true });
      console.log('音频引擎启动成功');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  stop(): void {
    if (!this.isActive) {
      return;
    }

    // 停止分析循环
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // 断开音频连接
    if (this.microphone) {
      this.microphone.disconnect();
      this.microphone = null;
    }

    // 停止媒体流
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    this.isActive = false;
    this.emit('statusChange', { active: false });
    console.log('音频引擎已停止');
  }

  dispose(): void {
    this.stop();
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.isInitialized = false;
  }

  // 事件监听
  on(event: AudioEngineEvent, callback: Function): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.push(callback);
    }
  }

  off(event: AudioEngineEvent, callback: Function): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: AudioEngineEvent, data: any): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`事件处理器执行失败 (${event}):`, error);
        }
      });
    }
  }

  private startAnalysisLoop(): void {
    const analyze = () => {
      if (!this.isActive || !this.analyser) {
        return;
      }

      try {
        // 获取频域数据
        this.analyser.getFloatFrequencyData(this.frequencyData);
        
        // 获取时域数据
        this.analyser.getFloatTimeDomainData(this.timeData);

        // 提取音频特征
        const features = this.extractFeatures();
        
        // 发送特征事件
        this.emit('featureTick', features);

        // 继续分析循环
        this.animationFrameId = requestAnimationFrame(analyze);
      } catch (error) {
        console.error('音频分析错误:', error);
        this.emit('error', error);
      }
    };

    this.animationFrameId = requestAnimationFrame(analyze);
  }

  private extractFeatures(): FeatureTick {
    const now = Date.now();
    
    // RMS (均方根) - 音量
    const rms = this.calculateRMS(this.timeData);
    
    // 频谱质心 - 音色亮度
    const centroid = this.calculateSpectralCentroid(this.frequencyData);
    
    // 频谱通量 - 音色变化
    const flux = this.calculateSpectralFlux();
    
    // 节拍检测率
    const onsetRate = this.detectOnsets(rms);

    // 更新频谱历史
    this.previousSpectrum.set(this.frequencyData);

    return {
      t: now,
      rms: Math.max(0, Math.min(1, rms)),
      centroid: Math.max(0, centroid),
      flux: Math.max(0, Math.min(1, flux)),
      onsetRate: Math.max(0, onsetRate),
      version: '1.0.0'
    };
  }

  private calculateRMS(data: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    return Math.sqrt(sum / data.length);
  }

  private calculateSpectralCentroid(spectrum: Float32Array): number {
    let weightedSum = 0;
    let magnitudeSum = 0;
    
    for (let i = 0; i < spectrum.length; i++) {
      const magnitude = Math.pow(10, spectrum[i] / 20); // 转换为线性幅度
      const frequency = (i * this.audioContext!.sampleRate) / (2 * spectrum.length);
      
      weightedSum += frequency * magnitude;
      magnitudeSum += magnitude;
    }
    
    return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
  }

  private calculateSpectralFlux(): number {
    let flux = 0;
    
    for (let i = 0; i < this.frequencyData.length; i++) {
      const diff = this.frequencyData[i] - this.previousSpectrum[i];
      if (diff > 0) {
        flux += diff;
      }
    }
    
    return flux / this.frequencyData.length;
  }

  private detectOnsets(rms: number): number {
    const now = Date.now();
    
    // 简单的节拍检测：RMS 突然增加
    if (rms > this.onsetThreshold && now - this.lastOnsetTime > 100) {
      this.onsetHistory.push(now);
      this.lastOnsetTime = now;
      
      // 保持最近 2 秒的历史
      this.onsetHistory = this.onsetHistory.filter(
        time => now - time < 2000
      );
    }
    
    // 计算每秒的节拍数
    return this.onsetHistory.length / 2;
  }

  private isWebAudioSupported(): boolean {
    return !!(
      window.AudioContext ||
      (window as any).webkitAudioContext ||
      (window as any).mozAudioContext
    );
  }

  // 获取当前状态
  get isRunning(): boolean {
    return this.isActive;
  }

  get isReady(): boolean {
    return this.isInitialized;
  }
}