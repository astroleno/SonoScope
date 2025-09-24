import { DanmuCommand, DanmuEvent, AudioFeatures } from '../types';

export interface DanmuAdapter {
  trigger(payload?: any): void;
  start(): void;
  stop(): void;
  onDanmu(callback: (event: DanmuEvent) => void): void;
  dispose(): void;
}

// 弹幕生成的核心特征接口
export interface DanmuCoreFeatures {
  // 最小可用输入
  style?: {
    label: string;
    confidence: number;
  };
  instruments?: {
    primary: string;
    secondary?: string;
    probabilities: Record<string, number>;
    confidence: number;
  };
  tempo?: {
    bpm: number;
    beatStrength: number;
  };
  voice?: {
    probability: number;
  };
  hpss?: {
    percussiveRatio: number;
    harmonicRatio: number;
  };
  timbre?: {
    warmth: number;
    brightness: number;
    roughness: number;
  };
  
  // 增强输入
  tempoStats?: {
    avgBpm: number;
    tempoStability: number;
    dominantTimeSignature: string;
    tempoConfidence: number;
  };
  instrumentStats?: {
    dominantInstrument: string;
    instrumentCount: number;
    polyphony: number;
    diversity: number;
    instrumentConfidence: number;
  };
  pitchStats?: {
    avgFundamentalFreq: number;
    dominantPitch: string;
    pitchStability: number;
    pitchConfidence: number;
  };
  enhancedHPSSStats?: {
    avgMusicalComplexity: number;
    avgMusicalStability: number;
    avgMusicalRichness: number;
  };
  combinedFeatures?: {
    energy: number;
    dynamics: number;
    complexity: number;
  };
}

export class EnhancedDanmuAdapter implements DanmuAdapter {
  private danmuCallback: ((event: DanmuEvent) => void) | null = null;
  private isActive = false;
  private _isReady = true;
  private _danmuCount = 0;
  private _pendingRequests = 0;
  private _currentStyle: string | null = null;
  
  // 弹幕生成状态
  private lastTriggerTime = 0;
  private triggerCooldown = 2200; // 适度加长冷却，降低密度
  private lastBeatStrength = 0;
  private lastVoiceProb = 0;
  private lastComplexity = 0;
  // 随机触发概率基础值（可按设备与能量自适应）
  private baseRandomProb = 0.03;
  // 观感控制：时间窗限流、重复抑制
  private recentTimestamps: number[] = [];
  private lastTextMap: Record<string, { text: string; ts: number }> = {};

  constructor() {
    // 初始化
  }

  /**
   * 接收来自 LLM 的 JSON（JSON Mode）并生成弹幕。
   * 期望字段：
   * id?: string; text: string; style: 'beat'|'voice'|'complexity'|'random'|'manual';
   * color?: string; size?: number; speed?: number; cooldownMs?: number;
   */
  fromJson(jsonInput: string | object): void {
    if (!this._isActive) return;
    try {
      const payload = typeof jsonInput === 'string' ? JSON.parse(jsonInput) : jsonInput;
      const normalized = this.validateAndClamp(payload);
      if (!normalized) return;
      this.trigger(normalized);
    } catch {
      // 严格模式：不做模板回退
      return;
    }
  }

  private validateAndClamp(input: any): any | null {
    if (!input || typeof input !== 'object') return null;
    const styleEnum = ['beat', 'voice', 'complexity', 'random', 'manual'];
    const text = typeof input.text === 'string' ? input.text.slice(0, 60) : '';
    const style = typeof input.style === 'string' && styleEnum.includes(input.style) ? input.style : 'random';
    if (!text) return null;
    const color = typeof input.color === 'string' ? input.color : '#ffffff';
    const sizeRaw = typeof input.size === 'number' ? input.size : 16;
    const speedRaw = typeof input.speed === 'number' ? input.speed : 1;
    const cooldownMsRaw = typeof input.cooldownMs === 'number' ? input.cooldownMs : this._cooldownMs;

    const size = Math.max(10, Math.min(36, sizeRaw));
    const speed = Math.max(0.5, Math.min(3, speedRaw));
    const cooldownMs = Math.max(500, Math.min(5000, cooldownMsRaw));

    return { text, style, color, size, speed, cooldownMs };
  }

