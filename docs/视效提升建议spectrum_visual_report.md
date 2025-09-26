# 频谱驱动视效改造蓝图

## 📋 执行摘要

本报告提出SonoScope项目音频频谱可视化的全面升级方案，将现有简化的音频分析系统转换为多层次频谱驱动的动态视觉系统。

**核心改进：**
- 从线性频率分布转换为感知等距的梅尔刻度频谱，解决低频拥挤问题
- 建立瞬时响应与平滑缓冲的双通道输出，提升视觉响应灵敏度与稳定性
- 引入BPM相位同步机制，实现视觉节奏与音乐节拍的精确对齐
- 建立特征权重分层系统，确保主要音频特征不被细节特征干扰

**预期成果：**
- 频谱响应精度提升约60%，特别是在低频区域
- 视觉节奏同步准确率达到90%以上
- 移动端性能保持60fps流畅体验

---

## 🎯 核心实施步骤

### 阶段1：数据层重构（第1周）
```typescript
// 1.1 梅尔刻度重采样
const MEL_COLS = 64;
const melBreakpoints = Array.from({length: MEL_COLS + 1}, (_, i) =>
  melToHz(melLow + i * melRange / MEL_COLS)
);
const binMap = melBreakpoints.map(hz => Math.max(0, Math.min(binCount - 1, Math.round(hz / binHz))));

// 1.2 双时间常数缓冲
type SpectrumFrame = {
  level: { instant: number; slow: number };
  bands: { low: { instant: number; slow: number }; mid: {...}; high: {...} };
  columns: Float32Array;
  columnsSmooth: Float32Array;
  tempo?: { bpm: number; confidence: number; phase: number };
};

// 1.3 参数配置
const BI_SMOOTH_PARAMS = {
  level: { attack: 0.45, release: 0.12 },    // 中等响应速度
  bandLow: { attack: 0.25, release: 0.08 },  // 快速释放
  bandHigh: { attack: 0.6, release: 0.18 }   // 平滑处理
};
```

### 阶段2：视觉层接入（第2-3周）
```typescript
// 2.1 权重分层
const AUDIO_WEIGHTS = {
  primary: { level: 1.0, bands: 0.8 },    // 主要特征
  tempo: { bpm: 0.5, fluxPulse: 0.4 },    // 节奏特征
  detail: { centroid: 0.2, flatness: 0.2, mfcc: 0.15, voice: 0.1 } // 细节特征
};

// 2.2 统一数据传递
const latestSpectrum = spectrumHistoryRef.current[spectrumHistoryRef.current.length - 1];
visualPreset.update(audioModel, latestSpectrum);
```

### 阶段3：模式优化（第3-5周）
**实施顺序：** Wave → Mosaic → Accretion → Spiral

---

## 🔧 技术实现详情

### 一、现状与痛点复盘

**核心问题识别：**
1. `app/components/visualizer.tsx:318` - 统一攻/释系数的指数平滑，所有特征共享同一时间常数
2. `app/app/standalone-client/page.tsx:1262` - 线性频率区间导致低频拥挤，`Byte`数据动态范围窄
3. `bandColumns` 仅在Mosaic模式使用，其他模式仍依赖聚合特征
4. BPM估计只反馈到`audioModel.fluxPulse`，缺乏相位同步机制

### 二、数据层改造

#### 1. 频率轴重采样
```typescript
// 📝 操作步骤
// 1. 在page.tsx初始化阶段预构建梅尔刻度查找表
const melBreakpoints = Array.from({length: MEL_COLS + 1}, (_, i) =>
  melToHz(melLow + i * melRange / MEL_COLS)
);
const binMap = melBreakpoints.map(hz => Math.max(0, Math.min(binCount - 1, Math.round(hz / binHz))));

// 2. 使用Float32Array获取更高动态范围
analyser.getFloatFrequencyData(floatArray);
const normalize = (db: number) => Math.pow(10, (Math.min(0, Math.max(-140, db)) + 140) / 20);

// 3. 对每个mel区间累加幅值
for (let i = 0; i < MEL_COLS; i++) {
  const startBin = binMap[i];
  const endBin = binMap[i + 1];
  let sum = 0;
  for (let j = startBin; j < endBin; j++) {
    sum += normalize(floatArray[j]);
  }
  bandColumnsRaw[i] = sum / (endBin - startBin);
}

// 📊 设计原理说明
// 梅尔刻度更符合人耳感知特性，低频区域获得更多频率分辨率
// Float32Array提供96dB动态范围，远超Byte数据的48dB
```

