# SonoScope 声象

> 基于浏览器的实时音乐可视化与弹幕引擎

当前实施版的入口为 `/SonoScope`。共享运行时、流式协议、安全配额与实际验收状态见 [上线验收](docs/launch-validation.md) 和 [部署指南](docs/部署指南.md)；旧阶段报告中的功能完整性声明不作为本版发布证据。

## 🎯 项目简介

SonoScope 将浏览器采集的声音转换为画面与弹幕。本地分析直接驱动画面和短反馈；可选的 AI 服务只接收当前声音摘要与最近弹幕，逐条返回评论。

## ✨ 核心特性

- 🎵 **实时音频分析** - 支持 RMS、频谱质心、通量、节拍检测等特征提取
- 🎼 **及时声学反馈** - 默认从音量、频谱与变化生成本地描述，不等待分类模型或网络；SDK 保留显式启用的 YAMNet 分类路径
- 🎨 **可视化插件系统** - 基于 p5.js 的可插拔可视化场景
- 💬 **混合弹幕** - 本地与 AI 共用有界队列，取消、过期、去重与实际显示计数统一处理
- ⏺️ **内部录播与回看** - 保存当前音源、全部实际上屏的弹幕和视觉操作，支持暂停、定位、倍速及本地备份恢复；实际平台验收见[录播验证](docs/internal-recording-replay-validation.md)
- 📱 **响应式控制** - 保留完整预设名称，支持缩放；真实手机验收状态见上线验收记录
- ♿ **无障碍控制** - 可见焦点、预设方向键、明确开关、减少动态和可读弹幕记录
- 🔧 **热插拔架构** - 统一数据契约，支持插件动态加载

## 🏗️ 项目结构

```
SonoScope/
├── app/                    # Next.js 主应用
├── packages/
│   ├── core/              # 核心功能包 (事件总线、数据契约、状态管理)
│   ├── sdk/               # 音频会话、特征 Worker 与共享运行时
│   ├── danmu-pipeline/    # 单一队列、显示回执与流式客户端
│   ├── visuals-basic/     # 基础粒子可视化插件
│   ├── visuals-trap/      # Trap 风格可视化插件
│   └── shared/            # 共享类型和工具
├── docs/                  # 技术文档
├── app/public/            # Next.js 应用静态资源（含 TFLite 模型）
├── deploy/                # 单实例 Node 服务与 nginx 配置模板
└── test/launch/           # 当前发布链路的回归测试
```

## 🚀 快速开始

### 环境要求

- Node.js 22.13+
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

1. **启动应用** - 访问 `http://localhost:3000/SonoScope`
2. **选择声音输入** - 点击“开启麦克风”授权，或选择本地音频文件
3. **查看本地反馈** - 默认声学模式无需下载分类模型；静音时不会为凑首条而填充评论。
4. **选择可视化** - 选择 Wave / Accretion / Spiral / Mosaic / Mochi；预设与声音启停互相独立
5. **享受效果** - 播放音乐或发出声音，观看实时可视化

### 录制与回看

声音开始后点击“开始录制”，结束时点击“停止并保存”。从“我的录播”打开会话，可暂停、拖动、调整倍速，或在完整弹幕记录中点击某条文字定位。关闭声音或文件自然结束也会收尾；页面隐藏或系统中断时停止输入并尽力保留可播放内容，列表会说明中断状态。

录播保存原音频、实际显示的文字与视觉状态，在 SS 内按媒体时间重放。它会适应当前屏幕，不是逐帧视频导出。回看读取原记录，不重新生成弹幕或调用 AI。

本地录播属于当前站点、浏览器和用户配置。清理站点数据、换浏览器或更换站点地址后，原列表不会自动迁移。可在录播库导出 `.ssrec.zip` 备份，再通过“恢复备份”导入；跨设备能否播放还取决于录音格式。已加载页面可读取本地录播，断网冷启动尚未提供应用壳缓存。

移动端与桌面端仍是最终目标，具体通过项和未完成项见[平台矩阵](docs/recording-platform-matrix.md)。窄屏模拟不能代替手机实测。

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
- **捕获／FFT 大小**: 1024，使用设备实际采样率
- **分类输入（显式启用时）**: 连续约1秒 PCM，按采样率重采样至16kHz；默认声学模式不启动分类 Worker
- **特征窗口**: 2秒 (LLM 分析窗口)

### 性能设置
- **目标帧率**: 桌面 60fps，移动端 30fps
- **分析降级**: Worker 错误或超时后继续基础 DSP；未知声音分类不填模板结果
- **停止策略**: 取消请求、释放音频与 Worker、清空显示队列，拒绝旧会话结果

## 📱 移动端支持

AudioContext 在明确的用户操作中激活；控制支持窄屏、触摸与减少动态。桌面浏览器的尺寸模拟不能替代 iOS Safari / Android Chrome 实机测试，实际验收记录见 `docs/launch-validation.md`。

## ♿ 无障碍功能

- **键盘导航**: 完整的 Tab 键导航支持
- **屏幕阅读器**: ARIA 标签和实时区域
- **高对比度**: 支持系统高对比度模式
- **减少动画**: 可选的动画减少选项

## 🔒 隐私与安全

- **本地优先**: 默认音频留在浏览器；模型与 WASM 从同源加载
- **数据最小化**: 仅传输音频特征，不传输原始音频
- **用户控制**: 明确的云端功能开关
- **安全传输**: 所有网络通信使用 TLS

## 📊 验收目标

有效特征帧到实际画面 p95 ≤100ms，本地首条显示 p95 ≤1s，AI 请求到首条显示 p95 ≤3s，整批截止8s。桌面与真实目标手机各持续运行30分钟。以上是目标，测量口径与已取得的证据见 `docs/launch-validation.md`，不以模拟测试证明设备性能。

## 🔁 当前模型集成状态（重要）

- 当前模型：`app/public/model/yamnet-1.tflite`，官方 float32 版本1，约4 MB；来源与校验值在同目录 `assets.json`。
- 加载与真实分类入口：`app/lib/workers/features.worker.ts`；DSP 单独运行，不被模型加载阻塞。
- `FeaturePipeline` 只合并当前会话的近期结果，再写入两秒摘要交给弹幕服务。加载失败或超时明确降级，分类字段为空。
- `standalone-client` 是兼容入口，跳转到共享主页面，不再单独维护模型链路。

### 本地开发端口

- 默认 `http://localhost:3000`；如占用会自动递增（例如 `3001/3002/3003`）。

### 排错指引

- 若声音分类不可用，请检查：
  - `/SonoScope/model/yamnet-1.tflite` 与 `/SonoScope/vendor/mediapipe-audio-1.1.0/wasm/` 下资源能从同源加载；
  - 浏览器权限：麦克风已授权；
  - 网络与缓存：清理缓存后重试。

## 🛠️ 开发工具

- **TypeScript / ESLint**：发布前类型与静态检查
- **Vitest**：实际 DSP、会话生命周期、流式服务、配额与 UI 回归
- **浏览器验收**：生产产物、真实模型、显示回执与实际绘制统计

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
