/**
 * 增强版弹幕管线 - 集成特征聚合器和风格检测器
 */

import { DanmuScheduler } from './danmu-scheduler';
import { fetchAnalyze } from './stream-client';
import { DanmuEngine } from './danmu-engine';
import {
  FeatureAggregator,
  FeatureFrame,
  StabilityMetrics,
} from './feature-aggregator';
import { StyleDetector } from './style-detector';

export interface PipelineConfig {
  apiPath?: string;
  needComments?: number;
  locale?: string;
  minIntervalMs?: number;
  maxConcurrency?: number;
  rmsThreshold?: number;
  requireStability?: boolean;
  stabilityWindowMs?: number;
  stabilityConfidence?: number;
  energyEnterThreshold?: number;
  energyExitThreshold?: number;
  // persona / AB 配置
  personaId?: 'auto' | 'quiet' | 'cheer' | 'steady' | 'playful' | 'critic' | 'enthusiast';
  personaDiversity?: number; // 0..1
  abBucket?: string;
}

function clamp01Number(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
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
  private commentTimer: NodeJS.Timeout | null = null;
  private lastDrive = 0;
  private lastCommentTimestamp = 0;
  private readonly commentIntervalRange = { min: 3000, max: 10000 };
  private lastInstrument: string | null = null;
  private lastStability: StabilityMetrics | null = null;
  private activityScore = 0;
  private pipelinePhase: 'idle' | 'ready' = 'idle';
  private phaseSince = Date.now();
  // 最近已显示的弹幕文本（供 existingDanmu 去重），最大50条
  private recentShownTexts: string[] = [];

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
      requireStability: true,
      stabilityWindowMs: 1500,
      stabilityConfidence: 0.45,
      energyEnterThreshold: 0.08,
      energyExitThreshold: 0.035,
      personaId: 'auto',
      personaDiversity: 0,
      abBucket: '',
      ...config,
    };
    this.featureAggregator.updateStabilityThresholds({
      min_stability_duration: this.config.stabilityWindowMs ?? 1500,
      min_confidence: this.config.stabilityConfidence ?? 0.45,
    });
    this.scheduler = new DanmuScheduler({
      maxConcurrency: this.config.maxConcurrency,
    });
  }

  start(): void {
    this.isActive = true;
    this.featureAggregator.reset();
    // 启动前先清理历史缓存，避免刷新/重启后残留影响去重与节奏
    try {
      this.pendingComments = [];
      this.recentShownTexts = [];
      this.danmuCount = 0;
      this.lastCommentTimestamp = 0;
      this.clearCommentTimer();
    } catch {}
    this.flushPendingComments(true);
    console.log('增强版弹幕管线启动，isActive:', this.isActive);
  }

  stop(): void {
    this.isActive = false;
    this.pendingRequests = 0;
    this.clearCommentTimer();
    // 停止时也清理一次，避免残留到下一次 sessions
    try {
      this.pendingComments = [];
      this.recentShownTexts = [];
      this.danmuCount = 0;
    } catch {}
    console.log('增强版弹幕管线停止');
  }

  // 处理音频特征，决定是否触发弹幕生成
  handleAudioFeatures(rms: number, features?: Record<string, unknown>): void {
    console.log('🎵 弹幕管线: 接收音频特征', { rms: rms.toFixed(4), hasFeatures: !!features });
    
    if (!this.isActive) {
      console.log('弹幕管线: 未激活，强制激活进行测试');
      this.isActive = true;
    }
    if (rms < this.config.rmsThreshold) {
      // 减少日志频率，避免刷屏
      if (
        typeof window !== 'undefined' && (
        !(window as any).__lastRmsLog ||
        Date.now() - (window as any).__lastRmsLog > 5000
      )) {
        (window as any).__lastRmsLog = Date.now();
        console.log(
          `弹幕管线: RMS过低 ${rms.toFixed(4)} < ${this.config.rmsThreshold}`
        );
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
        instrumentProbabilities: features.instrumentProbabilities as Record<
          string,
          number
        >,
        dominantInstrument: features.dominantInstrument as string,
        instrumentConfidence: features.instrumentConfidence as number,
      };
      if (frame.dominantInstrument) {
        this.lastInstrument = frame.dominantInstrument;
      }
      this.featureAggregator.addFrame(frame);

      // 调试：显示特征聚合进度
      const frameCount = this.featureAggregator.getFrameCount();
      if (frameCount % 50 === 0) {
        // 每50帧显示一次，减少日志频率
        console.log(
          `🎵 特征聚合进度: ${frameCount}帧, RMS: ${frame.rms?.toFixed(4)}`
        );
      }
    }

    // 检查稳定性（减少调用频率，避免过度计算）
    const currentTime = Date.now();
    if (
      typeof window !== 'undefined' && (
      !(window as any).__lastStabilityCheck ||
      currentTime - (window as any).__lastStabilityCheck > 1000 // 每1秒检查一次稳定性
    )) {
      (window as any).__lastStabilityCheck = currentTime;
      const stability = this.featureAggregator.checkStability();
      this.lastStability = stability;
      if (
        typeof window !== 'undefined' && (
        !(window as any).__lastStabilityLog ||
        currentTime - (window as any).__lastStabilityLog > 3000
      )) {
        (window as any).__lastStabilityLog = currentTime;
        console.log(
          `弹幕管线: 稳定性检测结果 - 整体稳定:${stability.overall_stable}, 置信度:${stability.confidence.toFixed(2)}`
        );
      }
    }

    const stabilitySnapshot = this.lastStability;
    const requireStability = this.config.requireStability;
    const meetsConfidence =
      (stabilitySnapshot?.confidence ?? 0) >=
      (this.config.stabilityConfidence ?? 0.45);
    if (
      requireStability &&
      stabilitySnapshot &&
      (!stabilitySnapshot.overall_stable || !meetsConfidence)
    ) {
      if (
        typeof window !== 'undefined' && (
        !(window as any).__lastStabilityGateLog ||
        Date.now() - (window as any).__lastStabilityGateLog > 2000
      )) {
        (window as any).__lastStabilityGateLog = Date.now();
        console.log('🎵 弹幕管线: 稳定度不足，跳过触发', stabilitySnapshot);
      }
      return;
    }

    const voiceProb = clamp01Number(features?.voiceProb as number | undefined);
    const percussiveRatio = clamp01Number(
      features?.percussiveRatio as number | undefined
    );
    const instrumentConfidence = clamp01Number(
      features?.instrumentConfidence as number | undefined
    );
    const energySample = clamp01Number(rms);
    const instantActivity =
      energySample * 0.45 +
      voiceProb * 0.25 +
      percussiveRatio * 0.2 +
      instrumentConfidence * 0.1;
    this.activityScore = this.activityScore * 0.75 + instantActivity * 0.25;
    this.updatePhase(this.activityScore, currentTime);

    if (this.pipelinePhase !== 'ready') {
      if (
        typeof window !== 'undefined' && (
        !(window as any).__lastPhaseGateLog ||
        currentTime - (window as any).__lastPhaseGateLog > 2500
      )) {
        (window as any).__lastPhaseGateLog = currentTime;
        console.log('🎵 弹幕管线: 动态进入稳定前收集阶段', {
          phase: this.pipelinePhase,
          activity: this.activityScore.toFixed(3),
        });
      }
      return;
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
      if (
        typeof window !== 'undefined' && (
        !(window as any).__lastIntervalLog ||
        Date.now() - (window as any).__lastIntervalLog > 3000
      )) {
        (window as any).__lastIntervalLog = Date.now();
        console.log(
          `🎵 弹幕管线: 间隔未到 ${now - this.lastTriggerTime}ms < ${interval}ms`
        );
      }
      return;
    }
    if (this.pendingRequests >= concurrency) {
      if (
        typeof window !== 'undefined' && (
        !(window as any).__lastConcurrencyLog ||
        Date.now() - (window as any).__lastConcurrencyLog > 3000
      )) {
        (window as any).__lastConcurrencyLog = Date.now();
        console.log(
          `弹幕管线: 并发限制 ${this.pendingRequests} >= ${concurrency}`
        );
      }
      return;
    }

    if (
      typeof window !== 'undefined' && (
      !(window as any).__lastTriggerLog ||
      Date.now() - (window as any).__lastTriggerLog > 2000
    )) {
      (window as any).__lastTriggerLog = Date.now();
      console.log('🎵 弹幕管线: 触发弹幕生成', {
        rms: rms.toFixed(4),
        drive: drive.toFixed(3),
        interval: interval,
        concurrency: concurrency
      });
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
    console.log(
      '增强弹幕管线: 调用API生成弹幕，当前并发:',
      this.pendingRequests
    );

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

      // 调用LLM弹幕API生成批量弹幕
      await this.generateBatchDanmu(windowFeatures.features, styleResult);
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
    console.log(
      '弹幕管线: 收到评论，加入缓冲区，长度:',
      this.pendingComments.length
    );
    this.scheduleCommentFlush();
  }

  // 批量生成弹幕
  private async generateBatchDanmu(features: any, styleResult: any): Promise<void> {
    try {
      const response = await fetch('/api/llm-danmu', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          features: features,
          // 让后端一次性生成 5 条常规 + 1-2 条鼓励/陪伴型（范围由后端采样）
          needDanmu: this.config.needComments || 3,
          encouragementExtraMin: 1,
          encouragementExtraMax: 2,
          // persona/AB 配置
          personaId: this.config.personaId,
          personaDiversity: this.config.personaDiversity,
          abBucket: this.config.abBucket,
          // 历史弹幕（供去重）
          existingDanmu: this.recentShownTexts.slice(-50)
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const result = await response.json();
      if (result.success && result.danmuList) {
        console.log(`批量弹幕生成成功: ${result.count}条弹幕`);
        
        // 将批量弹幕加入队列，分批次发出（动态间隔 + 抖动）
        const bpm = Number((features?.tempo_bpm ?? features?.tempo) || 0);
        const baseBeatMs = bpm > 0 ? 60000 / bpm : 1500; // 无BPM时采用1.5s基准
        const energy = Math.max(0, Math.min(1, Number(features?.rms ?? 0.25)));
        // 基于能量缩放间隔（能量越高，间隔越短；但设定下限）
        const energyFactor = 1.0 - 0.45 * energy; // 0.55x ~ 1.0x

        for (let i = 0; i < result.danmuList.length; i++) {
          const danmu = result.danmuList[i];
          // 抖动：在 [0.75, 1.25] * base 内随机
          const jitter = 0.75 + Math.random() * 0.5;
          const intervalMs = Math.max(600, Math.min(4000, Math.round(baseBeatMs * energyFactor * jitter)));

          setTimeout(() => {
            this.enqueueComment(danmu.text);
            // 直接显示弹幕
            this.danmuEngine.ingestText(danmu.text);
          }, i * intervalMs);
        }
        
        // 设置评论刷新
        this.scheduleCommentFlush();
      } else {
        console.warn('批量弹幕生成失败:', result.error);
      }
    } catch (error) {
      console.error('批量弹幕生成请求失败:', error);
    }
  }

  private scheduleCommentFlush() {
    if (!this.isActive) return;
    if (this.pendingComments.length === 0) return;
    if (this.commentTimer !== null) return;

    const delay = this.pickCommentInterval();
    this.commentTimer = (typeof window !== 'undefined' ? window : global).setTimeout(() => {
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
      // 记录最近显示文本供后端去重
      try {
        this.recentShownTexts.push(next);
        if (this.recentShownTexts.length > 50) {
          this.recentShownTexts.splice(0, this.recentShownTexts.length - 50);
        }
      } catch {}
      this.lastCommentTimestamp = Date.now();
      console.log(
        '弹幕管线: 发送评论，剩余缓冲区长度:',
        this.pendingComments.length
      );
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

  private updatePhase(activity: number, now: number) {
    const enter = this.config.energyEnterThreshold ?? 0.08;
    const exit = this.config.energyExitThreshold ?? 0.035;
    if (this.pipelinePhase !== 'ready' && activity >= enter) {
      this.pipelinePhase = 'ready';
      this.phaseSince = now;
      console.log('弹幕管线: 活动度达到触发阈值，进入 ready 状态');
    } else if (this.pipelinePhase === 'ready' && activity <= exit) {
      this.pipelinePhase = 'idle';
      this.phaseSince = now;
      console.log('弹幕管线: 活动度低于退出阈值，回到 idle 状态');
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
      frameCount: this.featureAggregator.getFrameCount(),
      dominantInstrument: this.lastInstrument,
      stabilityConfidence: this.lastStability?.confidence ?? 0,
      stabilityDuration: this.lastStability?.stability_duration ?? 0,
      activityScore: this.activityScore,
      phase: this.pipelinePhase,
    };
  }
}
