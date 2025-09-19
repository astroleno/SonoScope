/**
 * 事件总线实现
 * 简化的类型安全事件系统
 */
/**
 * 事件总线类
 * 提供类型安全的事件发布/订阅机制
 */
export class EventBus {
    listeners = new Map();
    constructor() {
        // 初始化所有事件类型的监听器集合
        ['featureTick', 'decisionEvent', 'error', 'performance'].forEach(type => this.listeners.set(type, new Set()));
    }
    /**
     * 订阅事件
     * @param type 事件类型
     * @param handler 事件处理器
     */
    on(type, handler) {
        const handlers = this.listeners.get(type);
        if (handlers) {
            handlers.add(handler);
        }
    }
    /**
     * 取消订阅事件
     * @param type 事件类型
     * @param handler 事件处理器
     */
    off(type, handler) {
        const handlers = this.listeners.get(type);
        if (handlers) {
            handlers.delete(handler);
        }
    }
    /**
     * 发布事件
     * @param type 事件类型
     * @param data 事件数据
     */
    emit(type, data) {
        const handlers = this.listeners.get(type);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(data);
                }
                catch (error) {
                    console.error(`事件处理器执行失败 (${type}):`, error);
                }
            });
        }
    }
    /**
     * 一次性订阅事件
     * @param type 事件类型
     * @param handler 事件处理器
     */
    once(type, handler) {
        const onceHandler = (data) => {
            handler(data);
            this.off(type, onceHandler);
        };
        this.on(type, onceHandler);
    }
    /**
     * 清空所有事件监听器
     */
    clear() {
        this.listeners.forEach(handlers => handlers.clear());
    }
    /**
     * 获取指定事件类型的监听器数量
     * @param type 事件类型
     * @returns 监听器数量
     */
    getListenerCount(type) {
        const handlers = this.listeners.get(type);
        return handlers ? handlers.size : 0;
    }
    /**
     * 获取所有监听器信息
     * @returns 监听器信息对象
     */
    getListenersInfo() {
        const info = {};
        this.listeners.forEach((handlers, type) => {
            info[type] = handlers.size;
        });
        return info;
    }
}
//# sourceMappingURL=event-bus.js.map