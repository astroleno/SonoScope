# 声象 SonoScope - 产品需求文档 v2.0

## 一、项目概述

**名称**：声象 SonoScope

**定位**：基于浏览器的实时音乐可视化与弹幕引擎，面向 Web 与移动端。

**核心思路**：双环路架构——本地快环做音频特征驱动的即时可视化，慢环由 LLM 基于特征生成风格化弹幕与参数建议。

**设计原则**：Web 可用、移动适配、特征丰富、易上手、易部署、可插拔、**可访问性优先**。

## 二、目标与价值

### 目标

在普通手机浏览器中实现稳定的实时可视化，首屏接入与首条弹幕均小于 1 秒。

通过统一数据契约与可视化插件规范，实现多套 p5 场景的热插拔。

用 GLM-4.5 完成"选择与短文本生成"，控制成本与延迟。

**实现 WCAG 2.1 AA 级别的无障碍访问标准，确保所有用户群体都能使用产品。**

### 价值

**对开发者**：最短路径把"声音→画面/文字"跑起来，后续扩展更换模型或场景不改主干，完善的文档和开发工具链。

**对用户**：在移动端也能顺畅体验，弱网或离线仍有稳定反馈，**包括残障用户在内的所有用户都能无障碍使用**。

## 三、用户画像与典型场景

### 用户画像

音视频创作者、直播与活动运营、互动装置团队、教育演示、**视障/听障用户、老年人用户、临时性损伤用户**。

### 典型场景

现场音乐或音轨播放，页面立即呈现随节奏变化的粒子与字幕弹幕。

切换不同视觉主题，画面平滑过渡，不中断音乐。

弱网时仍有本地句库弹幕与可视化微反馈。

**用户通过键盘完全控制所有功能，屏幕阅读器用户能获得完整的音频反馈和界面描述。**

**听障用户能通过视觉化效果和字幕体验音乐内容。**

## 四、范围与优先级

### V1 MVP（必做）

拾音接入与权限引导（浏览器、移动端手势解锁音频）

Meyda 等本地特征：rms、spectralCentroid、spectralFlux、onsetRate、pitch（条件更新）、bpm（简单估计或空）

事件总线与数据契约：FeatureTick、DecisionEvent

可视化插件系统：至少两套 p5 场景，支持 applyPreset 插值切换

弹幕系统：本地句库为主，GLM-4.5 为辅；JSON Schema 约束输出

**完整键盘导航支持、屏幕阅读器兼容、基本的无障碍UI组件**

### V1.1（次优先）

更稳健的 BPM/打点、可视化插件商店式清单、参数调试面板

**高级无障碍功能：语音控制、高对比度模式、字体大小调整**

### V1.2（可选）

WebRTC 实时模型通路、关键词触发词、本地轻量嵌入模型做相似度去重

**AI驱动的无障碍增强：智能字幕、音频描述生成**

## 五、非功能指标

### 延迟
本地可视化快环更新间隔 20–60 ms；LLM 决策 0.5–2 Hz；首条弹幕 < 1 s。

### 性能
移动端 30–60 fps；弱机自动降粒子与着色开销。

### 可用性
无网络仍有本地可视与弹幕；网络恢复自动切回增强。

### 稳定
风格切换具滞后与冷却，不抖动。

### **可访问性**
**WCAG 2.1 AA 合规性，所有交互元素可通过键盘访问，屏幕阅读器完全兼容，支持多种辅助设备。**

## 六、系统架构与数据流

### 分层

**用户界面层**：响应式设计、无障碍组件、多语言支持、键盘导航管理

拾音层：getUserMedia、AudioWorklet，移动端功耗与权限处理

特征层：Meyda 等产出 FeatureTick

控制层：状态机与过渡管理，特征窗统计、阈值与冷却，生成 DecisionEvent

可视化层：p5 插件，统一 preset 接口与插值

弹幕层：本地句库优先，按需调用 GLM-4.5，输出 danmu 事件

**可访问性层**：屏幕阅读器管理、键盘事件处理、语音控制接口、辅助设备适配

边缘/后端：Vercel Edge 仅做鉴权、令牌、限流与配置下发

### 数据流

30–60 fps：FeatureTick 推送至控制层与可视化层用于微反馈

0.5–2 Hz：特征统计快照发送 LLM；LLM 返回 style/preset/danmu 决策

**用户交互事件**：键盘、语音、辅助设备输入的无障碍处理流

## 七、事件与数据契约（规范）

### FeatureTick

