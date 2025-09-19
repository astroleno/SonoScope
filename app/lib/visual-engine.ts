/**
 * 可视化引擎 - M1 阶段实现
 * 负责管理可视化插件和渲染循环
 */

import { EventBus, FeatureTick } from './event-bus';

export interface VisualPreset {
  bg: string;
  particleSpeed: number;
  particleDensity: number;
  blur: number;
  accentHue: number;
  fontWeight: number;
}

export interface VisualPlugin {
  name: string;
  version: string;
  capabilities: string[];
  supportedParams: (keyof VisualPreset)[];

  init(container: HTMLElement): Promise<void>;
  applyPreset(
    preset: Partial<VisualPreset>,
    _durationMs: number
  ): Promise<void>;
  renderTick(featureTick: FeatureTick): void;
  dispose(): void;
}

export class VisualEngine {
  private eventBus: EventBus;
  private container: HTMLElement | null = null;
  private currentPlugin: VisualPlugin | null = null;
  private isInitialized = false;
  private isRendering = false;
  private animationFrameId: number | null = null;

  // 性能监控
  private lastFrameTime = 0;
  private frameCount = 0;
  private fps = 0;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  async initialize(): Promise<void> {
    try {
      // 获取画布容器
      this.container = document.getElementById('visual-canvas');
      if (!this.container) {
        throw new Error('找不到可视化画布容器');
      }

      // 默认加载基础粒子插件
      await this.loadBasicParticlesPlugin();

      this.isInitialized = true;
      console.log('可视化引擎初始化成功');
    } catch (error) {
      console.error('可视化引擎初始化失败:', error);
      throw error;
    }
  }

  private async loadBasicParticlesPlugin(): Promise<void> {
    if (!this.container) {
      throw new Error('容器未初始化');
    }

    // 创建基础粒子插件
    const plugin = new BasicParticlesPlugin();
    await plugin.init(this.container);
    this.currentPlugin = plugin;

    // 开始渲染循环
    this.startRendering();
    console.log('基础粒子插件加载成功');
  }

  async applyPreset(
    preset: Partial<VisualPreset>,
    duration: number = 1000
  ): Promise<void> {
    if (!this.currentPlugin) {
      throw new Error('没有加载的可视化插件');
    }

    try {
      await this.currentPlugin.applyPreset(preset, duration);
    } catch (error) {
      console.error('应用预设失败:', error);
      throw error;
    }
  }

  dispose(): void {
    this.stopRendering();

    if (this.currentPlugin) {
      this.currentPlugin.dispose();
      this.currentPlugin = null;
    }

    this.isInitialized = false;
  }

  private startRendering(): void {
    if (this.isRendering) {
      return;
    }

    this.isRendering = true;
    this.lastFrameTime = performance.now();
    this.frameCount = 0;

    const render = (currentTime: number) => {
      if (!this.isRendering) {
        return;
      }

      try {
        // 更新 FPS
        this.updateFPS(currentTime);

        // 这里不直接渲染，而是等待音频特征事件
        // 实际的渲染由 renderTick 方法处理

        this.animationFrameId = requestAnimationFrame(render);
      } catch (error) {
        console.error('渲染循环错误:', error);
        this.eventBus.emit('error', error as Error);
      }
    };

    this.animationFrameId = requestAnimationFrame(render);
  }

  private stopRendering(): void {
    this.isRendering = false;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private updateFPS(currentTime: number): void {
    this.frameCount++;

    if (currentTime - this.lastFrameTime >= 1000) {
      this.fps = Math.round(
        (this.frameCount * 1000) / (currentTime - this.lastFrameTime)
      );
      this.frameCount = 0;
      this.lastFrameTime = currentTime;

      // 发送性能事件
      this.eventBus.emit('performance', {
        fps: this.fps,
        memory: this.getMemoryUsage(),
        latency: 0,
      });
    }
  }

  private getMemoryUsage(): number {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize / 1024 / 1024; // MB
    }
    return 0;
  }

  // 处理音频特征事件
  handleFeatureTick(featureTick: FeatureTick): void {
    if (this.currentPlugin && this.isRendering) {
      try {
        this.currentPlugin.renderTick(featureTick);
      } catch (error) {
        console.error('渲染特征失败:', error);
        this.eventBus.emit('error', error as Error);
      }
    }
  }

  get isReady(): boolean {
    return this.isInitialized;
  }

  get isActive(): boolean {
    return this.isRendering;
  }

  get currentFPS(): number {
    return this.fps;
  }
}

/**
 * 基础粒子插件 - M1 阶段实现
 */
class BasicParticlesPlugin implements VisualPlugin {
  name = 'basic-particles';
  version = '1.0.0';
  capabilities = ['particles', 'color-response', 'beat-detection'];
  supportedParams: (keyof VisualPreset)[] = [
    'bg',
    'particleSpeed',
    'particleDensity',
    'blur',
    'accentHue',
    'fontWeight',
  ];

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private particles: Particle[] = [];
  private container: HTMLElement | null = null;

