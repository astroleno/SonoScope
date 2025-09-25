# 独立客户端 TODO（交付端 Facade 方案）

## 目标
- 与测试端体验一致，隐藏核心接口，仅暴露受控微调项。
- 保证无网络/无模型/无麦克风时可正常降级运行。

## 待办清单

### 1. Facade 封装（高优先级）
- [ ] 新建 `packages/sdk` 扩展：`ClientFacade`（组合 Core + 适配器）
  - [ ] 方法：`start/stop/dispose/setPreset/applyConfig/getStatus`
  - [ ] 状态：运行状态、当前预设、简要特征统计、弹幕计数
  - [ ] 事件桥接：`danmu` 事件透传（隐藏内部总线）
  - [ ] 入参校验：范围限制 + 防抖 + 默认回退

### 2. 配置与预设（高优先级）
- [ ] 定义 `client.config.schema.json`（白名单 + 范围）
- [ ] 默认预设：`vocal_first` / `percussive_first` / `electronic` / `pop`
- [ ] 主题令牌：与 `app/app/globals.css` 对齐，暴露安全子集
- [ ] 导入/导出：JSON（可选签名校验）

### 3. 弹幕链路（高优先级）
- [x] 默认使用 `EnhancedDanmuAdapter`
- [ ] 回退 `SimpleDanmuAdapter`（异常或性能受限）
- [x] 冷却/密度：`cooldownMs`（已实现）／`maxDensityPerMin`（待定）
- [ ] 文案模板：本地简短模板（无LLM时）

### 4. 可视化与性能（高优先级）
- [x] 适配 `SimpleVisualAdapter`，预设参数限制（基础已接入）
- [ ] 质量档位：`low/med/high`（分辨率/特效）
- [ ] Worker 开关与回退（与现有 WorkerManager 对齐）

### 5. UI 外壳（中优先级）
- [ ] “基础微调”面板（滑块 + 选择器）
- [ ] 只读状态面板（运行/预设/简要特征/弹幕数）
- [ ] 预设下拉 + 一键恢复默认

### 6. 运行与打包（中优先级）
- [x] Web 构建：`pnpm -r build` 一体化打包
- [ ] 桌面封装（可选）：Tauri/Electron 脚手架与 CI 脚本
- [ ] 资源离线：本地模型可选放置与加载策略

### 7. 验证与回归（高优先级）
- [x] Node 侧：Worker/HPSS/性能三套脚本跑通
- [x] 浏览器端：/client-shell 端到端点击验证（开始/停止/预设/弹幕）
- [ ] 降级链路：断网/无模型/无麦克风场景
- [ ] 压力测试：密度/帧率与内存观察

### 8. 文档与交付（中优先级）
- [x] 更新 `客户端说明.md`（已完成基础更新，待补 Facade API 与预设说明）
- [ ] 发布说明与变更日志
- [ ] 客户参数手册（白名单与范围）

## 风险与对策
- LLM/模型网络不稳定 → 本地模板/启发式回退
- 浏览器权限差异 → 设备选择回退与提示
- 性能波动 → 质量档位与 Worker 优先

## 完成标准
- 一键启动（Web）与可选桌面打包
- 断网/无模型可用，体验与测试端一致
- 仅通过 Facade 暴露可调项，越权操作被拒绝


