/**
 * SonoScope 核心包入口文件
 * 导出所有核心功能模块
 */
// 事件系统
export { EventBus } from './events/event-bus';
// 状态管理
export { StateManager } from './state/state-manager';
// 数据验证
export { validateFeatureTickData, validateVisualPresetData, validateDecisionEventData, getValidationErrors } from './validation/schemas';
// 错误类型
export { SonoScopeError } from './types';
// 版本信息
export const VERSION = '1.0.0';
//# sourceMappingURL=index.js.map