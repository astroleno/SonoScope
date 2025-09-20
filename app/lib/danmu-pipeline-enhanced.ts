/**
 * 增强版弹幕管线 - 集成特征聚合器和风格检测器
 */

import { DanmuScheduler } from './danmu-scheduler';
import { fetchAnalyze } from './stream-client';
import { DanmuEngine } from './danmu-engine';
import { FeatureAggregator, FeatureFrame } from './feature-aggregator';
import { StyleDetector } from './style-detector';

export interface PipelineConfig {
  apiPath?: string;
  needComments?: number;
  locale?: string;
  minIntervalMs?: number;
  maxConcurrency?: number;
  rmsThreshold?: number;
}

export class DanmuPipelineEnhanced {
  private scheduler: DanmuScheduler;
  private danmuEngine: DanmuEngine;
  private featureAggregator: FeatureAggregator;
  private styleDetector: StyleDetector;
  private config: Required<PipelineConfig>;
  private isActive = false;
  private lastTriggerTime = 0;
  private pendingRequests = 0;
  private currentStyle: string | null = null;
  private danmuCount = 0;
  private pendingComments: string[] = [];
  private commentTimer: number | null = null;
  private lastDrive = 0;
  private lastCommentTimestamp = 0;
  private readonly commentIntervalRange = { min: 3000, max: 10000 };

  constructor(danmuEngine: DanmuEngine, config?: PipelineConfig) {
    this.danmuEngine = danmuEngine;
    this.featureAggregator = new FeatureAggregator();
    this.styleDetector = new StyleDetector();
    this.config = {
      apiPath: '/api/analyze',
      needComments: 4,
      locale: 'zh-CN',
      minIntervalMs: 2000,
      maxConcurrency: 2,
      rmsThreshold: 0.0001, // 进一步降低RMS阈值，确保能检测到音频
      ...config,
    };
    this.scheduler = new DanmuScheduler({
      maxConcurrency: this.config.maxConcurrency,
    });
  }

  start(): void {
    this.isActive = true;
    this.featureAggregator.reset();
    this.flushPendingComments(true);
    console.log('增强版弹幕管线启动，isActive:', this.isActive);
  }

  stop(): void {
    this.isActive = false;
    this.pendingRequests = 0;
    this.clearCommentTimer();
    console.log('增强版弹幕管线停止');
  }

  // 处理音频特征，决定是否触发弹幕生成
  handleAudioFeatures(rms: number, features?: Record<string, unknown>): void {
    if (!this.isActive) {
      console.log('弹幕管线: 未激活，强制激活进行测试');
      this.isActive = true;
    }
    if (rms < this.config.rmsThreshold) {
      // 减少日志频率，避免刷屏
      if (!(window as any).__lastRmsLog || Date.now() - (window as any).__lastRmsLog > 5000) {
        (window as any).__lastRmsLog = Date.now();
        console.log(`弹幕管线: RMS过低 ${rms.toFixed(4)} < ${this.config.rmsThreshold}`);
      }
      return;
    }

    // 添加特征帧到聚合器
    if (features) {
      const frame: FeatureFrame = {
        timestamp: Date.now(),
        rms: features.rms as number,
        spectralCentroid: features.spectralCentroid as number,
        zcr: features.zcr as number,
        mfcc: features.mfcc as number[],
        spectralFlatness: features.spectralFlatness as number,
        spectralFlux: features.spectralFlux as number,
        chroma: features.chroma as number[],
        spectralBandwidth: features.spectralBandwidth as number,
        spectralRolloff: features.spectralRolloff as number,
        spectralContrast: features.spectralContrast as number[],
        spectralSpread: features.spectralSpread as number,
        spectralSkewness: features.spectralSkewness as number,
        spectralKurtosis: features.spectralKurtosis as number,
        loudness: features.loudness as number,
        perceptualSpread: features.perceptualSpread as number,
        perceptualSharpness: features.perceptualSharpness as number,
        voiceProb: features.voiceProb as number,
        percussiveRatio: features.percussiveRatio as number,
        harmonicRatio: features.harmonicRatio as number,
      };
      this.featureAggregator.addFrame(frame);
      
      // 调试：显示特征聚合进度
      const frameCount = this.featureAggregator.getFrameCount();
      if (frameCount % 10 === 0) { // 每10帧显示一次
        console.log(`🎵 特征聚合进度: ${frameCount}帧, RMS: ${frame.rms?.toFixed(4)}`);
      }
    }

    // 检查稳定性（临时禁用，直接基于RMS触发）
    const stability = this.featureAggregator.checkStability();
    if (!(window as any).__lastStabilityLog || Date.now() - (window as any).__lastStabilityLog > 3000) {
      (window as any).__lastStabilityLog = Date.now();
      console.log(`弹幕管线: 稳定性检测结果 - 整体稳定:${stability.overall_stable}, 置信度:${stability.confidence.toFixed(2)}`);
    }
    
    // 临时禁用稳定性检测，直接基于RMS触发
    // if (!stability.overall_stable && stability.confidence < 0.3) {
    //   console.log('弹幕管线: 特征质量过低，跳过触发');
    //   return;
    // }

    const now = Date.now();
    const drive = this.scheduler.driveFromRms(rms);
    this.lastDrive = drive;
    const interval = this.scheduler.nextIntervalSec(drive) * 1000; // 转毫秒
    const concurrency = this.scheduler.concurrency(drive, now);

    // 检查是否应该触发
    if (now - this.lastTriggerTime < interval) {
      console.log(`弹幕管线: 间隔未到 ${now - this.lastTriggerTime}ms < ${interval}ms`);
      return;
    }
    if (this.pendingRequests >= concurrency) {
      if (!(window as any).__lastConcurrencyLog || Date.now() - (window as any).__lastConcurrencyLog > 3000) {
        (window as any).__lastConcurrencyLog = Date.now();
        console.log(`弹幕管线: 并发限制 ${this.pendingRequests} >= ${concurrency}`);
      }
      return;
    }

           if (!(window as any).__lastTriggerLog || Date.now() - (window as any).__lastTriggerLog > 2000) {
             (window as any).__lastTriggerLog = Date.now();
             console.log('弹幕管线: 触发弹幕生成');
           }
           this.triggerDanmuGeneration();
    this.lastTriggerTime = now;
  }

