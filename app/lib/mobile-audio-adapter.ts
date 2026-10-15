/**
 * 移动端音频适配器
 * 处理移动设备检测、音频约束优化和降级方案
 */

export interface MobileInfo {
  isMobile: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isIPad: boolean;
  isIPhone: boolean;
  browser: string;
  version?: string;
}

export interface AudioConstraints {
  audio: {
    echoCancellation?: boolean;
    noiseSuppression?: boolean;
    autoGainControl?: boolean;
    sampleRate?: number;
    channelCount?: number;
    deviceId?: string | { exact?: string };
  };
}

export interface FallbackOptions {
  testTone?: boolean;
  fileUpload?: boolean;
  systemAudio?: boolean;
}

export class MobileAudioAdapter {
  private mobileInfo: MobileInfo;

  constructor() {
    this.mobileInfo = this.detectMobileDevice();
  }

  /**
   * 检测移动设备类型
   */
  private detectMobileDevice(): MobileInfo {
    const userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent.toLowerCase();

    // iOS 检测
    const isIOS = /ipad|iphone|ipod/.test(userAgent);
    const isIPad = /ipad/.test(userAgent);
    const isIPhone = /iphone/.test(userAgent);

    // Android 检测
    const isAndroid = /android/.test(userAgent);

    // 移动设备检测
    const isMobile = isIOS || isAndroid || /mobile/.test(userAgent);

    // 浏览器检测
    let browser = 'unknown';
    if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
      browser = 'safari';
    } else if (userAgent.includes('chrome')) {
      browser = 'chrome';
    } else if (userAgent.includes('firefox')) {
      browser = 'firefox';
    } else if (userAgent.includes('edge')) {
      browser = 'edge';
    }

    // 提取版本号
    let version;
    const versionMatch = userAgent.match(
      /(version|chrome|firefox|edge)\/(\d+)/
    );
    if (versionMatch) {
      version = versionMatch[2];
    }

    return {
      isMobile,
      isIOS,
      isAndroid,
      isIPad,
      isIPhone,
      browser,
      version,
    };
  }

  /**
   * 获取移动设备信息
   */
  getMobileInfo(): MobileInfo {
    return { ...this.mobileInfo };
  }

  /**
   * 检查是否支持 getUserMedia
   */
  isGetUserMediaSupported(): boolean {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  /**
   * 检查是否支持 AudioContext
   */
  isAudioContextSupported(): boolean {
    return !!(window.AudioContext || (window as any).webkitAudioContext);
  }

  /**
   * 获取针对设备的优化音频约束
   */
  getOptimizedAudioConstraints(deviceId?: string): AudioConstraints {
    // 移动设备优先使用最简单的配置
    if (this.mobileInfo.isMobile) {
      const mobileConstraints: AudioConstraints = {
        audio: {
          // 移动设备上禁用复杂处理，避免兼容性问题
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        },
      };

      // 如果指定了设备ID（但移动设备上可能不支持）
      if (deviceId && deviceId !== 'default') {
        mobileConstraints.audio.deviceId = { exact: deviceId };
      }

      // iOS 特殊处理
      if (this.mobileInfo.isIOS) {
        mobileConstraints.audio.sampleRate = 48000;
      } else {
        // 其他移动设备使用更通用的采样率
        mobileConstraints.audio.sampleRate = 44100;
      }

      console.log('📱 使用移动端优化音频约束:', mobileConstraints);
      return mobileConstraints;
    }

    // 桌面设备使用更完整的配置
    const baseConstraints: AudioConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 44100,
        channelCount: 1,
      },
    };

    // 如果指定了设备ID
    if (deviceId) {
      baseConstraints.audio.deviceId = { exact: deviceId };
    }

    return baseConstraints;
  }

  /**
   * 获取降级选项
   */
  getFallbackOptions(): FallbackOptions {
    const options: FallbackOptions = {};

    // 测试音频始终可用
    options.testTone = true;

    // 文件上传在移动设备上可能不可靠
    options.fileUpload =
      !this.mobileInfo.isIOS ||
      (this.mobileInfo.version && parseInt(this.mobileInfo.version) >= 14);

    // 系统音频捕获在移动设备上通常不支持
    options.systemAudio = false;

    return options;
  }

  /**
   * 检查是否需要特殊处理
   */
  needsSpecialHandling(): boolean {
    // iOS Safari 需要特殊处理
    if (this.mobileInfo.isIOS && this.mobileInfo.browser === 'safari') {
      return true;
    }

    // 旧版本 Android 需要特殊处理
    if (
      this.mobileInfo.isAndroid &&
      this.mobileInfo.version &&
      parseInt(this.mobileInfo.version) < 10
    ) {
      return true;
    }

    return false;
  }

  /**
   * 获取用户友好的错误消息
   */
  getUserFriendlyError(error: Error): string {
    const errorMessage = error.message.toLowerCase();

    // 特定错误处理
    if (errorMessage.includes('getusermedia is not implemented')) {
      return '您的浏览器不支持音频捕获。请尝试使用最新版本的 Chrome、Firefox 或 Safari 浏览器。';
    }

    if (errorMessage.includes('permission denied')) {
      if (this.mobileInfo.isIOS) {
        return '请在 iOS 设置中允许此应用访问麦克风：设置 > 隐私 > 麦克风 > 允许此应用';
      }
      return '请允许此应用访问麦克风权限';
    }

    if (errorMessage.includes('not found')) {
      return '未检测到麦克风设备。请确保麦克风已连接并正常工作。';
    }

    if (errorMessage.includes('constraint')) {
      return '音频设备配置错误。请尝试重新连接麦克风或使用其他音频设备。';
    }

    // 默认错误消息
    return '音频初始化失败，请稍后重试。如果问题持续存在，请尝试使用其他浏览器或设备。';
  }

  /**
   * 获取音频设备列表
   */
  async getAudioDevices(): Promise<MediaDeviceInfo[]> {
    try {
      // 先请求临时权限以获取设备列表
      const tempStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      // 停止临时流
      tempStream.getTracks().forEach(track => track.stop());

      // 获取设备列表
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(device => device.kind === 'audioinput');
    } catch (error) {
      console.warn('无法获取音频设备列表:', error);
      return [];
    }
  }

  /**
   * 创建 AudioContext 并确保运行
   */
  async createAudioContext(): Promise<AudioContext> {
    if (!this.isAudioContextSupported()) {
      throw new Error('AudioContext 不支持');
    }

    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    const audioContext = new AudioContextClass();

    // iOS Safari 需要用户交互才能恢复 AudioContext
    if (this.mobileInfo.isIOS && audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    return audioContext;
  }
}