  trigger(payload?: any): void {
    if (!this.isActive) return;

    const now = Date.now();
    // 时间窗限流：5 秒最多 6 条
    this.recentTimestamps = this.recentTimestamps.filter(ts => now - ts <= 5000);
    if (this.recentTimestamps.length >= 6) return;
    // 冷却判断
    if (now - this.lastTriggerTime < this.triggerCooldown) return;

    this.lastTriggerTime = now;
    this._danmuCount++;
    this._pendingRequests = Math.max(0, this._pendingRequests - 1);

    const event: DanmuEvent = {
      id: `danmu_${now}_${Math.random()}`,
      command: {
        text: payload?.text || 'Enhanced danmu message',
        style: payload?.style || 'default',
        color: payload?.color || '#ffffff',
        size: payload?.size || 16,
        speed: payload?.speed || 1,
        position: payload?.position || 'right',
        duration: payload?.duration || 5000,
      },
      timestamp: now,
    };

    // 重复抑制：同一 style 的相同文本 10 秒内不重复
    const styleKey = event.command.style || 'default';
    const last = this.lastTextMap[styleKey];
    if (last && last.text === event.command.text && now - last.ts < 10000) {
      return; // 丢弃重复
    }
    this.lastTextMap[styleKey] = { text: event.command.text, ts: now };
    this.recentTimestamps.push(now);

    if (this.danmuCallback) {
      this.danmuCallback(event);
    }
  }

  start(): void {
    this.isActive = true;
    this._currentStyle = 'enhanced';
  }

  stop(): void {
    this.isActive = false;
    this._currentStyle = null;
  }

  onDanmu(callback: (event: DanmuEvent) => void): void {
    this.danmuCallback = callback;
  }

  // 处理音频特征并生成智能弹幕
  handleAudioFeatures(level: number, features: AudioFeatures): void {
    if (!this.isActive) return;

    const coreFeatures = this.extractCoreFeatures(features);
    const danmuPayload = this.generateDanmuPayload(coreFeatures, level);
    
    if (danmuPayload) {
      this.trigger(danmuPayload);
    }
  }

  // 从AudioFeatures提取弹幕核心特征
  private extractCoreFeatures(features: AudioFeatures): DanmuCoreFeatures {
    const core: DanmuCoreFeatures = {};

    // 基础特征映射
    if (features.tempo) {
      core.tempo = {
        bpm: features.tempo.bpm,
        beatStrength: features.percussiveRatio || 0,
      };
    }

    if (features.instruments) {
      core.instruments = {
        primary: features.instruments.dominantInstrument,
        secondary: features.instruments.dominantInstrument, // 使用主乐器作为次乐器
        confidence: features.instrumentConfidence || 0,
        probabilities: features.instrumentProbabilities || {},
      };
    }

    if (features.voiceProb !== undefined) {
      core.voice = {
        probability: features.voiceProb,
      };
    }

    if (features.percussiveRatio !== undefined && features.harmonicRatio !== undefined) {
      core.hpss = {
        percussiveRatio: features.percussiveRatio,
        harmonicRatio: features.harmonicRatio,
      };
    }

    if (features.timbre) {
      core.timbre = {
        warmth: features.timbre.warmth,
        brightness: features.timbre.brightness,
        roughness: features.timbre.roughness,
      };
    }

    // 增强特征映射
    if (features.enhancedHPSS) {
      core.enhancedHPSSStats = {
        avgMusicalComplexity: features.enhancedHPSS.musicComplexity,
        avgMusicalStability: features.enhancedHPSS.overallStability,
        avgMusicalRichness: features.enhancedHPSS.overallRichness,
      };
    }

    // 组合特征
    core.combinedFeatures = {
      energy: features.rms || 0,
      dynamics: features.spectralFlux || 0,
      complexity: features.enhancedHPSS?.musicComplexity || 0,
    };

    return core;
  }

  // 基于特征生成弹幕内容
  private generateDanmuPayload(core: DanmuCoreFeatures, level: number): any | null {
    const now = Date.now();
    // 动态冷却：按 BPM 调整触发频率（越快的歌，冷却越短，但设下限）
    const bpm = core.tempo?.bpm || 0;
    if (bpm > 0) {
      const beatMs = 60000 / bpm;
      const dynamic = Math.max(900, Math.min(3000, Math.round(beatMs * 0.75)));
      this.triggerCooldown = dynamic;
    } else {
      this.triggerCooldown = 2200;
    }
    
    // 节拍强度变化检测（去抖）
    if (
      core.tempo?.beatStrength &&
      Math.abs(core.tempo.beatStrength - this.lastBeatStrength) > 0.22 &&
      now - this.lastTriggerTime > this.triggerCooldown * 0.6
    ) {
      this.lastBeatStrength = core.tempo.beatStrength;
      return this.generateBeatDanmu(core);
    }

    // 人声概率变化检测（去抖）
    if (
      core.voice?.probability &&
      Math.abs(core.voice.probability - this.lastVoiceProb) > 0.33 &&
      now - this.lastTriggerTime > this.triggerCooldown * 0.7
    ) {
      this.lastVoiceProb = core.voice.probability;
      return this.generateVoiceDanmu(core);
    }

    // 复杂度变化检测（去抖）
    if (
      core.combinedFeatures?.complexity &&
      Math.abs(core.combinedFeatures.complexity - this.lastComplexity) > 0.22 &&
      now - this.lastTriggerTime > this.triggerCooldown * 0.8
    ) {
      this.lastComplexity = core.combinedFeatures.complexity;
      return this.generateComplexityDanmu(core);
    }

    // 随机触发（自适应低概率；移动端或低能量时进一步降低）
    const isMobile = typeof navigator !== 'undefined' && /iphone|ipad|android|mobile/i.test(navigator.userAgent);
    const energy = Math.max(0, Math.min(1, core.combinedFeatures?.energy ?? 0));
    const prob = this.baseRandomProb * (isMobile ? 0.5 : 1) * (energy > 0.5 ? 1 : 0.6);
    if (Math.random() < prob) {
      return this.generateRandomDanmu(core);
    }

    return null;
  }

