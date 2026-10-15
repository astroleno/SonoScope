/**
 * 弹幕管线 Hook
 * 管理弹幕管线的生命周期和状态
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { EventBus } from '../lib/event-bus';
import { ConsoleTamer } from '../lib/console-tamer';
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
  dominantInstrument: string | null;
}

export function useDanmuPipeline(options: UseDanmuPipelineOptions = {}) {
  const { enabled = true, autoStart = true, useSimple = true, ...configValues } = options;
  const configKey = JSON.stringify(configValues);
  const pipelineConfig = useMemo<PipelineConfig>(() => JSON.parse(configKey), [configKey]);

  const [state, setState] = useState<DanmuPipelineState>({
    isActive: false,
    currentStyle: null,
    pendingRequests: 0,
    danmuCount: 0,
    dominantInstrument: null,
  });

  const eventBusRef = useRef<EventBus | null>(null);
  const danmuEngineRef = useRef<DanmuEngine | null>(null);
  const pipelineRef = useRef<DanmuPipelineEnhanced | DanmuPipelineSimple | null>(null);
  const initializedRef = useRef(false);
  const [isReady, setReady] = useState(false);

  // 初始化弹幕引擎和管线
  useEffect(() => {
    if (!enabled || initializedRef.current) return;
    let cancelled = false;

    const initPipeline = async () => {
      try {
        // 创建事件总线
        const eventBus = new EventBus();
        eventBusRef.current = eventBus;

        // 创建弹幕引擎
        const danmuEngine = new DanmuEngine(eventBus);
        await danmuEngine.initialize();
        if (cancelled) { danmuEngine.dispose(); return; }
        danmuEngineRef.current = danmuEngine;

        // 创建弹幕管线（根据配置选择版本）
        const pipeline = useSimple 
          ? new DanmuPipelineSimple(danmuEngine, pipelineConfig)
          : new DanmuPipelineEnhanced(danmuEngine, pipelineConfig);
        pipelineRef.current = pipeline;

        initializedRef.current = true;
        setReady(true);
        ConsoleTamer.info('danmu.init', '弹幕管线初始化完成');
        ConsoleTamer.debug('danmu.init', '🎵 弹幕管线状态:', {
          isReady: pipelineRef.current?.isReady,
          status: pipelineRef.current?.status
        });
      } catch (error) {
        console.error('弹幕管线初始化失败:', error);
      }
    };

    initPipeline();

    return () => {
      cancelled = true;
      if (pipelineRef.current) {
        pipelineRef.current.stop();
      }
      if (danmuEngineRef.current) {
        danmuEngineRef.current.stop();
        danmuEngineRef.current.dispose();
      }
      initializedRef.current = false;
      setReady(false);
    };
  }, [enabled, pipelineConfig, useSimple]);

  // 启动/停止管线
  const start = () => {
    ConsoleTamer.debug('danmu.start', '🎵 useDanmuPipeline start 被调用:', {
      hasDanmuEngine: !!danmuEngineRef.current,
      hasPipeline: !!pipelineRef.current,
      initialized: initializedRef.current
    });
    if (danmuEngineRef.current && pipelineRef.current) {
      danmuEngineRef.current.start();
      pipelineRef.current.start();
      ConsoleTamer.info('danmu.start', '🎵 弹幕管线启动成功');
      
      // 延迟更新状态，确保状态同步
      setTimeout(() => {
        const status = pipelineRef.current?.status;
        ConsoleTamer.debug('danmu.start', '🎵 延迟状态检查:', status);
        if (status) {
          setState(prev => ({
            ...prev,
            isActive: status.isActive || true, // 确保isActive为true
            currentStyle: status.currentStyle,
            pendingRequests: status.pendingRequests,
            danmuCount: status.danmuCount,
          }));
          ConsoleTamer.debug('danmu.start', '🎵 状态已更新为:', { isActive: status.isActive || true });
        } else {
          // 如果没有status，至少设置isActive为true
          setState(prev => ({ ...prev, isActive: true }));
          ConsoleTamer.debug('danmu.start', '🎵 状态已更新为: {isActive: true}');
        }
      }, 100);
    } else {
      ConsoleTamer.warn('danmu.start', '🎵 弹幕管线启动失败 - 组件未就绪');
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
    const updateState = () => {
      if (!pipelineRef.current) {
        ConsoleTamer.debug('danmu.state', '🎵 状态更新检查: 弹幕管线未初始化');
        return;
      }
      
      const status = pipelineRef.current?.status;
      ConsoleTamer.debug('danmu.state', '🎵 状态更新检查:', {
        hasPipeline: !!pipelineRef.current,
        status: status,
        isActive: status?.isActive
      });
      
      const dominantInstrument =
        status && 'dominantInstrument' in status
          ? (status as { dominantInstrument: string | null }).dominantInstrument
          : null;
      setState(prev => {
        const newState = {
          ...prev,
          isActive: status?.isActive || false,
          currentStyle: status?.currentStyle || null,
          pendingRequests: status?.pendingRequests || 0,
          danmuCount: status?.danmuCount || 0,
          dominantInstrument: dominantInstrument ?? prev.dominantInstrument,
        };
        
        // 检查状态是否真的发生了变化
        const hasChanged = 
          prev.isActive !== newState.isActive ||
          prev.currentStyle !== newState.currentStyle ||
          prev.pendingRequests !== newState.pendingRequests ||
          prev.danmuCount !== newState.danmuCount ||
          prev.dominantInstrument !== newState.dominantInstrument;
        
        if (hasChanged) {
          ConsoleTamer.debug('danmu.state', '🎵 状态发生变化，触发更新');
          return newState;
        } else {
          ConsoleTamer.debug('danmu.state', '🎵 状态未发生变化，保持原状态');
          // 强制触发一次更新，确保组件能够重新渲染
          return { ...prev };
        }
      });
    };

    // 立即更新一次状态
    updateState();
    
    // 然后定期更新
    const interval = setInterval(updateState, 500);
    return () => clearInterval(interval);
  }, []); // 不依赖任何值，确保状态更新机制能正确工作

  // 自动启动
  useEffect(() => {
    if (autoStart && enabled && initializedRef.current && !state.isActive) {
      start();
    }
  }, [autoStart, enabled, state.isActive, isReady]);

  const returnValue = {
    ...state,
    start,
    stop,
    trigger,
    handleAudioFeatures,
    isReady,
  };
  
  return returnValue;
}
