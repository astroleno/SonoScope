下面是一份可直接落地的 PRD 与技术栈方案，项目名按你定的“声象 SonoScope”。

一、项目概述

名称：声象 SonoScope

定位：基于浏览器的实时音乐可视化与弹幕引擎，面向 Web 与移动端。

核心思路：双环路架构——本地快环做音频特征驱动的即时可视化，慢环由 LLM 基于特征生成风格化弹幕与参数建议。

设计原则：Web 可用、移动适配、特征丰富、易上手、易部署、可插拔。

二、目标与价值

目标

在普通手机浏览器中实现稳定的实时可视化，首屏接入与首条弹幕均小于 1 秒。

通过统一数据契约与可视化插件规范，实现多套 p5 场景的热插拔。

用 GLM-4.5 完成“选择与短文本生成”，控制成本与延迟。

价值

对开发者：最短路径把“声音→画面/文字”跑起来，后续扩展更换模型或场景不改主干。

对用户：在移动端也能顺畅体验，弱网或离线仍有稳定反馈。

三、用户画像与典型场景

用户画像：音视频创作者、直播与活动运营、互动装置团队、教育演示。

典型场景：

现场音乐或音轨播放，页面立即呈现随节奏变化的粒子与字幕弹幕。

切换不同视觉主题，画面平滑过渡，不中断音乐。

弱网时仍有本地句库弹幕与可视化微反馈。

四、范围与优先级

V1 MVP（必做）

拾音接入与权限引导（浏览器、移动端手势解锁音频）

Meyda 等本地特征：rms、spectralCentroid、spectralFlux、onsetRate、pitch（条件更新）、bpm（简单估计或空）

事件总线与数据契约：FeatureTick、DecisionEvent

可视化插件系统：至少两套 p5 场景，支持 applyPreset 插值切换

弹幕系统：本地句库为主，GLM-4.5 为辅；JSON Schema 约束输出

V1.1（次优先）

更稳健的 BPM/打点、可视化插件商店式清单、参数调试面板

V1.2（可选）

WebRTC 实时模型通路、关键词触发词、本地轻量嵌入模型做相似度去重

五、非功能指标

延迟：本地可视化快环更新间隔 20–60 ms；LLM 决策 0.5–2 Hz；首条弹幕 < 1 s。

性能：移动端 30–60 fps；弱机自动降粒子与着色开销。

可用性：无网络仍有本地可视与弹幕；网络恢复自动切回增强。

稳定：风格切换具滞后与冷却，不抖动。

六、系统架构与数据流

分层

拾音层：getUserMedia、AudioWorklet，移动端功耗与权限处理

特征层：Meyda 等产出 FeatureTick

控制层：状态机与过渡管理，特征窗统计、阈值与冷却，生成 DecisionEvent

可视化层：p5 插件，统一 preset 接口与插值

弹幕层：本地句库优先，按需调用 GLM-4.5，输出 danmu 事件

边缘/后端：Vercel Edge 仅做鉴权、令牌、限流与配置下发

数据流

30–60 fps：FeatureTick 推送至控制层与可视化层用于微反馈

0.5–2 Hz：特征统计快照发送 LLM；LLM 返回 style/preset/danmu 决策

七、事件与数据契约（规范）

FeatureTick

字段：t、rms(0..1)、centroid(Hz)、flux(0..1)、onsetRate(/s)、bpm?、pitch?

说明：pitch 与 bpm 仅在稳定且门限通过时更新

DecisionEvent

style.switch：{style, confidence, cooldownMs}

preset.suggest：{params{bg, particleSpeed, particleDensity, blur, accentHue, fontWeight}, ttlMs}

danmu.text：{text≤12、tone、lifeMs}

版本化：所有事件带 version 字段以兼容升级。

约束：用 JSON Schema 校验（前端 ajv），不合规直接丢弃并回退到本地规则。

八、可视化插件规范

生命周期：init(container) → applyPreset(partial, durationMs) → renderTick(featureTick) → dispose()

参数键：bg、particleSpeed、particleDensity、blur、accentHue、fontWeight（可扩展但需声明 capability）

过渡：由统一 TransitionManager 持有与插值，插件只消费结果

资源：切换前一帧离屏预热；插件自包含样式与资源路径

九、LLM 策略与提示

模型：GLM-4.5

角色与边界：

职责仅限风格选择、小幅参数建议、短弹幕生成

输入为最近 2 秒统计的特征 JSON，不传原始音频

输出严格遵守 JSON Schema

调用策略：

默认走本地句库；当稳态风格持续 ≥2 s 或用户开启增强模式时，再调用 LLM

频率 0.5–1 Hz；超时与失败回退本地句库

相似度去重：近 10 秒输出做去重，避免复读

十、移动端适配与可用性

首次手势激活 AudioContext 与 autoplay

带宽与功耗守则：降采样与粒子自适应，弱网停用云端 LLM

兼容：iOS Safari 音频授权、字体与 WebGL 回退路径

十一、隐私与安全

麦克风数据默认仅在本地处理；若启用云端分析，显式开关与提示

仅上传特征统计，不上传录音

令牌最小权限与短时有效，Edge 限流与域名白名单

十二、里程碑与交付

M1 原型周：拾音、特征、两套 p5 场景、事件总线与状态机、本地句库弹幕

M2 集成周：接入 GLM-4.5 与 JSON 校验，控制冷却与插值，移动端调优

M3 发布周：可视化插件注册表与配置页、性能与稳定性测试、文档与示例站

十三、验收与测试

功能验收

连续 10 分钟播放，fps ≥ 45（桌面）与 ≥ 30（移动）

弹幕首条返回 < 1 s，后续平均 < 800 ms

风格切换不抖动，无连续来回切换

测试用例

高低响度、不同节拍、静音、嘈杂环境、弱网/断网、权限拒绝

JSON 校验失败、LLM 超时、插件崩溃的回退路径

十四、技术栈与部署

前端

TypeScript、Next.js（App Router）、p5.js

音频与特征：Web Audio API、AudioWorklet、Meyda、pitchy 或 ml5（CREPE 可选）、Tone.js（节拍辅助）

状态管理与事件：轻量事件总线（自实现或 mitt）

JSON 校验：ajv

AI

GLM-4.5（HTTP 流式为主）；后续可加 WebRTC 实时通路

本地句库检索：fuse.js 或自写索引

后端与部署

Vercel：Edge Function 用于签发临时令牌、读取环境配置、限流

静态资源 CDN：字体、纹理、插件包

TURN/STUN（若启用实时通路）：第三方托管

观测与诊断

前端埋点：ttfb_ms、fps、llm_rtt_ms、style_switch_count、fallback_rate

Vercel Analytics 与自建日志端点

开发体验

Monorepo（pnpm）

packages/core：事件、状态机、过渡管理、Schema

packages/visuals-*：p5 插件集合

app：示例站与控制面板

Storybook 或独立 Demo 页用于插件调试

十五、目录结构建议

根目录

/app（Next.js 前端与示例）

/packages/core（事件、契约、状态机、过渡管理、句库）

/packages/visuals-basic、/visuals-trap（各 p5 场景）

/public/assets（字体、纹理、噪声表）

/edge/api/token（Vercel Edge 路由与配置下发）

十六、风险与对策

风格抖动

对策：进入/退出阈值分离、冷却时间、统计窗中位数或 EMA

移动端功耗

对策：特征条件更新、粒子自适应、OffscreenCanvas 可选

网络不稳定

对策：将 LLM 作为增强项，本地句库兜底；只传特征 JSON

插件不一致

对策：参数键名白名单、capability 声明、Schema 校验与降级