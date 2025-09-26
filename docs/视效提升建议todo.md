# 频谱驱动视效改造 TODO（结合项目现状与移动端可行性）

说明：本清单基于《视效提升建议 spectrum_visual_report.md》、当前已落地的“频谱优先模式”修改，以及 Vercel 独立客户端在手机端（iOS/Android、Safari/Chrome）可实现的约束，整理为分阶段、可交付、可回滚的实施路线图。

---

## 阶段 1：数据层重构（必做，1-2 天）

- [x] 引入 Float32 频谱数据
  - 在 `page.tsx` 优先使用 `analyser.getFloatFrequencyData(Float32Array)` 替代 Byte 频谱
  - 归一化 dB：`db ∈ [-140,0] → amp = 10^((db+140)/20)`
  - 验证移动端（iOS Safari）可用性与性能（≈0.5-1.5ms/帧目标）

- [x] 梅尔刻度重采样（MEL_COLS=64，可降 48/32）
  - 预计算 `mel→hz` 断点与 `hz→bin` 映射表，按列聚合幅值
  - 输出 `columnsRaw: Float32Array(MEL_COLS)`
  - 自适应降级：FPS<45 时列数自动降至 48/32

- [x] 双时间常数缓冲（instant/slow）
  - 定义 `biSmooth(cur, next, {attack, release})`
  - 为 `level、bandLow、bandMid、bandHigh、columns` 同时维护 `instant/slow`
  - 缓冲结构 `SpectrumFrame`：
    - `level: { instant, slow }`
    - `bands: { low, mid, high }`（均含 `instant/slow`）
    - `columns, columnsSmooth`
    - `tempo?: { bpm, confidence }`（先留接口）
  - 环形历史缓冲 `FRAME_HISTORY=32`，成本低，便于后续相位与统计

- [x] 与现有“频谱优先模式”并存
  - 在 `Visualizer` 维持现有简化权重输入（不破坏已稳定功能）
  - 增加可选 `spectrumFrame` 入参，逐步迁移预设使用 `instant/slow`

验收标准：
- DevTools 性能记录：频谱计算耗时 ≤ 2ms/帧（移动端 ≤ 3ms/帧）
- 列热力变化在低频段可明显分辨，噪声地板稳定

---

## 阶段 2：视觉层接入（2-3 天，按模式推进）

通用策略：主驱动=level/bands（slow），细节=columns/bands（instant），脉冲/节拍控制速度/闪烁。

- [x] Wave（优先）
  - `amplitude/thickness ← bandLow.slow`
  - `frequency/phaseJitter ← bandHigh.instant`
  - `speed ← tempo.bpm 或 fluxPulse`（优先节拍，回退脉冲）
  - 维持现有统一权重配置，可在 `audioWeights` 中分层（primary/tempo/detail）

- [x] Mosaic
  - 生成/尺寸/寿命：`bandLow.slow`；颜色流/生长率：`bandHigh.instant`
  - 列映射：用 `columnsSmooth` 作为横向驱动，列平滑 α≈0.3-0.5

- [x] Accretion
  - 增益/亮度：`level.slow + bandLow.slow`
  - 闪烁/细节：`bandHigh.instant`
  - 保持移动端强度下探（避免过度闪烁）

- [x] Spiral
  - 体规模/基线：`bandLow.slow`
  - 扰动/高光：`bandHigh.instant + fluxPulse`
  - 亮度乘性调节：`level.slow`

验收标准：
- 切换“频谱优先模式”时，各预设随低/中/高频的联动更加直观、可控
- 60fps 框内稳定（移动端 ≥45fps 且不卡顿）

---

## 阶段 3：节奏层（1-2 天）

- [x] BPM 相位（phase）累积
  - 在 `page.tsx` 用 `audioContext.currentTime` 累积 `phase = (phase + bpm/60*dt) % 1`
  - 仅在 `confidence ≥ 0.45` 时启用；降级用 `fluxPulse`

- [x] 预设节奏映射
  - 说明：Wave 已使用 bpm/fluxPulse 驱动速度；Mosaic 的 colorFlowSpeed 将在后续进一步按 phase 做细化（当前先保留默认速度）。
  - Wave：`speed ← bpm/400`，无可靠节拍时 `speed ← base + fluxPulse*k`
  - Mosaic：`colorFlowSpeed ← base*(1 + tempo.confidence*0.3)`

验收标准：
- 有节拍音乐时，Wave/Mosaic 的速度/呼吸明显“贴拍”，停/起拍切换平滑

---

## 阶段 4：性能与回退（1 天）

- [x] FPS 监控与自适应降档
  - FPS<45：更新频率降至 30Hz、MEL_COLS 退 48/32、禁用昂贵效果

- [ ] 环境开关（.env/URL）
  - `NEXT_PUBLIC_SPECTRUM_ENABLED`：启用 Mel 管线
  - `NEXT_PUBLIC_SPECTRUM_PRIORITY`：频谱优先模式默认开
  - `NEXT_PUBLIC_SPECTRUM_FALLBACK`：强制回退旧路径

- [ ] 回退验证
  - 一键关闭新管线，页面应仍可运行，视觉可回到“简化频谱”方案

---

## 阶段 5：文档与可运维（0.5 天）

- [ ] 更新 `docs/` 与根 README：
  - 新的数据流图（Mel→biSmooth→SpectrumFrame→Visualizer）
  - 参数/权重表与示例（按 preset）
  - 移动端注意事项（见下）

---

## 移动端 / Vercel 独立客户端 约束与可行性清单

- ✅ HTTPS 与麦克风权限
  - Vercel 默认 HTTPS，可用 `getUserMedia({audio:true})`；iOS 需用户手势 `AudioContext.resume()`（项目已有处理）

- ✅ WebGL1 兼容
  - 预设已适配 WebGL1；移动端默认降分辨率/降粒子/降帧率（已实现基础逻辑）

- ✅ 计算预算
  - 目标：新增频谱管线 ≤ 2-3ms/帧（中端机）
  - 降档策略：列数 64→48/32，更新频率 60→30Hz，禁用昂贵效果

- ⚠️ TFJS/TFLite 模型
  - YAMNet 仅作补充；移动端优先 TFLite，失败回退 TFJS/启发式
  - 避免在主线程做重型推理；当前做法为低频触发、可保持

- ⚠️ 权限/策略
  - iOS Safari：仅在手势后创建/恢复 `AudioContext`
  - iframe/Embed：需检查 permissionsPolicy（项目已采集）

---

## 权重分层与参数建议（与现有 audioWeights 协同）

- primary：`{ level:1.0, bands:0.8 }`
- tempo：`{ bpm:0.5, fluxPulse:0.4 }`
- detail：`{ centroid:0.2, flatness:0.2, mfcc:0.15, voice:0.1 }`

默认攻/释（biSmooth）：
- level：`attack=0.45, release=0.12`
- bandLow：`attack=0.25, release=0.08`
- bandHigh：`attack=0.6, release=0.18`

---

## 验收与度量（每阶段）

- 性能：移动端 ≥45fps，PC ≥60fps；频谱计算 ≤2ms/帧
- 音乐性：低/高频手动扫频验证映射一致性；节奏曲目验证“贴拍”
- 回退：开关关闭新管线后功能完整、页面稳定

---

## 回滚策略

- 每个阶段完成后打 `git tag`；
- `.env` / URL 开关一键禁用新管线；
- 保留旧频谱路径直至新管线在移动端稳定 1 周。


