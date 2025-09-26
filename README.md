# SonoScope 声象

> 基于浏览器的实时音乐可视化与弹幕引擎

## 🎯 项目简介

SonoScope 是一个移动优先的实时音乐可视化系统，能够将音频特征转换为动态视觉效果和智能弹幕。项目采用双环路架构：本地快环提供即时可视化反馈，慢环通过 LLM 生成风格化弹幕和参数建议。

## ✨ 核心特性

- 🎵 **实时音频分析** - 支持 RMS、频谱质心、通量、节拍检测等特征提取
- 🎼 **乐器识别融合** - Mediapipe YAMNet + Meyda 双通道，实时输出主唱/乐器标签并驱动弹幕
- 🎨 **可视化插件系统** - 基于 p5.js 的可插拔可视化场景
- 💬 **智能弹幕** - 本地句库 + GLM-4.5 增强的弹幕生成
- 📱 **移动端优化** - 针对 iOS Safari 和 Chrome 的深度优化
- ♿ **无障碍设计** - 完整的键盘导航和屏幕阅读器支持
- 🔧 **热插拔架构** - 统一数据契约，支持插件动态加载

## 🏗️ 项目结构

```
SonoScope/
├── app/                    # Next.js 主应用
├── packages/
│   ├── core/              # 核心功能包 (事件总线、数据契约、状态管理)
│   ├── visuals-basic/     # 基础粒子可视化插件
│   ├── visuals-trap/      # Trap 风格可视化插件
│   └── shared/            # 共享类型和工具
├── docs/                  # 技术文档
├── public/                # 静态资源（部署到 Vercel 时使用）
├── app/public/            # Next.js 应用静态资源（含 TFLite 模型）
└── edge/                  # Vercel Edge Functions
```

## 🚀 快速开始

### 环境要求

- Node.js 18+
- pnpm 8+
- 现代浏览器 (支持 Web Audio API)

### 安装依赖

```bash
# 安装所有依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建生产版本
pnpm build
```

### 开发命令

```bash
# 启动开发服务器
pnpm dev

# 构建所有包
pnpm build

# 运行测试
pnpm test

# 代码检查
pnpm lint

# 类型检查
pnpm type-check
```

## 📖 使用指南

### 基础使用

1. **启动应用** - 访问 `http://localhost:3000`
2. **授权麦克风** - 点击"开始"按钮授权音频访问
3. **确认模型已加载** - 浏览器应能访问 `http://localhost:3000/model/yamnet_tflite/yamnet.tflite`
4. **选择可视化** - 从插件列表中选择可视化场景
5. **享受效果** - 播放音乐或发出声音，观看实时可视化

### 开发者指南

#### 创建新的可视化插件

```typescript
// packages/visuals-example/src/index.ts
import { VisualPlugin } from '@sonoscope/core';

export const examplePlugin: VisualPlugin = {
  name: 'example',
  version: '1.0.0',
  
  async init(container: HTMLElement) {
    // 初始化 p5.js 场景
  },
  
  async applyPreset(preset: Partial<VisualPreset>, duration: number) {
    // 应用预设参数
  },
  
  renderTick(featureTick: FeatureTick) {
    // 渲染音频特征
  },
  
  dispose() {
    // 清理资源
  }
};
```

#### 事件系统使用

```typescript
import { EventBus, FeatureTick } from '@sonoscope/core';

const eventBus = new EventBus();

// 监听音频特征
eventBus.on('featureTick', (tick: FeatureTick) => {
  console.log('RMS:', tick.rms, 'Centroid:', tick.centroid);
});

// 发送决策事件
eventBus.emit('decisionEvent', {
  type: 'style.switch',
  style: 'energetic',
  confidence: 0.8
});
```

## 🎨 可视化插件

### 基础粒子 (Basic Particles)
- 基于 RMS 的粒子密度变化
- 频谱质心控制颜色变化
- 节拍检测触发粒子爆发

### Trap 风格 (Trap Style)
- 低音响应的大粒子效果
- 高对比度色彩方案
- 节拍同步的几何变换

## 🔧 配置选项

### 音频参数
- **FFT 大小**: 2048 (平衡性能和精度)
- **跳跃长度**: 512 (控制更新频率)
- **特征窗口**: 2秒 (LLM 分析窗口)

### 性能设置
- **目标帧率**: 桌面 60fps，移动端 30fps
- **粒子密度**: 自适应设备性能
- **降级策略**: 弱设备自动降低复杂度

## 📱 移动端支持

### iOS Safari 优化
- 手势激活 AudioContext
- WebGL 降级处理
- 内存管理优化

### Android Chrome 优化
- 硬件加速检测
- 电池优化模式适配
- 触摸交互增强

## ♿ 无障碍功能

- **键盘导航**: 完整的 Tab 键导航支持
- **屏幕阅读器**: ARIA 标签和实时区域
- **高对比度**: 支持系统高对比度模式
- **减少动画**: 可选的动画减少选项

## 🔒 隐私与安全

- **本地优先**: 默认仅本地处理，无网络传输
- **数据最小化**: 仅传输音频特征，不传输原始音频
- **用户控制**: 明确的云端功能开关
- **安全传输**: 所有网络通信使用 TLS

## 📊 性能指标

- **首屏加载**: < 1秒
- **首条弹幕**: < 1秒
- **可视化延迟**: 20-60ms
- **YAMNet 推理频率（TFLite wasm）**: 2–4Hz（移动端稳定）
- **YAMNet 单次时延（TFLite wasm）**: 50–150ms（设备差异）
- **LLM 响应**: 0.5–2Hz
- **内存使用**: < 100MB（移动端）

## 🔁 当前模型集成状态（重要）

- 已采用 **TFLite Web（wasm）** 方案集成 YAMNet，移动端兼容性更好、首包更友好。
- 模型文件路径：`app/public/model/yamnet_tflite/yamnet.tflite`（已内置，约 15MB）。
- 页面加载逻辑：优先 TFLite → 失败时回退 TFJS GraphModel（如后续提供）→ 最终回退启发式，不阻塞主功能。
- 代码位置：`app/app/standalone-client/page.tsx` 中的 `loadYAMNetModel()` 与分类调用逻辑。

### 本地开发端口

- 默认 `http://localhost:3000`；如占用会自动递增（例如 `3001/3002/3003`）。

### 排错指引

- 若控制台未出现 “YAMNet (TFLite) 加载成功”，请检查：
  - `http://localhost:3000/model/yamnet_tflite/yamnet.tflite` 可直接下载（非 XML/HTML）；
  - 浏览器权限：麦克风已授权；
  - 网络与缓存：清理缓存后重试。

## 🛠️ 开发工具

- **Storybook**: 插件开发和调试
- **TypeScript**: 完整类型支持
- **ESLint + Prettier**: 代码质量保证
- **Jest**: 单元测试
- **Playwright**: E2E 测试

## 📚 文档

- [项目概述](docs/01-overview-scope.md)
- [系统架构](docs/03-architecture-dataflow.md)
- [事件契约](docs/04-events-contracts.md)
- [插件规范](docs/05-plugin-spec.md)
- [LLM 策略](docs/05-llm-strategy.md)
- [无障碍指南](docs/06-cross-cutting-concerns.md)

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🆘 支持

- 📧 邮箱: support@sonoscope.dev
- 🐛 问题反馈: [GitHub Issues](https://github.com/your-org/sonoscope/issues)
- 💬 讨论: [GitHub Discussions](https://github.com/your-org/sonoscope/discussions)

---

**SonoScope** - 让声音可视化，让音乐有画面 🎵✨
