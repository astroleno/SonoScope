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

  // 本地弹幕库
  private localPhrases: string[] = [
    '太棒了！',
    '好听！',
    '节奏感很强',
    '音色很美',
    '很有感觉',
    '继续！',
    '不错！',
    '喜欢这个',
    '很有氛围',
    '很棒的音乐',
    '节奏不错',
    '音质很好',
    '很有创意',
    '继续播放',
    '很好听',
    '很有感觉',
    '音色很棒',
    '节奏感强',
    '很喜欢',
    '太赞了',
  ];

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

      this.isInitialized = true;
      console.log('弹幕引擎初始化成功');
    } catch (error) {
      console.error('弹幕引擎初始化失败:', error);
      throw error;
    }
  }

  start(): void {
    if (!this.isInitialized) {
      throw new Error('弹幕引擎未初始化');
    }

    if (this.isActive) {
      return;
    }

    this.isActive = true;
    this.startAnimationLoop();
    console.log('弹幕引擎启动');
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
    const animate = () => {
      if (!this.isActive) {
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

    this.danmuItems.forEach((item, id) => {
      // 更新位置
      item.x += item.vx;
      // 固定 Y，不上下漂移

      // 不按时间衰减，改为走完整屏后移除

      // 更新元素位置
      item.element.style.transform = `translate(${item.x}px, ${item.y}px)`;

      // 更新透明度
      item.element.style.opacity = '1';

      // 检查是否需要移除
      const width = item.element.offsetWidth || 80;
      if (item.x < -width - 16) itemsToRemove.push(id);
    });

    // 移除过期弹幕
    itemsToRemove.forEach(id => {
      this.removeDanmu(id);
    });
  }

  // 处理音频特征事件
  handleFeatureTick(featureTick: FeatureTick): void {
    if (!this.isActive) {
      return;
    }

    const now = Date.now();

    // 控制生成频率
    if (now - this.lastGenerationTime < this.GENERATION_INTERVAL) {
      return;
    }

    // 根据音频特征选择弹幕
    const text = this.selectDanmuText(featureTick);
    if (!text) {
      return;
    }

    // 限制弹幕数量
    if (this.danmuItems.size >= this.MAX_DANMU_COUNT) {
      const firstId = this.danmuItems.keys().next().value;
      this.removeDanmu(firstId);
    }

    this.createDanmu(text, featureTick);
    this.lastGenerationTime = now;
  }

  // 外部文本注入：供管线/流式接口调用
  ingestText(text: string): void {
    if (!this.isActive) return;
    if (!text || !text.trim()) return;
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

  private selectDanmuText(featureTick: FeatureTick): string | null {
    const { rms, centroid, flux, onsetRate } = featureTick;

    // 根据音频特征选择不同的弹幕
    if (onsetRate > 0.5) {
      // 节拍强烈时
      return this.getRandomPhrase([
        '太棒了！',
        '节奏感很强',
        '继续！',
        '很有感觉',
      ]);
    } else if (rms > 0.7) {
      // 音量较大时
      return this.getRandomPhrase(['好听！', '音色很美', '不错！', '很喜欢']);
    } else if (centroid > 2000) {
      // 高频较多时
      return this.getRandomPhrase([
        '音色很棒',
        '很有创意',
        '音质很好',
        '太赞了',
      ]);
    } else if (flux > 0.3) {
      // 变化较大时
      return this.getRandomPhrase([
        '很有氛围',
        '很棒的音乐',
        '继续播放',
        '很好听',
      ]);
    }

    // 默认随机选择
    return this.getRandomPhrase(this.localPhrases);
  }

  private getRandomPhrase(phrases: string[]): string {
    return phrases[Math.floor(Math.random() * phrases.length)];
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
    const laneIdx = this.nextLane++ % laneCount;
    const lanePaddingTop = 56;
    const lanePaddingBottom = 56;
    const usableH = Math.max(100, screenH - lanePaddingTop - lanePaddingBottom);
    const laneGap = usableH / laneCount;
    const laneY = lanePaddingTop + laneIdx * laneGap + laneGap * 0.35;

    const x = screenW + 24;
    const y = laneY;
    // 速度多样化：基础速度 × (1 + rms 影响) × 随机因子
    const randomFactor = 0.7 + Math.random() * 0.8; // 0.7 ~ 1.5
    const speed = Math.max(1.2, this.DANMU_SPEED * (1 + rms * 0.8) * randomFactor);
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
    };

    this.danmuItems.set(id, danmuItem);
  }

  private removeDanmu(id: string): void {
    const item = this.danmuItems.get(id);
    if (item) {
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