字段：t、rms(0..1)、centroid(Hz)、flux(0..1)、onsetRate(/s)、bpm?、pitch?

说明：pitch 与 bpm 仅在稳定且门限通过时更新

### DecisionEvent

style.switch：{style, confidence, cooldownMs}

preset.suggest：{params{bg, particleSpeed, particleDensity, blur, accentHue, fontWeight}, ttlMs}

danmu.text：{text≤12、tone、lifeMs}

### **可访问性事件**

a11y.announcement：{text, priority, type='screen-reader'|'audio-cue'}

a11y.focus_change：{element, context, navigation_method}

a11y.state_change：{feature, old_value, new_value, user_initiated}

版本化：所有事件带 version 字段以兼容升级。

约束：用 JSON Schema 校验（前端 ajv），不合规直接丢弃并回退到本地规则。

## 八、可视化插件规范

### 生命周期
init(container) → applyPreset(partial, durationMs) → renderTick(featureTick) → dispose()

### 参数键
bg、particleSpeed、particleDensity、blur、accentHue、fontWeight（可扩展但需声明 capability）

### 过渡
由统一 TransitionManager 持有与插值，插件只消费结果

### 资源
切换前一帧离屏预热；插件自包含样式与资源路径

### **可访问性要求**
- 插件必须支持键盘控制
- 提供屏幕阅读器描述
- 支持高对比度模式
- 可配置的动画速度
- 颜色可自定义以确保色盲友好

## 九、LLM 策略与提示

### 模型
GLM-4.5

### 角色与边界

职责仅限风格选择、小幅参数建议、短弹幕生成

输入为最近 2 秒统计的特征 JSON，不传原始音频

输出严格遵守 JSON Schema

### 调用策略

默认走本地句库；当稳态风格持续 ≥2 s 或用户开启增强模式时，再调用 LLM

频率 0.5–1 Hz；超时与失败回退本地句库

相似度去重：近 10 秒输出做去重，避免复读

## 十、移动端适配与可用性

首次手势激活 AudioContext 与 autoplay

带宽与功耗守则：降采样与粒子自适应，弱网停用云端 LLM

兼容：iOS Safari 音频授权、字体与 WebGL 回退路径

### **移动端无障碍**
- 触摸目标最小 44x44px
- 支持VoiceOver和TalkBack
- 响应式字体大小
- 手势操作的可访问性替代方案
- 减少动态动画以防止晕动症

## 十一、隐私与安全

麦克风数据默认仅在本地处理；若启用云端分析，显式开关与提示

仅上传特征统计，不上传录音

令牌最小权限与短时有效，Edge 限流与域名白名单

### **安全合规**
- **GDPR/CCPA 合规**：用户数据收集同意机制、数据访问权、被遗忘权
- **数据保留政策**：用户数据保留30天，可手动删除
- **安全审计**：定期安全扫描和渗透测试
- **加密传输**：所有数据传输使用TLS 1.3+

## 十二、可访问性（无障碍）设计

### 12.1 键盘导航
- **Tab顺序**：逻辑性导航顺序，符合阅读习惯
- **快捷键**：
  - `Space`：播放/暂停音频
  - `S`：切换可视化风格
  - `D`：开关弹幕显示
  - `+/-`：调整音量
  - `H`：显示帮助信息
  - `Esc`：关闭弹窗/对话框
- **焦点管理**：可见焦点指示器，避免焦点陷阱

### 12.2 屏幕阅读器支持
- **ARIA标签**：所有交互元素配备适当的aria-label、aria-describedby
- **实时区域**：动态内容使用aria-live属性
- **状态通知**：重要状态变化通过aria-atomic通知
- **语义化HTML**：正确使用HTML5语义元素

### 12.3 视觉无障碍
- **高对比度模式**：提供WCAG AA级对比度选项
- **字体控制**：用户可调整字体大小（100%-200%）
- **颜色安全**：色盲友好的配色方案，不依赖颜色传递信息
- **动画控制**：可减少或停止动画，防止晕动症
- **响应式设计**：适配各种屏幕尺寸和方向

### 12.4 听觉无障碍
- **字幕系统**：所有音频内容提供文字字幕
- **视觉反馈**：音频事件通过视觉方式呈现
- **音量控制**：独立调节不同音频元素的音量
- **无音频模式**：提供纯视觉体验选项

### 12.5 认知无障碍
- **简化界面**：提供简洁模式选项
- **操作确认**：重要操作需要二次确认
- **进度指示**：长时间操作显示进度
- **错误恢复**：清晰的错误信息和恢复建议
- **帮助系统**：上下文相关的帮助信息

