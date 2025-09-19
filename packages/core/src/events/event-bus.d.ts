/**
 * 事件总线实现
 * 简化的类型安全事件系统
 */
export interface FeatureTick {
    t: number;
    rms: number;
    centroid: number;
    flux: number;
    onsetRate: number;
    bpm?: number;
    pitch?: number;
    version: string;
}
export interface DecisionEvent {
    type: 'style.switch' | 'preset.suggest' | 'danmu.text';
    [key: string]: any;
}
export type EventType = 'featureTick' | 'decisionEvent' | 'error' | 'performance';
export interface EventData {
    featureTick: FeatureTick;
    decisionEvent: DecisionEvent;
    error: Error;
    performance: {
        fps: number;
        memory: number;
        latency: number;
    };
}
type EventHandler<T extends EventType> = (data: EventData[T]) => void;
/**
 * 事件总线类
 * 提供类型安全的事件发布/订阅机制
 */
export declare class EventBus {
    private listeners;
    constructor();
    /**
     * 订阅事件
     * @param type 事件类型
     * @param handler 事件处理器
     */
    on<T extends EventType>(type: T, handler: EventHandler<T>): void;
    /**
     * 取消订阅事件
     * @param type 事件类型
     * @param handler 事件处理器
     */
    off<T extends EventType>(type: T, handler: EventHandler<T>): void;
    /**
     * 发布事件
     * @param type 事件类型
     * @param data 事件数据
     */
    emit<T extends EventType>(type: T, data: EventData[T]): void;
    /**
     * 一次性订阅事件
     * @param type 事件类型
     * @param handler 事件处理器
     */
    once<T extends EventType>(type: T, handler: EventHandler<T>): void;
    /**
     * 清空所有事件监听器
     */
    clear(): void;
    /**
     * 获取指定事件类型的监听器数量
     * @param type 事件类型
     * @returns 监听器数量
     */
    getListenerCount(type: EventType): number;
    /**
     * 获取所有监听器信息
     * @returns 监听器信息对象
     */
    getListenersInfo(): Record<EventType, number>;
}
export {};
//# sourceMappingURL=event-bus.d.ts.map