  // 当前状态
  private currentPreset: Partial<VisualPreset> = {
    bg: '#000000',
    particleSpeed: 1,
    particleDensity: 100,
    blur: 0,
    accentHue: 200,
    fontWeight: 400,
  };

  async init(container: HTMLElement): Promise<void> {
    this.container = container;

    // 创建画布
    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'none';

    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) {
      throw new Error('无法创建画布上下文');
    }

    // 设置画布大小
    this.resizeCanvas();

    // 添加到容器
    container.appendChild(this.canvas);

    // 监听窗口大小变化
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  async applyPreset(
    preset: Partial<VisualPreset>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _durationMs: number
  ): Promise<void> {
    this.currentPreset = { ...this.currentPreset, ...preset };
  }

  renderTick(featureTick: FeatureTick): void {
    if (!this.ctx || !this.canvas) return;

    const { rms, centroid, flux, onsetRate } = featureTick;

    // 清空画布
    this.ctx.fillStyle = this.currentPreset.bg || '#000000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // 根据 RMS 调整粒子数量
    const targetParticleCount = Math.floor(
      (this.currentPreset.particleDensity || 100) * (0.5 + rms * 0.5)
    );

    // 添加新粒子
    while (this.particles.length < targetParticleCount) {
      this.addParticle(rms, centroid);
    }

    // 移除多余粒子
    while (this.particles.length > targetParticleCount) {
      this.particles.shift();
    }

    // 更新和渲染粒子
    this.particles.forEach(particle => {
      this.updateParticle(particle, rms, centroid, flux);
      this.renderParticle(particle);
    });

    // 节拍检测 - 创建爆发效果
    if (onsetRate > 0.5) {
      this.createBeatBurst(rms, centroid);
    }
  }

  dispose(): void {
    if (this.canvas && this.container) {
      this.container.removeChild(this.canvas);
    }
    this.particles = [];
    window.removeEventListener('resize', () => this.resizeCanvas());
  }

  private resizeCanvas(): void {
    if (!this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
  }

  private addParticle(rms: number, centroid: number): void {
    const particle: Particle = {
      x: Math.random() * (this.canvas?.width || 800),
      y: Math.random() * (this.canvas?.height || 600),
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 4,
      size: Math.random() * 4 + 2,
      color: this.hslToRgb(
        (this.currentPreset.accentHue || 200 + centroid * 0.1) % 360,
        80,
        70
      ),
      life: 1,
      maxLife: 1,
    };

    this.particles.push(particle);
  }

  private updateParticle(
    particle: Particle,
    rms: number,
    centroid: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _flux: number
  ): void {
    // 更新位置
    particle.x += particle.vx * (this.currentPreset.particleSpeed || 1);
    particle.y += particle.vy * (this.currentPreset.particleSpeed || 1);

    // 边界检测
    if (particle.x < 0 || particle.x > (this.canvas?.width || 800)) {
      particle.vx *= -1;
    }
    if (particle.y < 0 || particle.y > (this.canvas?.height || 600)) {
      particle.vy *= -1;
    }

    // 根据音频特征调整颜色
    const hue = (this.currentPreset.accentHue || 200 + centroid * 0.1) % 360;
    particle.color = this.hslToRgb(hue, 80, 50 + rms * 50);
  }

  private renderParticle(particle: Particle): void {
    if (!this.ctx) return;

    this.ctx.save();
    this.ctx.globalAlpha = particle.life;
    this.ctx.fillStyle = particle.color;
    this.ctx.beginPath();
    this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }

  private createBeatBurst(rms: number, centroid: number): void {
    const burstCount = Math.floor(rms * 10);

    for (let i = 0; i < burstCount; i++) {
      const particle: Particle = {
        x: (this.canvas?.width || 800) / 2 + (Math.random() - 0.5) * 100,
        y: (this.canvas?.height || 600) / 2 + (Math.random() - 0.5) * 100,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        size: Math.random() * 8 + 4,
        color: this.hslToRgb(
          (this.currentPreset.accentHue || 200 + centroid * 0.2) % 360,
          100,
          100
        ),
        life: 1,
        maxLife: 1,
      };

      this.particles.push(particle);
    }
  }

  private hslToRgb(h: number, s: number, l: number): string {
    h /= 360;
    s /= 100;
    l /= 100;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
    const m = l - c / 2;

    let r = 0,
      g = 0,
      b = 0;

    if (0 <= h && h < 1 / 6) {
      r = c;
      g = x;
      b = 0;
    } else if (1 / 6 <= h && h < 2 / 6) {
      r = x;
      g = c;
      b = 0;
    } else if (2 / 6 <= h && h < 3 / 6) {
      r = 0;
      g = c;
      b = x;
    } else if (3 / 6 <= h && h < 4 / 6) {
      r = 0;
      g = x;
      b = c;
    } else if (4 / 6 <= h && h < 5 / 6) {
      r = x;
      g = 0;
      b = c;
    } else if (5 / 6 <= h && h < 1) {
      r = c;
      g = 0;
      b = x;
    }

    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);

    return `rgb(${r}, ${g}, ${b})`;
  }
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
}
