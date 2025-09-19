# 10 技术栈 / 部署 / 开发体验（来源：PRD.md）

## 技术栈
- 前端：TypeScript、Next.js（App Router）、p5.js
- 音频与特征：Web Audio API、AudioWorklet、Meyda、pitchy 或 ml5（CREPE 可选）、Tone.js（节拍辅助）
- 状态管理与事件：轻量事件总线（自实现或 mitt）
- JSON 校验：ajv
- AI：GLM-4.5（HTTP 流式为主）；本地句库检索：fuse.js 或自写索引

## 后端与部署
- Vercel Edge Function：签发临时令牌、读取环境配置、限流
- 静态资源 CDN：字体、纹理、插件包
- TURN/STUN（若启用实时通路）：第三方托管

## 观测与诊断
- 前端埋点：`ttfb_ms`、`fps`、`llm_rtt_ms`、`style_switch_count`、`fallback_rate`
- Vercel Analytics 与自建日志端点

## 开发体验
- Monorepo（pnpm）
- packages/core：事件、状态机、过渡管理、Schema
- packages/visuals-*：p5 插件集合
- app：示例站与控制面板
- Storybook 或独立 Demo 页用于插件调试

## 目录结构建议（节选）
- /app（Next.js 前端与示例）
- /packages/core（事件、契约、状态机、过渡管理、句库）
- /packages/visuals-basic、/visuals-trap（各 p5 场景）
- /public/assets（字体、纹理、噪声表）
- /edge/api/token（Vercel Edge 路由与配置下发）