### 12.6 辅助技术兼容
- **屏幕放大器**：支持系统级缩放功能
- **语音控制**：支持Siri、Google Assistant等语音命令
- **开关设备**：支持外接开关设备
- **眼动追踪**：兼容眼动追踪设备

### 12.7 测试标准
- **自动测试**：axe-core、Lighthouse无障碍审计
- **人工测试**：残障用户测试小组参与
- **辅助设备测试**：JAWS、NVDA、VoiceOver、TalkBack兼容性测试
- **合规认证**：目标达到WCAG 2.1 AA级别

## 十三、开发者文档与开发体验

### 13.1 快速开始

#### 环境要求
- Node.js 18+
- pnpm 8+
- Git

#### 一分钟安装
```bash
# 克隆项目
git clone https://github.com/your-org/SonoScope.git
cd SonoScope

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 打开浏览器访问 http://localhost:3000
```

#### 第一个插件
```javascript
// packages/my-visualizer/src/index.ts
import { VisualizerPlugin } from '@sonoscope/core';

export const myVisualizer: VisualizerPlugin = {
  id: 'my-visualizer',
  name: 'My First Visualizer',
  
  init(container) {
    // 初始化代码
  },
  
  renderTick(features) {
    // 渲染逻辑
  },
  
  // ... 其他必需方法
};
```

### 13.2 项目架构

#### 目录结构
```
SonoScope/
├── app/                          # Next.js 应用
│   ├── pages/                    # 页面路由
│   ├── components/               # React 组件
│   ├── lib/                      # 工具函数
│   └── styles/                   # 样式文件
├── packages/
│   ├── core/                     # 核心库
│   │   ├── src/
│   │   │   ├── events/          # 事件系统
│   │   │   ├── audio/           # 音频处理
│   │   │   ├── visualization/   # 可视化引擎
│   │   │   ├── accessibility/    # 无障碍功能
│   │   │   └── types/           # TypeScript 类型
│   │   └── package.json
│   ├── visuals-basic/           # 基础可视化插件
│   ├── visuals-trap/           # Trap风格插件
│   └── utils/                  # 工具包
├── edge/
│   └── api/                    # Vercel Edge 函数
├── public/                      # 静态资源
├── docs/                        # 文档
├── scripts/                     # 构建脚本
└── examples/                    # 示例项目
```

#### 核心概念

**音频处理管道**
```typescript
interface AudioPipeline {
  source: AudioNode;
  analyser: AnalyserNode;
  featureExtractor: FeatureExtractor;
}
```

**事件系统**
```typescript
// 订阅音频特征事件
eventBus.on('feature:tick', (features: FeatureTick) => {
  // 处理特征数据
});

// 发布控制事件
eventBus.emit('control:style-change', { style: 'wave' });
```

**插件开发**
```typescript
interface VisualizerPlugin {
  id: string;
  name: string;
  version: string;
  
  // 生命周期方法
  init(container: HTMLElement): Promise<void>;
  applyPreset(preset: Partial<VisualPreset>, duration: number): Promise<void>;
  renderTick(features: FeatureTick): void;
  dispose(): Promise<void>;
  
  // 无障碍支持
  getAccessibilityInfo(): AccessibilityInfo;
}
```

### 13.3 开发工具

#### 本地开发
```bash
# 启动开发服务器（热重载）
pnpm dev

# 启动 Storybook 开发插件
pnpm storybook

# 运行测试
pnpm test

# 类型检查
pnpm type-check

# 代码检查
pnpm lint
```

#### 调试工具
- **React Developer Tools**：组件状态调试
- **Audio Context Inspector**：音频节点调试
- **Performance Monitor**：性能分析
- **Accessibility Inspector**：无障碍属性检查

### 13.4 插件开发指南

#### 创建新插件
```bash
# 使用 CLI 创建插件模板
pnpm create:plugin my-new-visualizer

# 生成的文件结构
packages/my-new-visualizer/
├── src/
│   ├── index.ts         # 主入口
│   ├── renderer.ts      # 渲染逻辑
│   ├── presets.ts       # 预设配置
│   └── accessibility.ts # 无障碍支持
├── package.json
└── README.md
```

#### 插件 API 参考

