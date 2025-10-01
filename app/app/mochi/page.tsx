"use client";

// 说明：本页面为“仅 Mochi 预设”的独立入口。
// 逻辑基本复用 standalone-client/page.tsx，但固定 preset 为 'mochi'，并隐藏预设切换按钮。

import React, { useState, useCallback, useEffect, useRef } from 'react';
import Visualizer from '../../components/visualizer';
import Meyda from 'meyda';
import { DanmuEngine } from '../../lib/danmu-engine';
import { ConsoleTamer } from '../../lib/console-tamer';
import { useDanmuPipeline } from '../../hooks/useDanmuPipeline';

// 注意：为保持与主页一致的体验，本文件复制了关键音频处理逻辑。
// 为简洁起见，仅做“固定预设=mochi + 隐藏预设选择”的差异。

export default function MochiOnlyPage() {
  const [currentPreset, setCurrentPreset] = useState<string>('mochi');
  const [isRunning, setIsRunning] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [features, setFeatures] = useState<any>(null);
  const [sensitivity, setSensitivity] = useState(1.5);
  const [debugVisible, setDebugVisible] = useState<boolean>(false);

  // LLM 弹幕管线（与主页一致的初始化，但本页默认自动启动）
  const danmuPipeline = useDanmuPipeline({
    autoStart: true,
    useSimple: false,
    needComments: 5,
    locale: 'zh-CN',
    minIntervalMs: 3000,
    maxConcurrency: 1,
    rmsThreshold: 0.01,
    requireStability: true,
    stabilityWindowMs: 2000,
    stabilityConfidence: 0.4,
  });
  const danmuPipelineRef = useRef(danmuPipeline);
  danmuPipelineRef.current = danmuPipeline;

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const meydaAnalyzerRef = useRef<any | null>(null);

  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current) return;
    const analyser = analyserRef.current;
    const bufferLength = analyser.fftSize;
    const timeDomainData = new Float32Array(bufferLength);
    analyser.getFloatTimeDomainData(timeDomainData);
    let sumSquares = 0;
    for (let i = 0; i < bufferLength; i++) sumSquares += timeDomainData[i] * timeDomainData[i];
    const rms = Math.sqrt(sumSquares / bufferLength);
    setAudioLevel(Math.min(Math.max(rms, 0), 1));
    animationFrameRef.current = requestAnimationFrame(analyzeAudio);
  }, []);

  const startAudioProcessing = useCallback(async () => {
    try {
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      } catch (_) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      const AudioContextCtor = (window as any).AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextCtor({ latencyHint: 'interactive' });
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream!);
      sourceRef.current = source;
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);
      try {
        const silentGain = audioContext.createGain();
        silentGain.gain.value = 0;
        analyser.connect(silentGain);
        silentGain.connect(audioContext.destination);
        gainRef.current = silentGain;
      } catch (_) {}
      try { if (audioContext.state !== 'running') await audioContext.resume(); } catch (_) {}
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      streamRef.current = stream!;

      // 初始化 Meyda：仅启用核心特征，足以驱动可视
      try {
        if (Meyda && typeof window !== 'undefined') {
          meydaAnalyzerRef.current = Meyda.createMeydaAnalyzer({
            audioContext,
            source,
            bufferSize: 1024,
            featureExtractors: ['rms', 'spectralCentroid', 'zcr', 'mfcc', 'spectralFlatness'],
            callback: (f: any) => {
              const processed = {
                rms: typeof f.rms === 'number' ? f.rms : 0,
                spectralCentroid: typeof f.spectralCentroid === 'number' ? f.spectralCentroid : 0,
                zcr: typeof f.zcr === 'number' ? f.zcr : 0,
                mfcc: Array.isArray(f.mfcc) ? f.mfcc : [],
                spectralFlatness: typeof f.spectralFlatness === 'number' ? f.spectralFlatness : 0,
              } as any;
              setFeatures(processed);
              // 将特征送入弹幕管线（若已激活）
              try {
                if (danmuPipelineRef.current.isActive) {
                  const full = {
                    ...processed,
                    timestamp: Date.now(),
                    preset: 'mochi',
                    sensitivity,
                  } as any;
                  danmuPipelineRef.current.handleAudioFeatures(processed.rms, full);
                }
              } catch (_) {}
            }
          });
          meydaAnalyzerRef.current.start();
        }
      } catch (_) {}

      setIsRunning(true);
      setTimeout(() => analyzeAudio(), 50);
    } catch (err) {
      console.error('MochiOnly 启动失败:', err);
    }
  }, [analyzeAudio]);

  const stopAudioProcessing = useCallback(() => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
    try { meydaAnalyzerRef.current?.stop?.(); } catch(_) {}
    meydaAnalyzerRef.current = null;
    try { audioContextRef.current?.close?.(); } catch(_) {}
    audioContextRef.current = null;
    try { streamRef.current?.getTracks()?.forEach(t => t.stop()); } catch(_) {}
    streamRef.current = null;
    sourceRef.current = null; gainRef.current = null; analyserRef.current = null;
    setIsRunning(false); setAudioLevel(0); setFeatures(null);
  }, []);

  useEffect(() => {
    const handle = async () => {
      try { await startAudioProcessing(); } catch(_) {}
    };
    handle();
    return () => stopAudioProcessing();
  }, [startAudioProcessing, stopAudioProcessing]);

  // 弹幕管线就绪后自动启动（与主页逻辑一致）
  useEffect(() => {
    const p = danmuPipelineRef.current;
    if (p.isReady && !p.isActive) {
      try { p.start(); } catch (_) {}
    }
  }, [danmuPipeline.isReady, danmuPipeline.isActive]);

  // 工具：与主页一致的字素拆分，保证逐字动画一致
  const segmentGraphemes = (input: string): string[] => {
    try {
      // @ts-ignore
      if (Intl?.Segmenter) {
        // @ts-ignore
        const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
        // @ts-ignore
        return Array.from(seg.segment(input), (s: any) => s.segment);
      }
    } catch (_) {}
    return Array.from(input);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col relative">
      {/* 可视化组件 - 全屏背景，仅 Mochi */}
      <div className="absolute inset-0 z-0">
        <Visualizer
          audioLevel={audioLevel}
          running={isRunning}
          preset={'mochi'}
          features={features}
          sensitivity={sensitivity}
          spectrumPriority={true}
        />
        <div id="danmu-container" className="absolute inset-0 pointer-events-none z-20" />
      </div>

      {/* 顶部预设选择条（样式与主页一致；仅 Mochi 可选，其它为占位） */}
      <div className="relative z-10 pt-12 sm:pt-14 portrait:pt-8 pb-6">
        <div className="flex gap-3 sm:gap-4 lg:gap-4 flex-nowrap justify-center items-center w-full px-4 sm:px-6 overflow-x-auto">
          {[
            { id: 'wave', label: 'Wave' },
            { id: 'accretion', label: 'Accretion' },
            { id: 'spiral', label: 'Spiral' },
            { id: 'mochi', label: 'Mochi' },
            { id: 'danmu', label: 'Danmu' },
          ].map((option) => {
            const graphemes = segmentGraphemes(option.label);
            const centerIndex = (graphemes.length - 1) / 2;
            const isSelected = option.id === 'mochi';
            const isDisabled = option.id !== 'mochi' && option.id !== 'danmu';
            return (
              <button
                key={option.id}
                onClick={() => { /* 仅 Mochi 保持选中，其他为占位 */ }}
                className={`
                  group relative block overflow-visible sm:overflow-hidden whitespace-nowrap
                  text-xl sm:text-[1.75rem] lg:text-[2.5rem]
                  text-center font-black uppercase leading-none mx-auto portrait:px-2
                  ${option.id === 'danmu'
                    ? (false ? 'text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.8)] !blur-none !filter-none'
                       : 'text-white/40 blur-sm')
                    : (isSelected
                       ? 'text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.8)] !blur-none !filter-none'
                       : 'text-white/40 blur-sm')}
                  ${isDisabled ? 'cursor-default' : 'cursor-pointer'}
                  focus:outline-none focus:ring-0 focus:border-0 px-4 py-2 transition-all duration-300 ease-in-out
                `}
                aria-pressed={isSelected}
                aria-label={option.label}
                disabled={isDisabled}
              >
                <span className="sm:hidden inline-block w-full text-center" aria-hidden>
                  {option.label.slice(0, 2).toUpperCase()}
                </span>
                <div className="hidden sm:flex relative">
                  {graphemes.map((g, i) => (
                    <span
                      key={`top-${option.id}-${i}`}
                      className={`inline-block transition-transform duration-300 ease-in-out ${
                        isSelected ? '-translate-y-[180%] opacity-0' : 'group-hover:-translate-y-[120%]'
                      }`}
                      style={{ transitionDelay: `${Math.abs(i - centerIndex) * 25}ms` }}
                    >
                      {g}
                    </span>
                  ))}
                </div>
                <div className="hidden sm:flex absolute inset-0 justify-center items-center">
                  {graphemes.map((g, i) => (
                    <span
                      key={`bottom-${option.id}-${i}`}
                      className={`inline-block transition-transform duration-300 ease-in-out ${isSelected ? 'translate-y-0 opacity-100' : 'translate-y-[180%] opacity-0'} ${isSelected ? '' : 'group-hover:translate-y-0 group-hover:opacity-100'}`}
                      style={{ transitionDelay: `${Math.abs(i - centerIndex) * 25}ms` }}
                    >
                      {g}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}


