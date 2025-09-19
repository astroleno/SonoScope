/**
 * 基础粒子可视化插件
 * 基于 p5.js 实现的粒子系统，响应音频特征变化
 */

import p5 from 'p5';
import { VisualPlugin, FeatureTick, VisualPreset } from '@sonoscope/core';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: p5.Color;
  life: number;
  maxLife: number;
}

interface BasicParticlesState {
  particles: Particle[];
  backgroundColor: p5.Color;
  particleSpeed: number;
  particleDensity: number;
  blur: number;
  accentHue: number;
  fontWeight: number;
}

export class BasicParticlesPlugin implements VisualPlugin {
  name = 'basic-particles';
  version = '1.0.0';
  capabilities = ['particles', 'color-response', 'beat-detection'];
  supportedParams: (keyof VisualPreset)[] = [
    'bg', 'particleSpeed', 'particleDensity', 'blur', 'accentHue', 'fontWeight'
  ];

  private p5Instance: p5 | null = null;
  private container: HTMLElement | null = null;
  private state: BasicParticlesState;
  private transitionManager: TransitionManager;

  constructor() {
    this.state = {
      particles: [],
      backgroundColor: p5.prototype.color(0, 0, 0),
      particleSpeed: 1,
      particleDensity: 100,
      blur: 0,
      accentHue: 0,
      fontWeight: 400
    };
    this.transitionManager = new TransitionManager();
  }

