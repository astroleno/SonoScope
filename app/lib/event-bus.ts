/**
 * 事件总线 - M1 阶段实现
 * 轻量级事件系统，支持类型安全的事件传递
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
export class EventBus {
  private listeners: Map<EventType, Set<EventHandler<any>>> = new Map();

  constructor() {
    // 初始化所有事件类型的监听器集合
    (['featureTick', 'decisionEvent', 'error', 'performance'] as EventType[]).forEach(
      type => this.listeners.set(type, new Set())
    );
  }

  /**
   * 订阅事件
   * @param type 事件类型
   * @param handler 事件处理器
   */
  on<T extends EventType>(type: T, handler: EventHandler<T>): void {
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
  off<T extends EventType>(type: T, handler: EventHandler<T>): void {
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
  emit<T extends EventType>(type: T, data: EventData[T]): void {
    const handlers = this.listeners.get(type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
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
  once<T extends EventType>(type: T, handler: EventHandler<T>): void {
    const onceHandler = (data: EventData[T]) => {
      handler(data);
      this.off(type, onceHandler);
    };
    this.on(type, onceHandler);
  }

  /**
   * 清空所有事件监听器
   */
  clear(): void {
    this.listeners.forEach(handlers => handlers.clear());
  }

  /**
   * 获取指定事件类型的监听器数量
   * @param type 事件类型
   * @returns 监听器数量
   */
  getListenerCount(type: EventType): number {
    const handlers = this.listeners.get(type);
    return handlers ? handlers.size : 0;
  }

  /**
   * 获取所有监听器信息
   * @returns 监听器信息对象
   */
  getListenersInfo(): Record<EventType, number> {
    const info = {} as Record<EventType, number>;
    this.listeners.forEach((handlers, type) => {
      info[type] = handlers.size;
    });
    return info;
  }
}
