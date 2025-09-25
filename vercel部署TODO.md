# Vercel 部署 TODO（SonoScope Standalone Client）

本清单汇总最近两轮讨论与代码审查结论，面向“最小可用 + 渐进增强”的生产部署方案。

## 0. 当前状态（已完成）
- 根路由重定向到 `/standalone-client`，首页即独立客户端
- 调试/测试页保留：`/test`
- 清理未用页面：`client-shell/`、`danmu-demo/`、`danmu-test/`、`real-danmu/`
- 本地构建通过（Next 14）：`pnpm --filter app build`

---

## 1. 首包与模型策略（必须）
- [ ] 动态加载 TFJS 与 YAMNet 模型（仅在需要分类/弹幕增强时加载）
  - 触发点：开启 Danmu 或首次需要分类结果
  - 代码：`import('@tensorflow/tfjs')` + `tf.loadLayersModel('/model/yamnet.task')`
  - 超时与重试：超时 2–3s；失败降级为启发式
- [ ] 其余模型（CREPE/OpenL3/Musicnn）全部降级为启发式（不预置，不加载）
- [ ] 将 YAMNet 标签映射拆分为独立文件（懒加载），避免主包内嵌 500+ 行常量

## 2. UI 与渲染优化（必须）
- [ ] Meyda 回调状态更新节流（每 60–120ms 更新 UI）
- [ ] 可视化预设动态分包：`dynamic(() => import(...), { ssr: false })`
- [ ] 生产日志最小化：仅输出 error/warn，开发日志 `NODE_ENV !== 'production'`

## 3. 安全与合规（必须）
- [ ] Danmu 文本净化：在 `DanmuEngine.ingestText` 入口进行 sanitize（剔除脚本协议、长度限制）
- [ ] 安全响应头（Vercel/Next）：
  - `Content-Security-Policy`（示例：`script-src 'self' 'unsafe-eval' blob:` 以兼容 TFJS/webgl；按需完善）
  - `Permissions-Policy: microphone=(self)`
  - `X-Content-Type-Options: nosniff`
- [ ] 仅在用户交互后请求麦克风权限（已满足）

## 4. 缓存与静态资源（推荐）
- [ ] `public/model/yamnet.task` 添加长缓存（immutable），并确认 ETag 生效
- [ ] 静态 shader / 纹理 / 字体 设置合适 Cache-Control
- [ ] 可选：接入 PWA/Service Worker 做二次缓存（后续）

## 5. 打包与体积监控（推荐）
- [ ] 集成 `@next/bundle-analyzer` 检查 `/standalone-client` 首包与增量体积
- [ ] 将大静态常量/数据（如标签表）外置并懒加载

## 6. 性能自适应（推荐）
- [ ] 设备能力检测（`hardwareConcurrency`、掉帧）→ 自动降低粒子数/更新频率/分辨率
- [ ] YAMNet 推理帧率保持 2–4fps（无需更高）
- [ ] 计划性优化：环形缓冲替代切片拷贝，减少分配

## 7. 用户体验增强（推荐）
- [ ] 添加加载状态指示器（特别是TFJS模型加载）
- [ ] 实现优雅的降级提示（模型加载失败时）
- [ ] 添加性能监控和用户反馈收集
- [ ] 移动端特定的性能优化

## 8. 监控与容错（推荐）
- [ ] 前端错误上报（Sentry 等）仅生产启用
- [ ] 关键路径 try-catch 已完善：保持
- [ ] 集成Google Analytics或类似工具
- [ ] 添加Web Vitals监控
- [ ] 错误日志收集和分析
- [ ] 用户行为分析

---

## 9. 部署验证Checklist（推荐）
- [ ] 不同网络环境下的加载测试（3G/4G/WiFi）
- [ ] 移动设备兼容性测试（iOS/Android）
- [ ] 长时间运行的稳定性测试（1小时+）
- [ ] 内存泄漏验证（Chrome DevTools Memory面板）
- [ ] 错误恢复机制测试（断网重连、权限拒绝）
- [ ] 多浏览器兼容性测试（Chrome、Safari、Firefox）
- [ ] 性能基准测试（Lighthouse评分 > 90）

---

## 10. Vercel 配置与部署步骤
1) 代码准备
   - 确认根目录 `package.json` / `pnpm-workspace.yaml` 正常
   - `app/next.config.js`：按需添加 headers（CSP 等）与 bundle-analyzer 配置
   - 根 `README.md` / 本文件同步最新说明

2) Vercel 项目设置（建议）
   - Framework: Next.js
   - Root Directory: `app`
   - Build Command: `pnpm --filter app build`
   - Install Command: `pnpm install --frozen-lockfile`
   - Output Directory: `.next`
   - Environment Variables：按需添加（如无服务端依赖可为空）

3) 首次部署与验证
   - 部署后访问 `/` → 自动跳转 `/standalone-client`
   - 检查移动端权限与可视化响应
   - 手动开启 "Danmu" → 触发 TFJS/YAMNet 懒加载；验证降级逻辑（断网或超时）
   - 访问 `/test` 保留测试主页
   - 运行Lighthouse性能审计，确保得分 > 90
   - 验证加载状态指示器和降级提示功能正常

---

## 11. 任务清单（可勾选）
### 🚨 必须项（生产部署前完成）
- [ ] 动态加载 TFJS/YAMNet + 超时降级
- [ ] 拆分 YAMNet 标签映射为独立模块
- [ ] Meyda 状态节流 60–120ms
- [ ] 预设模块动态分包
- [ ] 生产日志最小化
- [ ] Danmu 文本 sanitize
- [ ] 安全响应头（CSP/Permissions-Policy/nosniff）

### ⭐ 推荐项（用户体验优化）
- [ ] 模型与静态资源缓存优化
- [ ] 集成 bundle analyzer 并调优
- [ ] 设备自适应质量
- [ ] 加载状态指示器
- [ ] 优雅降级提示

### 📊 监控项（长期运行）
- [ ] Sentry 错误监控
- [ ] Google Analytics 集成
- [ ] Web Vitals 监控
- [ ] 用户行为分析
- [ ] 性能监控面板

---

## 10. 常用命令
```bash
# 本地启动
pnpm --filter app dev

# 生产构建
pnpm --filter app build

# 分析包体（示例）
ANALYZE=true pnpm --filter app build
```

---

## 12. 风险评估与缓解措施

### ⚠️ 主要风险
1. **TFJS动态加载用户体验**：模型文件较大（4MB），可能影响用户体验
2. **CSP配置复杂性**：需要平衡安全性和功能完整性
3. **移动端性能**：低端设备可能出现性能问题
4. **浏览器兼容性**：WebGL和Web Audio API支持差异

### 🛡️ 缓解措施
1. **加载体验优化**：实现进度条、骨架屏、预加载提示
2. **CSP渐进式配置**：从宽松策略开始，逐步收紧
3. **设备自适应**：自动检测设备能力，调整渲染质量
4. **优雅降级**：为不支持的功能提供备选方案

---

如需我直接落地"动态加载 TFJS + 标签外置 + 节流 + 分包 + 安全头 + 文本净化"，回复"执行优化"，我会一次性完成并再跑一次构建验证。

**推荐实施顺序**：必须项 → 推荐项 → 监控项 → 部署验证


