import { DanmuCommand, DanmuEvent, AudioFeatures } from '../types';

export interface DanmuAdapter {
  trigger(payload?: any): void;
  start(): void;
  stop(): void;
  onDanmu(callback: (event: DanmuEvent) => void): void;
  dispose(): void;
}

export class PipelineDanmuAdapter implements DanmuAdapter {
  private pipeline: any = null;
  private danmuCallback: ((event: DanmuEvent) => void) | null = null;
  private isActive = false;

  constructor() {
    this.initializePipeline();
  }

  private async initializePipeline(): Promise<void> {
    try {
      // Import danmu pipeline dynamically
      const { useDanmuPipeline } = await import('@sonoscope/danmu-pipeline');
      
      // Create pipeline instance
      this.pipeline = useDanmuPipeline({
        enabled: true,
        autoStart: false,
        useSimple: false,
        needComments: 4,
        locale: 'zh-CN',
        rmsThreshold: 0.0001,
        maxConcurrency: 2,
      });

      // Set up event handlers
      this.setupEventHandlers();
    } catch (error) {
      console.error('Failed to initialize danmu pipeline:', error);
    }
  }

  private setupEventHandlers(): void {
    if (!this.pipeline) return;

    // Listen for danmu events
    this.pipeline.on('danmu', (data: any) => {
      if (this.danmuCallback) {
        const event: DanmuEvent = {
          id: data.id || `danmu_${Date.now()}_${Math.random()}`,
          command: {
            text: data.text || data.content || 'Default danmu',
            style: data.style || 'default',
            color: data.color || '#ffffff',
            size: data.size || 16,
            speed: data.speed || 1,
            position: data.position || 'right',
            duration: data.duration || 5000,
          },
          timestamp: Date.now(),
          features: data.features,
        };
        this.danmuCallback(event);
      }
    });

    this.pipeline.on('error', (error: Error) => {
      console.error('Danmu pipeline error:', error);
    });
  }

  trigger(payload?: any): void {
    if (this.pipeline && this.isActive) {
      this.pipeline.trigger(payload);
    }
  }

  start(): void {
    if (this.pipeline) {
      this.pipeline.start();
      this.isActive = true;
    }
  }

  stop(): void {
    if (this.pipeline) {
      this.pipeline.stop();
      this.isActive = false;
    }
  }

  onDanmu(callback: (event: DanmuEvent) => void): void {
    this.danmuCallback = callback;
  }

  // Method to handle audio features (called by Core)
  handleAudioFeatures(level: number, features: AudioFeatures): void {
    if (this.pipeline && this.isActive) {
      this.pipeline.handleAudioFeatures(level, features);
    }
  }

  // Get pipeline status
  get isReady(): boolean {
    return this.pipeline?.isReady ?? false;
  }

  get danmuCount(): number {
    return this.pipeline?.danmuCount ?? 0;
  }

  get pendingRequests(): number {
    return this.pipeline?.pendingRequests ?? 0;
  }

  get currentStyle(): string | null {
    return this.pipeline?.currentStyle ?? null;
  }

  dispose(): void {
    this.stop();
    this.danmuCallback = null;
    this.pipeline = null;
  }
}
