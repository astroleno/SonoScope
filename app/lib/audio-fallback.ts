/**
 * 音频降级方案
 * 提供多种备选音频源，用于麦克风不可用的情况
 */

export interface AudioFallbackSource {
  type: 'testTone' | 'fileUpload' | 'systemAudio';
  name: string;
  description: string;
  isActive: boolean;
}

export interface TestToneConfig {
  frequency: number;
  amplitude: number;
  waveType: 'sine' | 'square' | 'sawtooth' | 'triangle';
  modulation?: {
    frequency: number;
    depth: number;
  };
}

export interface FileUploadConfig {
  supportedFormats: string[];
  maxSize: number; // MB
  autoPlay: boolean;
}

export class AudioFallbackManager {
  private audioContext: AudioContext | null = null;
  private currentSource: AudioFallbackSource | null = null;
  private oscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private analyser: AnalyserNode | null = null;

  constructor() {
    this.initializeAudioContext();
  }

  private async initializeAudioContext(): Promise<void> {
    try {
      this.audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.5;
    } catch (error) {
      console.error('AudioContext 初始化失败:', error);
    }
  }

  /**
   * 获取可用的降级方案
   */
  getAvailableSources(): AudioFallbackSource[] {
    const sources: AudioFallbackSource[] = [];

    // 测试音频总是可用
    sources.push({
      type: 'testTone',
      name: '测试音频',
      description: '使用生成的测试音调进行演示',
      isActive: this.currentSource?.type === 'testTone',
    });

    // 文件上传在大多数设备上都可用
    sources.push({
      type: 'fileUpload',
      name: '音频文件',
      description: '上传本地音频文件',
      isActive: this.currentSource?.type === 'fileUpload',
    });

    // 系统音频（仅在某些情况下可用）
    const isSystemAudioSupported = this.isSystemAudioSupported();
    if (isSystemAudioSupported) {
      sources.push({
        type: 'systemAudio',
        name: '系统音频',
        description: '捕获系统音频输出',
        isActive: this.currentSource?.type === 'systemAudio',
      });
    }

    return sources;
  }

  /**
   * 启动测试音频
   */
  async startTestTone(
    config: TestToneConfig = {
      frequency: 440,
      amplitude: 0.3,
      waveType: 'sine',
    }
  ): Promise<AudioContext> {
    if (!this.audioContext) {
      throw new Error('AudioContext 不可用');
    }

    // 停止当前源
    this.stopCurrentSource();

    try {
      // 创建振荡器
      this.oscillator = this.audioContext.createOscillator();
      this.gainNode = this.audioContext.createGain();

      // 配置振荡器
      this.oscillator.type = config.waveType;
      this.oscillator.frequency.setValueAtTime(
        config.frequency,
        this.audioContext.currentTime
      );

      // 配置增益
      this.gainNode.gain.setValueAtTime(
        config.amplitude,
        this.audioContext.currentTime
      );

      // 添加调制（如果配置了）
      if (config.modulation) {
        const modulator = this.audioContext.createOscillator();
        const modGain = this.audioContext.createGain();

        modulator.frequency.setValueAtTime(
          config.modulation.frequency,
          this.audioContext.currentTime
        );
        modGain.gain.setValueAtTime(
          config.modulation.depth,
          this.audioContext.currentTime
        );

        modulator.connect(modGain);
        modGain.connect(this.oscillator.frequency);
        modulator.start();
      }

      // 连接音频节点
      this.oscillator.connect(this.gainNode);
      this.gainNode.connect(this.analyser!);
      this.analyser.connect(this.audioContext.destination);

      // 启动振荡器
      this.oscillator.start();

      // 更新当前源状态
      this.currentSource = {
        type: 'testTone',
        name: '测试音频',
        description: `正在播放 ${config.frequency}Hz ${config.waveType} 波`,
        isActive: true,
      };

      // 确保音频上下文运行
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      return this.audioContext;
    } catch (error) {
      console.error('测试音频启动失败:', error);
      throw error;
    }
  }

