'use client';

import { useState, useRef } from 'react';
import Visualizer from '../components/visualizer';
import Meyda from 'meyda';
import { useDanmuPipeline } from '../hooks/useDanmuPipeline';
import MobileAudioPermission from '../components/mobile-audio-permission';
import AudioFallback from '../components/audio-fallback';
import {
  getSharedInstrumentClassifier,
  InstrumentDetectionResult,
} from '../lib/instrument-classifier';
import { EnhancedFeatureAggregator } from '../lib/enhanced-feature-aggregator';

type AudioFeatureSnapshot = {
  // 基础Meyda特征
  rms?: number;
  spectralCentroid?: number;
  zcr?: number;
  mfcc?: number[];
  spectralFlatness?: number;
  spectralFlux?: number;
  chroma?: number[];
  spectralBandwidth?: number;
  spectralRolloff?: number;
  spectralContrast?: number[];
  spectralSpread?: number;
  spectralSkewness?: number;
  spectralKurtosis?: number;
  loudness?: number;
  perceptualSpread?: number;
  perceptualSharpness?: number;
  voiceProb?: number;
  percussiveRatio?: number;
  harmonicRatio?: number;
  dominantInstrument?: string;
  instrumentProbabilities?: Record<string, number>;
  instrumentConfidence?: number;
  
  // 增强特征
  pitch?: {
    fundamentalFreq: number;
    pitchConfidence: number;
    pitchClass: string;
    octave: number;
    cents: number;
    harmonicity: number;
    isVoiced: boolean;
  };
  tempo?: {
    bpm: number;
    tempoConfidence: number;
    timeSignature: [number, number];
    rhythmPattern: string;
  };
  timbre?: {
    brightness: number;
    warmth: number;
    roughness: number;
    timbreCategory: string;
  };
  instruments?: {
    dominantInstrument: string;
    instrumentCount: number;
    polyphony: number;
  };
  enhancedHPSS?: {
    musicComplexity: number;
    overallStability: number;
    overallRichness: number;
    dominantComponent: 'harmonic' | 'percussive' | 'mixed';
  };
};

