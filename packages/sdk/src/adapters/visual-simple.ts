import { VisualizationPreset, VisualizationControls, AudioFeatures } from '../types';

export interface VisualAdapter {
  setPreset(preset: VisualizationPreset, controls?: VisualizationControls): void;
  render(canvas: HTMLCanvasElement | any, features?: AudioFeatures): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

export class SimpleVisualAdapter implements VisualAdapter {
  private p5Instance: any = null;
  private currentPreset: VisualizationPreset = 'pulse';
  private currentControls: VisualizationControls = {};

  constructor(p5Instance: any) {
    this.p5Instance = p5Instance;
  }

  setPreset(preset: VisualizationPreset, controls?: VisualizationControls): void {
    this.currentPreset = preset;
    this.currentControls = { ...this.currentControls, ...controls };
  }

  render(canvas: HTMLCanvasElement | any, features?: AudioFeatures): void {
    if (!this.p5Instance) return;

    const level = features?.rms ?? 0;
    const p = this.p5Instance;

    switch (this.currentPreset) {
      case 'pulse':
        this.renderPulse(p, level, features);
        break;
      case 'accretion':
        this.renderAccretion(p, level, features);
        break;
      case 'mosaic':
        this.renderMosaic(p, level, features);
        break;
      case 'spiral':
        this.renderSpiral(p, level, features);
        break;
    }
  }

  private renderPulse(p: any, level: number, features?: AudioFeatures): void {
    // Simple pulse visualization
    const centerX = p.width / 2;
    const centerY = p.height / 2;
    const baseRadius = Math.min(p.width, p.height) * 0.1;
    const pulseRadius = baseRadius * (1 + level * 2);

    // Background trail
    p.fill(0, 0, 0, 20);
    p.noStroke();
    p.rect(0, 0, p.width, p.height);

    // Pulse rings
    p.noFill();
    p.stroke(0, 212, 255, 150);
    p.strokeWeight(3);
    p.circle(centerX, centerY, pulseRadius * 2);

    p.stroke(139, 92, 246, 100);
    p.strokeWeight(2);
    p.circle(centerX, centerY, pulseRadius * 1.5);

    // Center glow
    p.fill(0, 212, 255, 100 + level * 100);
    p.noStroke();
    p.circle(centerX, centerY, pulseRadius * 0.8);
  }

  private renderAccretion(p: any, level: number, features?: AudioFeatures): void {
    // Simple accretion-like visualization
    const time = p.millis() / 1000;
    const centerX = p.width / 2;
    const centerY = p.height / 2;

    // Background
    p.fill(0, 0, 0, 30);
    p.noStroke();
    p.rect(0, 0, p.width, p.height);

    // Spiral pattern
    p.stroke(255, 0, 110, 150);
    p.strokeWeight(2);
    p.noFill();

    p.beginShape();
    for (let i = 0; i < 100; i++) {
      const angle = i * 0.1 + time * 0.5;
      const radius = i * 2 + level * 50;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      p.vertex(x, y);
    }
    p.endShape();
  }

  private renderMosaic(p: any, level: number, features?: AudioFeatures): void {
    // Simple mosaic-like visualization
    const cellSize = 20 + level * 30;
    const cols = Math.floor(p.width / cellSize);
    const rows = Math.floor(p.height / cellSize);

    // Background
    p.fill(0, 0, 0, 50);
    p.noStroke();
    p.rect(0, 0, p.width, p.height);

    // Cells
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = i * cellSize;
        const y = j * cellSize;
        const noise = p.noise(i * 0.1, j * 0.1, p.millis() * 0.001);
        
        if (noise > 0.5 + level * 0.3) {
          const hue = (i + j + p.millis() * 0.01) % 360;
          p.fill(p.color(hue, 80, 80, 150));
          p.noStroke();
          p.rect(x, y, cellSize, cellSize);
        }
      }
    }
  }

  private renderSpiral(p: any, level: number, features?: AudioFeatures): void {
    // Simple spiral visualization
    const centerX = p.width / 2;
    const centerY = p.height / 2;
    const time = p.millis() / 1000;

    // Background
    p.fill(0, 0, 0, 20);
    p.noStroke();
    p.rect(0, 0, p.width, p.height);

    // Spiral
    p.stroke(0, 255, 20, 200);
    p.strokeWeight(3);
    p.noFill();

    p.beginShape();
    for (let i = 0; i < 200; i++) {
      const angle = i * 0.1 + time * 2;
      const radius = i * 1.5 + level * 100;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      p.vertex(x, y);
    }
    p.endShape();
  }

  resize(width: number, height: number): void {
    if (this.p5Instance) {
      this.p5Instance.resizeCanvas(width, height);
    }
  }

  dispose(): void {
    // Clean up
  }
}
