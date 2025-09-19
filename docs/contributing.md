---
title: "贡献指南"
author: "SonoScope Team"
version: "2.0"
last_updated: "2025-09-19"
audience: "Developers, Contributors, Community Members"
related_docs: ["01-overview-scope.md", "08-tech-deploy-devex.md", "api-reference.md"]
---

# 贡献指南

## 概述

欢迎贡献 SonoScope 项目！本文档将指导您如何参与项目开发，包括环境设置、开发流程、代码规范等。

## 目录

- [开始之前](#开始之前)
- [开发环境设置](#开发环境设置)
- [项目结构](#项目结构)
- [开发工作流](#开发工作流)
- [代码规范](#代码规范)
- [测试规范](#测试规范)
- [文档规范](#文档规范)
- [提 Pull Request](#提-pull-request)
- [问题报告](#问题报告)
- [发布流程](#发布流程)

## 开始之前

### 前置要求

- **Node.js**: 18.0 或更高版本
- **pnpm**: 8.0 或更高版本
- **Git**: 熟悉基本 Git 操作
- **编辑器**: 推荐 VS Code（有配置文件）
- **浏览器**: Chrome 80+ 或 Firefox 75+（用于开发调试）

### 必备知识

- **TypeScript**: 项目使用 TypeScript 开发
- **React/Next.js**: 前端框架
- **p5.js**: 可视化库
- **Web Audio API**: 音频处理
- **Git**: 版本控制和协作

### 社区准则

- 🤝 **友好尊重**：对所有参与者保持尊重和包容
- 💡 **建设性反馈**：提供具体、有用的反馈
- 📚 **文档先行**：代码变更必须包含相应文档
- 🧪 **测试覆盖**：新功能必须包含测试
- 🔍 **代码审查**：积极参与代码审查

## 开发环境设置

### 1. 克隆仓库

```bash
# 克隆项目
git clone https://github.com/your-org/SonoScope.git
cd SonoScope

# 安装依赖
pnpm install
```

### 2. 环境配置

```bash
# 复制环境变量模板
cp .env.example .env.local

# 编辑环境变量（需要时）
nano .env.local
```

### 3. 启动开发服务器

```bash
# 启动前端开发服务器
pnpm dev

# 启动 Storybook（插件开发）
pnpm storybook

# 运行测试
pnpm test

# 类型检查
pnpm type-check

# 代码检查
pnpm lint
```

### 4. 验证设置

访问以下地址确保环境正常：

- **应用**: http://localhost:3000
- **Storybook**: http://localhost:6006
- **API 文档**: http://localhost:3000/api-docs

## 项目结构

```
SonoScope/
├── app/                          # Next.js 应用
│   ├── pages/                    # 页面路由
│   ├── components/               # React 组件
│   ├── lib/                      # 工具函数
│   ├── styles/                   # 样式文件
│   └── public/                   # 静态资源
├── packages/
│   ├── core/                     # 核心库
│   │   ├── src/
│   │   │   ├── events/          # 事件系统
│   │   │   ├── audio/           # 音频处理
│   │   │   ├── visualization/   # 可视化引擎
│   │   │   ├── accessibility/   # 无障碍功能
│   │   │   └── types/           # TypeScript 类型
│   │   └── package.json
│   ├── visuals-basic/           # 基础可视化插件
│   ├── visuals-trap/           # Trap 风格插件
│   └── utils/                  # 工具包
├── edge/
│   └── api/                    # Vercel Edge 函数
├── docs/                        # 项目文档
├── scripts/                     # 构建脚本
├── tests/                      # 测试文件
├── examples/                   # 示例项目
├── .github/                    # GitHub 配置
├── .vscode/                    # VS Code 配置
└── package.json                # 项目配置
```

## 开发工作流

### 1. 选择任务

- 查看 [Issues](https://github.com/your-org/SonoScope/issues)
- 选择感兴趣的 issue（标注 `good first issue` 适合新手）
- 在 issue 中声明你要处理该任务

### 2. 创建分支

```bash
# 从 main 创建功能分支
git checkout main
git pull origin main

# 创建新分支
git checkout -b feature/your-feature-name

# 或者修复分支
git checkout -b fix/issue-number
```

### 3. 开发过程

```bash
# 编写代码
# 添加测试
# 更新文档

# 定期同步主分支
git fetch origin
git rebase origin/main

# 运行测试和检查
pnpm test
pnpm lint
pnpm type-check
```

### 4. 提交更改

```bash
# 添加更改
git add .

# 提交（遵循约定式提交）
git commit -m "feat: add new visualization style"

# 推送到远程
git push origin feature/your-feature-name
```

### 5. 提交 Pull Request

- 在 GitHub 上创建 Pull Request
- 填写 PR 模板
- 链接相关的 issue
- 等待代码审查

## 代码规范

### TypeScript 规范

```typescript
// ✅ 良好的类型定义
interface AudioFeature {
  rms: number;        // 音量强度 (0-1)
  spectralCentroid: number;  // 频谱质心 (Hz)
  timestamp: number;  // 时间戳
}

// ✅ 使用枚举提高可读性
enum DeviceTier {
  LOW_END = 'low',
  MID_RANGE = 'mid',
  HIGH_END = 'high',
  DESKTOP = 'desktop'
}

// ✅ 错误处理
class AudioError extends Error {
  constructor(
    message: string,
    public code: string,
    public recoverable: boolean = true
  ) {
    super(message);
    this.name = 'AudioError';
  }
}
```

### 命名约定

```typescript
// 文件命名：kebab-case
// audio-processor.ts
// visualizer-plugin.ts

// 类命名：PascalCase
class AudioProcessor {}
class VisualizerPlugin {}

// 变量和函数：camelCase
const audioContext = new AudioContext();
function processFeatures() {}

// 常量：SCREAMING_SNAKE_CASE
const MAX_PARTICLE_COUNT = 1000;
const SAMPLE_RATE = 44100;

// 接口：PascalCase，以 I 开头（可选）
interface IAudioFeature {}
interface VisualizerConfig {}
```

### 组件规范

```typescript
// ✅ React 组件示例
const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  isVisible,
  onFeatureExtracted,
  className
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    if (!isVisible) return;
    
    const processor = new AudioProcessor();
    processor.onFeatureExtracted = onFeatureExtracted;
    
    return () => {
      processor.dispose();
    };
  }, [isVisible, onFeatureExtracted]);
  
  return (
    <canvas
      ref={canvasRef}
      className={cn('audio-visualizer', className)}
      aria-label="Audio visualization"
    />
  );
};
```

### 样式规范

```css
/* 使用 CSS Modules 或 Tailwind */
.visualizer-container {
  /* 使用 CSS 变量 */
  --particle-size: 4px;
  --primary-color: hsl(var(--primary-hue), 70%, 50%);
  
  /* 响应式设计 */
  width: 100%;
  height: 100%;
  max-width: 1200px;
  
  /* 可访问性 */
  @media (prefers-reduced-motion: reduce) {
    animation-duration: 0.01ms;
  }
}
```

## 测试规范

### 单元测试

```typescript
// ✅ 好的测试示例
describe('AudioProcessor', () => {
  let processor: AudioProcessor;
  
  beforeEach(() => {
    processor = new AudioProcessor();
  });
  
  afterEach(() => {
    processor.dispose();
  });
  
  describe('feature extraction', () => {
    it('should extract RMS correctly', () => {
      const audioData = new Float32Array([0.5, 0.3, 0.8, 0.2]);
      const features = processor.extractFeatures(audioData);
      
      expect(features.rms).toBeCloseTo(0.5, 1);
      expect(features.spectralCentroid).toBeGreaterThan(0);
    });
    
    it('should handle empty audio data', () => {
      const features = processor.extractFeatures(new Float32Array(0));
      
      expect(features.rms).toBe(0);
      expect(features.spectralCentroid).toBe(0);
    });
  });
});
```

### 集成测试

```typescript
// ✅ 集成测试示例
describe('AudioPipeline Integration', () => {
  it('should process audio and emit events', async () => {
    const pipeline = new AudioPipeline();
    const eventBus = new EventBus();
    
    const mockAudioData = generateMockAudioData();
    let capturedFeatures: FeatureTick | null = null;
    
    eventBus.on('feature:tick', (features: FeatureTick) => {
      capturedFeatures = features;
    });
    
    await pipeline.initialize();
    pipeline.processAudioData(mockAudioData);
    
    expect(capturedFeatures).toBeTruthy();
    expect(capturedFeatures.rms).toBeGreaterThan(0);
  });
});
```

### 端到端测试

```typescript
// ✅ E2E 测试示例（使用 Playwright）
test('user can start audio visualization', async ({ page }) => {
  await page.goto('/');
  
  // 点击开始按钮
  await page.click('[data-testid="start-button"]');
  
  // 等待权限对话框
  await page.waitForSelector('[data-testid="permission-dialog"]');
  
  // 允许权限
  await page.click('[data-testid="allow-permission"]');
  
  // 验证可视化开始
  await expect(page.locator('[data-testid="visualizer"]')).toBeVisible();
  
  // 验证性能指标
  await expect(page.locator('[data-testid="fps-counter"]')).toHaveText(/30|40|50|60/);
});
```

## 文档规范

### 代码文档

```typescript
/**
 * 音频特征提取器
 * 
 * 负责从原始音频数据中提取特征，包括：
 * - RMS（音量强度）
 * - 频谱质心
 * - 频谱变化率
 * 
 * @example
 * ```typescript
 * const extractor = new FeatureExtractor();
 * const features = extractor.extract(audioData);
 * console.log(features.rms);
 * ```
 */
class FeatureExtractor {
  /**
   * 提取音频特征
   * @param audioData 原始音频数据
   * @returns 提取的特征对象
   * @throws {AudioError} 当音频数据无效时抛出
   */
  extract(audioData: Float32Array): FeatureTick {
    // 实现
  }
}
```

### JSDoc 标签

```typescript
// 常用 JSDoc 标签
/**
 * @param {string} name - 参数名称
 * @returns {number} 返回值说明
 * @throws {Error} 错误情况
 * @example 使用示例
 * @see 相关链接
 * @deprecated 弃用标记
 * @since 版本信息
 */
```

### README 文档

每个包和重要组件都应该包含 README.md：

```markdown
# Package Name

简短描述。

## 功能特性

- 特性 1
- 特性 2

## 安装

```bash
npm install package-name
```

## 使用方法

```javascript
const Package = require('package-name');
const instance = new Package();
```

## API

### method(param1, param2)

描述方法功能。

**参数：**
- `param1` {string} - 参数1描述
- `param2` {number} - 参数2描述

**返回值：**
{Object} - 返回值描述

## 示例

查看 `examples/` 目录。
```

## 提 Pull Request

### PR 模板

```markdown
## 变更描述
简要描述这个 PR 的目的和变更内容。

## 变更类型
- [ ] Bug 修复
- [ ] 新功能
- [ ] 文档更新
- [ ] 重构
- [ ] 性能优化
- [ ] 测试
- [ ] 其他: ______

## 相关 Issue
Closes #123

## 测试清单
- [ ] 功能测试通过
- [ ] 单元测试覆盖
- [ ] 集成测试通过
- [ ] 手动测试通过
- [ ] 文档已更新

## 环境测试
- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] 移动端测试

## 截图（如适用）
<!-- 添加截图展示变更效果 -->

## 额外说明
任何额外信息或注意事项。
```

### PR 审查清单

- [ ] 代码符合项目规范
- [ ] 测试覆盖率充足
- [ ] 文档已更新
- [ ] 提交信息清晰
- [ ] 分支命名正确
- [ ] CI/CD 检查通过
- [ ] 相关问题已解决
- [ ] 性能影响已评估

## 问题报告

### Bug 报告模板

```markdown
## Bug 描述
简要描述 bug 现象。

## 期望行为
描述期望的正确行为。

## 实际行为
描述实际发生的错误行为。

## 重现步骤
1. 执行操作 A
2. 执行操作 B
3. 观察结果

## 环境信息
- 操作系统: [例如 macOS 12.0]
- 浏览器: [例如 Chrome 96.0]
- 设备类型: [例如 iPhone 12]
- 项目版本: [例如 v1.0.0]

## 其他信息
任何额外的信息，如错误日志、截图等。
```

### 功能请求模板

```markdown
## 功能描述
详细描述你希望添加的功能。

## 使用场景
描述这个功能的使用场景和用户需求。

## 建议的实现方案
如果有，描述你建议的实现方式。

## 替代方案
描述你考虑过的其他方案。

## 额外信息
任何其他相关信息。
```

## 发布流程

### 版本号规则

遵循 [语义化版本 2.0.0](https://semver.org/)：

- `MAJOR.MINOR.PATCH`
- `1.0.0` - 初始稳定版本
- `1.1.0` - 向后兼容的新功能
- `1.1.1` - 向后兼容的 bug 修复
- `2.0.0` - 破坏性变更

### 发布步骤

```bash
# 1. 更新版本号
pnpm version patch/minor/major

# 2. 生成变更日志
pnpm run changelog

# 3. 构建
pnpm build

# 4. 测试
pnpm test

# 5. 提交标签
git push --follow-tags

# 6. 发布到 npm（如果是包）
pnpm publish --access public
```

### 变更日志

使用 [ conventional-changelog](https://github.com/conventional-changelog/conventional-changelog) 生成变更日志：

```markdown
## [1.1.0] - 2025-09-19

### Added
- 新增可视化插件系统
- 添加音频特征提取功能
- 支持移动端触摸交互

### Changed
- 改进性能监控
- 更新用户界面

### Fixed
- 修复音频权限处理问题
- 解决内存泄漏问题
```

## 社区支持

### 获取帮助

- **GitHub Discussions**: 技术讨论和问答
- **Discord**: 实时交流和社区支持
- **Email**: private@sonoscope.dev (私人问题)

### 贡献方式

1. **代码贡献**: 遵循本文档的开发流程
2. **文档贡献**: 改进项目文档和示例
3. **问题反馈**: 报告 bug 或提出功能建议
4. **社区支持**: 帮助回答社区问题

### 认可贡献者

所有贡献者都会在 [贡献者列表](CONTRIBUTORS.md) 中获得认可，包括：

- 代码贡献者
- 文档贡献者
- 设计贡献者
- 社区支持者

---

## 快速参考

| 任务 | 命令 |
|------|------|
| 安装依赖 | `pnpm install` |
| 启动开发 | `pnpm dev` |
| 运行测试 | `pnpm test` |
| 代码检查 | `pnpm lint` |
| 类型检查 | `pnpm type-check` |
| 构建 | `pnpm build` |
| 发布 | `pnpm publish` |

感谢您对 SonoScope 项目的贡献！🎉

---

**相关文档**：
- [项目概述与范围](01-overview-scope.md)
- [技术栈与部署](08-tech-deploy-devex.md)
- [API 参考文档](api-reference.md)