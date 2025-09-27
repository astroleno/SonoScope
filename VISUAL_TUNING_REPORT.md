# SonoScope 可视化调优建议

## 输入数据参考
- 音频特征来源：`参数对比.md` 记录的稳定特征及派生量
- 代码位置：
  - Accretion 着色器与均衡：`app/visuals/accretion.ts`
  - Wave 着色器：`app/visuals/wave.ts`
  - Spiral 着色器：`app/visuals/spiral.ts`
  - Mosaic 渲染逻辑：`app/visuals/mosaic.ts`

## Accretion（过亮）
- 亮度放大集中在 `app/visuals/accretion.ts:84-92`，`uOverallBoost`、`brightnessPulse`、`pulseBoost` 连乘后再叠加一次能量增益。
- `applyAccretionAudioUniforms`（`app/visuals/accretion.ts:118-175`）默认 `overallBoost` 为 `1.0`，并允许外部拉到 `1.6`，在 RMS 较高时容易超曝。

**建议**
1. 将 `brightnessPulse` 的上限从 `3.0` 降到约 `2.2`，并对 `pulseBoost` 加对数压缩（例如 `log1p`）。
2. 调低默认 `overallBoost` 至 ~`0.85`，并把入参范围改为 `[0.6, 1.2]`；结合 `voiceProb`/`percussiveRatio` 做自适应补偿：
   - 人声占比高 → 允许更亮（补偿至 1.0）
   - 打击占比高 → 使用较低阈值防止持续闪白
3. 在 `kGain` 之前加入 soft-knee（如 `pow(uLevel, 0.75)`），降低 RMS 突增时的瞬时冲击。

## Wave（敏感度不足）
- 目前波形核心参数 (`uAmplitude`, `uFrequency`) 在 `applyWaveUniforms` 中默认为常数（`0.25`、`0.9`），音频调制只影响光晕 (`uGlowStrength`) 和色彩 (
`uBrightness`)。
- 因此显示“动得少”：波形主体未随 RMS/频段变化。

**建议**
1. 将振幅映射调整为：`amplitude = base + rms * sens * 0.35`，并使用 `percussiveRatio` 作为更快的突发增强；必要时引入 `voiceProb` 做稳定器。
2. 用 `spectralCentroid` 控制相位分离或频率，例如：
   ```ts
   const centroidNorm = clamp01(audio.centroid);
   shader.setUniform('uPhaseDelta', mix(0.4, 1.1, centroidNorm));
   shader.setUniform('uFrequency', mix(0.65, 1.05, centroidNorm));
   ```
3. 让 `uGlowStrength` 基于 `spectralFlux` / `pulse`，增大打击音时的高亮区域，并加入平滑（如 200ms EMA）以免闪烁。

## Spiral（颜色需更多变化）
- 色彩主要来源于 `hue(...)` 调用（`app/visuals/spiral.ts:100-104`）与后续亮度调制，范围被大量 clamp 限制在 `0.8` 内。
- 目前的 `hueShift` 是 `centroid`, `MFCC`, `pulse` 的线性叠加，缺少明显的色域跳变。

**建议**
1. 引入 `chroma` 或 `mfcc` 作为调色板索引：构造 3~4 组固定调色板（低频蓝、高频紫、打击暖色），根据 `dominantInstrument` 或 `percussiveRatio` 在段落之间切换。
2. 在 `march()` 返回后增加自定义的 `paletteMix`，例如：
   ```glsl
   vec3 baseHue = hue(...);
   vec3 paletteHue = mix(vec3(0.2,0.4,0.9), vec3(1.0,0.5,0.2), clamp(uPulse,0.,1.));
   col = mix(col, paletteHue, smoothstep(0.3, 0.8, uFlux));
   ```
3. 允许通过外部控制设置“旋涡主题”，在 `applySpiralUniforms` 中暴露一个 `theme` 枚举，将不同主题映射到不同的 `hueShift` 或 `specHue` 组合。

## Mosaic（变化过平均）
- `getBandActivity`（`app/visuals/mosaic.ts:266-299`）主要依赖噪声和常数，真正的频谱值只在 `spawnChance` 中简单加权。
- `extras.bandColumns` 从音频侧传入但目前没有使用。

**建议**
1. 在 `getBandActivity` 内直接使用 `extras.bandColumns`：
   ```ts
   const columns = this.extras?.bandColumns;
   const energy = columns ? columns[bandIndex] : 0;
   const normalized = Math.pow(clamp(energy, 0, 1), 0.6);
   ```
   用 `normalized` 替换噪声基线，再叠加少量噪声防止静态。
2. 将 `spawnChance`、`audioSizeMultiplier`、`ghost` 透明度都改为引用该 `normalized`，并利用 `bandLow/Mid/High` 做额外分段微调。
3. 引入“频段冷却”机制：频段活跃度短时间爆表后衰减（使用 0.5s 移动平均 + 最大值限制），让能量真正集中在显著频段。
4. 通过 `auroraMode` 时（`controls.auroraMode`），用 `bandColumns` mid/high 部分驱动背景渐变，让观众更直观看到频率向上移动。

## 后续落地建议
1. 先实现 Mosaic 的 `bandColumns` 接入（影响最大），确认频谱关联明显后再调节 spawn/growth 常数。
2. Wave 与 Accretion 调整可以共享一个“感度调节”配置（例如引入 UI slider），方便在不同设备上校准。
3. Spiral 的调色板建议做成 API（预设 + 外部覆盖），便于测试多种视觉风格。

---
*本报告未修改任何源代码，仅基于现有实现提出调优思路。*
