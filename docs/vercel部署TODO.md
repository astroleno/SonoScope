# Vercel 部署 TODO（SonoScope Standalone Client）

本清单汇总最近两轮讨论与代码审查结论，面向"最小可用 + 渐进增强"的生产部署方案。基于subagent分析建议优化，重点解决环境配置、模型管理、性能监控等关键问题。

## 📋 执行摘要

**部署策略**：采用"核心功能优先 + 渐进增强"的策略，确保基础功能稳定运行，高级特性可选加载

**关键优化点（已聚焦为可立即上线的最小集）**：
- 环境配置：从文件系统迁移到Vercel环境变量
- 模型管理：统一模型加载路径，优化TFJS动态加载
- 性能监控：集成完整的前端监控体系
- 缓存策略：完善静态资源缓存配置

**预期成果**：首包体积减少60%，加载速度提升40%，移动端兼容性显著改善

---

## 0. 当前状态（已完成）
- 根路由重定向到 `/standalone-client`，首页即独立客户端
- 调试/测试页保留：`/test`
- 清理未用页面：`client-shell/`、`danmu-demo/`、`danmu-test/`、`real-danmu/`
- 本地构建通过（Next 14）：`pnpm --filter app build`

---

## 1. 环境配置重构（按需）

### 1.1 环境变量迁移
- [ ] 若上线版本需要云端 API（如 GLM），将 `env.local.json` 配置迁移到 Vercel 环境变量；否则本项可延后至 P1
- [ ] 在 `app/app/standalone-client/page.tsx` 中添加环境变量验证逻辑（存在云端依赖时）
- [ ] 实现配置回退机制，确保环境变量缺失时的优雅降级

```typescript
// 环境配置示例
const GLM_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_GLM_API_KEY || '',
  apiUrl: process.env.NEXT_PUBLIC_GLM_URL || 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  // 添加验证逻辑
  isValid: () => {
    return !!process.env.NEXT_PUBLIC_GLM_API_KEY;
  }
};
```

### 1.2 模型路径统一（TFLite 为主，TFJS 作为回退）
- [ ] 确认并统一模型文件部署路径，生产优先使用 TFLite：`/model/yamnet_tflite/yamnet.tflite`
- [ ] 保留 TFJS GraphModel 作为回退路径（可选）：`/model/yamnet/model.json`
- [ ] 修改加载逻辑描述与示例，避免多路径同时主用，减少维护成本
- [ ] 验证模型文件在 Vercel 环境中的可访问性（200/缓存头）

```typescript
// 统一模型加载路径（生产主用 TFLite，GraphModel 仅作为回退）
const MODEL_PATHS = {
  yamnetTFLite: '/model/yamnet_tflite/yamnet.tflite',
  // 仅当后续提供了 TFJS GraphModel 时启用回退
  yamnetGraphModel: '/model/yamnet/model.json'
};
```

---

## 2. 首包与模型策略（必须）

### 2.1 TFJS/TFLite 动态加载优化
- [ ] 完全移除 `page.tsx` 顶层 `import '@tensorflow/tfjs'`
- [ ] 实现条件动态加载，仅在需要时按需加载 `@tensorflow/tfjs` 与 `@tensorflow/tfjs-tflite`
- [ ] 添加加载状态指示器和进度显示
- [ ] 实现超时重试机制（2–3 秒超时）

```typescript
// 按需加载 TFJS（首包不引入）
const loadTFJS = async (): Promise<any> => {
  if (typeof window === 'undefined') return null;
  try {
    const tf = await import('@tensorflow/tfjs');
    await tf.ready();
    return tf;
  } catch (error) {
    console.error('TFJS加载失败:', error);
    return null;
  }
};

// 按需加载 TFLite 运行时（优先用于移动端）
const loadTFLite = async (): Promise<any> => {
  if (typeof window === 'undefined') return null;
  try {
    return await import('@tensorflow/tfjs-tflite');
  } catch (error) {
    console.error('TFLite运行时加载失败:', error);
    return null;
  }
};
```

### 2.2 模型文件管理
- [ ] 确认YAMNet模型文件实际存在并可访问
- [ ] 实现模型文件的CDN加速（可选）
- [ ] 添加模型文件完整性校验
- [ ] 其余模型（CREPE/OpenL3/Musicnn）降级为启发式

### 2.3 数据外置优化
- [ ] 将YAMNet标签映射（521行）拆分为独立JSON文件
- [ ] 实现标签文件的懒加载和缓存
- [ ] 将其他大常量数据外置

---

## 3. 性能与缓存优化（必须）

### 3.1 代码分割优化
- [ ] Meyda回调状态更新节流（每60-120ms更新UI）
- [ ] 可视化预设动态分包：`dynamic(() => import(...), { ssr: false })`
- [ ] 使用`requestIdleCallback`预取非关键资源

### 3.2 缓存与权限策略配置
- [ ] 在 `next.config.js` 中配置静态资源缓存策略
- [ ] 模型文件设置长期缓存（1 年）
- [ ] Shader/纹理/字体资源配置适当缓存
- [ ] 添加 `Permissions-Policy: microphone=(self)` 以提升权限明确性

