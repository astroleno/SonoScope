/**
 * SonoScope 核心包入口文件
 * 导出所有核心功能模块
 */
export { EventBus } from './events/event-bus';
export type { FeatureTick, DecisionEvent } from './events/event-bus';
export { StateManager } from './state/state-manager';
export type { AppState, SonoScopeConfig } from './state/state-manager';
export { validateFeatureTickData, validateVisualPresetData, validateDecisionEventData, getValidationErrors } from './validation/schemas';
export type { FeatureTick as ValidationFeatureTick, VisualPreset, DecisionEvent as ValidationDecisionEvent } from './validation/schemas';
export { SonoScopeError } from './types';
export declare const VERSION = "1.0.0";
//# sourceMappingURL=index.d.ts.map