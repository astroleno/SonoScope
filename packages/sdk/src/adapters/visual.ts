import { VisualizationPreset, VisualizationControls, AudioFeatures } from '../types';

export interface VisualAdapter {
  setPreset(preset: VisualizationPreset, controls?: VisualizationControls): void;
  render(canvas: HTMLCanvasElement | any, features?: AudioFeatures): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

export class P5VisualAdapter implements VisualAdapter {
  private p5Instance: any = null;
  private currentPreset: VisualizationPreset = 'pulse';
  private currentControls: VisualizationControls = {};
  private visualizers: Map<VisualizationPreset, any> = new Map();
  private isInitialized = false;

  constructor(p5Instance: any) {
    this.p5Instance = p5Instance;
    this.initializeVisualizers();
  }

  private async initializeVisualizers(): Promise<void> {
    try {
      // Import visualizers dynamically
      const { drawPulse } = await import('@sonoscope/visuals-basic');
      const { drawAccretion, applyAccretionAudioUniforms } = await import('@sonoscope/visuals-basic');
      const { drawMosaic, applyMosaicUniforms, MosaicVisual } = await import('@sonoscope/visuals-basic');
      const { drawSpiral } = await import('@sonoscope/visuals-trap');

      // Initialize visualizers
      this.visualizers.set('pulse', { draw: drawPulse });
      this.visualizers.set('accretion', { draw: drawAccretion, applyUniforms: applyAccretionAudioUniforms });
      this.visualizers.set('mosaic', { draw: drawMosaic, applyUniforms: applyMosaicUniforms, class: MosaicVisual });
      this.visualizers.set('spiral', { draw: drawSpiral });

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize visualizers:', error);
    }
  }

  setPreset(preset: VisualizationPreset, controls?: VisualizationControls): void {
    this.currentPreset = preset;
    this.currentControls = { ...this.currentControls, ...controls };
  }

  render(canvas: HTMLCanvasElement | any, features?: AudioFeatures): void {
    if (!this.isInitialized || !this.p5Instance) return;

    const visualizer = this.visualizers.get(this.currentPreset);
    if (!visualizer) return;

    try {
      switch (this.currentPreset) {
        case 'pulse':
          this.renderPulse(visualizer, features);
          break;
        case 'accretion':
          this.renderAccretion(visualizer, features);
          break;
        case 'mosaic':
          this.renderMosaic(visualizer, features);
          break;
        case 'spiral':
          this.renderSpiral(visualizer, features);
          break;
      }
    } catch (error) {
      console.error(`Error rendering ${this.currentPreset}:`, error);
    }
  }

  private renderPulse(visualizer: any, features?: AudioFeatures): void {
    // Create particles if not exists
    if (!this.p5Instance._pulseParticles) {
      this.p5Instance._pulseParticles = [];
      for (let i = 0; i < 50; i++) {
        this.p5Instance._pulseParticles.push({
          x: this.p5Instance.random(this.p5Instance.width),
          y: this.p5Instance.random(this.p5Instance.height),
          r: this.p5Instance.random(2, 8),
          a: this.p5Instance.random(50, 150),
          vx: this.p5Instance.random(-1, 1),
          vy: this.p5Instance.random(-1, 1),
        });
      }
    }

    const level = features?.rms ?? 0;
    const pulseFeatures = features ? {
      spectralCentroid: features.spectralCentroid,
      spectralBandwidth: features.spectralBandwidth,
      spectralFlux: features.spectralFlux,
      tempo: features.tempo?.bpm,
      beatStrength: features.percussiveRatio,
    } : undefined;

    visualizer.draw(this.p5Instance, this.p5Instance._pulseParticles, level, pulseFeatures);
  }

  private renderAccretion(visualizer: any, features?: AudioFeatures): void {
    if (!this.p5Instance._accretionShader) {
      // Initialize shader
      this.p5Instance._accretionShader = this.p5Instance.createShader(
        this.p5Instance._accretionVertexShader || '',
        this.p5Instance._accretionFragmentShader || ''
      );
    }

    const shader = this.p5Instance._accretionShader;
    if (!shader) return;

    const level = features?.rms ?? 0;
    const sensitivity = this.currentControls.sensitivity ?? 1.0;
    const controls = {
      gainScale: this.currentControls.gainScale,
      flickerStrength: this.currentControls.flickerStrength,
      flickerFreq: this.currentControls.flickerFreq,
      overallBoost: this.currentControls.overallBoost,
      genre: this.currentControls.genre,
    };

    visualizer.applyUniforms(this.p5Instance, shader, level, features, sensitivity, controls);
    visualizer.draw(this.p5Instance, shader);
  }

  private renderMosaic(visualizer: any, features?: AudioFeatures): void {
    if (!this.p5Instance._mosaicVisual) {
      // Initialize mosaic visual
      const controls = {
        cellSize: this.currentControls.cellSize ?? 20,
        maxAge: this.currentControls.maxAge ?? 80,
        growthRate: this.currentControls.growthRate ?? 0.05,
        spawnRate: this.currentControls.spawnRate ?? 0.02,
        colorScheme: this.currentControls.colorScheme ?? 0,
        colorFlowSpeed: this.currentControls.colorFlowSpeed ?? 0.01,
        alpha: this.currentControls.alpha ?? 0.7,
      };

      this.p5Instance._mosaicVisual = new visualizer.class(this.p5Instance, controls, {
        level: 0, flux: 0, centroid: 0, flatness: 0, zcr: 0, mfcc: [0, 0, 0, 0], pulse: 0
      });
    }

    const audioUniforms = {
      level: features?.rms ?? 0,
      flux: features?.spectralFlux ?? 0,
      centroid: features?.spectralCentroid ? features.spectralCentroid / 8000 : 0,
      flatness: features?.spectralFlatness ?? 0,
      zcr: features?.zcr ?? 0,
      mfcc: features?.mfcc?.slice(0, 4) as [number, number, number, number] ?? [0, 0, 0, 0],
      pulse: features?.percussiveRatio ?? 0,
    };

    const sensitivity = this.currentControls.sensitivity ?? 1.0;
    const controls = {
      cellSize: this.currentControls.cellSize ?? 20,
      maxAge: this.currentControls.maxAge ?? 80,
      growthRate: this.currentControls.growthRate ?? 0.05,
      spawnRate: this.currentControls.spawnRate ?? 0.02,
      colorScheme: this.currentControls.colorScheme ?? 0,
      colorFlowSpeed: this.currentControls.colorFlowSpeed ?? 0.01,
      alpha: this.currentControls.alpha ?? 0.7,
    };

    visualizer.applyUniforms(this.p5Instance, this.p5Instance._mosaicVisual, audioUniforms, sensitivity, ...Object.values(controls));
    visualizer.draw(this.p5Instance, this.p5Instance._mosaicVisual);
  }

  private renderSpiral(visualizer: any, features?: AudioFeatures): void {
    const level = features?.rms ?? 0;
    visualizer.draw(this.p5Instance, level);
  }

  resize(width: number, height: number): void {
    if (this.p5Instance) {
      this.p5Instance.resizeCanvas(width, height);
    }
  }

  dispose(): void {
    // Clean up visualizers
    this.visualizers.clear();
    this.isInitialized = false;
  }
}
