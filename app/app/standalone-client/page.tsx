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

  const graphemes = segmentGraphemes(label);
  const centerIndex = (graphemes.length - 1) / 2;

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
        {graphemes.map((grapheme, i) => (
          <span
            key={`top-${i}`}
            className="inline-block transition-transform duration-300 ease-in-out group-hover:-translate-y-[110%]"
            style={{
              transitionDelay: `${Math.abs(i - centerIndex) * 25}ms`,
            }}
          >
            {grapheme}
          </span>
        ))}
      </div>
      
      {/* 下层文字 - 悬停时从下方滑入 */}
      <div className="absolute inset-0 flex">
        {graphemes.map((grapheme, i) => (
          <span
            key={`bottom-${i}`}
            className="inline-block transition-transform duration-300 ease-in-out translate-y-[110%] group-hover:translate-y-0"
            style={{
              transitionDelay: `${Math.abs(i - centerIndex) * 25}ms`,
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
  const streamRef = useRef<MediaStream | null>(null);

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

  // 音频分析循环 - 参考主页面的实现
  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.fftSize;
    const timeDomainData = new Float32Array(bufferLength);

    // 使用时域数据计算 RMS 与峰值 - 这是关键！
    analyser.getFloatTimeDomainData(timeDomainData);

    let sumSquares = 0;
    let maxAbs = 0;
    let minVal = 1;
    let maxVal = -1;
    let zeroCount = 0;

    for (let i = 0; i < bufferLength; i++) {
      const sample = timeDomainData[i]; // [-1, 1]
      if (sample === 0) zeroCount++;
      sumSquares += sample * sample;
      if (sample > maxVal) maxVal = sample;
      if (sample < minVal) minVal = sample;
      const abs = Math.abs(sample);
      if (abs > maxAbs) maxAbs = abs;
    }

    const rms = Math.sqrt(sumSquares / bufferLength); // [0, 1]
    let normalizedLevel = Math.min(Math.max(rms, 0), 1);

    // 调试信息：检查是否所有值都是0
    if (zeroCount === bufferLength) {
      console.warn('⚠️ 音频数据全为零 - 可能音频流未正确连接');
      // 输出前10个样本值用于调试
      const sampleValues = Array.from(timeDomainData.slice(0, 10));
      console.log('前10个音频样本值:', sampleValues);
    }

    // 检查是否是固定值（如91-92%可能表示读取问题）
    if (normalizedLevel > 0.9 && normalizedLevel < 0.93) {
      console.warn('⚠️ 检测到可能的固定音频值:', normalizedLevel.toFixed(6));
    }

    setAudioLevel(normalizedLevel);
    
    // 简单的特征提取
    const features = {
      rms: normalizedLevel,
      spectralCentroid: normalizedLevel * 0.5,
      zcr: normalizedLevel * 0.3,
      mfcc: [normalizedLevel * 0.8, normalizedLevel * 0.6, normalizedLevel * 0.4, normalizedLevel * 0.2],
      spectralFlatness: normalizedLevel * 0.7,
      spectralFlux: normalizedLevel * 0.4,
      voiceProb: normalizedLevel * 0.6,
      percussiveRatio: normalizedLevel * 0.5,
      harmonicRatio: normalizedLevel * 0.8
    };
    setFeatures(features);
    
    // 调试日志 - 每100帧输出一次
    if (Math.random() < 0.01) {
      console.log('音频级别:', normalizedLevel.toFixed(3), 'RMS:', rms.toFixed(3), 'MaxAbs:', maxAbs.toFixed(3), 'ZeroCount:', zeroCount, 'BufferLength:', bufferLength);
    }
    
    // 继续循环
    animationFrameRef.current = requestAnimationFrame(analyzeAudio);
  }, []);

  // 启动音频处理 - 参考主页面的实现
  const startAudioProcessing = useCallback(async () => {
    try {
      console.log('请求麦克风权限...');

      // 获取麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
        }
      });

      console.log('创建音频上下文...');

      // 创建音频上下文
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);

      // 配置分析器 - 使用与主页面相同的配置
      analyser.fftSize = 2048; // 改为2048，与主页面一致
      analyser.smoothingTimeConstant = 0.5; // 改为0.5，与主页面一致

      // 连接音频节点
      source.connect(analyser);
      
      // 调试：检查连接状态
      console.log('音频节点连接状态:', {
        sourceConnected: source.context.state,
        analyserConnected: analyser.context.state,
        analyserFftSize: analyser.fftSize,
        analyserFrequencyBinCount: analyser.frequencyBinCount
      });

      // 确保音频上下文运行
      try {
        if (audioContext.state !== 'running') {
          await audioContext.resume();
          console.log('AudioContext 已恢复:', audioContext.state);
        }
        console.log('AudioContext 状态:', audioContext.state);
        console.log('AudioContext 采样率:', audioContext.sampleRate);
      } catch (resumeErr) {
        console.warn('AudioContext 恢复失败:', resumeErr);
      }

      // 启用音轨
      try {
        stream.getAudioTracks().forEach(track => {
          console.log('音轨状态:', {
            enabled: track.enabled,
            muted: track.muted,
            readyState: track.readyState,
            label: track.label
          });
          if (!track.enabled) track.enabled = true;
        });
      } catch (e) {
        console.warn('无法设置音轨启用状态:', e);
      }

      // 保存引用
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
      streamRef.current = stream;

      console.log('开始音频分析...');

      // 先标记为运行，再启动循环
      setIsRunning(true);
      
      // 延迟启动分析循环，确保状态已更新
      setTimeout(() => {
        console.log('启动音频分析循环...');
        console.log('isRunning状态:', isRunning);
        console.log('analyserRef.current:', !!analyserRef.current);
        
        // 测试音频数据获取
        const testAnalyser = analyserRef.current;
        if (testAnalyser) {
          const testBuffer = new Float32Array(testAnalyser.fftSize);
          testAnalyser.getFloatTimeDomainData(testBuffer);
          console.log('测试音频数据前10个值:', Array.from(testBuffer.slice(0, 10)));
        }
        
        analyzeAudio();
      }, 100);

      console.log('音频处理已启动');
    } catch (error) {
      console.error('启动音频处理失败:', error);
    }
  }, [analyzeAudio]);

  // 停止音频处理 - 参考主页面的实现
  const stopAudioProcessing = useCallback(() => {
    // 停止音频分析循环
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // 断开音频连接
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // 停止媒体流
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
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
      {/* 全局样式 - 移除所有按钮的焦点样式 */}
      <style jsx global>{`
        button:focus {
          outline: none !important;
          box-shadow: none !important;
          border: none !important;
        }
        button:focus-visible {
          outline: none !important;
          box-shadow: none !important;
          border: none !important;
        }
        button:active {
          outline: none !important;
          box-shadow: none !important;
          border: none !important;
        }
      `}</style>
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
          {PRESET_OPTIONS.map((option, index) => {
            const graphemes = segmentGraphemes(option.label);
            const centerIndex = (graphemes.length - 1) / 2;

            return (
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
                      focus:outline-none focus:ring-0 focus:border-0
                      min-h-[44px] min-w-[44px]
                      px-4 py-2
                      transition-all duration-300 ease-in-out
                      // will-change-transform
                      // transform-gpu
                    `}
              style={{
                lineHeight: 0.75,
              }}
            >
              {/* 上层文字 - 悬停时向上移动 */}
              <div className="flex relative">
                {graphemes.map((grapheme, i) => (
                  <span
                    key={`top-${i}`}
                    className="inline-block transition-transform duration-300 ease-in-out group-hover:-translate-y-[120%]"
                    style={{
                      transitionDelay: `${Math.abs(i - centerIndex) * 25}ms`,
                    }}
                  >
                    {grapheme}
                  </span>
                ))}
              </div>

              {/* 下层文字 - 悬停时从下方滑入 */}
              <div className="absolute inset-0 flex justify-center items-center">
                {graphemes.map((grapheme, i) => (
                  <span
                    key={`bottom-${i}`}
                    className="inline-block transition-transform duration-300 ease-in-out translate-y-[120%] group-hover:translate-y-0"
                    style={{
                      transitionDelay: `${Math.abs(i - centerIndex) * 25}ms`,
                    }}
                  >
                    {grapheme}
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
