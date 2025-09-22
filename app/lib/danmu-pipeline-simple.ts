/**
 * 简化版弹幕管线 - 直接基于RMS触发，用于测试
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
  rmsThreshold?: number;
}

export class DanmuPipelineSimple {
  private scheduler: DanmuScheduler;
  private danmuEngine: DanmuEngine;
  private config: Required<PipelineConfig>;
  private isActive = false;
  private lastTriggerTime = 0;
  private pendingRequests = 0;
  private currentStyle: string | null = null;
  private danmuCount = 0;

  constructor(danmuEngine: DanmuEngine, config?: PipelineConfig) {
    this.danmuEngine = danmuEngine;
    this.config = {
      apiPath: '/api/analyze',
      needComments: 4,
      locale: 'zh-CN',
      minIntervalMs: 2000,
      maxConcurrency: 2,
      rmsThreshold: 0.01,
      ...config,
    };
    this.scheduler = new DanmuScheduler({
      maxConcurrency: this.config.maxConcurrency,
    });
  }

  start(): void {
    this.isActive = true;
    console.log('简化版弹幕管线启动');
  }

  stop(): void {
    this.isActive = false;
    this.pendingRequests = 0;
    console.log('简化版弹幕管线停止');
  }

  // 处理音频特征，决定是否触发弹幕生成
  handleAudioFeatures(rms: number, features?: Record<string, unknown>): void {
    if (!this.isActive) {
      console.log('简化弹幕管线: 未激活');
      return;
    }
    if (rms < this.config.rmsThreshold) {
      console.log(`简化弹幕管线: RMS过低 ${rms.toFixed(4)} < ${this.config.rmsThreshold}`);
      return;
    }

    const now = Date.now();
    const drive = this.scheduler.driveFromRms(rms);
    const interval = this.scheduler.nextIntervalSec(drive) * 1000; // 转毫秒
    const concurrency = this.scheduler.concurrency(drive, now);

    // 检查是否应该触发
    if (now - this.lastTriggerTime < interval) {
      console.log(`简化弹幕管线: 间隔未到 ${now - this.lastTriggerTime}ms < ${interval}ms`);
      return;
    }
    if (this.pendingRequests >= concurrency) {
      console.log(`简化弹幕管线: 并发限制 ${this.pendingRequests} >= ${concurrency}`);
      return;
    }

    console.log('简化弹幕管线: 触发弹幕生成');
    this.triggerDanmuGeneration();
    this.lastTriggerTime = now;
  }

  // 手动触发弹幕生成
  trigger(): void {
    if (!this.isActive) return;
    this.triggerDanmuGeneration();
  }

  private async triggerDanmuGeneration(): Promise<void> {
    if (this.pendingRequests >= this.config.maxConcurrency) return;

    this.pendingRequests++;

    try {
      // 使用简化的特征数据
      const simpleFeatures = {
        rms_mean: 0.1,
        spectralCentroid_mean: 2000,
        spectralFlatness_mean: 0.3,
        tempo_bpm: 120,
        dynamic_range: 0.5,
      };

      console.log('简化弹幕管线: 调用API生成弹幕');

      // 调用API生成弹幕
      await fetchAnalyze(
        this.config.apiPath,
        {
          window_ms: 2000,
          features: simpleFeatures,
          need_comments: this.config.needComments,
          locale: this.config.locale,
          style: 'Electronic',
          confidence: 0.8,
          talking_points: ['节拍稳定', '音色清晰'],
        },
        {
          onStyle: e => {
            this.currentStyle = e.style;
            console.log(`简化弹幕管线: API风格确认: ${e.style} (置信度: ${e.confidence})`);
          },
          onComment: e => {
            if (this.isActive) {
              this.danmuEngine.ingestText(e.text);
              this.danmuCount++;
              console.log(`简化弹幕管线: 弹幕: ${e.text}`);
            } else {
              console.log(`简化弹幕管线已停止，跳过弹幕: ${e.text}`);
            }
          },
          onDone: () => {
            console.log('简化弹幕管线: 弹幕流完成');
          },
          onError: err => {
            console.warn('简化弹幕管线: 弹幕生成失败:', err);
            // 不使用默认弹幕，只记录错误
          },
        }
      );
    } catch (error) {
      console.error('简化弹幕管线: 弹幕生成请求失败:', error);
      // 不使用默认弹幕，只记录错误
    } finally {
      this.pendingRequests--;
    }
  }


  // 获取状态信息
  get isReady(): boolean {
    return this.danmuEngine !== null;
  }

  get status() {
    return {
      isActive: this.isActive,
      currentStyle: this.currentStyle,
      danmuCount: this.danmuCount,
      pendingRequests: this.pendingRequests,
      dominantInstrument: null,
      stabilityConfidence: 0,
      stabilityDuration: 0,
    };
  }
}
