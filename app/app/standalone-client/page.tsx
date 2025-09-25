"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import Visualizer from '../../components/visualizer';

// 字素簇拆分函数 - 支持中文、emoji等复杂字符
function segmentGraphemes(input: string): string[] {
  try {
    if ((Intl as any)?.Segmenter) {
      const seg = new (Intl as any).Segmenter(undefined, { granularity: 'grapheme' });
      return Array.from(seg.segment(input), (s: any) => s.segment);
    }
  } catch (_) {
    // 降级方案：简单字符拆分
  }
  return Array.from(input);
}

// FlipOption 组件
interface FlipOptionProps {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  density?: 'compact' | 'normal' | 'spacious';
  animation?: 'auto' | 'reduced' | 'off';
  className?: string;
}

const FlipOption: React.FC<FlipOptionProps> = ({
  label,
  selected = false,
  disabled = false,
  onSelect,
  density = 'normal',
  animation = 'auto',
  className = ''
}) => {
  const handleClick = useCallback(() => {
    if (!disabled && onSelect) {
      onSelect();
    }
  }, [disabled, onSelect]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }, [handleClick]);

  const sizeClasses = {
    compact: 'text-xl sm:text-2xl',
    normal: 'text-2xl sm:text-4xl md:text-6xl',
    spacious: 'text-4xl sm:text-6xl md:text-8xl'
  };

  const colorClasses = selected 
    ? 'text-cyan-400 group-hover:text-cyan-300' 
    : 'text-purple-400 group-hover:text-purple-300';

  const disabledClasses = disabled 
    ? 'opacity-50 cursor-not-allowed' 
    : 'cursor-pointer';

  return (
    <button
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      className={`
        group relative block overflow-hidden whitespace-nowrap
        ${sizeClasses[density]}
        ${colorClasses}
        ${disabledClasses}
        font-black uppercase
        focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-black
        min-h-[44px] min-w-[44px]
        ${className}
      `}
      style={{
        lineHeight: 0.75,
      }}
      role="option"
      aria-selected={selected}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
    >
      {/* 上层文字 - 悬停时向上移动 */}
      <div className="flex">
        {segmentGraphemes(label).map((grapheme, i) => (
          <span
            key={`top-${i}`}
            className="inline-block transition-transform duration-300 ease-in-out group-hover:-translate-y-[110%]"
            style={{
              transitionDelay: `${i * 25}ms`,
            }}
          >
            {grapheme}
          </span>
        ))}
      </div>
      
      {/* 下层文字 - 悬停时从下方滑入 */}
      <div className="absolute inset-0 flex">
        {segmentGraphemes(label).map((grapheme, i) => (
          <span
            key={`bottom-${i}`}
            className="inline-block transition-transform duration-300 ease-in-out translate-y-[110%] group-hover:translate-y-0"
            style={{
              transitionDelay: `${i * 25}ms`,
            }}
          >
            {grapheme}
          </span>
        ))}
      </div>

      {/* 选中状态指示器 */}
      {selected && (
        <div className="absolute -bottom-1 left-0 right-0 h-1 bg-cyan-400 rounded-full" />
      )}
    </button>
  );
};

// 预设选项配置
const PRESET_OPTIONS = [
  { id: 'wave', label: 'Wave' },
  { id: 'accretion', label: 'Accretion' },
  { id: 'spiral', label: 'Spiral' },
  { id: 'mosaic', label: 'Mosaic' }
];

