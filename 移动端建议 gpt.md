收到。我基于你描述的四个症状，在不改代码的前提下做“只读诊断”。给你一份按“现象 → 最可能原因 → 快速验证点”的排查清单。优先级按命中率排序。

1) preset 与 danmu 在移动端出现“两层文字”

最可能原因（命中率高）
	•	SSR/CSR 水土不服：根据窗口尺寸/UA 做了条件渲染，SSR 时走了桌面分支，客户端首帧变成移动分支，导致水合差异，旧节点没被正确回收，于是看起来像“双影/两层”。
	•	开启了文本描边/阴影的“双节点”实现（如一个用于描边、一个用于填充），移动端缩放后两层轻微错位。
	•	开启 React StrictMode（开发）触发双渲染，外加绝对定位/portal，造成视觉叠影（生产一般不会，但如果你线上是 dev/preview 构建就会踩）。

快速验证
	•	打开移动端 DevTools，检查 danmu 的 DOM 是否确实有重复节点（同一条内容两份）。
	•	查看是否在 render 期用到了 window.innerWidth / navigator.userAgent / matchMedia 等直接分支渲染；若有，需改为“首帧一致 + 挂载后再切换”的模式（例如先渲染通用结构，useEffect 再 setState）。
	•	搜索是否存在“文字描边”的双节点写法或 ::before/::after 复制文本；暂时关掉描边/阴影类，观察是否消失。
	•	检查是否使用了随机数（Math.random()、Date.now()）作为 key 或在 render 期生成 id，导致水合不稳定；改用 useId/useRef。

2) mosaic 只会生成三角形

最可能原因
	•	形状枚举在移动端拿到的是默认值（未传/类型转换失败），默认落在 3（三角形）。常见于从按钮 data-* 读取、或 URL 参数解析在 iOS Safari 上被空字符串/NaN 吃掉。
	•	WebGL/Shader 精度分支：移动端 fragment highp 不可用导致走了 fallback 路径（你的 fallback 只实现了三角镶嵌）。
	•	Canvas 尺寸与 DPR 未对齐，算法按像素块 size 计算时被四舍五入到最小三角块。

快速验证
	•	在切换形状后 console.log 实际生效的枚举/参数；对比桌面与移动。
	•	检查 shader/算法里是否有 #ifdef GL_FRAGMENT_PRECISION_HIGH 分支或“无扩展 → 退化到三角”的逻辑。
	•	明确设置 DPR：canvas.width = clientWidth * dpr; canvas.height = clientHeight * dpr; ctx.scale(dpr, dpr)，并确认算法里的单元 size 是按 CSS 像素还是设备像素。

3) 四种 preset 点击后变模糊（而非清晰）

最可能原因
	•	误用了 filter: blur(...) 而非 backdrop-filter，或 Tailwind 类名用错（blur-* 会模糊内容本身；backdrop-blur-* 才是模糊背景）。
	•	点击态/过渡态加了 transform: scale(...) 或 translateZ(0)，在移动端触发栅格化，文本与位图被“位图化缩放”导致发虚。
	•	DPR 失配：点击切换 preset 时重设了画布/视频流尺寸但没同步 DPR，首帧拉伸导致糊。

快速验证
	•	临时禁用与点击态相关的 filter/transform/动画类，看问题是否消失。
	•	检查 preset 切换时是否重建了 Canvas/WebGL，而 setPixelRatio 或 resizeObserver 没跑。
	•	在 DevTools 查看计算样式：是否有 filter: blur(...) 出现在容器或文本自身。

4) danmu 开/关都变模糊

最可能原因
	•	组件容器用了 backdrop-filter 但背景透明度/图层顺序不对，被浏览器当 filter 处理，直接把文字也模糊了。
	•	父级存在 will-change: filter/transform 或 filter: blur(0) 这类“看似无效”的声明，在移动端仍触发离屏合成，文字发虚。
	•	CSS 动画里有从 blur(2px) -> blur(0) 的过渡，动画结束后由于子像素/合成路径，残留轻微模糊。

快速验证
	•	对弹幕开关容器逐级禁用 filter/backdrop-filter/will-change/transform，二分法定位是哪一层导致。
	•	若在半透明玻璃拟态卡片上叠字：在文字层单独提取新 stacking context（position: relative; z-index），并确保文字层自身没有 filter。
	•	关闭开关动画，仅做显隐，观察是否消失。

通用“移动端发虚/双影”硬核排查项
	•	Canvas/WebGL 一律对齐 DPR；每次 resize/preset 切换后重新 gl.viewport() / 重新 scale(dpr,dpr)。
	•	避免对文本使用任何 transform/filter 动画；如需动，动容器的布局属性或使用不影响栅格化的过渡。
	•	避免渲染期读取窗口尺寸做条件 JSX；用“首帧一致（无分叉）+ 挂载后切换”。
	•	避免随机 key；任何会导致 SSR/CSR DOM 结构不同的逻辑都要挪到 useEffect。
	•	iOS Safari 特殊：-webkit-text-stroke 与阴影叠加时容易出现描边/填充错位，可改用 paint-order: stroke fill，或用 SVG 文本描边方案。
	•	检查是否用了 mix-blend-mode、backface-visibility、translateZ(0) 等会强制层合成的属性；在文本栈上尽量少用。

最小变更验证顺序（建议按这个顺序快速 A/B）
	1.	打开移动端 DevTools，确认是否确有重复 DOM（判定是“水合问题”还是“视觉叠影”）。
	2.	暂时移除所有 filter/backdrop-filter/blur/* 与 transform/*scale*/will-change，看三项模糊问题是否全部消失。
	3.	固定 DPR 与画布尺寸，打印实际 shape 枚举/参数，确认 mosaic 非预期枚举默认化。
	4.	若 1 判定为水合：把所有与 viewport/UA 相关的条件渲染改为“挂载后再切换”的模式；移除随机 key。

如果你愿意，把相关组件（danmu/preset/mosaic 的 JSX + 样式段落）贴出来，我可以继续做“只读”逐行定位。