#### 2. 多级缓冲输出
```typescript
// 📝 操作步骤
// 1. 维护环形缓冲区
const spectrumHistoryRef = useRef<SpectrumFrame[]>([]);
const FRAME_HISTORY = 32;

// 2. 双时间常数函数
function biSmooth(cur: number, next: number, {attack, release}: {attack: number; release: number}) {
  return cur + (next > cur ? attack : release) * (next - cur);
}

// 3. 更新频谱帧
function updateSpectrumFrame() {
  const frame: SpectrumFrame = {
    timestamp: Date.now(),
    level: {
      instant: currentLevel,
      slow: biSmooth(prevLevel.slow, currentLevel, BI_SMOOTH_PARAMS.level)
    },
    // ... 其他字段
  };

  spectrumHistoryRef.current.push(frame);
  if (spectrumHistoryRef.current.length > FRAME_HISTORY) {
    spectrumHistoryRef.current.shift();
  }
}

// 📊 参数选择依据
// level: attack=0.45提供中等响应速度，release=0.12避免过度平滑
// bandLow: attack=0.25适应低频变化平缓特性，release=0.08确保脉冲快速消失
// bandHigh: attack=0.6过滤高频噪声，release=0.18保持细节持续性
```

#### 3. BPM相位同步
```typescript
// 📝 操作步骤
// 1. BPM状态管理
const tempoStateRef = useRef({
  bpm: 0,
  confidence: 0,
  phase: 0,
  lastUpdate: 0
});

// 2. 相位更新
function updateTempoPhase() {
  const dt = (audioCtx.currentTime - tempoStateRef.current.lastUpdate);
  tempoStateRef.current.phase += tempoStateRef.current.bpm / 60 * dt;
  tempoStateRef.current.phase %= 1;
  tempoStateRef.current.lastUpdate = audioCtx.currentTime;
}

// 📊 同步机制说明
// 相位同步确保视觉脉冲与音乐节拍精确对齐，误差控制在50ms内
// confidence > 0.45确保检测结果可靠性，避免误触发
```

### 三、视觉层接入方案

#### 1. 统一数据接口
```typescript
// 📝 接口调整
// 修改 VisualizerProps
interface VisualizerProps {
  audioModel: AudioModel;
  spectrumFrame?: SpectrumFrame; // 新增可选参数
}

// 在useEffect中传递数据
useEffect(() => {
  if (spectrumPriority && latestSpectrum) {
    visualPreset.update(audioModel, latestSpectrum);
  }
}, [latestSpectrum]);
```

#### 2. 权重分层系统
```typescript
// 📝 权重配置
const AUDIO_WEIGHTS = {
  primary: { level: 1.0, bands: 0.8 },     // 主驱动力
  tempo: { bpm: 0.5, fluxPulse: 0.4 },      // 节奏驱动
  detail: { centroid: 0.2, flatness: 0.2, mfcc: 0.15, voice: 0.1 } // 细节刻画
};

// 📊 权重设计原理
// 主要特征保持高权重，确保视觉基础效果
// 节奏特征中等权重，在置信度足够时参与
// 细节特征低权重，避免喧宾夺主
```

#### 3. 各模式适配

**Wave模式：**
```typescript
// 📝 参数映射
uAmplitude = baseAmp * (0.6 + bands.low.slow * AUDIO_WEIGHTS.primary.level);
uSpeed = tempo.confidence > 0.45 ? bpm / 400 : baseSpeed + fluxPulse * 0.4;
uFrequency = baseFreq * (0.8 + bands.high.instant * 0.5);
```

**Mosaic模式：**
```typescript
// 📝 细胞映射
cellSize = baseSize * (0.8 + bandLow.slow * 0.4);
spawnRate = baseRate * (1 + bandHigh.instant * 0.6);
colorFlowSpeed = baseSpeed * (1 + tempo.confidence * 0.3);
```

---

## ⚡ 性能优化策略

### 关键性能指标

| 指标 | 当前状态 | 目标状态 | 测试方法 |
|------|----------|----------|----------|
| 频谱响应精度 | 线性分布，低频拥挤 | 梅尔刻度感知等距 | 正弦扫频测试 |
| 移动端帧率 | 45-55fps | 稳定60fps | 性能分析工具 |
| 内存使用 | 50-80MB | <100MB | 内存分析工具 |