export default function StandaloneClient() {
  // 状态管理
  const [currentPreset, setCurrentPreset] = useState<string>('wave');
  const [animationMode, setAnimationMode] = useState<'auto' | 'reduced' | 'off'>('auto');
  const [isRunning, setIsRunning] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [features, setFeatures] = useState(null);
  const [sensitivity, setSensitivity] = useState(1.5);
  
  // 音频处理引用
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // 检测用户偏好
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) {
      setAnimationMode('reduced');
    }
    
    const handleChange = (e: MediaQueryListEvent) => {
      setAnimationMode(e.matches ? 'reduced' : 'auto');
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // 音频分析循环
  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current) return;
    
    const dataArray = dataArrayRef.current;
    if (dataArray && analyserRef.current) {
      (analyserRef.current as any).getByteFrequencyData(dataArray);
    }
    
    // 计算音频级别
    let sum = 0;
    for (let i = 0; i < dataArrayRef.current.length; i++) {
      sum += dataArrayRef.current[i];
    }
    const level = sum / (dataArrayRef.current.length * 255);
    setAudioLevel(level);
    
    // 简单的特征提取
    const features = {
      rms: level,
      spectralCentroid: level * 0.5,
      zcr: level * 0.3,
      mfcc: [level * 0.8, level * 0.6, level * 0.4, level * 0.2],
      spectralFlatness: level * 0.7,
      spectralFlux: level * 0.4,
      voiceProb: level * 0.6,
      percussiveRatio: level * 0.5,
      harmonicRatio: level * 0.8
    };
    setFeatures(features);
    
    if (isRunning) {
      animationFrameRef.current = requestAnimationFrame(analyzeAudio);
    }
  }, [isRunning]);

  // 启动音频处理
  const startAudioProcessing = useCallback(async () => {
    try {
      // 获取麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
        } 
      });
      
      // 创建音频上下文
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      
      // 配置分析器
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      
      // 连接音频节点
      source.connect(analyser);
      
      // 保存引用
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
      
      // 开始分析
      setIsRunning(true);
      analyzeAudio();
      
      console.log('音频处理已启动');
    } catch (error) {
      console.error('启动音频处理失败:', error);
    }
  }, [analyzeAudio]);

  // 停止音频处理
  const stopAudioProcessing = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    analyserRef.current = null;
    dataArrayRef.current = null;
    setIsRunning(false);
    setAudioLevel(0);
    setFeatures(null);
    
    console.log('音频处理已停止');
  }, []);

  // 处理预设选择
  const handlePresetChange = useCallback((presetId: string) => {
    setCurrentPreset(presetId);
    
    // 如果还没开始，自动开始音频处理
    if (!isRunning) {
      startAudioProcessing();
    }
    
    console.log('预设已切换至:', presetId);
  }, [isRunning, startAudioProcessing]);

  // 清理函数
  useEffect(() => {
    return () => {
      stopAudioProcessing();
    };
  }, [stopAudioProcessing]);

  // 键盘快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 数字键切换预设
      const presetKeys = ['Digit1', 'Digit2', 'Digit3', 'Digit4'];
      const keyIndex = presetKeys.indexOf(e.code);
      if (keyIndex >= 0 && keyIndex < PRESET_OPTIONS.length) {
        e.preventDefault();
        handlePresetChange(PRESET_OPTIONS[keyIndex].id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePresetChange]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col relative">
      {/* 可视化组件 - 全屏背景 */}
      <div className="absolute inset-0 z-0">
        <Visualizer
          audioLevel={audioLevel}
          running={isRunning}
          preset={currentPreset as 'pulse' | 'accretion' | 'spiral' | 'mosaic' | 'wave'}
          features={features}
          sensitivity={sensitivity}
        />
      </div>
      
      {/* 预设选择器 - 放在顶部但不贴边 */}
      <div className="relative z-10 pt-16 pb-8">
        <div className="flex gap-8 flex-wrap justify-center">
          {PRESET_OPTIONS.map((option, index) => (
            <button
              key={option.id}
              onClick={() => handlePresetChange(option.id)}
              className={`
                group relative block overflow-hidden whitespace-nowrap
                text-4xl sm:text-6xl md:text-8xl
                font-black uppercase
                ${currentPreset === option.id 
                  ? 'text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]' 
                  : 'text-white/40 blur-sm hover:text-white/60 hover:blur-none'
                }
                cursor-pointer
                focus:outline-none
                min-h-[44px] min-w-[44px]
                px-4 py-2
                transition-all duration-300 ease-in-out
              `}
              style={{
                lineHeight: 0.75,
              }}
            >
              {/* 上层文字 - 悬停时向上移动 */}
              <div className="flex">
                {segmentGraphemes(option.label).map((grapheme, i) => (
                  <span
                    key={`top-${i}`}
                    className="inline-block transition-transform duration-300 ease-in-out group-hover:-translate-y-[120%]"
                    style={{
                      transitionDelay: `${i * 25}ms`,
                    }}
                  >
                    {grapheme}
                  </span>
                ))}
              </div>
              
              {/* 下层文字 - 悬停时从下方滑入 */}
              <div className="absolute inset-0 flex">
                {segmentGraphemes(option.label).map((grapheme, i) => (
                  <span
                    key={`bottom-${i}`}
                    className="inline-block transition-transform duration-300 ease-in-out translate-y-[120%] group-hover:translate-y-0"
                    style={{
                      transitionDelay: `${i * 25}ms`,
                    }}
                  >
                    {grapheme}
                  </span>
                ))}
              </div>

            </button>
          ))}
        </div>
      </div>
    </div>
  );
}