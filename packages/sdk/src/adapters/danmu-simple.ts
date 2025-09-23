import { DanmuCommand, DanmuEvent, AudioFeatures } from '../types';

export interface DanmuAdapter {
  trigger(payload?: any): void;
  start(): void;
  stop(): void;
  onDanmu(callback: (event: DanmuEvent) => void): void;
  dispose(): void;
}

export class SimpleDanmuAdapter implements DanmuAdapter {
  private danmuCallback: ((event: DanmuEvent) => void) | null = null;
  private isActive = false;
  private _isReady = true;
  private _danmuCount = 0;
  private _pendingRequests = 0;
  private _currentStyle: string | null = null;

  constructor() {
    // Simple initialization
  }

  trigger(payload?: any): void {
    if (!this.isActive) return;

    // Simulate danmu generation
    const event: DanmuEvent = {
      id: `danmu_${Date.now()}_${Math.random()}`,
      command: {
        text: payload?.text || 'Test danmu message',
        style: payload?.style || 'default',
        color: payload?.color || '#ffffff',
        size: payload?.size || 16,
        speed: payload?.speed || 1,
        position: payload?.position || 'right',
        duration: payload?.duration || 5000,
      },
      timestamp: Date.now(),
    };

    this._danmuCount++;
    this._pendingRequests = Math.max(0, this._pendingRequests - 1);

    if (this.danmuCallback) {
      this.danmuCallback(event);
    }
  }

  start(): void {
    this.isActive = true;
    this._currentStyle = 'default';
  }

  stop(): void {
    this.isActive = false;
    this._currentStyle = null;
  }

  onDanmu(callback: (event: DanmuEvent) => void): void {
    this.danmuCallback = callback;
  }

  // Method to handle audio features (called by Core)
  handleAudioFeatures(level: number, features: AudioFeatures): void {
    if (!this.isActive) return;

    // Simple auto-trigger based on audio level
    if (level > 0.1 && Math.random() < 0.1) {
      this._pendingRequests++;
      setTimeout(() => {
        this.trigger({
          text: `Audio level: ${(level * 100).toFixed(1)}%`,
          style: 'auto',
          color: level > 0.5 ? '#ff6b6b' : '#4ecdc4',
        });
      }, 1000);
    }
  }

  // Get adapter status
  get isReady(): boolean {
    return this._isReady;
  }

  get danmuCount(): number {
    return this._danmuCount;
  }

  get pendingRequests(): number {
    return this._pendingRequests;
  }

  get currentStyle(): string | null {
    return this._currentStyle;
  }

  dispose(): void {
    this.stop();
    this.danmuCallback = null;
  }
}
