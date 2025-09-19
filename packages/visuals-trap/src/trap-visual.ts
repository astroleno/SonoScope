/**
 * Trap 风格可视化插件
 * 基于 p5.js 实现的几何变换和低音响应效果
 */

import p5 from 'p5';
import { VisualPlugin, FeatureTick, VisualPreset } from '@sonoscope/core';

interface TrapVisualState {
  backgroundColor: p5.Color;
  particleSpeed: number;
  particleDensity: number;
  blur: number;
  accentHue: number;
  fontWeight: number;
  
  // Trap 特有状态
  bassIntensity: number;
  geometricShapes: GeometricShape[];
  waveAmplitude: number;
  colorShift: number;
}

interface GeometricShape {
  x: number;
  y: number;
  size: number;
  rotation: number;
  color: p5.Color;
  shape: 'triangle' | 'square' | 'hexagon';
  pulse: number;
}

export class TrapVisualPlugin implements VisualPlugin {
  name = 'trap-visual';
  version = '1.0.0';
  capabilities = ['geometric', 'bass-response', 'color-shift', 'beat-sync'];
  supportedParams: (keyof VisualPreset)[] = [
    'bg', 'particleSpeed', 'particleDensity', 'blur', 'accentHue', 'fontWeight'
  ];

  private p5Instance: p5 | null = null;
  private container: HTMLElement | null = null;
  private state: TrapVisualState;
  private transitionManager: TransitionManager;

