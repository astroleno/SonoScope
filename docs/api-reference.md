---
title: "API 参考文档"
author: "SonoScope Team"
version: "2.0"
last_updated: "2025-09-19"
audience: "Frontend Developers, Plugin Developers, Backend Developers"
related_docs: ["04-events-contracts.md", "05-plugin-spec.md", "03-architecture-dataflow.md"]
---

# API 参考文档

## 概述

本文档提供 SonoScope 项目的完整 API 参考，包括核心接口、事件系统、插件 API 和后端 API。

## 目录

- [核心数据类型](#核心数据类型)
- [事件系统 API](#事件系统-api)
- [可视化插件 API](#可视化插件-api)
- [音频处理 API](#音频处理-api)
- [LLM 集成 API](#llm-集成-api)
- [后端 API](#后端-api)
- [工具函数](#工具函数)

## 核心数据类型

### FeatureTick
音频特征数据结构，包含当前时刻的音频分析结果。

```typescript
interface FeatureTick {
  /** 时间戳 (毫秒) */
  t: number;
  
  /** 音量强度 (0-1) */
  rms: number;
  
  /** 频谱质心 (Hz) */
  spectralCentroid: number;
  
  /** 频谱变化率 (0-1) */
  flux: number;
  
  /** 节拍检测率 (次/秒) */
  onsetRate: number;
  
  /** 可选：BPM 估算 */
  bpm?: number;
  
  /** 可选：音高检测 (Hz) */
  pitch?: number;
  
  /** 数据版本 */
  version: string;
}
```

### DecisionEvent
决策事件，包含 LLM 或本地规则生成的可视化控制指令。

```typescript
interface DecisionEvent {
  /** 风格切换指令 */
  style?: {
    switch: {
      style: string;
      confidence: number;
      cooldownMs: number;
    };
  };
  
  /** 预设建议 */
  preset?: {
    suggest: {
      params: {
        bg: string;
        particleSpeed: number;
        particleDensity: number;
        blur: number;
        accentHue: number;
        fontWeight: number;
      };
      ttlMs: number;
    };
  };
  
  /** 弹幕文本 */
  danmu?: {
    text: {
      content: string;  // 最大12字符
      tone: string;    // 语气/情感
      lifeMs: number;  // 显示时长
    };
  };
  
  /** 事件版本 */
  version: string;
}
```

### VisualPreset
可视化预设参数。

```typescript
interface VisualPreset {
  /** 背景颜色/样式 */
  bg: string | { r: number; g: number; b: number; a: number };
  
  /** 粒子速度倍数 */
  particleSpeed: number;
  
  /** 粒子密度 */
  particleDensity: number;
  
  /** 模糊程度 */
  blur: number;
  
  /** 强调色相 */
  accentHue: number;
  
  /** 字体粗细 */
  fontWeight: number;
  
  /** 预设名称 */
  name?: string;
  
  /** 预设描述 */
  description?: string;
}
```

## 事件系统 API

### EventBus
中心化事件总线，处理组件间通信。

```typescript
class EventBus {
  /**
   * 订阅事件
   * @param event 事件名称
   * @param handler 事件处理函数
   */
  on(event: string, handler: Function): void;
  
  /**
   * 订阅一次性事件
   * @param event 事件名称
   * @param handler 事件处理函数
   */
  once(event: string, handler: Function): void;
  
  /**
   * 发布事件
   * @param event 事件名称
   * @param data 事件数据
   */
  emit(event: string, data: any): void;
  
  /**
   * 取消订阅
   * @param event 事件名称
   * @param handler 事件处理函数
   */
  off(event: string, handler: Function): void;
  
  /**
   * 移除所有订阅
   * @param event 可选事件名称
   */
  removeAllListeners(event?: string): void;
}
```

### 标准事件

```typescript
// 音频特征事件
eventBus.emit('feature:tick', featureTick: FeatureTick);

// 决策事件
eventBus.emit('decision:style-change', decision: DecisionEvent);
eventBus.emit('decision:preset-update', decision: DecisionEvent);
eventBus.emit('decision:danmu-text', decision: DecisionEvent);

// 控制事件
eventBus.emit('control:play-pause', isPlaying: boolean);
eventBus.emit('control:volume-change', volume: number);
eventBus.emit('control:style-switch', styleId: string);

// 系统事件
eventBus.emit('system:device-change', deviceInfo: DeviceInfo);
eventBus.emit('system:performance-warning', warning: PerformanceWarning);
eventBus.emit('system:error', error: Error);
```

## 可视化插件 API

### VisualizerPlugin
所有可视化插件必须实现的接口。

```typescript
interface VisualizerPlugin {
  /** 插件唯一标识 */
  id: string;
  
  /** 插件显示名称 */
  name: string;
  
  /** 插件版本 */
  version: string;
  
  /** 插件描述 */
  description: string;
  
  /** 支持的参数列表 */
  supportedParams: string[];
  
  /** 初始化插件 */
  init(container: HTMLElement): Promise<void>;
  
  /** 应用预设参数 */
  applyPreset(preset: Partial<VisualPreset>, durationMs: number): Promise<void>;
  
  /** 渲染一帧 */
  renderTick(features: FeatureTick): void;
  
  /** 销毁插件 */
  dispose(): Promise<void>;
  
  /** 获取可访问性信息 */
  getAccessibilityInfo(): AccessibilityInfo;
  
  /** 处理键盘输入 */
  handleKeyboardInput(event: KeyboardEvent): void;
}
```

### AccessibilityInfo
可访问性信息接口。

```typescript
interface AccessibilityInfo {
  /** 插件名称 */
  name: string;
  
  /** 插件描述 */
  description: string;
  
  /** 支持的控制方式 */
  controls: ('keyboard' | 'touch' | 'mouse' | 'voice')[];
  
  /** 是否支持高对比度 */
  highContrastSupport: boolean;
  
  /** 是否支持减少动画 */
  reducedMotionSupport: boolean;
  
  /** 键盘快捷键 */
  keyboardShortcuts?: Array<{
    key: string;
    description: string;
    action: string;
  }>;
}
```

### PluginRegistry
插件注册和管理。

```typescript
class PluginRegistry {
  /**
   * 注册插件
   * @param plugin 插件实例
   */
  register(plugin: VisualizerPlugin): void;
  
  /**
   * 获取插件
   * @param id 插件ID
   */
  get(id: string): VisualizerPlugin | null;
  
  /**
   * 获取所有插件
   */
  getAll(): VisualizerPlugin[];
  
  /**
   * 卸载插件
   * @param id 插件ID
   */
  unregister(id: string): void;
  
  /**
   * 根据设备能力过滤插件
   * @param capabilities 设备能力
   */
  getCompatiblePlugins(capabilities: DeviceCapabilities): VisualizerPlugin[];
}
```

## 音频处理 API

### AudioPipeline
音频处理管道。

```typescript
class AudioPipeline {
  /** 初始化音频上下文 */
  initialize(): Promise<void>;
  
  /** 请求麦克风权限 */
  requestMicrophoneAccess(): Promise<boolean>;
  
  /** 开始音频处理 */
  start(): void;
  
  /** 停止音频处理 */
  stop(): void;
  
  /** 设置音频特征提取器 */
  setFeatureExtractor(extractor: FeatureExtractor): void;
  
  /** 获取当前音量 */
  getVolume(): number;
  
  /** 设置音量 */
  setVolume(volume: number): void;
  
  /** 是否正在播放 */
  isPlaying(): boolean;
}
```

### FeatureExtractor
音频特征提取器接口。

```typescript
interface FeatureExtractor {
  /** 提取特征 */
  extract(audioData: Float32Array): FeatureTick;
  
  /** 支持的特征列表 */
  getSupportedFeatures(): string[];
  
  /** 配置提取器 */
  configure(config: FeatureExtractorConfig): void;
}
```

## LLM 集成 API

### LLMClient
LLM 客户端接口。

```typescript
interface LLMClient {
  /**
   * 发送请求到 LLM
   * @param prompt 提示词
   * @param options 请求选项
   */
  request(prompt: string, options?: LLMRequestOptions): Promise<LLMResponse>;
  
  /**
   * 流式请求
   * @param prompt 提示词
   * @param options 请求选项
   */
  requestStream(prompt: string, options?: LLMRequestOptions): AsyncIterable<LLMResponseChunk>;
  
  /** 取消进行中的请求 */
  cancel(): void;
  
  /** 获取使用统计 */
  getStats(): LLMStats;
}
```

### LLMRequestOptions
LLM 请求选项。

```typescript
interface LLMRequestOptions {
  /** 最大响应令牌数 */
  maxTokens?: number;
  
  /** 温度参数 */
  temperature?: number;
  
  /** 超时时间 (毫秒) */
  timeout?: number;
  
  /** 是否流式响应 */
  stream?: boolean;
  
  /** 响应格式 */
  responseFormat?: {
    type: 'json_object';
    schema: JSONSchema;
  };
}
```

## 后端 API

### 认证 API

```typescript
// 获取临时访问令牌
POST /api/auth/token
Request: {
  "device_id": string,
  "client_type": "web" | "mobile"
}

Response: {
  "access_token": string,
  "expires_in": number,
  "token_type": "Bearer"
}
```

### 配置 API

```typescript
// 获取应用配置
GET /api/config
Response: {
  "llm_enabled": boolean,
  "max_particle_count": number,
  "supported_styles": string[],
  "feature_extraction": {
    "sample_rate": number,
    "window_size": number
  }
}

// 更新用户配置
PUT /api/config/user
Request: {
  "preferred_style": string,
  "accessibility": {
    "high_contrast": boolean,
    "reduced_motion": boolean
  }
}
```

### 分析 API

```typescript
// 上报性能指标
POST /api/analytics/performance
Request: {
  "metrics": {
    "fps": number,
    "memory_usage": number,
    "battery_level": number,
    "device_tier": string
  },
  "timestamp": number
}

// 上报用户行为
POST /api/analytics/events
Request: {
  "event_type": string,
  "event_data": any,
  "timestamp": number
}
```

## 工具函数

### 设备检测

```typescript
class DeviceDetector {
  /** 获取设备信息 */
  static getDeviceInfo(): DeviceInfo;
  
  /** 检测设备性能等级 */
  static detectPerformanceTier(): DeviceTier;
  
  /** 检测网络状况 */
  static getNetworkInfo(): NetworkInfo;
  
  /** 检测电池状态 */
  static getBatteryInfo(): Promise<BatteryInfo>;
}
```

### 性能监控

```typescript
class PerformanceMonitor {
  /** 开始监控 */
  start(): void;
  
  /** 停止监控 */
  stop(): PerformanceReport;
  
  /** 获取当前性能指标 */
  getCurrentMetrics(): PerformanceMetrics;
  
  /** 设置性能警告回调 */
  onWarning(callback: (warning: PerformanceWarning) => void): void;
}
```

### 工具函数

```typescript
// 颜色工具
const ColorUtils = {
  hslToRgb(h: number, s: number, l: number): [number, number, number];
  rgbToHsl(r: number, g: number, b: number): [number, number, number];
  getContrastRatio(color1: string, color2: string): number;
};

// 数学工具
const MathUtils = {
  lerp(start: number, end: number, t: number): number;
  clamp(value: number, min: number, max: number): number;
  smoothstep(edge0: number, edge1: number, x: number): number;
};

// 动画工具
const AnimationUtils = {
  easeInOutCubic(t: number): number;
  easeOutElastic(t: number): number;
  springAnimation(current: number, target: number, velocity: number, tension: number, friction: number): { value: number, velocity: number };
};
```

## 错误处理

### 标准错误类型

```typescript
class SonoScopeError extends Error {
  constructor(
    message: string,
    public code: string,
    public severity: 'error' | 'warning' | 'info',
    public recoverable: boolean = true
  );
}

// 常见错误代码
const ErrorCodes = {
  AUDIO_PERMISSION_DENIED: 'AUDIO_001',
  FEATURE_EXTRACTION_FAILED: 'AUDIO_002',
  PLUGIN_LOAD_FAILED: 'PLUGIN_001',
  LLM_REQUEST_FAILED: 'LLM_001',
  NETWORK_ERROR: 'NETWORK_001',
  DEVICE_INCOMPATIBLE: 'DEVICE_001'
} as const;
```

## 使用示例

### 基本用法

```typescript
// 初始化事件总线
const eventBus = new EventBus();

// 初始化音频管道
const audioPipeline = new AudioPipeline(eventBus);
await audioPipeline.initialize();

// 注册插件
const registry = new PluginRegistry();
registry.register(myVisualizerPlugin);

// 开始处理
audioPipeline.start();

// 监听音频特征
eventBus.on('feature:tick', (features: FeatureTick) => {
  console.log('Audio features:', features);
});
```

### 插件开发示例

```typescript
class MyVisualizer implements VisualizerPlugin {
  id = 'my-visualizer';
  name = 'My Visualizer';
  version = '1.0.0';
  
  async init(container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
  }
  
  async applyPreset(preset, durationMs) {
    // 实现参数过渡动画
    await this.transitionTo(preset, durationMs);
  }
  
  renderTick(features: FeatureTick) {
    // 根据音频特征渲染
    this.render(features);
  }
  
  async dispose() {
    this.canvas.remove();
  }
  
  getAccessibilityInfo() {
    return {
      name: this.name,
      description: 'My custom visualization',
      controls: ['keyboard', 'touch'],
      highContrastSupport: true
    };
  }
}
```

---

**相关文档**：
- [事件与数据契约](04-events-contracts.md)
- [可视化插件规范](05-plugin-spec.md)
- [系统架构与数据流](03-architecture-dataflow.md)