export default function HomePage() {
  const [isStarted, setIsStarted] = useState(false);
  const [status, setStatus] = useState('等待启动');
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<string>('');
  const [testMode, setTestMode] = useState(false);
  const [showMobilePermission, setShowMobilePermission] = useState(false);
  const [showAudioFallback, setShowAudioFallback] = useState(false);
  const [signalOn, setSignalOn] = useState(false);
  const [peak, setPeak] = useState(0);
  const [preset, setPreset] = useState<
    'pulse' | 'accretion' | 'spiral' | 'mosaic'
  >('pulse');
  const [accretionCtrl, setAccretionCtrl] = useState({
    sensMin: 0.92,
    sensMax: 1.18,
    gainScale: 1.15,
    flickerStrength: 0.1,
    flickerFreq: 14,
    overallBoost: 1.1,
  });
  const [mosaicCtrl, setMosaicCtrl] = useState({
    cellSize: 20,
    maxAge: 80,
    growthRate: 0.05,
    spawnRate: 0.02,
    colorScheme: 0,
    colorFlowSpeed: 0.01,
    alpha: 0.7,
  });
  // const [frequencyBars, setFrequencyBars] = useState<number[]>([]); // legacy, not used now
  const [features, setFeatures] = useState<AudioFeatureSnapshot | null>(null);
  const [sensitivity, setSensitivity] = useState<number>(1.5);
  const [rawMic, setRawMic] = useState<boolean>(false);
  const [autoCalibrate, setAutoCalibrate] = useState<boolean>(true);
  const noiseFloorRef = useRef<number>(0);

  // 弹幕管线
  const danmuPipeline = useDanmuPipeline({
    enabled: true,
    autoStart: false, // 手动启动
    useSimple: false, // 启用完整版管线进行实时风格检测
    needComments: 4,
    locale: 'zh-CN',
    rmsThreshold: 0.0001, // 进一步降低RMS阈值，确保能检测到音频
    maxConcurrency: 2,
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isRunningRef = useRef<boolean>(false);
  const meydaAnalyzerRef = useRef<any | null>(null);
  const featureSnapshotRef = useRef<AudioFeatureSnapshot | null>(null);
  const enhancedFeatureAggregatorRef = useRef<EnhancedFeatureAggregator | null>(null);
  type SharedInstrumentClassifier = ReturnType<
    typeof getSharedInstrumentClassifier
  >;
  const instrumentClassifierRef = useRef<SharedInstrumentClassifier | null>(
    null
  );
  const instrumentBufferRef = useRef<Float32Array>(new Float32Array(0));
  const instrumentSampleRateRef = useRef<number>(44100);
  const instrumentLastEvalRef = useRef<number>(0);
  const instrumentPendingRef = useRef<boolean>(false);
  const instrumentInfoRef = useRef<InstrumentDetectionResult | null>(null);
  const voiceLevelRef = useRef(0);
  const percussiveLevelRef = useRef(0);
  const harmonicLevelRef = useRef(0.5);

  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const clampOptional = (value: number | undefined) => {
    if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
      return 0;
    }
    return clamp01(value);
  };
  const pickNumber = (value: unknown): number | undefined => {
    if (typeof value !== 'number') return undefined;
    if (Number.isNaN(value) || !Number.isFinite(value)) return undefined;
    return value;
  };
  const toFixedArray = (value: unknown, length: number) => {
    if (!Array.isArray(value)) return undefined;
    const result = new Array(length).fill(0);
    for (let i = 0; i < Math.min(length, value.length); i++) {
      const num = pickNumber(value[i]);
      if (num !== undefined) {
        result[i] = num;
      }
    }
    return result;
  };

  const deriveAudioHints = (f: any) => {
    const flat =
      typeof f?.spectralFlatness === 'number' ? f.spectralFlatness : undefined;
    const centroid =
      typeof f?.spectralCentroid === 'number' ? f.spectralCentroid : undefined;
    const flux =
      typeof f?.spectralFlux === 'number' ? f.spectralFlux : undefined;

    let voiceProb: number | undefined;
    if (flat != null || centroid != null) {
      const flatFactor = flat != null ? clamp01(1 - flat) : 0.5;
      const centroidNorm =
        centroid != null ? clamp01((centroid - 1500) / 2500) : 0.5;
      voiceProb = clamp01(0.35 + 0.4 * flatFactor + 0.25 * centroidNorm);
    }

    let percussiveRatio: number | undefined;
    if (flat != null || flux != null) {
      const fluxNorm = flux != null ? clamp01(flux * 1.4) : 0.35;
      const flatNorm = flat != null ? clamp01(flat) : 0.4;
      percussiveRatio = clamp01(0.45 * fluxNorm + 0.4 * flatNorm);
    }

    let harmonicRatio: number | undefined;
    if (percussiveRatio != null) {
      const base = 1 - percussiveRatio * 0.7;
      const voiceBoost = voiceProb != null ? 0.2 * voiceProb : 0;
      harmonicRatio = clamp01(base + voiceBoost);
    }

    return { voiceProb, percussiveRatio, harmonicRatio };
  };

  const appendInstrumentSamples = (chunk: Float32Array) => {
    const sampleRate =
      instrumentSampleRateRef.current ||
      audioContextRef.current?.sampleRate ||
      44100;
    const maxSamples = Math.max(sampleRate * 2, chunk.length);
    const current = instrumentBufferRef.current;
    const combinedLength = Math.min(maxSamples, current.length + chunk.length);
    const nextBuffer = new Float32Array(combinedLength);
    const tailLength = Math.min(current.length, combinedLength - chunk.length);
    if (tailLength > 0) {
      nextBuffer.set(current.slice(current.length - tailLength), 0);
    }
    nextBuffer.set(chunk, combinedLength - chunk.length);
    instrumentBufferRef.current = nextBuffer;
  };

  const runInstrumentDetection = async () => {
    if (instrumentPendingRef.current) return;
    const sampleRate =
      instrumentSampleRateRef.current ||
      audioContextRef.current?.sampleRate ||
      44100;
    const buffer = instrumentBufferRef.current;
    if (buffer.length < sampleRate) return;
    const now =
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - instrumentLastEvalRef.current < 800) return;

    instrumentPendingRef.current = true;
    instrumentLastEvalRef.current = now;

    try {
      if (!instrumentClassifierRef.current) {
        instrumentClassifierRef.current = getSharedInstrumentClassifier();
      }
      const segment = buffer.slice(buffer.length - sampleRate);
      const result = await instrumentClassifierRef.current.classify(
        segment,
        sampleRate
      );
      if (result) {
        instrumentInfoRef.current = result;
      }
    } catch (err) {
      console.warn('Instrument detection error:', err);
    } finally {
      instrumentPendingRef.current = false;
    }
  };

  const handleStart = () => {
    // 检测移动设备并显示相应的权限请求
    const isMobile = /Mobile|Android|iPhone|iPad|iPod/i.test(
      navigator.userAgent
    );

    if (isMobile) {
      setShowMobilePermission(true);
    } else {
      // 桌面设备使用原来的流程
      startDesktopAudio();
    }
  };

  const startDesktopAudio = async () => {
    try {
      setStatus('请求麦克风权限...');
      console.log('请求麦克风权限...');

      // 先请求权限，再 enumerateDevices，以避免 Safari/权限策略导致的设备列表空/无标签
      const provisionalStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      setStatus('检查音频设备...');
      console.log('检查音频设备...');
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(d => d.kind === 'audioinput');
      if (audioInputs.length === 0) {
        // 清理临时流
        provisionalStream.getTracks().forEach(t => t.stop());
        throw new Error('未检测到音频输入设备，请连接麦克风或耳机');
      }

      // 优先使用有标签的第一个设备
      const preferred = audioInputs.find(d => !!d.label) ?? audioInputs[0];
      const deviceId = preferred.deviceId;

      // 关闭临时流，使用指定 deviceId 重新获取媒体流
      provisionalStream.getTracks().forEach(t => t.stop());

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: rawMic ? false : true,
          noiseSuppression: rawMic ? false : true,
          autoGainControl: rawMic ? false : true,
          sampleRate: 44100,
        },
      });

      // 显示设备信息
      const nameList = audioInputs.map(d => d.label || '未知设备').join(', ');
      setDeviceInfo(
        `检测到 ${audioInputs.length} 个音频设备，当前: ${preferred.label || '未知'}；全部: ${nameList}`
      );

      setStatus('初始化音频分析...');
      console.log('初始化音频分析...');

      // 创建音频上下文
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      instrumentSampleRateRef.current = audioContext.sampleRate;
      instrumentBufferRef.current = new Float32Array(0);
      instrumentLastEvalRef.current = 0;
      instrumentInfoRef.current = null;
      instrumentSampleRateRef.current = audioContext.sampleRate;
      instrumentBufferRef.current = new Float32Array(0);
      instrumentLastEvalRef.current = 0;
      instrumentInfoRef.current = null;

      // 确保音频上下文运行
      try {
        if (audioContext.state !== 'running') {
          await audioContext.resume();
          console.log('AudioContext 已恢复:', audioContext.state);
        }
      } catch (resumeErr) {
        console.warn('AudioContext 恢复失败:', resumeErr);
      }

      // 启用音轨
      try {
        stream.getAudioTracks().forEach(track => {
          if (!track.enabled) track.enabled = true;
        });
      } catch (e) {
        console.warn('无法设置音轨启用状态:', e);
      }

      // 配置分析器
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.5;

      // 连接
      microphone.connect(analyser);

      // 保存引用
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      microphoneRef.current = microphone;
      streamRef.current = stream;

      // 初始化增强特征聚合器
      try {
        enhancedFeatureAggregatorRef.current = new EnhancedFeatureAggregator();
        await enhancedFeatureAggregatorRef.current.initialize();
        console.log('增强特征聚合器初始化完成');
      } catch (e) {
        console.warn('增强特征聚合器初始化失败:', e);
      }

      // 初始化 Meyda 特征提取
      try {
        if (Meyda && (Meyda as any).isBrowser) {
          meydaAnalyzerRef.current = Meyda.createMeydaAnalyzer({
            audioContext,
            source: microphone,
            bufferSize: 1024,
            featureExtractors: [
              'rms',
              'spectralCentroid',
              'zcr',
              'mfcc',
              'spectralFlatness',
              'spectralFlux',
              'chroma',
              'spectralBandwidth',
              'spectralRolloff',
              'spectralContrast',
              'spectralSpread',
              'spectralSkewness',
              'spectralKurtosis',
              'loudness',
              'perceptualSpread',
              'perceptualSharpness',
            ],
            callback: (f: any) => {
              try {
                const hints = deriveAudioHints(f);
                const instrumentInfo = instrumentInfoRef.current;
                const loudnessValue =
                  typeof f.loudness === 'number'
                    ? f.loudness
                    : typeof f?.loudness?.total === 'number'
                      ? f.loudness.total
                      : undefined;
                const probabilities = instrumentInfo?.probabilities;
                const voiceModel = clampOptional(probabilities?.voice);
                const drumsModel = clampOptional(probabilities?.drums);
                const bassModel = clampOptional(probabilities?.bass);
                const synthModel = clampOptional(probabilities?.synth);
                const percussiveModel = clamp01(
                  drumsModel * 0.7 + bassModel * 0.2 + synthModel * 0.1
                );
                const heuristicVoice = hints.voiceProb ?? 0;
                const heuristicPercussive = hints.percussiveRatio ?? 0;
                const heuristicHarmonic = hints.harmonicRatio ?? undefined;

                const blendedVoice =
                  voiceModel > 0
                    ? clamp01(heuristicVoice * 0.4 + voiceModel * 0.6)
                    : heuristicVoice;
                voiceLevelRef.current =
                  voiceLevelRef.current * 0.7 + blendedVoice * 0.3;
                const finalVoiceProb = clamp01(voiceLevelRef.current);

                const blendedPercussive = clamp01(
                  heuristicPercussive * 0.5 + percussiveModel * 0.5
                );
                percussiveLevelRef.current =
                  percussiveLevelRef.current * 0.7 + blendedPercussive * 0.3;
                const finalPercussive = clamp01(percussiveLevelRef.current);

                const harmonicModel = clamp01(1 - finalPercussive + finalVoiceProb * 0.2);
                const blendedHarmonic =
                  heuristicHarmonic !== undefined
                    ? clamp01(heuristicHarmonic * 0.5 + harmonicModel * 0.5)
                    : harmonicModel;
                harmonicLevelRef.current =
                  harmonicLevelRef.current * 0.6 + blendedHarmonic * 0.4;
                const finalHarmonic = clamp01(harmonicLevelRef.current);

                const snapshot: AudioFeatureSnapshot = {
                  rms: pickNumber(f.rms),
                  spectralCentroid: pickNumber(f.spectralCentroid),
                  zcr: pickNumber(f.zcr),
                  mfcc: toFixedArray(f.mfcc, 13),
                  spectralFlatness: pickNumber(f.spectralFlatness),
                  spectralFlux: pickNumber(f.spectralFlux),
                  chroma: toFixedArray(f.chroma, 12),
                  spectralBandwidth: pickNumber(f.spectralBandwidth),
                  spectralRolloff: pickNumber(f.spectralRolloff),
                  spectralContrast: toFixedArray(f.spectralContrast, 6),
                  spectralSpread: pickNumber(f.spectralSpread),
                  spectralSkewness: pickNumber(f.spectralSkewness),
                  spectralKurtosis: pickNumber(f.spectralKurtosis),
                  loudness: pickNumber(loudnessValue),
                  perceptualSpread: pickNumber(f.perceptualSpread),
                  perceptualSharpness: pickNumber(f.perceptualSharpness),
                  voiceProb: finalVoiceProb,
                  percussiveRatio: finalPercussive,
                  harmonicRatio: finalHarmonic,
                  dominantInstrument: instrumentInfo?.label,
                  instrumentProbabilities: instrumentInfo?.probabilities,
                  instrumentConfidence: instrumentInfo?.probability,
                };

                // 添加增强特征提取
                if (enhancedFeatureAggregatorRef.current && audioContextRef.current) {
                  try {
                    // 获取当前音频缓冲区
                    const audioBuffer = new Float32Array(analyser.fftSize);
                    analyser.getFloatTimeDomainData(audioBuffer);
                    const sampleRate = audioContextRef.current.sampleRate;
                    
                    // 创建增强特征帧
                    const enhancedFrame = {
                      ...snapshot,
                      audioBuffer,
                      sampleRate,
                      timestamp: Date.now(),
                      // 确保包含必需的字段
                      pitch: undefined,
                      tempo: undefined,
                      timbre: undefined,
                      instruments: undefined,
                      enhancedHPSS: undefined
                    };

                    // 异步处理增强特征
                    enhancedFeatureAggregatorRef.current.addEnhancedFrame(enhancedFrame).then(() => {
                      // 获取增强特征统计
                      const enhancedWindow = enhancedFeatureAggregatorRef.current?.getLatestEnhancedWindow();
                      if (enhancedWindow) {
                        // 更新快照中的增强特征
                        snapshot.pitch = enhancedWindow.pitchStats ? {
                          fundamentalFreq: enhancedWindow.pitchStats.avgFundamentalFreq,
                          pitchConfidence: enhancedWindow.pitchStats.pitchConfidence,
                          pitchClass: enhancedWindow.pitchStats.dominantPitch,
                          octave: Math.floor(Math.log2(enhancedWindow.pitchStats.avgFundamentalFreq / 16.35)) - 1,
                          cents: 0, // 可以从详细统计中获取
                          harmonicity: 0.8, // 可以从详细统计中获取
                          isVoiced: enhancedWindow.pitchStats.pitchConfidence > 0.5
                        } : undefined;

                        snapshot.tempo = enhancedWindow.tempoStats ? {
                          bpm: enhancedWindow.tempoStats.avgBpm,
                          tempoConfidence: enhancedWindow.tempoStats.tempoConfidence,
                          timeSignature: enhancedWindow.tempoStats.dominantTimeSignature.split('/').map(Number) as [number, number],
                          rhythmPattern: enhancedWindow.tempoStats.tempoStability > 0.8 ? 'regular' : 'irregular'
                        } : undefined;

                        snapshot.timbre = enhancedWindow.timbreStats ? {
                          brightness: enhancedWindow.timbreStats.avgBrightness,
                          warmth: enhancedWindow.timbreStats.avgWarmth,
                          roughness: enhancedWindow.timbreStats.avgRoughness,
                          timbreCategory: enhancedWindow.timbreStats.dominantTimbre
                        } : undefined;

                        snapshot.instruments = enhancedWindow.instrumentStats ? {
                          dominantInstrument: enhancedWindow.instrumentStats.dominantInstrument,
                          instrumentCount: enhancedWindow.instrumentStats.instrumentCount,
                          polyphony: enhancedWindow.instrumentStats.polyphony
                        } : undefined;

                        snapshot.enhancedHPSS = enhancedWindow.enhancedHPSSStats ? {
                          musicComplexity: enhancedWindow.enhancedHPSSStats.avgMusicalComplexity,
                          overallStability: enhancedWindow.enhancedHPSSStats.avgMusicalStability,
                          overallRichness: enhancedWindow.enhancedHPSSStats.avgMusicalRichness,
                          dominantComponent: 'mixed' as const // 从统计中推断
                        } : undefined;

                        console.log('🎵 增强特征提取完成:', {
                          pitch: snapshot.pitch,
                          tempo: snapshot.tempo,
                          timbre: snapshot.timbre,
                          instruments: snapshot.instruments,
                          enhancedHPSS: snapshot.enhancedHPSS
                        });
                      }
                    }).catch(err => {
                      console.warn('增强特征提取失败:', err);
                    });
                  } catch (err) {
                    console.warn('增强特征处理错误:', err);
                  }
                }

                featureSnapshotRef.current = snapshot;
                setFeatures(snapshot);
              } catch (e) {
                // ignore per-frame errors
              }
            },
          });
          meydaAnalyzerRef.current.start();
        }
      } catch (e) {
        console.warn('Meyda 初始化失败:', e);
      }

      setStatus('开始音频分析...');
      console.log('开始音频分析...');

      // 先标记为运行，再启动循环，避免闭包捕获旧状态
      isRunningRef.current = true;
      setIsStarted(true);
      startAudioAnalysis();

      // 启动弹幕管线（延迟启动确保初始化完成）
      console.log('🎵 弹幕管线准备状态:', { isReady: danmuPipeline.isReady });
      setTimeout(() => {
        console.log('🎵 延迟启动弹幕管线');
        setTimeout(() => danmuPipeline.start(), 500);
      }, 1000); // 延迟1秒启动

      setStatus('音频分析已启动');
      setError(null);
      console.log('启动成功');
    } catch (err) {
      console.error('启动失败:', err);
      setError(err instanceof Error ? err.message : '启动失败');
      setStatus('启动失败');
    }
  };

  // 移动端权限处理
  const handleMobilePermissionGranted = async (
    stream: MediaStream,
    audioContext: AudioContext
  ) => {
    try {
      setStatus('初始化移动端音频分析...');
      console.log('初始化移动端音频分析...');

      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);

      // 配置分析器
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.5;

      // 连接
      microphone.connect(analyser);

      // 保存引用
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      microphoneRef.current = microphone;
      streamRef.current = stream;

      // 调试信息：检查音频流状态
      console.log('🎤 移动端音频流信息:', {
        audioTracks: stream.getAudioTracks().length,
        trackEnabled: stream.getAudioTracks()[0]?.enabled,
        trackMuted: stream.getAudioTracks()[0]?.muted,
        trackReadyState: stream.getAudioTracks()[0]?.readyState,
        trackLabel: stream.getAudioTracks()[0]?.label,
        audioContextState: audioContext.state,
        analyserConnected: true,
      });

      // 确保音频轨道启用（移动设备特别重要）
      try {
        stream.getAudioTracks().forEach(track => {
          if (!track.enabled) {
            console.log('启用音频轨道...');
            track.enabled = true;
          }
        });
      } catch (e) {
        console.warn('无法设置音频轨道启用状态:', e);
      }

      // 设置移动端设备信息
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length > 0) {
        const track = audioTracks[0];
        const deviceLabel = track.label || '移动端麦克风';
        setDeviceInfo(`移动端设备: ${deviceLabel}`);
      } else {
        setDeviceInfo('移动端音频设备已连接');
      }

      // 初始化 Meyda 特征提取
      try {
        if (Meyda && (Meyda as any).isBrowser) {
          meydaAnalyzerRef.current = Meyda.createMeydaAnalyzer({
            audioContext,
            source: microphone,
            bufferSize: 1024,
            featureExtractors: [
              'rms',
              'spectralCentroid',
              'zcr',
              'mfcc',
              'spectralFlatness',
              'spectralFlux',
              'chroma',
              'spectralBandwidth',
              'spectralRolloff',
              'spectralContrast',
              'spectralSpread',
              'spectralSkewness',
              'spectralKurtosis',
              'loudness',
              'perceptualSpread',
              'perceptualSharpness',
            ],
            callback: (f: any) => {
              try {
                const hints = deriveAudioHints(f);
                const instrumentInfo = instrumentInfoRef.current;
                setFeatures({
                  rms: typeof f.rms === 'number' ? f.rms : undefined,
                  spectralCentroid:
                    typeof f.spectralCentroid === 'number'
                      ? f.spectralCentroid
                      : undefined,
                  zcr: typeof f.zcr === 'number' ? f.zcr : undefined,
                  mfcc: Array.isArray(f.mfcc) ? f.mfcc : undefined,
                  spectralFlatness:
                    typeof f.spectralFlatness === 'number'
                      ? f.spectralFlatness
                      : undefined,
                  spectralFlux:
                    typeof f.spectralFlux === 'number'
                      ? f.spectralFlux
                      : undefined,
                  chroma: Array.isArray(f.chroma) ? f.chroma : undefined,
                  spectralBandwidth:
                    typeof f.spectralBandwidth === 'number'
                      ? f.spectralBandwidth
                      : undefined,
                  spectralRolloff:
                    typeof f.spectralRolloff === 'number'
                      ? f.spectralRolloff
                      : undefined,
                  spectralContrast: Array.isArray(f.spectralContrast)
                    ? f.spectralContrast
                    : undefined,
                  spectralSpread:
                    typeof f.spectralSpread === 'number'
                      ? f.spectralSpread
                      : undefined,
                  spectralSkewness:
                    typeof f.spectralSkewness === 'number'
                      ? f.spectralSkewness
                      : undefined,
                  spectralKurtosis:
                    typeof f.spectralKurtosis === 'number'
                      ? f.spectralKurtosis
                      : undefined,
                  loudness:
                    typeof f.loudness === 'number' ? f.loudness : undefined,
                  perceptualSpread:
                    typeof f.perceptualSpread === 'number'
                      ? f.perceptualSpread
                      : undefined,
                  perceptualSharpness:
                    typeof f.perceptualSharpness === 'number'
                      ? f.perceptualSharpness
                      : undefined,
                  voiceProb: hints.voiceProb,
                  percussiveRatio: hints.percussiveRatio,
                  harmonicRatio: hints.harmonicRatio,
                  dominantInstrument: instrumentInfo?.label,
                  instrumentProbabilities: instrumentInfo?.probabilities,
                  instrumentConfidence: instrumentInfo?.probability,
                });
              } catch (e) {
                // ignore per-frame errors
              }
            },
          });
          meydaAnalyzerRef.current.start();
        }
      } catch (e) {
        console.warn('Meyda 初始化失败:', e);
      }

      setStatus('开始音频分析...');
      console.log('开始音频分析...');

      // 确保音频上下文已恢复 (移动设备特别重要)
      try {
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
          console.log('AudioContext 已恢复:', audioContext.state);
        }
      } catch (resumeErr) {
        console.warn('AudioContext 恢复失败:', resumeErr);
      }

      // 先标记为运行，再启动循环，避免闭包捕获旧状态
      isRunningRef.current = true;
      setIsStarted(true);
      setShowMobilePermission(false);

      // 短暂延迟确保音频上下文完全就绪 (移动设备需要)
      setTimeout(() => {
        console.log('启动音频分析循环...');
        startAudioAnalysis();
      }, 100);

      // 启动弹幕管线
      if (danmuPipeline.isReady) {
        setTimeout(() => danmuPipeline.start(), 500);
      }

      setStatus('移动端音频分析已启动');
      setError(null);
      console.log('移动端启动成功');
    } catch (err) {
      console.error('移动端启动失败:', err);
      setError(err instanceof Error ? err.message : '移动端启动失败');
      setStatus('移动端启动失败');
    }
  };

  // 移动端权限错误处理
  const handleMobilePermissionError = (error: Error) => {
    console.error('移动端权限错误:', error);
    setError(error.message);
    setShowMobilePermission(false);
    setShowAudioFallback(true);
  };

  // 移动端降级选择处理
  const handleMobileFallbackSelected = (type: string) => {
    console.log('移动端降级选择:', type);
    setShowMobilePermission(false);
    setShowAudioFallback(true);
  };

  // 降级音频启动处理
  const handleFallbackStarted = (
    audioContext: AudioContext,
    analyser: AnalyserNode
  ) => {
    try {
      console.log('降级音频启动成功');

      // 保存引用
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      // 设置降级音频设备信息
      setDeviceInfo('降级音频源: 测试音频/文件上传');

      // 标记为运行
      isRunningRef.current = true;
      setIsStarted(true);
      setShowAudioFallback(false);
      setStatus('降级音频分析已启动');
      setError(null);

      // 启动音频分析循环
      startAudioAnalysis();

      // 启动弹幕管线
      if (danmuPipeline.isReady) {
        setTimeout(() => danmuPipeline.start(), 500);
      }
    } catch (err) {
      console.error('降级音频启动失败:', err);
      setError(err instanceof Error ? err.message : '降级启动失败');
    }
  };

  // 降级音频停止处理
  const handleFallbackStopped = () => {
    console.log('降级音频停止');
    handleStop();
  };

  const startAudioAnalysis = () => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.fftSize; // 使用时域数据长度
    const timeDomainData = new Float32Array(bufferLength);
    // const freqBufferLen = analyser.frequencyBinCount;
    // const freqData = new Uint8Array(freqBufferLen);

    // 仍保留频谱下采样工具，如后续需要可用
    // const downsample = (src: Uint8Array, targetBins: number) => {
    //   const bins: number[] = new Array(targetBins).fill(0);
    //   const step = src.length / targetBins;
    //   for (let i = 0; i < targetBins; i++) {
    //     const start = Math.floor(i * step);
    //     const end = Math.floor((i + 1) * step);
    //     let sum = 0;
    //     const s = Math.max(start, 0);
    //     const e = Math.min(end, src.length);
    //     const count = Math.max(1, e - s);
    //     for (let j = s; j < e; j++) sum += src[j];
    //     bins[i] = sum / count / 255;
    //   }
    //   return bins;
    // };

    console.log('开始音频分析循环，缓冲区长度:', bufferLength);

    const analyze = () => {
      if (!isRunningRef.current) return;

      // 临时禁用音频分析，避免错误
      // try {
      if (testMode) {
        const testLevel = Math.sin(Date.now() * 0.01) * 0.5 + 0.5;
        setAudioLevel(testLevel);
        setPeak(testLevel);
        setSignalOn(testLevel > 0.01);
      } else {
        // 使用时域数据计算 RMS 与峰值
        analyser.getFloatTimeDomainData(timeDomainData);

        const chunkCopy = new Float32Array(timeDomainData);
        appendInstrumentSamples(chunkCopy);
        runInstrumentDetection();

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

          // 尝试恢复音频上下文
          if (
            audioContextRef.current &&
            audioContextRef.current.state !== 'running'
          ) {
            console.log('尝试恢复音频上下文...');
            audioContextRef.current.resume().catch(err => {
              console.warn('恢复音频上下文失败:', err);
            });
          }
        }

        // 检查是否是固定值（如91-92%可能表示读取问题）
        if (normalizedLevel > 0.9 && normalizedLevel < 0.93) {
          console.warn(
            '⚠️ 检测到可能的固定音频值:',
            normalizedLevel.toFixed(6)
          );
          console.warn('这通常表示音频数据读取有问题，而不是真实的麦克风输入');

          // 输出前10个样本值用于调试
          const sampleValues = Array.from(timeDomainData.slice(0, 10));
          console.log('前10个音频样本值:', sampleValues);
        }

        // 每2秒输出一次调试信息
        if (
          !(window as any).__lastAudioDebugLog ||
          Date.now() - (window as any).__lastAudioDebugLog > 2000
        ) {
          (window as any).__lastAudioDebugLog = Date.now();
          console.log('🎵 音频调试:', {
            rms: rms.toFixed(6),
            normalizedLevel: normalizedLevel.toFixed(6),
            maxAbs: maxAbs.toFixed(6),
            minVal: minVal.toFixed(6),
            maxVal: maxVal.toFixed(6),
            zeroCount,
            bufferLength,
            audioContextState: audioContextRef.current?.state,
            audioContextRunning: audioContextRef.current?.state === 'running',
          });
        }
        // 自适应校准：估计噪声底并抬升动态范围
        if (autoCalibrate) {
          const prev = noiseFloorRef.current || 0;
          const alpha = normalizedLevel < 0.02 ? 0.01 : 0.002; // 安静时更快贴近底噪
          const floor = prev * (1 - alpha) + normalizedLevel * alpha;
          noiseFloorRef.current = Math.min(0.05, floor); // 底噪上限约 0.05
          const margin = 0.01; // 安全边距
          const adj = Math.max(
            0,
            normalizedLevel - (noiseFloorRef.current + margin)
          );
          normalizedLevel = Math.min(1, adj * 6); // 放大剩余动态范围
        }
        setAudioLevel(normalizedLevel);
        setPeak(maxAbs);
        setSignalOn(maxAbs > 0.008);

        // 自动触发弹幕管线
        if (
          !(window as any).__lastPipelineStatusLog ||
          Date.now() - (window as any).__lastPipelineStatusLog > 5000
        ) {
          (window as any).__lastPipelineStatusLog = Date.now();
          console.log('🎵 检查弹幕管线状态:', {
            isActive: danmuPipeline.isActive,
            normalizedLevel,
          });
        }
        const latestFeatures = featureSnapshotRef.current;
        if (danmuPipeline.isActive) {
          if (
            !(window as any).__lastFeatureDebugLog ||
            Date.now() - (window as any).__lastFeatureDebugLog > 3000
          ) {
            (window as any).__lastFeatureDebugLog = Date.now();
            console.log('🎵 特征数据状态:', {
              hasFeatures: !!latestFeatures,
              rms: latestFeatures?.rms,
              spectralCentroid: latestFeatures?.spectralCentroid,
              zcr: latestFeatures?.zcr,
              mfcc: latestFeatures?.mfcc?.length,
              chroma: latestFeatures?.chroma?.length,
              spectralFlatness: latestFeatures?.spectralFlatness,
              spectralFlux: latestFeatures?.spectralFlux,
              hasAllFeatures: !!(
                latestFeatures?.rms !== undefined &&
                latestFeatures?.spectralCentroid !== undefined &&
                latestFeatures?.zcr !== undefined
              ),
              meydaAnalyzerExists: !!meydaAnalyzerRef.current,
              featuresKeys: latestFeatures
                ? Object.keys(latestFeatures)
                : [],
              normalizedLevel,
            });
          }

          if (
            !(window as any).__lastPipelineDebugLog ||
            Date.now() - (window as any).__lastPipelineDebugLog > 3000
          ) {
            (window as any).__lastPipelineDebugLog = Date.now();
            console.log('🎵 弹幕管线状态:', {
              isActive: danmuPipeline.isActive,
              hasFeatures: !!latestFeatures,
              normalizedLevel,
            });
          }

          const pipelineFeatures: AudioFeatureSnapshot = {
            ...(latestFeatures ?? {}),
            rms: latestFeatures?.rms ?? normalizedLevel,
            loudness: latestFeatures?.loudness ?? normalizedLevel * 10,
            dominantInstrument:
              instrumentInfoRef.current?.label ??
              latestFeatures?.dominantInstrument,
            instrumentProbabilities:
              instrumentInfoRef.current?.probabilities ??
              latestFeatures?.instrumentProbabilities,
            instrumentConfidence:
              instrumentInfoRef.current?.probability ??
              latestFeatures?.instrumentConfidence,
          };

          if (
            pipelineFeatures.voiceProb == null ||
            pipelineFeatures.percussiveRatio == null ||
            pipelineFeatures.harmonicRatio == null
          ) {
            const derived = deriveAudioHints(pipelineFeatures);
            pipelineFeatures.voiceProb =
              pipelineFeatures.voiceProb ?? derived.voiceProb;
            pipelineFeatures.percussiveRatio =
              pipelineFeatures.percussiveRatio ?? derived.percussiveRatio;
            pipelineFeatures.harmonicRatio =
              pipelineFeatures.harmonicRatio ?? derived.harmonicRatio;
          }

          danmuPipeline.handleAudioFeatures(normalizedLevel, pipelineFeatures);
        } else {
          if (
            !(window as any).__lastInactiveLog ||
            Date.now() - (window as any).__lastInactiveLog > 5000
          ) {
            (window as any).__lastInactiveLog = Date.now();
            console.log('🎵 弹幕管线未激活，跳过调用');
          }
        }
        if (normalizedLevel > 0.1) {
          // 只在有足够音频时测试
          if (
            !(window as any).__lastSimpleTestLog ||
            Date.now() - (window as any).__lastSimpleTestLog > 5000
          ) {
            (window as any).__lastSimpleTestLog = Date.now();
            console.log('🎵 超简单测试：直接触发弹幕生成');
          }
          danmuPipeline.trigger();
        }

        // 频谱获取与下采样 (已移除spectrum预设)
        // if (preset === 'spectrum') {
        //   analyser.getByteFrequencyData(freqData);
        //   setFrequencyBars(downsample(freqData, 64));
        // }

        if (maxAbs < 0.01 && normalizedLevel < 0.005) {
          if (
            !(window as any).__lastQuietLog ||
            Date.now() - (window as any).__lastQuietLog > 2000
          ) {
            (window as any).__lastQuietLog = Date.now();
            console.log(
              '静音区间调试: maxAbs=',
              maxAbs.toFixed(4),
              'RMS=',
              normalizedLevel.toFixed(4),
              'min=',
              minVal.toFixed(3),
              'max=',
              maxVal.toFixed(3)
            );
          }
        }
      }

      // 继续分析循环
      animationFrameRef.current = requestAnimationFrame(analyze);
      // } catch (error) {
      //   if (error) {
      //     console.error('音频分析错误:', error);
      //   } else {
      //     console.error('音频分析错误: 未知错误');
      //   }
      //   // 不要继续循环，避免无限错误
      //   // animationFrameRef.current = requestAnimationFrame(analyze);
      // }
    };

    animationFrameRef.current = requestAnimationFrame(analyze);
  };

  const handleStop = () => {
    // 停止音频分析循环
    isRunningRef.current = false;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // 停止 Meyda
    try {
      if (meydaAnalyzerRef.current) {
        meydaAnalyzerRef.current.stop();
        meydaAnalyzerRef.current = null;
      }
    } catch (e) {
      console.warn('停止 Meyda 失败:', e);
    }

    // 断开音频连接
    if (microphoneRef.current) {
      microphoneRef.current.disconnect();
      microphoneRef.current = null;
    }

    // 停止媒体流
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // 关闭音频上下文
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;

    // 停止弹幕管线
    danmuPipeline.stop();

    setIsStarted(false);
    setStatus('等待启动');
    setAudioLevel(0);
    console.log('已停止');
  };

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center relative">
      {/* 标题 */}
      <div className="text-center mb-8 z-10">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
          SonoScope
        </h1>
        <p className="text-lg text-gray-300">实时音乐可视化与弹幕引擎</p>
      </div>

      {/* Accretion 控制面板 */}
      {isStarted && preset === 'accretion' && (
        <div className="mt-4 z-10 w-[min(92vw,680px)] bg-white/5 border border-white/10 rounded-lg p-4 text-sm">
          <div className="mb-2 text-gray-300 font-semibold">
            Accretion 控制面板
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                灵敏度下限 sensMin ({accretionCtrl.sensMin.toFixed(2)})
              </label>
              <input
                type="range"
                min={0.85}
                max={1.1}
                step={0.01}
                value={accretionCtrl.sensMin}
                onChange={e =>
                  setAccretionCtrl(v => ({
                    ...v,
                    sensMin: Math.min(
                      parseFloat(e.target.value),
                      v.sensMax - 0.01
                    ),
                  }))
                }
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                灵敏度上限 sensMax ({accretionCtrl.sensMax.toFixed(2)})
              </label>
              <input
                type="range"
                min={1.0}
                max={1.5}
                step={0.01}
                value={accretionCtrl.sensMax}
                onChange={e =>
                  setAccretionCtrl(v => ({
                    ...v,
                    sensMax: Math.max(
                      parseFloat(e.target.value),
                      v.sensMin + 0.01
                    ),
                  }))
                }
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                增益比例 gainScale ({accretionCtrl.gainScale.toFixed(2)})
              </label>
              <input
                type="range"
                min={0.6}
                max={1.8}
                step={0.02}
                value={accretionCtrl.gainScale}
                onChange={e =>
                  setAccretionCtrl(v => ({
                    ...v,
                    gainScale: parseFloat(e.target.value),
                  }))
                }
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                总体亮度 overallBoost (
                {(accretionCtrl as any).overallBoost?.toFixed(2) ?? '1.00'})
              </label>
              <input
                type="range"
                min={0.7}
                max={1.6}
                step={0.02}
                value={(accretionCtrl as any).overallBoost ?? 1.0}
                onChange={e =>
                  setAccretionCtrl(v => ({
                    ...v,
                    overallBoost: parseFloat(e.target.value),
                  }))
                }
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                闪烁强度 flickerStrength (
                {accretionCtrl.flickerStrength.toFixed(2)})
              </label>
              <input
                type="range"
                min={0.0}
                max={0.35}
                step={0.01}
                value={accretionCtrl.flickerStrength}
                onChange={e =>
                  setAccretionCtrl(v => ({
                    ...v,
                    flickerStrength: parseFloat(e.target.value),
                  }))
                }
                className="w-full"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-400 mb-1">
                闪烁频率 flickerFreq ({accretionCtrl.flickerFreq.toFixed(0)})
              </label>
              <input
                type="range"
                min={6}
                max={32}
                step={1}
                value={accretionCtrl.flickerFreq}
                onChange={e =>
                  setAccretionCtrl(v => ({
                    ...v,
                    flickerFreq: parseFloat(e.target.value),
                  }))
                }
                className="w-full"
              />
            </div>
          </div>
        </div>
      )}

      {/* Mosaic 控制面板 */}
      {isStarted && preset === 'mosaic' && (
        <div className="mt-4 z-10 w-[min(92vw,680px)] bg-white/5 border border-white/10 rounded-lg p-4 text-sm">
          <div className="mb-2 text-gray-300 font-semibold">
            Mosaic 控制面板
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                细胞大小 cellSize ({mosaicCtrl.cellSize})
              </label>
              <input
                type="range"
                min={10}
                max={50}
                step={2}
                value={mosaicCtrl.cellSize}
                onChange={e =>
                  setMosaicCtrl(v => ({
                    ...v,
                    cellSize: parseInt(e.target.value),
                  }))
                }
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                最大年龄 maxAge ({mosaicCtrl.maxAge})
              </label>
              <input
                type="range"
                min={40}
                max={120}
                step={5}
                value={mosaicCtrl.maxAge}
                onChange={e =>
                  setMosaicCtrl(v => ({
                    ...v,
                    maxAge: parseInt(e.target.value),
                  }))
                }
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                生长率 growthRate ({mosaicCtrl.growthRate.toFixed(3)})
              </label>
              <input
                type="range"
                min={0.01}
                max={0.1}
                step={0.005}
                value={mosaicCtrl.growthRate}
                onChange={e =>
                  setMosaicCtrl(v => ({
                    ...v,
                    growthRate: parseFloat(e.target.value),
                  }))
                }
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                生成率 spawnRate ({mosaicCtrl.spawnRate.toFixed(3)})
              </label>
              <input
                type="range"
                min={0.005}
                max={0.05}
                step={0.002}
                value={mosaicCtrl.spawnRate}
                onChange={e =>
                  setMosaicCtrl(v => ({
                    ...v,
                    spawnRate: parseFloat(e.target.value),
                  }))
                }
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                颜色流动速度 colorFlowSpeed (
                {mosaicCtrl.colorFlowSpeed.toFixed(3)})
              </label>
              <input
                type="range"
                min={0.005}
                max={0.05}
                step={0.002}
                value={mosaicCtrl.colorFlowSpeed}
                onChange={e =>
                  setMosaicCtrl(v => ({
                    ...v,
                    colorFlowSpeed: parseFloat(e.target.value),
                  }))
                }
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                透明度 alpha ({mosaicCtrl.alpha.toFixed(2)})
              </label>
              <input
                type="range"
                min={0.3}
                max={1.0}
                step={0.05}
                value={mosaicCtrl.alpha}
                onChange={e =>
                  setMosaicCtrl(v => ({
                    ...v,
                    alpha: parseFloat(e.target.value),
                  }))
                }
                className="w-full"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-400 mb-1">
                颜色方案 colorScheme ({mosaicCtrl.colorScheme})
              </label>
              <select
                value={mosaicCtrl.colorScheme}
                onChange={e =>
                  setMosaicCtrl(v => ({
                    ...v,
                    colorScheme: parseInt(e.target.value),
                  }))
                }
                className="w-full px-2 py-1 bg-gray-700 text-white rounded text-xs"
              >
                <option value={0}>黑白</option>
                <option value={1}>粉色天竺葵</option>
                <option value={2}>蓝色花朵</option>
                <option value={3}>日落</option>
                <option value={4}>紫色花朵</option>
                <option value={5}>莫奈</option>
                <option value={6}>康定斯基</option>
                <option value={7}>夏日</option>
                <option value={8}>樱花</option>
                <option value={9}>激情</option>
                <option value={10}>绣球花</option>
                <option value={11}>郁金香</option>
                <option value={12}>海洋</option>
                <option value={13}>明亮</option>
                <option value={14}>森林</option>
                <option value={15}>彩虹</option>
                <option value={16}>霓虹赛博</option>
                <option value={17}>极光</option>
                <option value={18}>火焰</option>
                <option value={19}>冰雪</option>
                <option value={20}>秋日</option>
                <option value={21}>春日</option>
                <option value={22}>宇宙</option>
                <option value={23}>极简</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* 错误显示 */}
      {error && (
        <div className="mb-4 z-10 p-4 bg-red-900/50 border border-red-500 rounded-lg">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* 状态显示 */}
      <div className="mb-6 z-10">
        {isStarted ? (
          <div className="flex items-center space-x-2 text-green-400">
            <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
            <span>{status}</span>
          </div>
        ) : (
          <div className="flex items-center space-x-2 text-gray-400">
            <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
            <span>{status}</span>
          </div>
        )}

        {/* 弹幕管线状态 */}
        {isStarted && (
          <div className="mt-2 text-xs text-gray-300">
            <div className="flex flex-wrap gap-2">
              <span>弹幕: {danmuPipeline.isActive ? '活跃' : '停止'}</span>
              {danmuPipeline.currentStyle && (
                <span className="text-blue-400">
                  风格: {danmuPipeline.currentStyle}
                </span>
              )}
              <span>数量: {danmuPipeline.danmuCount}</span>
              {danmuPipeline.pendingRequests > 0 && (
                <span className="text-yellow-400">
                  生成中: {danmuPipeline.pendingRequests}
                </span>
              )}
            </div>
            <div className="mt-1 text-xs text-gray-400">
              支持风格: EDM, Techno, Trance, Dubstep, Ambient, Rock, Pop, Jazz,
              Classical, Hip-Hop, Metal
            </div>
          </div>
        )}
      </div>

      {/* 麦克风状态面板 */}
      {isStarted && (
        <div className="mb-4 z-10 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-200">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span
                className={`inline-block w-2.5 h-2.5 rounded-full ${signalOn ? 'bg-green-400' : 'bg-gray-500'}`}
              ></span>
              <span>{signalOn ? '有信号' : '无信号'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">峰值:</span>
              <span>{Math.round(peak * 100)}%</span>
            </div>
            <div className="truncate max-w-[50vw] text-gray-400">
              {deviceInfo || '设备信息获取中...'}
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <span>轨道:</span>
              <span>
                {streamRef.current &&
                streamRef.current.getAudioTracks().length > 0
                  ? streamRef.current.getAudioTracks()[0].muted
                    ? '已静音'
                    : '活动'
                  : '未连接'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 音频级别指示器 */}
      {isStarted && (
        <div className="mb-6 z-10 w-64">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">音频级别</span>
            <span className="text-sm text-gray-400">
              {Math.round(audioLevel * 100)}%
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-green-500 to-red-500 h-2 rounded-full transition-all duration-100"
              style={{ width: `${audioLevel * 100}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* 控制按钮 */}
      <div className="flex gap-4 z-10">
        {/* 预设选择 */}
        <select
          value={preset}
          onChange={e =>
            setPreset(
              e.target.value as 'pulse' | 'accretion' | 'spiral' | 'mosaic'
            )
          }
          className="px-3 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="可视化预设"
        >
          <option value="pulse">脉冲圆环</option>
          <option value="accretion">Accretion</option>
          <option value="spiral">Spiral</option>
          <option value="mosaic">Mosaic</option>
        </select>

        {/* 反应强度 */}
        <div className="flex items-center gap-2 text-gray-300">
          <span className="text-xs">反应强度</span>
          <input
            type="range"
            min={0.5}
            max={3}
            step={0.1}
            value={sensitivity}
            onChange={e => setSensitivity(Number(e.target.value))}
            className="w-32"
            aria-label="反应强度"
          />
          <span className="text-xs w-8 text-right">
            {sensitivity.toFixed(1)}x
          </span>
        </div>

        {/* 原始麦克风 */}
        <label className="flex items-center gap-2 text-xs text-gray-300">
          <input
            type="checkbox"
            checked={rawMic}
            onChange={e => setRawMic(e.target.checked)}
          />
          原始麦克风(关降噪/自动增益)
        </label>

        {/* 自适应校准 */}
        <label className="flex items-center gap-2 text-xs text-gray-300">
          <input
            type="checkbox"
            checked={autoCalibrate}
            onChange={e => setAutoCalibrate(e.target.checked)}
          />
          自适应校准
        </label>
        <button
          onClick={handleStart}
          disabled={isStarted}
          className="px-8 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          开始
        </button>
        <button
          onClick={handleStop}
          disabled={!isStarted}
          className="px-8 py-4 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          停止
        </button>
        <button
          onClick={() => danmuPipeline.trigger()}
          disabled={!isStarted || !danmuPipeline.isActive}
          className={`px-6 py-4 rounded-lg focus:outline-none focus:ring-2 transition-all ${
            isStarted && danmuPipeline.isActive
              ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500'
              : 'bg-gray-600 text-white opacity-50 cursor-not-allowed'
          }`}
        >
          手动弹幕
        </button>
        <button
          onClick={() => setTestMode(!testMode)}
          className={`px-6 py-4 rounded-lg focus:outline-none focus:ring-2 transition-all ${
            testMode
              ? 'bg-yellow-600 text-white hover:bg-yellow-700 focus:ring-yellow-500'
              : 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500'
          }`}
        >
          {testMode ? '退出测试' : '测试模式'}
        </button>
        <button
          onClick={() => setShowAudioFallback(true)}
          disabled={isStarted}
          className={`px-6 py-4 rounded-lg focus:outline-none focus:ring-2 transition-all ${
            isStarted
              ? 'bg-gray-600 text-white opacity-50 cursor-not-allowed'
              : 'bg-purple-600 text-white hover:bg-purple-700 focus:ring-purple-500'
          }`}
        >
          音频选项
        </button>
      </div>

      {/* 设备信息 */}
      {deviceInfo && (
        <div className="mt-4 max-w-lg text-center text-gray-400 z-10">
          <p className="text-xs">{deviceInfo}</p>
        </div>
      )}

      {/* 使用说明 */}
      <div className="mt-8 max-w-lg text-center text-gray-400 z-10">
        <p className="text-sm">
          点击&ldquo;开始&rdquo;按钮授权麦克风访问，然后播放音乐或发出声音来体验实时可视化效果
        </p>
        {!isStarted && (
          <p className="text-xs mt-2 text-yellow-400">
            💡 如果没有麦克风，可以连接耳机或使用内置麦克风
          </p>
        )}
        {isStarted && (
          <div className="mt-4 text-xs text-gray-500">
            <p>🔧 调试信息：</p>
            <p>• 测试模式: {testMode ? '开启' : '关闭'}</p>
            <p>• 音频上下文: {audioContextRef.current ? '已创建' : '未创建'}</p>
            <p>• 分析器: {analyserRef.current ? '已连接' : '未连接'}</p>
            <p>• 麦克风: {microphoneRef.current ? '已连接' : '未连接'}</p>
          </div>
        )}
      </div>

      {/* 移动端权限弹窗 */}
      {showMobilePermission && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <MobileAudioPermission
            onPermissionGranted={handleMobilePermissionGranted}
            onFallbackSelected={handleMobileFallbackSelected}
            onError={handleMobilePermissionError}
          />
        </div>
      )}

      {/* 降级音频选项弹窗 */}
      {showAudioFallback && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <AudioFallback
              onFallbackStarted={handleFallbackStarted}
              onFallbackStopped={handleFallbackStopped}
            />
          </div>
        </div>
      )}

      {/* 画布容器 */}
      <div
        id="visual-canvas"
        className="absolute inset-0 pointer-events-none"
      />
      <div
        id="danmu-container"
        className="absolute inset-0 pointer-events-none"
      />
      <Visualizer
        key={preset}
        audioLevel={
          testMode ? Math.sin(Date.now() * 0.01) * 0.5 + 0.5 : audioLevel
        }
        running={isStarted}
        preset={preset}
        features={features}
        sensitivity={sensitivity}
        accretionControls={accretionCtrl}
        mosaicControls={mosaicCtrl}
      />
    </main>
  );
}
