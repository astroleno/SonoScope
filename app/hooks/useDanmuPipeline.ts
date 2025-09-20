/**
 * 弹幕管线 Hook
 * 管理弹幕管线的生命周期和状态
 */

import { useEffect, useRef, useState } from 'react';
import { EventBus } from '../lib/event-bus';
import { DanmuEngine } from '../lib/danmu-engine';
import {
  DanmuPipelineEnhanced,
  PipelineConfig,
} from '../lib/danmu-pipeline-enhanced';
import { DanmuPipelineSimple } from '../lib/danmu-pipeline-simple';

export interface UseDanmuPipelineOptions extends PipelineConfig {
  enabled?: boolean;
  autoStart?: boolean;
  useSimple?: boolean; // 是否使用简化版管线
}

export interface DanmuPipelineState {
  isActive: boolean;
  currentStyle: string | null;
  pendingRequests: number;
  danmuCount: number;
}

export function useDanmuPipeline(options: UseDanmuPipelineOptions = {}) {
  const { enabled = true, autoStart = true, useSimple = true, ...pipelineConfig } = options;

  const [state, setState] = useState<DanmuPipelineState>({
    isActive: false,
    currentStyle: null,
    pendingRequests: 0,
    danmuCount: 0,
  });

  const eventBusRef = useRef<EventBus | null>(null);
  const danmuEngineRef = useRef<DanmuEngine | null>(null);
  const pipelineRef = useRef<DanmuPipelineEnhanced | DanmuPipelineSimple | null>(null);
  const initializedRef = useRef(false);

  // 初始化弹幕引擎和管线
  useEffect(() => {
    if (!enabled || initializedRef.current) return;

    const initPipeline = async () => {
      try {
        // 创建事件总线
        const eventBus = new EventBus();
        eventBusRef.current = eventBus;

        // 创建弹幕引擎
        const danmuEngine = new DanmuEngine(eventBus);
        await danmuEngine.initialize();
        danmuEngineRef.current = danmuEngine;

        // 创建弹幕管线（根据配置选择版本）
        const pipeline = useSimple 
          ? new DanmuPipelineSimple(danmuEngine, pipelineConfig)
          : new DanmuPipelineEnhanced(danmuEngine, pipelineConfig);
        pipelineRef.current = pipeline;

        initializedRef.current = true;
        console.log('弹幕管线初始化完成');
      } catch (error) {
        console.error('弹幕管线初始化失败:', error);
      }
    };

    initPipeline();

    return () => {
      if (pipelineRef.current) {
        pipelineRef.current.stop();
      }
      if (danmuEngineRef.current) {
        danmuEngineRef.current.stop();
        danmuEngineRef.current.dispose();
      }
      initializedRef.current = false;
    };
  }, [enabled, ...Object.values(pipelineConfig)]);

  // 启动/停止管线
  const start = () => {
    console.log('🎵 useDanmuPipeline start 被调用:', {
      hasDanmuEngine: !!danmuEngineRef.current,
      hasPipeline: !!pipelineRef.current,
      initialized: initializedRef.current
    });
    if (danmuEngineRef.current && pipelineRef.current) {
      danmuEngineRef.current.start();
      pipelineRef.current.start();
      setState(prev => ({ ...prev, isActive: true }));
      console.log('🎵 弹幕管线启动成功');
    } else {
      console.log('🎵 弹幕管线启动失败 - 组件未就绪');
    }
  };

  const stop = () => {
    if (pipelineRef.current) {
      pipelineRef.current.stop();
    }
    if (danmuEngineRef.current) {
      danmuEngineRef.current.stop();
    }
    setState(prev => ({ ...prev, isActive: false }));
  };

  // 手动触发弹幕生成
  const trigger = async () => {
    if (pipelineRef.current) {
      pipelineRef.current.trigger();
    }
  };

  // 处理音频特征
  const handleAudioFeatures = (
    rms: number,
    features?: Record<string, unknown>
  ) => {
    if (pipelineRef.current) {
      pipelineRef.current.handleAudioFeatures(rms, features);
    }
  };

  // 更新状态
  useEffect(() => {
    if (!pipelineRef.current) return;

    const updateState = () => {
      const status = pipelineRef.current?.status;
      setState(prev => ({
        ...prev,
        currentStyle: status?.currentStyle || null,
        pendingRequests: status?.pendingRequests || 0,
        danmuCount: status?.danmuCount || 0,
      }));
    };

    const interval = setInterval(updateState, 1000);
    return () => clearInterval(interval);
  }, [state.isActive]);

  // 自动启动
  useEffect(() => {
    if (autoStart && enabled && initializedRef.current && !state.isActive) {
      start();
    }
  }, [autoStart, enabled, state.isActive]);

  return {
    ...state,
    start,
    stop,
    trigger,
    handleAudioFeatures,
    isReady: initializedRef.current,
  };
}
