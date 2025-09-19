# 声象 SonoScope - 精简版产品需求文档（MVP）

## 一、概述
- 名称：声象 SonoScope（浏览器端实时音乐可视化与弹幕）
- 定位：移动优先、可插拔、弱网可用、可访问性合规（WCAG 2.1 AA）
- 设计原则：轻量核心、数据契约先行、本地优先、渐进增强、简单可依赖

## 二、目标与成功标准
- 性能：首屏可用 ≤ 1s；首条弹幕 ≤ 1s；移动端渲染 ≥ 30fps（中端机）
- 稳定：风格切换平滑无抖动；弱网/断网有本地回退
- 扩展：统一数据契约与插件规范，支持 p5 可视化热插拔
- 成本：LLM 仅做增强（选择/短文本），频率 0.5–1 Hz，可完全关闭
- 可访问性：键盘全覆盖、屏幕阅读器兼容，达到 WCAG 2.1 AA

## 三、用户与核心场景
- 用户：音视频创作者、活动运营、互动装置、教育演示；含视障/听障用户
- 场景：播放音乐/拾音→即时可视化与字幕弹幕；一键切换主题；弱网仅本地反馈

## 四、范围与优先级
### MVP 必做
- 拾音接入与权限引导（移动端手势解锁 AudioContext）
- 本地特征提取：rms、spectralCentroid、spectralFlux、onsetRate、pitch?、bpm?
- 事件总线与数据契约：FeatureTick、DecisionEvent（JSON Schema 校验）
- 可视化插件系统：≥2 个 p5 场景；`applyPreset` 插值切换
- 弹幕：本地句库优先；按需调用 LLM（GLM-4.5）
- 可访问性基础：键盘导航、aria/live 区、可见焦点、高对比度模式

### 延期（MVP 后）
- 更稳健 BPM/打点；参数调试面板；插件清单/商店式配置
- 语音控制；本地嵌入相似度去重；WebRTC 实时通路（可选）

## 五、非功能指标
- 延迟：可视化快环 20–60ms；LLM 决策 0.5–1Hz；首条弹幕 < 1s
- 性能：移动端 ≥30fps（中端），桌面 ≥45fps；弱机自适应降级
- 可用性：无网可用（本地句库与可视微反馈）；自动恢复增强
- 稳定：风格切换具冷却与滞后；异常有回退路径
- 可访问性：WCAG 2.1 AA；键盘-only 测试通过；屏幕阅读器关键流程可达

## 六、核心流程与架构（精简）
- 拾音层：`getUserMedia` + `AudioWorklet` 输出频谱/时域数据
- 特征层：Meyda 生成 `FeatureTick`
- 控制层：状态机（阈值/冷却/统计窗）生成 `DecisionEvent`
- 可视化层：p5 插件消费 `FeatureTick` 与 `preset`
- 弹幕层：本地句库→（可选）LLM→`danmu` 事件
- 可访问性层：键盘导航、screen-reader 公告、动画/对比度控制
- 边缘/后端（可选）：Vercel Edge 签发令牌/限流/配置

## 七、数据契约（必需字段）
### FeatureTick
```
{
  t: number,
  rms: number,                 // 0..1
  spectralCentroid: number,    // Hz
  spectralFlux: number,        // 0..1
  onsetRate: number,           // /s
  bpm?: number,
  pitch?: number
}
```

### DecisionEvent
```
{
  style?: { name: string, confidence?: number, cooldownMs?: number },
  preset?: { bg?: string, particleSpeed?: number, particleDensity?: number, blur?: number, accentHue?: number, fontWeight?: number, ttlMs?: number },
  danmu?: { text: string, tone?: string, lifeMs?: number }
}
```

### 可访问性事件（建议）
```
{
  a11y: {
    announcement?: { text: string, priority?: 'polite'|'assertive' }
  }
}
```
说明：全部事件带 `version` 字段；前端用 ajv 做 Schema 校验，失败即回退本地规则。

## 八、插件规范（最小集合）
- 生命周期：`init(container)` → `applyPreset(partial, durationMs)` → `renderTick(featureTick)` → `dispose()`
- 能力声明：可选 `capability` 列表，参数键名受白名单约束
- 过渡：由统一 `TransitionManager` 插值，插件仅消费结果
- 无障碍：
  - 键盘可控（至少提供强度/主题切换的键位）
  - 提供 `getAccessibilityInfo()` 描述与高对比度支持

## 九、LLM 使用策略（精简）
- 模型：GLM-4.5；职责：风格选择、小幅参数建议、短弹幕
- 输入：最近 2s 统计特征 JSON；不传原始音频
- 频率：0.5–1Hz；超时/失败回退本地句库；近 10s 结果去重
- 模式：默认关闭或按需开启“增强模式”

## 十、风险与回退
- 风格抖动：进入/退出阈值分离 + 冷却时间 + EMA/中位数
- 移动端功耗：特征条件更新、粒子/分辨率自适应、可选 OffscreenCanvas
- 网络不稳：LLM 作为增强项；仅上传特征；无网回退本地
- 插件一致性：参数白名单 + capability 声明 + Schema 校验
- 可访问性合规：集成 axe-core 自动审计 + 手动键盘/阅读器测试

## 十一、里程碑（建议）
- M1（2 周）：拾音与特征 → 事件总线 → 1 个可视化插件 → 本地弹幕 → 基础无障碍
- M2（2 周）：第 2 个插件 → 预设插值 → 接入 GLM-4.5 → 移动端优化 → 键盘导航完善
- M3（1 周）：插件清单/配置页 → 性能/稳定性打磨 → 文档与示例站 → 无障碍审计

## 十二、验收标准
- 连续 10 分钟：桌面 ≥45fps、移动 ≥30fps；风格切换无抖动
- 弹幕：首条 <1s；后续平均 <800ms；失败自动回退
- 无网：保持基本可视与本地弹幕
- 可访问性：键盘-only 流程可达；屏幕阅读器关键操作可理解；对比度达 AA

## 十三、文档拆分建议（提质控复杂度）
- PRD（本文件）：业务目标、范围、指标、契约摘要、里程碑、验收
- 技术规范：音频管线、状态机、Schema、事件表（移入 `docs/tech-spec.md`）
- 插件开发：API 与示例、模板脚手架（移入 `docs/plugin-guide.md`）
- 无障碍细则：检查清单、测试流程、键位规范（移入 `docs/accessibility.md`）
- 开发体验：安装、脚本、目录结构、CI（移入 `docs/dev-setup.md`）

—— 通过“PRD 精简 + 专题文档”分层，减少主文档信息负荷，保留决策所需最小集。

