/**
 * 状态管理器
 * 管理应用全局状态，提供状态订阅和更新机制
 */
import { EventBus } from '../events/event-bus';
export interface AppState {
    audio: {
        isActive: boolean;
        isInitialized: boolean;
        hasPermission: boolean;
    };
    visual: {
        currentPlugin: string | null;
        currentPreset: any;
        isRendering: boolean;
    };
    danmu: {
        isActive: boolean;
        queue: string[];
        lastGenerated: number;
    };
    performance: {
        fps: number;
        memory: number;
        latency: number;
    };
}
export interface SonoScopeConfig {
    audio: {
        fftSize: number;
        hopLength: number;
        smoothingTimeConstant: number;
    };
    visual: {
        targetFps: number;
        maxParticles: number;
        enableWebGL: boolean;
    };
    llm: {
        enabled: boolean;
        apiKey?: string;
        endpoint?: string;
        frequency: number;
        timeout: number;
    };
    accessibility: {
        highContrast: boolean;
        reducedMotion: boolean;
        screenReader: boolean;
    };
}
/**
 * 状态管理器类
 * 提供响应式状态管理和状态持久化
 */
export declare class StateManager {
    private state;
    private config;
    private eventBus;
    private subscribers;
    constructor(eventBus: EventBus, config: SonoScopeConfig);
    /**
     * 获取初始状态
     */
    private getInitialState;
    /**
     * 获取当前状态
     */
    getState(): AppState;
    /**
     * 获取配置
     */
    getConfig(): SonoScopeConfig;
    /**
     * 更新状态
     * @param partialState 部分状态更新
     */
    updateState(partialState: Partial<AppState>): void;
    /**
     * 更新配置
     * @param partialConfig 部分配置更新
     */
    updateConfig(partialConfig: Partial<SonoScopeConfig>): void;
    /**
     * 订阅状态变化
     * @param callback 状态变化回调
     * @returns 取消订阅函数
     */
    subscribe(callback: (state: AppState) => void): () => void;
    /**
     * 通知所有订阅者
     */
    private notifySubscribers;
    /**
     * 重置状态到初始值
     */
    reset(): void;
    /**
     * 获取状态快照（用于调试）
     */
    getSnapshot(): {
        state: AppState;
        config: SonoScopeConfig;
        timestamp: number;
    };
}
//# sourceMappingURL=state-manager.d.ts.map