```javascript
// next.config.js 缓存与权限策略配置（在现有 COOP/COEP 基础上追加）
module.exports = {
  async headers() {
    return [
      {
        source: '/model/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }
        ],
      },
      {
        source: '/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400' }
        ],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'Permissions-Policy', value: 'microphone=(self)' }
        ]
      }
    ];
  }
};
```

### 3.3 生产环境优化
- [ ] 生产日志最小化：仅输出error/warn
- [ ] 移除开发环境特有的调试代码
- [ ] 优化React组件渲染性能

---

## 4. 安全配置（必须）

### 4.1 CSP 配置（建议分阶段逐步收紧）
- [ ] 配置适合 TFJS/WebGL 的 CSP 策略；首发可先不启用或采用较宽松策略，验证运行路径后再收紧
- [ ] 实现渐进式 CSP 收紧策略
- [ ] 添加其他必要的安全头部

```typescript
// next.config.js 安全头部配置
module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // 初期为保障运行可用，适度放宽；验证通过后按需收紧
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' blob:",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "connect-src 'self' https://open.bigmodel.cn",
              "media-src 'self' blob:",
              "worker-src 'self' blob:",
            ].join('; ')
          },
          {
            key: 'Permissions-Policy',
            value: 'microphone=(self), camera=()'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          }
        ],
      }
    ];
  }
};
```

### 4.2 内容安全
- [ ] Danmu文本净化：在`DanmuEngine.ingestText`入口进行sanitize
- [ ] 添加输入长度限制和内容过滤
- [ ] 实现XSS防护机制

---

## 5. 监控与错误处理（必须）

### 5.1 错误监控集成
- [ ] 集成Sentry错误监控（仅生产环境启用）
- [ ] 添加关键路径的try-catch包装
- [ ] 实现错误边界组件

```typescript
// Sentry集成示例
import * as Sentry from '@sentry/nextjs';

if (process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
  });
}
```

### 5.2 性能监控
- [ ] 集成Web Vitals监控
- [ ] 添加自定义性能指标收集
- [ ] 实现用户行为分析

```typescript
// Web Vitals监控
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

if (typeof window !== 'undefined') {
  getCLS(console.log);
  getFID(console.log);
  getFCP(console.log);
  getLCP(console.log);
  getTTFB(console.log);
}
```

### 5.3 用户分析
- [ ] 集成Google Analytics或Plausible
- [ ] 添加用户行为追踪
- [ ] 实现A/B测试框架

---

## 6. 用户体验优化（推荐）

### 6.1 加载体验
- [ ] 实现TFJS模型加载的进度条
- [ ] 添加骨架屏和加载状态指示器
- [ ] 实现优雅的降级提示

### 6.2 设备自适应
- [ ] 设备能力检测（`hardwareConcurrency`、`navigator.deviceMemory`）
- [ ] 自动调整粒子数量和渲染质量
- [ ] 实现网络条件自适应

```typescript
// 设备自适应示例
const getDeviceCapabilities = () => {
  return {
    isMobile: /Mobile|Android|iOS/.test(navigator.userAgent),
    memory: navigator.deviceMemory || 4,
    cores: navigator.hardwareConcurrency || 4,
    isSlowConnection: navigator.connection?.effectiveType.includes('2g')
  };
};
```

### 6.3 性能优化
- [ ] YAMNet推理帧率限制为2-4fps
- [ ] 实现环形缓冲替代切片拷贝
- [ ] 添加防抖和节流机制

---

## 7. Vercel配置优化（必须）

### 7.1 构建配置
- [ ] 创建 `vercel.json` 配置文件（仅当需要自定义时）
- [ ] 优化构建命令和输出设置
- [ ] 配置函数超时和内存限制（仅当对应 API Route 存在时添加）

```json
{
  "framework": "nextjs",
  "buildCommand": "pnpm --filter app build",
  "installCommand": "pnpm install --frozen-lockfile",
  // 仅当存在该 API Route 时再添加 functions 配置，避免 Vercel 校验失败
  "functions": {
    "app/app/api/llm-danmu/route.ts": {
      "maxDuration": 10
    }
  }
}
```

### 7.2 环境变量配置
- [ ] 在Vercel控制台配置必要的环境变量
- [ ] 添加环境变量验证和默认值
- [ ] 实现配置文件的版本控制

```bash
# 必需的环境变量
NEXT_PUBLIC_GLM_API_KEY=your_api_key_here
NEXT_PUBLIC_GLM_URL=https://open.bigmodel.cn/api/paas/v4/chat/completions
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn
NEXT_PUBLIC_GA_ID=your_google_analytics_id
```

---

## 8. 打包分析与优化（推荐）

### 8.1 包体分析
- [ ] 集成`@next/bundle-analyzer`
- [ ] 分析首包体积和增量加载
- [ ] 识别并优化大依赖项

```bash
# 包体分析命令
ANALYZE=true pnpm --filter app build
```