**基本插件结构**
```typescript
import { VisualizerPlugin, FeatureTick } from '@sonoscope/core';

export const myPlugin: VisualizerPlugin = {
  id: 'my-plugin',
  name: 'My Plugin',
  version: '1.0.0',
  
  async init(container) {
    // 初始化画布和资源
    this.canvas = document.createElement('canvas');
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
  },
  
  async applyPreset(preset, duration) {
    // 应用预设参数，支持动画过渡
    await this.transitionTo(preset, duration);
  },
  
  renderTick(features) {
    // 根据音频特征渲染
    this.renderVisualization(features);
  },
  
  async dispose() {
    // 清理资源
    this.canvas.remove();
  },
  
  getAccessibilityInfo() {
    return {
      name: this.name,
      description: 'My custom visualization',
      controls: ['keyboard', 'touch'],
      highContrastSupport: true
    };
  }
};
```

**无障碍功能实现**
```typescript
class AccessibleVisualizer {
  setupKeyboardControls() {
    document.addEventListener('keydown', (e) => {
      switch(e.key) {
        case 'ArrowUp':
          this.adjustIntensity(0.1);
          this.announce('intensity increased');
          break;
        case 'ArrowDown':
          this.adjustIntensity(-0.1);
          this.announce('intensity decreased');
          break;
      }
    });
  }
  
  announce(message: string) {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    document.body.appendChild(announcement);
    
    setTimeout(() => announcement.remove(), 1000);
  }
}
```

### 13.5 测试指南

#### 单元测试
```typescript
// plugins/my-visualizer/__tests__/index.test.ts
import { myVisualizer } from '../src';

describe('MyVisualizer', () => {
  let container: HTMLElement;
  
  beforeEach(() => {
    container = document.createElement('div');
  });
  
  it('should initialize correctly', async () => {
    await myVisualizer.init(container);
    expect(container.querySelector('canvas')).toBeTruthy();
  });
  
  it('should handle feature ticks', () => {
    const mockFeatures = createMockFeatures();
    expect(() => {
      myVisualizer.renderTick(mockFeatures);
    }).not.toThrow();
  });
});
```

#### 集成测试
```typescript
// tests/integration/audio-pipeline.test.ts
describe('Audio Pipeline', () => {
  it('should process audio and emit features', async () => {
    const pipeline = new AudioPipeline();
    const features = await pipeline.processAudio(mockAudioData);
    
    expect(features.rms).toBeGreaterThan(0);
    expect(features.spectralCentroid).toBeGreaterThan(0);
  });
});
```

#### 无障碍测试
```typescript
// tests/accessibility/keyboard-navigation.test.ts
describe('Keyboard Navigation', () => {
  it('should support all interactions via keyboard', async () => {
    const user = userEvent.setup();
    
    // Tab through all interactive elements
    await user.tab();
    expect(document.activeElement).toBe(firstInteractiveElement);
    
    // Test space bar for play/pause
    await user.keyboard(' ');
    expect(isPlaying).toBe(true);
  });
});
```

### 13.6 部署指南

#### 开发环境部署
```bash
# 构建项目
pnpm build

# 启动本地预览
pnpm preview
```

#### 生产环境部署
```bash
# 配置环境变量
cp .env.example .env.production

# 构建生产版本
pnpm build:production

# 部署到 Vercel
vercel --prod
```

#### Docker 部署
```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

### 13.7 贡献指南

#### 代码规范
- 使用 TypeScript 严格模式
- 遵循 ESLint 和 Prettier 配置
- 所有新功能需要测试覆盖
- 提交信息遵循 Conventional Commits

#### Pull Request 流程
1. Fork 项目并创建功能分支
2. 编写代码和测试
3. 运行完整的测试套件
4. 更新相关文档
5. 提交 PR 并描述变更内容

#### 社区支持
- GitHub Discussions：技术讨论
- Discord 社区：实时交流
- 文档贡献：改进文档和示例

### 13.8 故障排除

#### 常见问题
**音频权限问题**
```javascript
// 检查音频权限状态
async function checkAudioPermission() {
  const permission = await navigator.permissions.query({ name: 'microphone' });
  if (permission.state === 'denied') {
    showPermissionGuide();
  }
}
```

**性能问题**
```javascript
// 性能监控
const perfMonitor = {
  start() {
    this.startTime = performance.now();
  },
  
  end(label: string) {
    const duration = performance.now() - this.startTime;
    if (duration > 16.67) { // 超过60fps阈值
      console.warn(`${label} took ${duration.toFixed(2)}ms`);
    }
  }
};
```

#### 调试工具
```bash
# 启用调试模式
localStorage.debug='sonoscope:*'

# 查看性能统计
localStorage.debug='sonoscope:perf'

