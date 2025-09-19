# 05 可视化插件规范（来源：PRD.md）

- 生命周期：`init(container)` → `applyPreset(partial, durationMs)` → `renderTick(featureTick)` → `dispose()`
- 参数键：`bg`、`particleSpeed`、`particleDensity`、`blur`、`accentHue`、`fontWeight`（可扩展但需声明 capability）
- 过渡：由统一 `TransitionManager` 持有与插值，插件只消费结果
- 资源：切换前一帧离屏预热；插件自包含样式与资源路径

