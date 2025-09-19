---
title: "系统架构与数据流"
author: "SonoScope Team"
version: "2.0"
last_updated: "2025-09-19"
audience: "Backend Developers, Architects, System Designers"
related_docs: ["01-overview-scope.md", "04-events-contracts.md", "05-plugin-spec.md"]
---

# 03 系统架构与数据流（来源：PRD.md）

## 分层
- 拾音层：getUserMedia、AudioWorklet，移动端功耗与权限处理
- 特征层：Meyda 等产出 FeatureTick
- 控制层：状态机与过渡管理，特征窗统计、阈值与冷却，生成 DecisionEvent
- 可视化层：p5 插件，统一 preset 接口与插值
- 弹幕层：本地句库优先，按需调用 GLM-4.5，输出 danmu 事件
- 边缘/后端：Vercel Edge 仅做鉴权、令牌、限流与配置下发

## 数据流
- 30–60 fps：FeatureTick 推送至控制层与可视化层用于微反馈
- 0.5–2 Hz：特征统计快照发送 LLM；LLM 返回 style/preset/danmu 决策