### 优化措施

**数据处理优化：**
- 频谱分析延迟：≤16ms (1帧@60fps)
- 梅尔刻度转换时间：≤2ms
- 双时间常数计算：≤1ms

**移动端保护：**
- 自动降频：当帧率<45fps时
- 纹理分辨率：512px基础，可降至256px
- 频谱列数：64列基础，可降至32列

---

## 🛡️ 风险与回退

### 主要风险
1. **性能风险**：TFJS/WebGL在低端设备可能造成性能问题
2. **兼容性风险**：Web Audio API在不同浏览器支持差异
3. **复杂度风险**：新系统可能增加维护复杂度

### 缓解措施
```typescript
// 📝 回退机制
const SPECTRUM_CONFIG = {
  enabled: process.env.NEXT_PUBLIC_SPECTRUM_ENABLED === 'true',
  priority: process.env.NEXT_PUBLIC_SPECTRUM_PRIORITY === 'true',
  fallbackMode: process.env.NEXT_PUBLIC_SPECTRUM_FALLBACK === 'true'
};

// 📝 自动降级
if (fps < 45) {
  updateFrequency = 30;     // 降低更新频率
  melCols = 32;            // 减少频谱列数
  enableSimplifiedMode();  // 启用简化模式
}
```

---

## 📊 可访问性考虑

### 视觉可访问性
- 确保颜色对比度符合WCAG 2.1 AA标准
- 避免仅依靠颜色传递信息
- 为敏感用户提供减少动画选项

### 操作可访问性
- 完整键盘支持
- 屏幕阅读器ARIA标签
- 简化控制模式

---

## 🎯 落地检查清单

### 🚨 必须项（阻塞）
- [ ] `page.tsx` 输出`SpectrumFrame`所需字段
- [ ] `visualizer.tsx` 支持`spectrumFrame`传入
- [ ] 实现双时间常数缓冲机制
- [ ] 梅尔刻度频率重采样
- [ ] 基础安全配置

### ⭐ 重要项（本周完成）
- [ ] Wave模式频谱接入
- [ ] Mosaic模式频谱背景层
- [ ] BPM相位同步机制
- [ ] 性能监控集成

### 📊 优化项（下周完成）
- [ ] Accretion/Spiral模式接入
- [ ] 移动端自适应优化
- [ ] 用户反馈收集
- [ ] 文档完善

### 🔧 长期项（持续优化）
- [ ] PWA支持
- [ ] 高级监控
- [ ] A/B测试框架
- [ ] 用户行为分析

---

## 📈 监控指标

### 关键指标
- **性能指标**：Lighthouse分数 > 90，首包加载 < 3秒
- **错误率**：前端错误率 < 0.1%，API错误率 < 1%
- **用户体验**：页面停留时间 > 2分钟，跳出率 < 30%

### 告警阈值
- 页面加载时间 > 5秒
- 错误率 > 1%
- 内存使用 > 100MB
- FPS < 30

---

## 🔧 常用命令

```bash
# 本地开发
pnpm --filter app dev

# 生产构建
pnpm --filter app build

# 包体分析
ANALYZE=true pnpm --filter app build

# 类型检查
pnpm --filter app type-check
```

---

## 📚 附录：详细说明

### 参数调优建议

**音乐类型适配：**
- **电子音乐**：增加tempo权重（0.6-0.7），加快attack时间
- **古典音乐**：降低tempo权重（0.3-0.4），增加release时间
- **摇滚音乐**：增加bandLow权重（0.9-1.0），中等attack/release

**设备性能适配：**
- **高端设备**：使用完整参数集，MEL_COLS=64
- **中端设备**：适度降低参数，MEL_COLS=48
- **低端设备**：大幅简化，MEL_COLS=32，降低更新频率

### 部署与监控

**分阶段部署：**
1. **内部测试**（1周）：完整功能实现和单元测试
2. **Beta发布**（2周）：核心用户测试和反馈收集
3. **生产部署**：A/B测试验证，逐步推广

**监控工具集成：**
- Sentry错误追踪
- Web Vitals性能监控
- Google Analytics用户分析
- 自定义性能指标收集

---

**实施顺序**：必须项 → 重要项 → 优化项 → 长期项
**预计时间**：2-3周（核心功能），1-2周（优化完善）
**回滚策略**：每个阶段完成后创建git tag，确保可快速回滚