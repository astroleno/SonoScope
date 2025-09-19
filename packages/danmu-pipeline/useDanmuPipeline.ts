/**
 * 弹幕管线 Hook
 * 管理弹幕管线的生命周期和状态
 */

import { useEffect, useRef, useState } from 'react';
import { EventBus } from '../lib/event-bus';
import { DanmuEngine } from '../lib/danmu-engine';
import { DanmuPipeline, PipelineConfig } from '../lib/danmu-pipeline';

export interface UseDanmuPipelineOptions extends PipelineConfig {
  enabled?: boolean;
  autoStart?: boolean;
}

export interface DanmuPipelineState {
  isActive: boolean;
  currentStyle: string | null;
  pendingRequests: number;
  danmuCount: number;
}

export function useDanmuPipeline(options: UseDanmuPipelineOptions = {}) {
  const {
    enabled = true,
    autoStart = true,
    ...pipelineConfig
  } = options;

  const [state, setState] = useState<DanmuPipelineState>({
    isActive: false,
    currentStyle: null,
    pendingRequests: 0,
    danmuCount: 0,
  });

  const eventBusRef = useRef<EventBus | null>(null);
  const danmuEngineRef = useRef<DanmuEngine | null>(null);
  const pipelineRef = useRef<DanmuPipeline | null>(null);
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

        // 创建弹幕管线
        const pipeline = new DanmuPipeline(danmuEngine, pipelineConfig);
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
    if (danmuEngineRef.current && pipelineRef.current) {
      danmuEngineRef.current.start();
      pipelineRef.current.start();
      setState(prev => ({ ...prev, isActive: true }));
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
      await pipelineRef.current.manualTrigger();
    }
  };

  // 处理音频特征
  const handleAudioFeatures = (rms: number, features?: Record<string, unknown>) => {
    if (pipelineRef.current) {
      pipelineRef.current.handleAudioFeatures(rms, features);
    }
  };

  // 更新状态
  useEffect(() => {
    if (!pipelineRef.current) return;

    const updateState = () => {
      setState(prev => ({
        ...prev,
        currentStyle: pipelineRef.current?.currentStyleName || null,
        pendingRequests: pipelineRef.current?.pendingCount || 0,
        danmuCount: danmuEngineRef.current?.danmuCount || 0,
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
