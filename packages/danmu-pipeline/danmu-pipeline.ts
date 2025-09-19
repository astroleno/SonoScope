/**
 * 弹幕管线 - 自动触发与调度
 * 基于音频特征自动生成弹幕，集成调度器与流式接口
 */

import { DanmuScheduler } from './danmu-scheduler';
import { fetchAnalyze } from './stream-client';
import { DanmuEngine } from './danmu-engine';

export interface PipelineConfig {
  apiPath?: string;
  needComments?: number;
  locale?: string;
  minIntervalMs?: number;
  maxConcurrency?: number;
  rmsThreshold?: number; // 最小 RMS 才触发
}

export class DanmuPipeline {
  private scheduler: DanmuScheduler;
  private danmuEngine: DanmuEngine;
  private config: Required<PipelineConfig>;
  private isActive = false;
  private lastTriggerTime = 0;
  private pendingRequests = 0;
  private currentStyle: string | null = null;

  constructor(danmuEngine: DanmuEngine, config?: PipelineConfig) {
    this.danmuEngine = danmuEngine;
    this.config = {
      apiPath: '/api/analyze',
      needComments: 4,
      locale: 'zh-CN',
      minIntervalMs: 2000,
      maxConcurrency: 2,
      rmsThreshold: 0.05,
      ...config,
    };
    this.scheduler = new DanmuScheduler({
      maxConcurrency: this.config.maxConcurrency,
    });
  }

  start(): void {
    this.isActive = true;
    console.log('弹幕管线启动');
  }

  stop(): void {
    this.isActive = false;
    this.pendingRequests = 0;
    console.log('弹幕管线停止');
  }

  // 处理音频特征，决定是否触发弹幕生成
  handleAudioFeatures(rms: number, features?: Record<string, unknown>): void {
    if (!this.isActive) return;
    if (rms < this.config.rmsThreshold) return;

    const now = Date.now();
    const drive = this.scheduler.driveFromRms(rms);
    const interval = this.scheduler.nextIntervalSec(drive) * 1000; // 转毫秒
    const concurrency = this.scheduler.concurrency(drive, now);

    // 检查是否应该触发
    if (now - this.lastTriggerTime < interval) return;
    if (this.pendingRequests >= concurrency) return;

    this.triggerDanmuGeneration(features);
    this.lastTriggerTime = now;
  }

  private async triggerDanmuGeneration(features?: Record<string, unknown>): Promise<void> {
    if (this.pendingRequests >= this.config.maxConcurrency) return;

    this.pendingRequests++;
    
    try {
      await fetchAnalyze(
        this.config.apiPath,
        {
          features: features || {},
          need_comments: this.config.needComments,
          locale: this.config.locale,
        },
        {
          onStyle: (e) => {
            this.currentStyle = e.style;
            console.log(`风格识别: ${e.style} (置信度: ${e.confidence})`);
          },
          onComment: (e) => {
            this.danmuEngine.ingestText(e.text);
          },
          onDone: () => {
            console.log('弹幕流完成');
          },
          onError: (err) => {
            console.warn('弹幕生成失败:', err);
          },
        }
      );
    } catch (error) {
      console.warn('弹幕管线请求失败:', error);
    } finally {
      this.pendingRequests--;
    }
  }

  // 手动触发（用于测试）
  async manualTrigger(): Promise<void> {
    if (!this.isActive) return;
    await this.triggerDanmuGeneration();
  }

  get isRunning(): boolean {
    return this.isActive;
  }

  get currentStyleName(): string | null {
    return this.currentStyle;
  }

  get pendingCount(): number {
    return this.pendingRequests;
  }
}
