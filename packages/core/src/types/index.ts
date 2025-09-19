/**
 * SonoScope 核心类型定义
 * 包含所有事件、状态和插件的类型定义
 */

// 基础时间戳类型
export type Timestamp = number;

// 音频特征数据
export interface FeatureTick {
  /** 时间戳 (毫秒) */
  t: Timestamp;
  /** RMS 音量 (0-1) */
  rms: number;
  /** 频谱质心 (Hz) */
  centroid: number;
  /** 频谱通量 (0-1) */
  flux: number;
  /** 节拍检测率 (/s) */
  onsetRate: number;
  /** BPM (可选，仅在稳定时提供) */
  bpm?: number;
  /** 音高 (可选，仅在稳定时提供) */
  pitch?: number;
  /** 版本号 */
  version: string;
}

// 可视化预设参数
export interface VisualPreset {
  /** 背景颜色 */
  bg: string;
  /** 粒子速度 */
  particleSpeed: number;
  /** 粒子密度 */
  particleDensity: number;
  /** 模糊强度 */
  blur: number;
  /** 强调色相 */
  accentHue: number;
  /** 字体粗细 */
  fontWeight: number;
}

// 决策事件类型
export type DecisionEventType = 'style.switch' | 'preset.suggest' | 'danmu.text';

// 风格切换决策
export interface StyleSwitchDecision {
  type: 'style.switch';
  style: string;
  confidence: number;
  cooldownMs: number;
}

// 预设建议决策
export interface PresetSuggestDecision {
  type: 'preset.suggest';
  params: Partial<VisualPreset>;
  ttlMs: number;
}

// 弹幕文本决策
export interface DanmuTextDecision {
  type: 'danmu.text';
  text: string;
  tone: 'positive' | 'neutral' | 'negative';
  lifeMs: number;
}

// 决策事件联合类型
export type DecisionEvent = StyleSwitchDecision | PresetSuggestDecision | DanmuTextDecision;

// 可视化插件接口
export interface VisualPlugin {
  /** 插件名称 */
  name: string;
  /** 插件版本 */
  version: string;
  /** 插件能力声明 */
  capabilities: string[];
  /** 支持的参数列表 */
  supportedParams: (keyof VisualPreset)[];
  
  /** 初始化插件 */
  init(container: HTMLElement): Promise<void>;
  /** 应用预设参数 */
  applyPreset(preset: Partial<VisualPreset>, durationMs: number): Promise<void>;
  /** 渲染音频特征 */
  renderTick(featureTick: FeatureTick): void;
  /** 清理资源 */
  dispose(): void;
}

// 事件总线事件类型（已移至 event-bus.ts）

// 状态管理器状态
export interface AppState {
  /** 当前音频状态 */
  audio: {
    isActive: boolean;
    isInitialized: boolean;
    hasPermission: boolean;
  };
  /** 当前可视化状态 */
  visual: {
    currentPlugin: string | null;
    currentPreset: Partial<VisualPreset>;
    isRendering: boolean;
  };
  /** 当前弹幕状态 */
  danmu: {
    isActive: boolean;
    queue: string[];
    lastGenerated: Timestamp;
  };
  /** 性能状态 */
  performance: {
    fps: number;
    memory: number;
    latency: number;
  };
}

// 配置选项
export interface SonoScopeConfig {
  /** 音频配置 */
  audio: {
    fftSize: number;
    hopLength: number;
    smoothingTimeConstant: number;
  };
  /** 可视化配置 */
  visual: {
    targetFps: number;
    maxParticles: number;
    enableWebGL: boolean;
  };
  /** LLM 配置 */
  llm: {
    enabled: boolean;
    apiKey?: string;
    endpoint?: string;
    frequency: number;
    timeout: number;
  };
  /** 无障碍配置 */
  accessibility: {
    highContrast: boolean;
    reducedMotion: boolean;
    screenReader: boolean;
  };
}

// 错误类型
export class SonoScopeError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SonoScopeError';
  }
}

// 性能指标
export interface PerformanceMetrics {
  /** 首屏时间 */
  ttfb: number;
  /** 帧率 */
  fps: number;
  /** LLM 响应时间 */
  llmRtt: number;
  /** 风格切换次数 */
  styleSwitchCount: number;
  /** 降级率 */
  fallbackRate: number;
}
