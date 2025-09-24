## 预设选择器（Preset Selector）基于 FlipLink 的改造说明

### 背景
`ref_p5/Text/main.tsx` 中的 `FlipLink` 动画效果酷炫，但定位为“跳转链接的标题”。独立客户端需要“可选择的预设项”组件，因此需要将其从链接语义改造成可选择控件，并补齐交互、可访问性与性能策略。

### 结论（可行性）
- 可以将 `FlipLink` 作为“预设选择器”的视觉基础复用。
- 必要改造：语义从 `<a>` 跳转改为 `<button>`/`option` 选择；增加选中态、键盘可用性、ARIA 属性、国际化字符处理与移动端适配；控制 DOM 规模与过渡时序。

### 关键改造点
1) 交互与语义
- 使用 `<button>`（或自定义元素 + `role="option"`），容器可用 `role="listbox"` 或 `ul/li`。
- 点击触发“选择预设”事件，不做页面跳转。
- 管理状态：`selected`（选中）、`hover`（悬停）、`disabled`（禁用），视觉上明确区分。
- 键盘支持：上下/左右切换，Enter/Space 确认；提供焦点可见样式。
- ARIA：`aria-selected`、`aria-activedescendant`、`aria-disabled` 等。

2) 文本与国际化
- 现有按字符 `split("")` 会破坏中文、emoji、合字；需按“字素簇”分段。
- 建议使用 `Intl.Segmenter` 或基于 `grapheme-splitter` 的字素拆分。

3) 响应式与可访问性
- `prefers-reduced-motion`：为低动效用户提供降级（禁用或简化动画）。
- 移动端触控区域≥44px；字号在小屏收敛，避免溢出；长名称换行或截断并提供 `title`。

4) 性能与规模控制
- 每字符一个 `span`，元素数量 = 预设数 × 字符数 × 2（上下两行）。
- 控制每页预设数或采用虚拟滚动；缩短 `transitionDelay`；限制最长字符数或对超长名称使用整块过渡。

5) 视觉与主题
- 统一“默认/悬停/选中/禁用”配色，沿用 Tailwind 主题令牌（如 `text-primary`）。
- 提供紧凑版与放大版排版密度，适配预设数量不同的场景。

### 与现有实现相关的风险
- 非拉丁字符/emoji 被 `split("")` 拆坏，导致错位或渲染异常。
- 预设过多导致 DOM 过大、动画队列长，出现卡顿。
- 使用 `<a>` 语义不符应用内选择场景（无 SEO 需求）。

### 推荐的组件 API（最小可用）
```
<FlipOption
  label="Preset Name"
  selected={boolean}
  disabled={boolean}
  onSelect={() => void}
  density="compact | normal | spacious"
  animation="auto | reduced | off"
/>

<FlipOptionList
  options={Array<{ id: string; label: string; disabled?: boolean }>}
  value={string}
  onChange={(id: string) => void}
  orientation="horizontal | vertical"
  pageSize={number} // 可选，做分页/虚化控制
/>
```

### 事件与数据流建议
- 选择行为通过 `onSelect`/`onChange` 冒泡到上层，由上层状态管理（例如 Zustand/Context/Redux）更新当前预设。
- 将视觉组件做成“受控组件”（由 `selected/value` 驱动）。

### 字素簇拆分建议
- 优先使用原生 `Intl.Segmenter`（现代浏览器/Node 18+ 支持较好），回退到第三方库。
- 伪代码示例：
```ts
function segmentGraphemes(input: string): string[] {
  try {
    if ((Intl as any)?.Segmenter) {
      const seg = new (Intl as any).Segmenter(undefined, { granularity: 'grapheme' });
      return Array.from(seg.segment(input), (s: any) => s.segment);
    }
  } catch (_) {
    // ignore
  }
  // fallback（简单但不完美，可替换为 grapheme-splitter）
  return Array.from(input);
}
```

### 可访问性与键盘交互要点
- 容器：`role="listbox"`，管理 `aria-activedescendant` 指向当前高亮项。
- 子项：`role="option"`，根据状态设置 `aria-selected`、`aria-disabled`。
- 键盘：ArrowUp/Down/Left/Right 在子项间移动，Enter/Space 选择；Home/End 跳到首尾。
- 焦点样式：可见、对比度足够，禁用时焦点不可达。

### 响应式与降级策略
- `@media (prefers-reduced-motion: reduce)` 禁用翻转/位移动画，只保留颜色/阴影变化。
- 小屏幕：减小字号与字距，保证可读；多行自动换行或横向滚动。
- 超长名称：中间省略或两行折叠，并提供完整 `title`。

### 集成步骤（建议）
1. 抽取并改名 `FlipLink` → `FlipOption`，替换 `<a>` 为 `<button>`/`div role=option`。
2. 引入字素簇拆分工具，替换 `split("")`。
3. 添加 `selected/disabled/onSelect` 属性与样式，适配主题色。
4. 增加 `prefers-reduced-motion` 的 CSS 分支与移动端尺寸适配。
5. 封装 `FlipOptionList` 容器，负责键盘导航与 `aria-*` 管理。
6. 按需要添加分页/虚拟滚动，限制一次渲染的预设数量。
7. 与独立客户端的预设数据源与状态管理对接，完成受控化。

### 验收标准（DoD）
- 鼠标、键盘、触屏均可完成选择；焦点与选中态可视化明确。
- 在中文/emoji 名称下渲染与动画正常，无字符错位。
- `prefers-reduced-motion` 生效，动画降级无闪烁。
- 在 30 个预设、平均 10 字符/项的情况下，60FPS 基本稳定（或有降级/分页）。
- 无障碍检查（ARIA/对比度/焦点）通过基本审查。

### 后续扩展
- 搜索过滤、分组与收藏；最近使用排序。
- 多选与批量操作（需要改造 `role=listbox` → `aria-multiselectable`）。
- 动画主题切换（翻转/淡入/打字/滑入）。

---
说明：本文件为实现前的设计说明，落地实现时将以受控组件的方式提供，遵循现有主题体系与工程规范。


