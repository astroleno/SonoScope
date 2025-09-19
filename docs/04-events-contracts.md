---
title: "事件与数据契约"
author: "SonoScope Team"
version: "2.0"
last_updated: "2025-09-19"
audience: "Frontend Developers, Backend Developers, Plugin Developers"
related_docs: ["03-architecture-dataflow.md", "05-plugin-spec.md", "05-llm-strategy.md"]
---

# 04 事件与数据契约（来源：PRD.md）

## FeatureTick
- 字段：`t`、`rms(0..1)`、`centroid(Hz)`、`flux(0..1)`、`onsetRate(/s)`、`bpm?`、`pitch?`
- 说明：`pitch` 与 `bpm` 仅在稳定且门限通过时更新

## DecisionEvent
- `style.switch`：`{style, confidence, cooldownMs}`
- `preset.suggest`：`{params{bg, particleSpeed, particleDensity, blur, accentHue, fontWeight}, ttlMs}`
- `danmu.text`：`{text≤12、tone、lifeMs}`

## 版本与校验
- 版本化：所有事件带 `version` 字段以兼容升级。
- 约束：用 JSON Schema 校验（前端 ajv），不合规直接丢弃并回退到本地规则。