  async init(container: HTMLElement): Promise<void> {
    this.container = container;
    
    return new Promise((resolve, reject) => {
      try {
        this.p5Instance = new p5((p: p5) => {
          p.setup = () => {
            const canvas = p.createCanvas(
              container.clientWidth,
              container.clientHeight
            );
            canvas.parent(container);
            p.colorMode(p.HSB, 360, 100, 100, 100);
            p.noStroke();
            resolve();
          };

          p.draw = () => {
            this.render(p);
          };

          p.windowResized = () => {
            if (container.clientWidth > 0 && container.clientHeight > 0) {
              p.resizeCanvas(container.clientWidth, container.clientHeight);
            }
          };
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async applyPreset(preset: Partial<VisualPreset>, durationMs: number): Promise<void> {
    const targetState = this.transitionManager.createTransition(
      this.state,
      preset,
      durationMs
    );

    // 开始过渡动画
    this.transitionManager.startTransition(targetState, durationMs);
  }

  renderTick(featureTick: FeatureTick): void {
    if (!this.p5Instance) return;

    // 更新状态（如果有过渡动画）
    this.state = this.transitionManager.getCurrentState();

    // 根据音频特征更新粒子
    this.updateParticles(featureTick);
  }

  dispose(): void {
    if (this.p5Instance) {
      this.p5Instance.remove();
      this.p5Instance = null;
    }
    this.container = null;
    this.state.particles = [];
  }

  private render(p: p5): void {
    // 应用模糊效果
    if (this.state.blur > 0) {
      p.drawingContext.filter = `blur(${this.state.blur}px)`;
    } else {
      p.drawingContext.filter = 'none';
    }

    // 背景
    p.background(this.state.backgroundColor);

    // 渲染粒子
    this.state.particles.forEach(particle => {
      p.fill(particle.color);
      p.ellipse(particle.x, particle.y, particle.size, particle.size);
    });

    // 重置滤镜
    p.drawingContext.filter = 'none';
  }

  private updateParticles(featureTick: FeatureTick): void {
    if (!this.p5Instance) return;

    const p = this.p5Instance;
    const { rms, centroid, flux, onsetRate } = featureTick;

    // 根据 RMS 调整粒子密度
    const targetParticleCount = Math.floor(
      this.state.particleDensity * (0.5 + rms * 0.5)
    );

    // 添加新粒子
    while (this.state.particles.length < targetParticleCount) {
      this.addParticle(p, rms, centroid, flux);
    }

    // 移除多余粒子
    while (this.state.particles.length > targetParticleCount) {
      this.state.particles.shift();
    }

    // 更新现有粒子
    this.state.particles.forEach(particle => {
      // 更新位置
      particle.x += particle.vx * this.state.particleSpeed;
      particle.y += particle.vy * this.state.particleSpeed;

      // 更新生命周期
      particle.life--;
      if (particle.life <= 0) {
        particle.life = 0;
      }

      // 根据生命周期调整透明度
      const alpha = (particle.life / particle.maxLife) * 100;
      particle.color.setAlpha(alpha);

      // 边界检测
      if (particle.x < 0 || particle.x > p.width || 
          particle.y < 0 || particle.y > p.height) {
        particle.life = 0;
      }
    });

    // 移除死亡粒子
    this.state.particles = this.state.particles.filter(p => p.life > 0);

    // 节拍检测 - 创建爆发效果
    if (onsetRate > 0.5) {
      this.createBeatBurst(p, rms, centroid);
    }
  }

  private addParticle(p: p5, rms: number, centroid: number, flux: number): void {
    const particle: Particle = {
      x: p.random(p.width),
      y: p.random(p.height),
      vx: p.random(-2, 2),
      vy: p.random(-2, 2),
      size: p.random(2, 8) * (0.5 + rms),
      color: p.color(
        (this.state.accentHue + centroid * 0.1) % 360,
        80,
        100,
        80
      ),
      life: p.random(60, 120),
      maxLife: 120
    };

    this.state.particles.push(particle);
  }

  private createBeatBurst(p: p5, rms: number, centroid: number): void {
    const burstCount = Math.floor(rms * 20);
    
    for (let i = 0; i < burstCount; i++) {
      const particle: Particle = {
        x: p.width / 2 + p.random(-50, 50),
        y: p.height / 2 + p.random(-50, 50),
        vx: p.random(-5, 5),
        vy: p.random(-5, 5),
        size: p.random(4, 12),
        color: p.color(
          (this.state.accentHue + centroid * 0.2) % 360,
          100,
          100,
          100
        ),
        life: 30,
        maxLife: 30
      };

      this.state.particles.push(particle);
    }
  }
}

/**
 * 过渡管理器
 * 处理参数变化的平滑过渡
 */
class TransitionManager {
  private currentTransition: any = null;
  private startTime: number = 0;
  private duration: number = 0;
  private startState: any = null;
  private targetState: any = null;

  createTransition(currentState: any, preset: Partial<VisualPreset>, duration: number): any {
    return {
      backgroundColor: preset.bg ? this.parseColor(preset.bg) : currentState.backgroundColor,
      particleSpeed: preset.particleSpeed ?? currentState.particleSpeed,
      particleDensity: preset.particleDensity ?? currentState.particleDensity,
      blur: preset.blur ?? currentState.blur,
      accentHue: preset.accentHue ?? currentState.accentHue,
      fontWeight: preset.fontWeight ?? currentState.fontWeight
    };
  }

  startTransition(targetState: any, duration: number): void {
    this.currentTransition = targetState;
    this.startTime = Date.now();
    this.duration = duration;
    this.startState = { ...this.startState };
    this.targetState = targetState;
  }

  getCurrentState(): BasicParticlesState {
    if (!this.currentTransition) {
      return this.startState;
    }

    const elapsed = Date.now() - this.startTime;
    const progress = Math.min(elapsed / this.duration, 1);

    // 使用缓动函数
    const easedProgress = this.easeInOutCubic(progress);

    // 插值计算
    const currentState = { ...this.startState };
    
    if (this.targetState.backgroundColor) {
      currentState.backgroundColor = this.interpolateColor(
        this.startState.backgroundColor,
        this.targetState.backgroundColor,
        easedProgress
      );
    }

    Object.keys(this.targetState).forEach(key => {
      if (key !== 'backgroundColor' && typeof this.targetState[key] === 'number') {
        currentState[key] = this.lerp(
          this.startState[key],
          this.targetState[key],
          easedProgress
        );
      }
    });

    // 过渡完成
    if (progress >= 1) {
      this.currentTransition = null;
    }

    return currentState;
  }

  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  private lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t;
  }

  private parseColor(colorStr: string): any {
    // 简单的颜色解析，实际项目中可能需要更复杂的实现
    return colorStr;
  }

  private interpolateColor(startColor: any, endColor: any, t: number): any {
    // 颜色插值实现，这里简化处理
    return endColor;
  }
}

// 导出插件实例
export const basicParticlesPlugin = new BasicParticlesPlugin();