# 无障碍调试
localStorage.debug='sonoscope:a11y'
```

## 十四、里程碑与交付

### M1 原型周
拾音、特征、两套 p5 场景、事件总线与状态机、本地句库弹幕、**基础无障碍功能**

### M2 集成周
接入 GLM-4.5 与 JSON 校验，控制冷却与插值，移动端调优、**完整键盘导航**

### M3 发布周
可视化插件注册表与配置页、性能与稳定性测试、文档与示例站、**无障碍认证**

## 十五、验收与测试

### 功能验收

连续 10 分钟播放，fps ≥ 45（桌面）与 ≥ 30（移动）

弹幕首条返回 < 1 s，后续平均 < 800 ms

风格切换不抖动，无连续来回切换

**无障碍测试通过率 100%，覆盖所有 WCAG 2.1 AA 要求**

### 测试用例

高低响度、不同节拍、静音、嘈杂环境、弱网/断网、权限拒绝

JSON 校验失败、LLM 超时、插件崩溃的回退路径

**键盘-only 操作、屏幕阅读器兼容、高对比度模式、辅助设备支持**

## 十六、技术栈与部署

### 前端
TypeScript、Next.js（App Router）、p5.js

音频与特征：Web Audio API、AudioWorklet、Meyda、pitchy 或 ml5（CREPE 可选）、Tone.js（节拍辅助）

状态管理与事件：轻量事件总线（自实现或 mitt）

JSON 校验：ajv

**无障碍：axe-core、react-aria、@testing-library/user-event**

### AI
GLM-4.5（HTTP 流式为主）；后续可加 WebRTC 实时通路

本地句库检索：fuse.js 或自写索引

### 后端与部署
Vercel：Edge Function 用于签发临时令牌、读取环境配置、限流

静态资源 CDN：字体、纹理、插件包

TURN/STUN（若启用实时通路）：第三方托管

### 观测与诊断
前端埋点：ttfb_ms、fps、llm_rtt_ms、style_switch_count、fallback_rate

Vercel Analytics 与自建日志端点

**无障碍监控：axe-core 审计、用户代理分析、辅助设备使用统计**

### 开发体验
Monorepo（pnpm）

packages/core：事件、状态机、过渡管理、Schema

packages/visuals-*：p5 插件集合

app：示例站与控制面板

Storybook 或独立 Demo 页用于插件调试

**开发工具：TypeScript strict mode、ESLint + Prettier、Husky hooks、GitHub Actions**

## 十七、目录结构建议

### 根目录
/app（Next.js 前端与示例）
/packages/core（事件、契约、状态机、过渡管理、句库）
/packages/visuals-basic、/visuals-trap（各 p5 场景）
/public/assets（字体、纹理、噪声表）
/edge/api/token（Vercel Edge 路由与配置下发）
/docs（项目文档）
/examples（示例项目）
/scripts（构建和工具脚本）
/tests（测试文件）

## 十八、风险与对策

### 风格抖动
对策：进入/退出阈值分离、冷却时间、统计窗中位数或 EMA

### 移动端功耗
对策：特征条件更新、粒子自适应、OffscreenCanvas 可选

### 网络不稳定
对策：将 LLM 作为增强项，本地句库兜底；只传特征 JSON

### 插件不一致
对策：参数键名白名单、capability 声明、Schema 校验与降级

### **无障碍合规风险**
**对策**：集成axe-core自动检测、残障用户测试小组、定期无障碍审计、建立无障碍问题快速响应机制

## 十九、附录

### 19.1 无障碍检查清单
- [ ] 所有交互元素可通过键盘访问
- [ ] 提供足够的颜色对比度
- [ ] 图片和图标有替代文本
- [ ] 表单有适当的标签
- [ ] 动态内容有适当的ARIA属性
- [ ] 支持屏幕阅读器
- [ ] 支持高对比度模式
- [ ] 提供足够的操作时间
- [ ] 避免引起癫痫的内容

### 19.2 开发者资源
- [API 文档](./docs/api.md)
- [插件开发指南](./docs/plugin-development.md)
- [无障碍开发指南](./docs/accessibility.md)
- [部署指南](./docs/deployment.md)
- [故障排除](./docs/troubleshooting.md)

### 19.3 性能基准
- 移动端低端设备：≥20fps
- 移动端中端设备：≥30fps  
- 移动端高端设备：≥45fps
- 桌面端：≥60fps
- 内存使用：<100MB
- CPU使用率：<30%（移动端）

---

*本文档遵循语义化版本控制，v2.0 专注于增强可访问性和开发者体验。*