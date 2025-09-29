/**
 * 弹幕引擎 - M1 阶段实现
 * 负责弹幕生成、显示和管理
 */

import { EventBus, FeatureTick } from './event-bus';

interface DanmuItem {
  id: string;
  text: string;
  timestamp: number;
  life: number;
  element: HTMLElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  laneIdx: number; // 添加轨道索引
}

export class DanmuEngine {
  private eventBus: EventBus;
  private container: HTMLElement | null = null;
  private danmuItems: Map<string, DanmuItem> = new Map();
  private isInitialized = false;
  private isActive = false;
  private animationFrameId: number | null = null;
  // 水平轨道参数
  private lanes = 8;
  private nextLane = 0;
  private laneOccupancy: Set<number> = new Set(); // 跟踪轨道占用情况

  // 弹幕配置
  private readonly MAX_DANMU_COUNT = 15;
  private readonly DANMU_SPEED = 2;
  private readonly DANMU_LIFE = 5000; // 5秒
  private readonly GENERATION_INTERVAL = 3000; // 3秒生成一次

  // 生成控制
  private lastGenerationTime = 0;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  async initialize(): Promise<void> {
    try {
      // 获取弹幕容器
      this.container = document.getElementById('danmu-container');
      if (!this.container) {
        throw new Error('找不到弹幕容器');
      }

      // 设置容器样式
      this.setupContainer();

      // 初始化时强制清空容器与内部状态，避免刷新/热更新后残留
      try {
        this.clearAllDanmu();
        this.container.innerHTML = '';
        this.nextLane = 0;
      } catch {}

      this.isInitialized = true;
      console.log('弹幕引擎初始化成功');
    } catch (error) {
      console.error('弹幕引擎初始化失败:', error);
      throw error;
    }
  }

  start(): void {
    console.log('🎵 弹幕引擎: start() 被调用, isInitialized:', this.isInitialized, 'isActive:', this.isActive);
    
    if (!this.isInitialized) {
      console.error('🎵 弹幕引擎: 未初始化，无法启动');
      throw new Error('弹幕引擎未初始化');
    }

    if (this.isActive) {
      console.log('🎵 弹幕引擎: 已经激活，跳过启动');
      return;
    }

    // 启动前进行一次彻底清空，防止上一次会话的节点与状态残留
    try {
      this.clearAllDanmu();
      if (this.container) {
        this.container.innerHTML = '';
      }
      this.nextLane = 0;
    } catch {}

    this.isActive = true;
    this.startAnimationLoop();
    console.log('🎵 弹幕引擎: 启动成功, isActive:', this.isActive);
  }

  stop(): void {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // 清除所有弹幕
    this.clearAllDanmu();
    console.log('弹幕引擎停止');
  }

  dispose(): void {
    this.stop();

    if (this.container) {
      this.container.innerHTML = '';
    }

    this.isInitialized = false;
  }

  private setupContainer(): void {
    if (!this.container) return;

    this.container.style.position = 'absolute';
    this.container.style.top = '0';
    this.container.style.left = '0';
    this.container.style.width = '100%';
    this.container.style.height = '100%';
    this.container.style.pointerEvents = 'none';
    this.container.style.overflow = 'hidden';
    this.container.style.zIndex = '10';
  }

  private startAnimationLoop(): void {
    console.log('🎵 弹幕引擎: 启动动画循环');
    const animate = () => {
      if (!this.isActive) {
        console.log('🎵 弹幕引擎: 动画循环停止 - isActive:', this.isActive);
        return;
      }

      try {
        this.updateDanmu();
        this.animationFrameId = requestAnimationFrame(animate);
      } catch (error) {
        console.error('弹幕动画错误:', error);
        this.eventBus.emit('error', error as Error);
      }
    };

    this.animationFrameId = requestAnimationFrame(animate);
  }

  private updateDanmu(): void {
    const itemsToRemove: string[] = [];
    
    // 每5秒显示一次弹幕状态
    if (this.danmuItems.size > 0 && !(window as any).__lastDanmuStatusLog || Date.now() - (window as any).__lastDanmuStatusLog > 5000) {
      (window as any).__lastDanmuStatusLog = Date.now();
      console.log('🎵 弹幕引擎: 更新弹幕, 当前弹幕数:', this.danmuItems.size);
    }

    this.danmuItems.forEach((item, id) => {
      // 更新位置
      item.x += item.vx;
      // 固定 Y，不上下漂移

      // 不按时间衰减，改为走完整屏后移除

      // 更新元素位置
      item.element.style.left = `${item.x}px`;
      item.element.style.top = `${item.y}px`;

      // 更新透明度
      item.element.style.opacity = '1';

      // 检查是否需要移除：确保弹幕完全离开屏幕
      const width = item.element.offsetWidth || 200;
      if (item.x < -width - 50) { // 增加更多边距，确保完全离开
        itemsToRemove.push(id);
      }
    });

    // 移除过期弹幕
    itemsToRemove.forEach(id => {
      this.removeDanmu(id);
    });
  }