  // 手动触发弹幕生成
  trigger(): void {
    if (!this.isActive) {
      console.log('🎵 弹幕管线未激活，强制激活进行测试');
      this.isActive = true;
    }
    this.triggerDanmuGeneration();
  }

  private async triggerDanmuGeneration(): Promise<void> {
    if (this.pendingRequests >= this.config.maxConcurrency) {
      console.log('增强弹幕管线: 并发限制，跳过生成');
      return;
    }

    this.pendingRequests++;
    console.log('增强弹幕管线: 调用API生成弹幕，当前并发:', this.pendingRequests);

    try {
      // 获取聚合特征
      const windowFeatures = this.featureAggregator.computeWindowFeatures();
      if (!windowFeatures) {
        console.warn('特征窗口不足，跳过弹幕生成');
        this.pendingRequests--;
        return;
      }

      // 快速风格检测
      const styleResult = this.styleDetector.detectStyle(
        windowFeatures.features
      );
      this.currentStyle = styleResult.style;
      console.log(
        `风格检测: ${styleResult.style} (置信度: ${styleResult.confidence})`
      );

      // 调用API生成弹幕
      await fetchAnalyze(
        this.config.apiPath,
        {
          window_ms: windowFeatures.window_ms,
          features: windowFeatures.features,
          need_comments: this.config.needComments,
          locale: this.config.locale,
          style: styleResult.style,
          confidence: styleResult.confidence,
          talking_points: styleResult.talking_points,
        },
        {
          onStyle: e => {
            this.currentStyle = e.style;
            console.log(`API风格确认: ${e.style} (置信度: ${e.confidence})`);
          },
          onComment: e => {
            this.enqueueComment(e.text);
          },
          onDone: () => {
            console.log('弹幕流完成');
            this.scheduleCommentFlush();
          },
          onError: err => {
            console.warn('弹幕生成失败:', err);
            // 不使用默认弹幕，只记录错误
          },
        }
      );
    } catch (error) {
      console.error('弹幕生成请求失败:', error);
      // 不使用默认弹幕，只记录错误
    } finally {
      this.pendingRequests--;
    }
  }

  private enqueueComment(text: string) {
    if (!text || !text.trim()) return;
    if (!this.isActive) {
      console.log('弹幕管线已停止，丢弃评论:', text);
      return;
    }
    this.pendingComments.push(text.trim());
    console.log('弹幕管线: 收到评论，加入缓冲区，长度:', this.pendingComments.length);
    this.scheduleCommentFlush();
  }

  private scheduleCommentFlush() {
    if (!this.isActive) return;
    if (this.pendingComments.length === 0) return;
    if (this.commentTimer !== null) return;

    const delay = this.pickCommentInterval();
    this.commentTimer = window.setTimeout(() => {
      this.commentTimer = null;
      this.flushPendingComments();
    }, delay);
  }

  private flushPendingComments(force = false) {
    if (!this.isActive && !force) {
      return;
    }

    const next = this.pendingComments.shift();
    if (!next) return;

    if (this.isActive) {
      this.danmuEngine.ingestText(next);
      this.danmuCount++;
      this.lastCommentTimestamp = Date.now();
      console.log('弹幕管线: 发送评论，剩余缓冲区长度:', this.pendingComments.length);
    }

    if (this.pendingComments.length > 0) {
      this.scheduleCommentFlush();
    }
  }

  private pickCommentInterval(): number {
    const drive = this.lastDrive;
    const min = this.commentIntervalRange.min;
    const max = this.commentIntervalRange.max;
    const energyFactor = 1 - this.clamp01(drive);
    const spread = max - min;
    const base = min + spread * energyFactor;
    const jitter = 1 + (Math.random() - 0.5) * 0.3; // ±15%
    const delay = Math.max(min, Math.min(max, base * jitter));

    const sinceLast = Date.now() - this.lastCommentTimestamp;
    if (sinceLast < min) {
      return Math.max(min - sinceLast, 500);
    }
    return delay;
  }

  private clearCommentTimer() {
    if (this.commentTimer !== null) {
      clearTimeout(this.commentTimer);
      this.commentTimer = null;
    }
  }

  private clamp01(v: number): number {
    return Math.max(0, Math.min(1, v));
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
      frameCount: this.featureAggregator.getFrameCount(),
    };
  }
}