  constructor() {
    this.state = {
      backgroundColor: p5.prototype.color(0, 0, 0),
      particleSpeed: 1,
      particleDensity: 50,
      blur: 0,
      accentHue: 280, // 紫色基调
      fontWeight: 700,
      bassIntensity: 0,
      geometricShapes: [],
      waveAmplitude: 0,
      colorShift: 0
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
            
            // 初始化几何形状
            this.initializeShapes(p);
            resolve();
          };

          p.draw = () => {
            this.render(p);
          };

          p.windowResized = () => {
            if (container.clientWidth > 0 && container.clientHeight > 0) {
              p.resizeCanvas(container.clientWidth, container.clientHeight);
              this.initializeShapes(p);
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

    this.transitionManager.startTransition(targetState, durationMs);
  }

  renderTick(featureTick: FeatureTick): void {
    if (!this.p5Instance) return;

    // 更新状态
    this.state = this.transitionManager.getCurrentState();

    // 根据音频特征更新视觉效果
    this.updateVisuals(featureTick);
  }

  dispose(): void {
    if (this.p5Instance) {
      this.p5Instance.remove();
      this.p5Instance = null;
    }
    this.container = null;
    this.state.geometricShapes = [];
  }

  private render(p: p5): void {
    // 应用模糊效果
    if (this.state.blur > 0) {
      p.drawingContext.filter = `blur(${this.state.blur}px)`;
    } else {
      p.drawingContext.filter = 'none';
    }

    // 背景渐变
    this.renderBackground(p);

    // 渲染几何形状
    this.state.geometricShapes.forEach(shape => {
      this.renderShape(p, shape);
    });

    // 渲染波形
    this.renderWave(p);

    // 重置滤镜
    p.drawingContext.filter = 'none';
  }

  private renderBackground(p: p5): void {
    // 创建径向渐变背景
    for (let i = 0; i < p.height; i++) {
      const inter = p.map(i, 0, p.height, 0, 1);
      const c = p.lerpColor(
        p.color(0, 0, 0),
        p.color(this.state.accentHue, 20, 10),
        inter
      );
      p.stroke(c);
      p.line(0, i, p.width, i);
    }
  }

  private renderShape(p: p5, shape: GeometricShape): void {
    p.push();
    p.translate(shape.x, shape.y);
    p.rotate(shape.rotation);
    
    // 根据脉冲调整大小
    const size = shape.size * (1 + shape.pulse * 0.3);
    
    p.fill(shape.color);
    
    switch (shape.shape) {
      case 'triangle':
        p.triangle(0, -size/2, -size/2, size/2, size/2, size/2);
        break;
      case 'square':
        p.rect(-size/2, -size/2, size, size);
        break;
      case 'hexagon':
        this.drawHexagon(p, size);
        break;
    }
    
    p.pop();
  }

  private drawHexagon(p: p5, size: number): void {
    p.beginShape();
    for (let i = 0; i < 6; i++) {
      const angle = p.TWO_PI / 6 * i;
      const x = p.cos(angle) * size / 2;
      const y = p.sin(angle) * size / 2;
      p.vertex(x, y);
    }
    p.endShape(p.CLOSE);
  }

  private renderWave(p: p5): void {
    if (this.state.waveAmplitude <= 0) return;

    p.stroke(this.state.accentHue, 100, 100, 80);
    p.strokeWeight(3);
    p.noFill();

    p.beginShape();
    for (let x = 0; x < p.width; x += 5) {
      const y = p.height / 2 + 
        p.sin(x * 0.01 + this.state.colorShift) * this.state.waveAmplitude;
      p.vertex(x, y);
    }
    p.endShape();
  }

  private updateVisuals(featureTick: FeatureTick): void {
    if (!this.p5Instance) return;

    const p = this.p5Instance;
    const { rms, centroid, flux, onsetRate, bpm } = featureTick;

    // 更新低音强度（基于 RMS）
    this.state.bassIntensity = rms;

    // 更新波形振幅
    this.state.waveAmplitude = rms * 100;

    // 更新颜色偏移
    this.state.colorShift += 0.1;

    // 更新几何形状
    this.state.geometricShapes.forEach((shape, index) => {
      // 旋转
      shape.rotation += 0.02 * this.state.particleSpeed;

      // 脉冲效果（基于节拍）
      if (onsetRate > 0.3) {
        shape.pulse = Math.min(shape.pulse + 0.1, 1);
      } else {
        shape.pulse = Math.max(shape.pulse - 0.02, 0);
      }

      // 颜色变化
      const hue = (this.state.accentHue + centroid * 0.1 + index * 30) % 360;
      shape.color = p.color(hue, 80, 100, 70 + rms * 30);

      // 位置微调（基于通量）
      shape.x += p.sin(flux * 10) * 0.5;
      shape.y += p.cos(flux * 10) * 0.5;

      // 边界检测
      if (shape.x < 0) shape.x = p.width;
      if (shape.x > p.width) shape.x = 0;
      if (shape.y < 0) shape.y = p.height;
      if (shape.y > p.height) shape.y = 0;
    });

    // 节拍检测 - 创建新形状
    if (onsetRate > 0.5) {
      this.createBeatShape(p, rms, centroid);
    }
  }

  private initializeShapes(p: p5): void {
    this.state.geometricShapes = [];
    const shapeCount = Math.floor(this.state.particleDensity / 10);

    for (let i = 0; i < shapeCount; i++) {
      const shape: GeometricShape = {
        x: p.random(p.width),
        y: p.random(p.height),
        size: p.random(20, 80),
        rotation: p.random(p.TWO_PI),
        color: p.color(
          (this.state.accentHue + i * 30) % 360,
          80,
          100,
          70
        ),
        shape: p.random(['triangle', 'square', 'hexagon']),
        pulse: 0
      };

      this.state.geometricShapes.push(shape);
    }
  }

  private createBeatShape(p: p5, rms: number, centroid: number): void {
    const shape: GeometricShape = {
      x: p.width / 2 + p.random(-100, 100),
      y: p.height / 2 + p.random(-100, 100),
      size: p.random(30, 100) * rms,
      rotation: 0,
      color: p.color(
        (this.state.accentHue + centroid * 0.2) % 360,
        100,
        100,
        100
      ),
      shape: p.random(['triangle', 'square', 'hexagon']),
      pulse: 1
    };

    this.state.geometricShapes.push(shape);

    // 限制形状数量
    if (this.state.geometricShapes.length > 50) {
      this.state.geometricShapes.shift();
    }
  }
}

/**
 * 过渡管理器（与基础粒子插件类似）
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

  getCurrentState(): TrapVisualState {
    if (!this.currentTransition) {
      return this.startState;
    }

    const elapsed = Date.now() - this.startTime;
    const progress = Math.min(elapsed / this.duration, 1);
    const easedProgress = this.easeInOutCubic(progress);

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
    return colorStr;
  }

  private interpolateColor(startColor: any, endColor: any, t: number): any {
    return endColor;
  }
}

// 导出插件实例
export const trapVisualPlugin = new TrapVisualPlugin();
