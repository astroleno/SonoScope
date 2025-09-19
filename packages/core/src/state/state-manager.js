/**
 * 状态管理器
 * 管理应用全局状态，提供状态订阅和更新机制
 */
import { SonoScopeError } from '../types';
/**
 * 状态管理器类
 * 提供响应式状态管理和状态持久化
 */
export class StateManager {
    state;
    config;
    eventBus;
    subscribers = new Set();
    constructor(eventBus, config) {
        this.eventBus = eventBus;
        this.config = config;
        this.state = this.getInitialState();
        // 监听性能事件
        this.eventBus.on('performance', (metrics) => {
            this.updateState({
                performance: {
                    fps: metrics.fps,
                    memory: metrics.memory,
                    latency: metrics.latency
                }
            });
        });
        // 监听错误事件
        this.eventBus.on('error', (error) => {
            console.error('状态管理器捕获错误:', error);
        });
    }
    /**
     * 获取初始状态
     */
    getInitialState() {
        return {
            audio: {
                isActive: false,
                isInitialized: false,
                hasPermission: false
            },
            visual: {
                currentPlugin: null,
                currentPreset: {},
                isRendering: false
            },
            danmu: {
                isActive: false,
                queue: [],
                lastGenerated: 0
            },
            performance: {
                fps: 0,
                memory: 0,
                latency: 0
            }
        };
    }
    /**
     * 获取当前状态
     */
    getState() {
        return { ...this.state };
    }
    /**
     * 获取配置
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * 更新状态
     * @param partialState 部分状态更新
     */
    updateState(partialState) {
        try {
            const newState = { ...this.state, ...partialState };
            // 深度合并嵌套对象
            if (partialState.audio) {
                newState.audio = { ...this.state.audio, ...partialState.audio };
            }
            if (partialState.visual) {
                newState.visual = { ...this.state.visual, ...partialState.visual };
            }
            if (partialState.danmu) {
                newState.danmu = { ...this.state.danmu, ...partialState.danmu };
            }
            if (partialState.performance) {
                newState.performance = { ...this.state.performance, ...partialState.performance };
            }
            this.state = newState;
            this.notifySubscribers();
        }
        catch (error) {
            const sonoScopeError = new SonoScopeError('状态更新失败', 'STATE_UPDATE_ERROR', { partialState, error });
            this.eventBus.emit('error', sonoScopeError);
        }
    }
    /**
     * 更新配置
     * @param partialConfig 部分配置更新
     */
    updateConfig(partialConfig) {
        try {
            this.config = { ...this.config, ...partialConfig };
        }
        catch (error) {
            const sonoScopeError = new SonoScopeError('配置更新失败', 'CONFIG_UPDATE_ERROR', { partialConfig, error });
            this.eventBus.emit('error', sonoScopeError);
        }
    }
    /**
     * 订阅状态变化
     * @param callback 状态变化回调
     * @returns 取消订阅函数
     */
    subscribe(callback) {
        this.subscribers.add(callback);
        // 立即调用一次
        callback(this.getState());
        // 返回取消订阅函数
        return () => {
            this.subscribers.delete(callback);
        };
    }
    /**
     * 通知所有订阅者
     */
    notifySubscribers() {
        this.subscribers.forEach(callback => {
            try {
                callback(this.getState());
            }
            catch (error) {
                console.error('状态订阅者回调执行失败:', error);
            }
        });
    }
    /**
     * 重置状态到初始值
     */
    reset() {
        this.state = this.getInitialState();
        this.notifySubscribers();
    }
    /**
     * 获取状态快照（用于调试）
     */
    getSnapshot() {
        return {
            state: this.getState(),
            config: this.getConfig(),
            timestamp: Date.now()
        };
    }
}
//# sourceMappingURL=state-manager.js.map