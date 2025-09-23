import { 
  CoreConfig, 
  CoreEvents, 
  AudioSource, 
  VisualizationPreset, 
  VisualizationControls,
  AudioFeatures,
  DanmuEvent,
  ThemeTokens,
  Transport
} from './types';
import { AudioAdapter, WebAudioAdapter } from './adapters/audio';
import { VisualAdapter, P5VisualAdapter } from './adapters/visual';
import { DanmuAdapter, SimpleDanmuAdapter } from './adapters/danmu-simple';
import { MemoryTransport } from './transports/memory';
import { WorkerTransport } from './transports/worker';

export class Core {
  private config: CoreConfig;
  private transport: Transport;
  private audioAdapter: AudioAdapter;
  private visualAdapter: VisualAdapter | null = null;
  private danmuAdapter: DanmuAdapter;
  private eventHandlers = new Map<keyof CoreEvents, Set<CoreEvents[keyof CoreEvents]>>();
  private isInitialized = false;
  private isRunning = false;
  private currentFeatures: AudioFeatures | null = null;

  constructor(config: CoreConfig = {}) {
    this.config = {
      sensitivity: 1.0,
      themeTokens: this.getDefaultThemeTokens(),
      ...config,
    };

    // Initialize transport
    if (config.transports?.type === 'worker') {
      this.transport = new WorkerTransport(config.transports.options?.workerScript);
    } else {
      this.transport = new MemoryTransport();
    }

    // Initialize adapters
    this.audioAdapter = new WebAudioAdapter();
    this.danmuAdapter = new SimpleDanmuAdapter();

    // Set up event forwarding
    this.setupEventForwarding();
  }

  private getDefaultThemeTokens(): ThemeTokens {
    return {
      neonBlue: '#00D4FF',
      neonPurple: '#8B5CF6',
      neonPink: '#FF006E',
      neonGreen: '#39FF14',
      bgDark: '#0A0A0F',
      bgMedium: '#1A1A2E',
      bgLight: '#16213E',
      textPrimary: '#ffffff',
      textSecondary: '#cccccc',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      accentColor: '#00D4FF',
    };
  }

  private setupEventForwarding(): void {
    // Audio features
    this.audioAdapter.onFeatures((features) => {
      this.currentFeatures = features;
      this.emit('features', features);
      
      // Forward to danmu adapter
      if (this.danmuAdapter && this.isRunning) {
        (this.danmuAdapter as any).handleAudioFeatures(features.rms || 0, features);
      }
    });

    // Danmu events
    this.danmuAdapter.onDanmu((event) => {
      this.emit('danmu', event);
    });
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize danmu adapter
      this.danmuAdapter.start();
      
      this.isInitialized = true;
      this.emit('ready');
      this.log('info', 'Core initialized successfully');
    } catch (error) {
      this.emit('error', error as Error);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (!this.isInitialized) {
      await this.init();
    }

    if (this.isRunning) return;

    try {
      this.isRunning = true;
      await this.audioAdapter.start();
      this.log('info', 'Core started');
    } catch (error) {
      this.isRunning = false;
      this.emit('error', error as Error);
      throw error;
    }
  }

  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    this.audioAdapter.stop();
    this.danmuAdapter.stop();
    this.emit('stopped');
    this.log('info', 'Core stopped');
  }

  dispose(): void {
    this.stop();
    this.audioAdapter.dispose();
    this.danmuAdapter.dispose();
    this.transport.dispose();
    this.eventHandlers.clear();
    this.isInitialized = false;
  }

  // Audio methods
  async setAudioSource(source: AudioSource): Promise<void> {
    await this.audioAdapter.setSource(source);
  }

  // Visual methods
  setVisualAdapter(adapter: VisualAdapter): void {
    this.visualAdapter = adapter;
  }

  setPreset(preset: VisualizationPreset, controls?: VisualizationControls): void {
    if (this.visualAdapter) {
      this.visualAdapter.setPreset(preset, controls);
    }
  }

  render(canvas: HTMLCanvasElement | any): void {
    if (this.visualAdapter) {
      this.visualAdapter.render(canvas, this.currentFeatures || undefined);
    }
  }

  resize(width: number, height: number): void {
    if (this.visualAdapter) {
      this.visualAdapter.resize(width, height);
    }
  }

  // Danmu methods
  triggerDanmu(payload?: any): void {
    this.danmuAdapter.trigger(payload);
  }

  // Config methods
  setConfig(config: Partial<CoreConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Apply theme tokens if provided
    if (config.themeTokens) {
      this.applyThemeTokens(config.themeTokens);
    }
  }

  private applyThemeTokens(tokens: ThemeTokens): void {
    const root = document.documentElement;
    (Object.entries as any)(tokens).forEach(([key, value]: [string, any]) => {
      if (value) {
        const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
        root.style.setProperty(cssVar, value);
      }
    });
  }

  // Event system
  on<K extends keyof CoreEvents>(event: K, handler: CoreEvents[K]): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off<K extends keyof CoreEvents>(event: K, handler: CoreEvents[K]): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private emit<K extends keyof CoreEvents>(event: K, ...args: Parameters<CoreEvents[K]>): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          (handler as any)(...args);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  private log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    this.emit('log', level, message, data);
  }

  // Getters
  get initialized(): boolean {
    return this.isInitialized;
  }

  get running(): boolean {
    return this.isRunning;
  }

  get features(): AudioFeatures | null {
    return this.currentFeatures;
  }

  get danmuStatus() {
    return {
      isReady: (this.danmuAdapter as any).isReady,
      isActive: this.isRunning,
      count: (this.danmuAdapter as any).danmuCount,
      pendingRequests: (this.danmuAdapter as any).pendingRequests,
      currentStyle: (this.danmuAdapter as any).currentStyle,
    };
  }
}
