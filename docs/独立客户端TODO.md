# 独立客户端 TODO（SonoScope 客户端外壳）

> 目标：将“音频采集/特征/可视化/弹幕”能力沉到可复用核心（monorepo packages），构建独立客户端外壳（Web/Electron/移动壳），通过稳定 SDK 调用核心。

## 0. 基线与范围
- **核心不重写**：沿用 `packages/*` 能力；抽出统一 SDK 接口
- **首期目标**：桌面 Web/Electron 外壳可运行；可切换可视化与弹幕；可配置主题
- **不纳入**：支付/登录等业务，另立模块

## 1. 包结构与抽象
- [ ] 整理核心包边界（保留）
  - [ ] `packages/core`: 事件总线、特征聚合、调度、类型
  - [ ] `packages/danmu-pipeline`: 弹幕状态机、风格映射、渲染适配层
  - [ ] `packages/visuals-*`: 视觉预设（p5/WebGL）
  - [ ] `packages/shared`: 公共类型/工具
- [ ] 新增 `packages/sdk`（对外 API）
  - [ ] 打包为 ESM + CJS，类型导出
  - [ ] 不直接依赖 UI；仅暴露接口与事件

## 2. Core SDK 接口（packages/sdk）
- [ ] 初始化
  - [ ] `Core.init(options: { transports, storage, modelProviders })`
  - [ ] 生命周期：`start() / stop() / dispose()`
- [ ] 订阅
  - [ ] `on('features', (f: AudioFeatures)=>void)`
  - [ ] `on('danmu', (d: DanmuEvent)=>void)`
  - [ ] `on('log'|'error', ...)`
- [ ] 控制
  - [ ] `visual.setPreset(name, controls?)`
  - [ ] `visual.render(canvas | p5Instance)`
  - [ ] `danmu.trigger(payload?)`
  - [ ] `audio.setSource(deviceId|MediaStream|File)`
  - [ ] `config.set({ themeTokens, sensitivity, genre, flags })`
- [ ] 类型与协议
  - [ ] `AudioFeatures`, `VisualizationControls`, `DanmuCommand`, `ThemeTokens`

## 3. 传输与运行时
- [ ] Web Worker 通道
  - [ ] 主线程 <-> Worker：`postMessage`，传递音频帧/特征
  - [ ] 大对象使用 `transferables`
- [ ] Electron IPC 通道（第二期）
  - [ ] 主进程/渲染进程：`ipcMain/ipcRenderer`
- [ ] WebSocket（可选，远端推理）
  - [ ] 统一封装为 `Transports` 插件

## 4. 音频源与特征
- [ ] 设备选择与回退（默认设备容错）
- [ ] Meyda 基础特征与增强聚合器接入
- [ ] 采样率/缓冲区参数暴露为配置
- [ ] 自动校准与噪声底跟踪

## 5. 可视化层
- [ ] 预设接入：`pulse | accretion | spiral | mosaic`
- [ ] 统一 `applyUniforms` 适配器（SDK 内部）
- [ ] 主题令牌映射到视觉（色彩/发光）
- [ ] 性能开关：低端设备降级策略

## 6. 弹幕引擎
- [ ] 触发状态机接入（已完成于现项目，封装为 SDK 方法）
- [ ] 样式层解耦：文本描边/发光/入场动效；安全区域布局
- [ ] 音频驱动参数（level/flux/centroid/pulse） -> 速度/字号/发光
- [ ] 风格预设与可扩展主题（EDM/Lo-fi/Trap 等）

## 7. 客户端外壳（Web/Electron）
- [ ] Web 壳（现有 `app/` 抽稀为 Demo 壳）
  - [ ] 仅保留：设备选择、开始/停止、预设切换、少量调参
  - [ ] UI 使用 `ThemeTokens`，与企业主题解耦
- [ ] Electron 壳（第二期）
  - [ ] 菜单/窗口/音频输入权限、文件拖放

## 8. 打包与分发
- [ ] SDK：`tsup/rollup` 产出 ESM+CJS+类型
- [ ] Web 壳：Next.js 生产构建，禁用调试日志
- [ ] Electron：`electron-builder` 目标（mac/win）

## 9. 质量与监控
- [ ] 单测：SDK 类型/事件/边界条件
- [ ] 集成测试：Worker 通路、设备回退
- [ ] 性能基线：CPU/GPU 利用与帧率
- [ ] 远程日志与崩溃上报接口

## 10. 迁移次序（建议一周节奏）
- [ ] 第1天：梳理类型与事件，起草 `packages/sdk` 骨架
- [ ] 第2天：接入音频/特征与可视化适配器
- [ ] 第3天：弹幕引擎封装到 SDK；提供 `danmu.trigger()`
- [ ] 第4天：Web 壳最小界面+主题令牌
- [ ] 第5天：传输抽象（Worker）与设备容错；打包与文档
- [ ] 第6-7天：测试与修复，准备客户 Demo