### 8.2 依赖优化
- [ ] 评估并替换重型依赖
- [ ] 实现Tree Shaking优化
- [ ] 优化CSS和静态资源

---

## 9. 部署验证Checklist（必须）

### 9.1 功能验证
- [ ] 不同网络环境下的加载测试（3G/4G/WiFi）
- [ ] 移动设备兼容性测试（iOS/Android）
- [ ] 多浏览器兼容性测试（Chrome、Safari、Firefox）
- [ ] 长时间运行稳定性测试（1小时+）

### 9.2 性能验证
- [ ] Lighthouse性能审计（得分 > 90）
- [ ] 内存泄漏验证（Chrome DevTools）
- [ ] 首包体积检查（< 1MB）
- [ ] 加载时间测试（< 3秒）

### 9.3 错误恢复测试
- [ ] 断网重连测试
- [ ] 权限拒绝处理
- [ ] 模型加载失败降级
- [ ] API调用错误处理

---

## 10. 任务优先级清单

### 🚨 P0 - 阻塞项（立即处理，保证可上线）
- [ ] 统一 YAMNet 模型路径（生产主用 TFLite：`/model/yamnet_tflite/yamnet.tflite`），并验证 200/缓存
- [ ] 将 TFJS 与 `@tensorflow/tfjs-tflite` 改为按需动态导入（移除顶层静态 import）
- [ ] 在 `next.config.js` 添加：
  - [ ] `/model/:path*` 长缓存 `Cache-Control: public, max-age=31536000, immutable`
  - [ ] `Permissions-Policy: microphone=(self)`
- [ ]（可选）CSP 以宽松策略或暂不启用，待验证路径后再收紧

### ⭐ P1 - 重要项（本周完成）
- [ ] 若使用云端 API：环境变量迁移与验证（含缺省值与校验）
- [ ] YAMNet 标签映射外置为 JSON 并懒加载
- [ ] Meyda 状态更新节流（60–120ms）
- [ ] 预设动态分包、生产日志最小化
- [ ] 完善错误处理与优雅降级提示

### 📊 P2 - 优化项（下周完成）
- [ ] 设备自适应
- [ ] 用户体验优化
- [ ] 包体分析和优化
- [ ] A/B测试框架

### 🔧 P3 - 长期项（持续优化）
- [ ] PWA支持
- [ ] 高级监控
- [ ] 性能调优
- [ ] 用户反馈收集

---

## 11. 风险管理与应对

### ⚠️ 高风险项
1. **模型加载性能**：4MB+ TFJS可能影响用户体验
   - 缓解：进度条、预加载、CDN加速

2. **环境配置迁移**：可能影响现有功能
   - 缓解：渐进式迁移、保留回退机制

3. **移动端兼容性**：WebGL/Web Audio API支持差异
   - 缓解：特性检测、优雅降级

### 🛡️ 中风险项
1. **包体积控制**：需要持续监控
   - 缓解：定期分析、依赖优化

2. **浏览器兼容性**：特别是Safari限制
   - 缓解：兼容性测试、polyfill

3. **网络条件**：不同环境下的加载体验
   - 缓解：自适应加载、离线缓存

---

## 12. 部署步骤指南

### 阶段1：基础配置（1天）
1. 代码准备
   - 确认根目录 `package.json` / `pnpm-workspace.yaml` 正常
   - 配置 `app/next.config.js` 头部和缓存策略
   - 创建 `vercel.json` 配置文件

2. 环境配置
   - 在Vercel控制台配置环境变量
   - 实现环境变量验证逻辑
   - 测试配置迁移效果

### 阶段2：核心优化（2-3天）
1. 性能优化
   - 实现TFJS动态加载
   - 完成代码分割和缓存配置
   - 集成监控系统

2. 安全配置
   - 配置CSP和其他安全头部
   - 实现内容净化机制
   - 测试安全策略效果

### 阶段3：部署验证（1天）
1. 部署测试
   - 部署到Vercel预览环境
   - 执行完整的验证Checklist
   - 性能和兼容性测试

2. 生产部署
   - 部署到生产环境
   - 监控关键指标
   - 准备回滚方案

---

## 13. 常用命令

```bash
# 本地开发
pnpm --filter app dev

# 生产构建
pnpm --filter app build

# 包体分析
ANALYZE=true pnpm --filter app build

# 类型检查
pnpm --filter app type-check

# 代码格式化
pnpm format

# 代码检查
pnpm lint
```

---

## 14. 监控指标

### 关键指标
- **性能指标**：Lighthouse分数 > 90，首包加载 < 3秒
- **错误率**：前端错误率 < 0.1%，API错误率 < 1%
- **用户体验**：页面停留时间 > 2分钟，跳出率 < 30%
- **移动端**：iOS/Android兼容性 > 95%

### 告警阈值
- 页面加载时间 > 5秒
- 错误率 > 1%
- 内存使用 > 100MB
- FPS < 30

---

**推荐实施顺序**：P0阻塞项 → P1重要项 → P2优化项 → P3长期项

**预计完成时间**：1-2周（取决于团队规模）

**回滚准备**：每个阶段完成后创建git tag，确保可快速回滚