  // 处理音频特征事件
  handleFeatureTick(featureTick: FeatureTick): void {
    // 禁用自动生成，只使用外部注入的弹幕
    return;
  }

  // 外部文本注入：供管线/流式接口调用
  ingestText(text: string): void {
    console.log('🎵 弹幕引擎: 尝试注入文本:', text, 'isActive:', this.isActive, 'isInitialized:', this.isInitialized);
    
    if (!this.isActive) {
      console.log('🎵 弹幕引擎: 未激活，跳过弹幕创建');
      return;
    }
    if (!text || !text.trim()) {
      console.log('🎵 弹幕引擎: 文本为空，跳过弹幕创建');
      return;
    }
    
    console.log('🎵 弹幕引擎: 开始创建弹幕:', text);
    
    if (this.danmuItems.size >= this.MAX_DANMU_COUNT) {
      const firstId = this.danmuItems.keys().next().value;
      this.removeDanmu(firstId);
    }
    // 使用轻量特征占位，基于当前数量制造微小变化
    const pseudo: FeatureTick = {
      rms: 0.4 + Math.random() * 0.3,
      centroid: 1800 + Math.random() * 800,
      flux: 0.2 + Math.random() * 0.2,
      onsetRate: 0.3 + Math.random() * 0.4,
    } as FeatureTick;
    this.createDanmu(text, pseudo);
  }


  private createDanmu(text: string, featureTick: FeatureTick): void {
    if (!this.container) return;

    const id = `danmu-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // 创建弹幕元素
    const element = document.createElement('div');
    element.textContent = text;
    element.id = id;

    // 设置样式
    element.style.position = 'absolute';
    element.style.color = '#ffffff';
    element.style.fontSize = '16px';
    element.style.fontWeight = 'bold';
    element.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
    element.style.whiteSpace = 'nowrap';
    element.style.pointerEvents = 'none';
    element.style.userSelect = 'none';
    element.style.zIndex = '100';

    // 根据音频特征调整样式
    const { rms, centroid } = featureTick;
    element.style.fontSize = `${14 + rms * 8}px`;
    element.style.color = `hsl(${(centroid * 0.1) % 360}, 80%, 70%)`;

    // 添加到容器
    this.container.appendChild(element);

    // 计算初始位置和速度
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    const laneCount = Math.max(4, Math.min(12, this.lanes));
    
    // 智能轨道分配：避免重复
    let laneIdx = this.nextLane % laneCount;
    let attempts = 0;
    while (this.laneOccupancy.has(laneIdx) && attempts < laneCount) {
      laneIdx = (laneIdx + 1) % laneCount;
      attempts++;
    }
    
    // 如果所有轨道都被占用，选择最老的轨道
    if (this.laneOccupancy.has(laneIdx)) {
      laneIdx = this.nextLane % laneCount;
    }
    
    // 标记轨道为占用
    this.laneOccupancy.add(laneIdx);
    
    const lanePaddingTop = 56;
    const lanePaddingBottom = 56;
    const usableH = Math.max(100, screenH - lanePaddingTop - lanePaddingBottom);
    const laneGap = usableH / laneCount;
    const laneY = lanePaddingTop + laneIdx * laneGap + laneGap * 0.35;

    // 从屏幕右侧开始，确保横贯整个屏幕
    const x = screenW + 50; // 从屏幕外开始
    const y = laneY;
    
    // 设置初始位置
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
    
    // 计算横贯整个屏幕所需的时间（约8-12秒）
    const elementWidth = element.offsetWidth || 200; // 估算弹幕宽度
    const totalDistance = screenW + elementWidth + 100; // 总距离
    const duration = 8000 + Math.random() * 4000; // 8-12秒
    const speed = totalDistance / duration * 16.67; // 转换为每帧像素数（60fps）
    
    const vx = -speed;
    const vy = 0;

    // 创建弹幕项
    const danmuItem: DanmuItem = {
      id,
      text,
      timestamp: Date.now(),
      life: this.DANMU_LIFE,
      element,
      x,
      y,
      vx,
      vy,
      laneIdx, // 记录轨道索引
    };

    this.danmuItems.set(id, danmuItem);
    console.log('🎵 弹幕引擎: 弹幕创建完成:', text, '轨道:', laneIdx, '位置:', x, y, '速度:', vx);
  }

  private removeDanmu(id: string): void {
    const item = this.danmuItems.get(id);
    if (item) {
      // 释放轨道
      this.laneOccupancy.delete(item.laneIdx);
      
      if (item.element.parentNode) {
        item.element.parentNode.removeChild(item.element);
      }
      this.danmuItems.delete(id);
    }
  }

  private clearAllDanmu(): void {
    this.danmuItems.forEach(item => {
      if (item.element.parentNode) {
        item.element.parentNode.removeChild(item.element);
      }
    });
    this.danmuItems.clear();
    this.laneOccupancy.clear(); // 清除所有轨道占用
  }

  get isReady(): boolean {
    return this.isInitialized;
  }

  get isRunning(): boolean {
    return this.isActive;
  }

  get danmuCount(): number {
    return this.danmuItems.size;
  }
}