  /**
   * 处理文件上传
   */
  async handleFileUpload(
    file: File,
    config: FileUploadConfig = {
      supportedFormats: ['mp3', 'wav', 'ogg', 'm4a', 'aac'],
      maxSize: 50,
      autoPlay: true,
    }
  ): Promise<AudioContext> {
    if (!this.audioContext) {
      throw new Error('AudioContext 不可用');
    }

    // 验证文件
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
    if (!config.supportedFormats.includes(fileExtension)) {
      throw new Error(`不支持的音频格式: ${fileExtension}`);
    }

    if (file.size > config.maxSize * 1024 * 1024) {
      throw new Error(`文件太大，最大支持 ${config.maxSize}MB`);
    }

    // 停止当前源
    this.stopCurrentSource();

    try {
      // 创建音频元素
      this.audioElement = new Audio();
      this.audioElement.src = URL.createObjectURL(file);
      this.audioElement.crossOrigin = 'anonymous';

      // 创建音频源节点
      const source = this.audioContext.createMediaElementSource(
        this.audioElement
      );
      source.connect(this.analyser!);
      this.analyser.connect(this.audioContext.destination);

      // 自动播放
      if (config.autoPlay) {
        await this.audioElement.play();
      }

      // 更新当前源状态
      this.currentSource = {
        type: 'fileUpload',
        name: '音频文件',
        description: `正在播放: ${file.name}`,
        isActive: true,
      };

      // 确保音频上下文运行
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      return this.audioContext;
    } catch (error) {
      console.error('文件上传处理失败:', error);
      throw error;
    }
  }

  /**
   * 启动系统音频捕获（实验性功能）
   */
  async startSystemAudio(): Promise<AudioContext> {
    if (!this.audioContext) {
      throw new Error('AudioContext 不可用');
    }

    // 停止当前源
    this.stopCurrentSource();

    try {
      // 尝试获取系统音频
      const stream = await navigator.mediaDevices.getDisplayMedia({
        audio: true,
        video: false,
      });

      // 创建音频源
      const source = this.audioContext.createMediaStreamSource(stream);
      source.connect(this.analyser!);
      this.analyser.connect(this.audioContext.destination);

      // 更新当前源状态
      this.currentSource = {
        type: 'systemAudio',
        name: '系统音频',
        description: '正在捕获系统音频',
        isActive: true,
      };

      // 确保音频上下文运行
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      return this.audioContext;
    } catch (error) {
      console.error('系统音频捕获失败:', error);
      throw new Error('系统音频捕获不可用，请尝试其他选项');
    }
  }

  /**
   * 停止当前源
   */
  stopCurrentSource(): void {
    if (this.oscillator) {
      this.oscillator.stop();
      this.oscillator.disconnect();
      this.oscillator = null;
    }

    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.src = '';
      this.audioElement = null;
    }

    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }

    this.currentSource = null;
  }

  /**
   * 获取分析器
   */
  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  /**
   * 获取当前源信息
   */
  getCurrentSource(): AudioFallbackSource | null {
    return this.currentSource;
  }

  /**
   * 检查系统音频是否支持
   */
  private isSystemAudioSupported(): boolean {
    return !!(
      navigator.mediaDevices && (navigator.mediaDevices as any).getDisplayMedia
    );
  }

  /**
   * 创建测试音调配置
   */
  static createTestToneConfigs(): TestToneConfig[] {
    return [
      {
        frequency: 220,
        amplitude: 0.3,
        waveType: 'sine',
        modulation: {
          frequency: 2,
          depth: 50,
        },
      },
      {
        frequency: 440,
        amplitude: 0.3,
        waveType: 'sine',
      },
      {
        frequency: 880,
        amplitude: 0.2,
        waveType: 'triangle',
      },
      {
        frequency: 330,
        amplitude: 0.25,
        waveType: 'square',
      },
    ];
  }

  /**
   * 生成动态测试音频（频率变化）
   */
  async startDynamicTestTone(): Promise<AudioContext> {
    if (!this.audioContext) {
      throw new Error('AudioContext 不可用');
    }

    // 停止当前源
    this.stopCurrentSource();

    try {
      this.oscillator = this.audioContext.createOscillator();
      this.gainNode = this.audioContext.createGain();

      this.oscillator.type = 'sine';
      this.gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);

      // 连接音频节点
      this.oscillator.connect(this.gainNode);
      this.gainNode.connect(this.analyser!);
      this.analyser.connect(this.audioContext.destination);

      // 启动振荡器
      this.oscillator.start();

      // 添加频率变化
      const changeFrequency = () => {
        if (this.oscillator) {
          const time = this.audioContext!.currentTime;
          const baseFreq = 220;
          const variation =
            Math.sin(time * 0.5) * 200 + Math.sin(time * 0.3) * 100;
          this.oscillator.frequency.setValueAtTime(baseFreq + variation, time);
        }

        if (this.currentSource?.type === 'testTone') {
          requestAnimationFrame(changeFrequency);
        }
      };

      changeFrequency();

      // 更新当前源状态
      this.currentSource = {
        type: 'testTone',
        name: '动态测试音频',
        description: '正在播放频率变化的测试音频',
        isActive: true,
      };

      // 确保音频上下文运行
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      return this.audioContext;
    } catch (error) {
      console.error('动态测试音频启动失败:', error);
      throw error;
    }
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.stopCurrentSource();

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.analyser = null;
  }
}