  // 生成节拍相关弹幕
  private generateBeatDanmu(core: DanmuCoreFeatures): any {
    const bpm = core.tempo?.bpm || 0;
    const beatStrength = core.tempo?.beatStrength || 0;
    
    const beatTexts = [
      `🎵 BPM: ${Math.round(bpm)}`,
      `💥 节拍强度: ${Math.round(beatStrength * 100)}%`,
      `🔥 节奏感爆棚！`,
      `⚡ 节拍同步中...`,
      `🎶 律动感十足`,
    ];

    return {
      text: beatTexts[Math.floor(Math.random() * beatTexts.length)],
      style: 'beat',
      color: beatStrength > 0.7 ? '#ff6b6b' : '#4ecdc4',
      size: 16 + beatStrength * 8,
      speed: 1 + beatStrength * 0.5,
    };
  }

  // 生成人声相关弹幕
  private generateVoiceDanmu(core: DanmuCoreFeatures): any {
    const voiceProb = core.voice?.probability || 0;
    
    const voiceTexts = [
      `🎤 人声检测: ${Math.round(voiceProb * 100)}%`,
      `🎵 主唱模式`,
      `🎶 人声清晰`,
      `🎤 声线优美`,
      `🎵 人声主导`,
    ];

    return {
      text: voiceTexts[Math.floor(Math.random() * voiceTexts.length)],
      style: 'voice',
      color: voiceProb > 0.7 ? '#ff9ff3' : '#54a0ff',
      size: 16 + voiceProb * 4,
      speed: 1,
    };
  }

  // 生成复杂度相关弹幕
  private generateComplexityDanmu(core: DanmuCoreFeatures): any {
    const complexity = core.combinedFeatures?.complexity || 0;
    const instrumentCount = Object.keys(core.instruments?.probabilities || {}).length;
    
    const complexityTexts = [
      `🎼 复杂度: ${Math.round(complexity * 100)}%`,
      `🎵 乐器数量: ${instrumentCount}`,
      `🎶 编曲丰富`,
      `🎼 层次分明`,
      `🎵 音乐饱满`,
    ];

    return {
      text: complexityTexts[Math.floor(Math.random() * complexityTexts.length)],
      style: 'complexity',
      color: complexity > 0.7 ? '#ffa502' : '#2ed573',
      size: 16 + complexity * 6,
      speed: 1 + complexity * 0.3,
    };
  }

  // 生成随机弹幕
  private generateRandomDanmu(core: DanmuCoreFeatures): any {
    const bpm = core.tempo?.bpm || 0;
    const primaryInstrument = core.instruments?.primary || 'unknown';
    
    const randomTexts = [
      `🎵 ${primaryInstrument} 主导`,
      `🎶 音乐节拍: ${Math.round(bpm)} BPM`,
      `🎼 音色温暖`,
      `🎵 旋律优美`,
      `🎶 节奏感强`,
    ];

    return {
      text: randomTexts[Math.floor(Math.random() * randomTexts.length)],
      style: 'random',
      color: '#ffffff',
      size: 16,
      speed: 1,
    };
  }

  // 生成特征摘要（用于调试）
  generateFeatureSummary(core: DanmuCoreFeatures): string {
    const parts = [];
    
    if (core.tempo?.bpm) parts.push(`bpm=${Math.round(core.tempo.bpm)}`);
    if (core.instruments?.primary) parts.push(`instrument=${core.instruments.primary}`);
    if (core.voice?.probability) parts.push(`voice=${Math.round(core.voice.probability * 100)}%`);
    if (core.tempo?.beatStrength) parts.push(`beat=${Math.round(core.tempo.beatStrength * 100)}%`);
    
    return parts.join('; ');
  }

  // Get adapter status
  get isReady(): boolean {
    return this._isReady;
  }

  get danmuCount(): number {
    return this._danmuCount;
  }

  get pendingRequests(): number {
    return this._pendingRequests;
  }

  get currentStyle(): string | null {
    return this._currentStyle;
  }

  dispose(): void {
    this.stop();
    this.danmuCallback = null;
  }
}
