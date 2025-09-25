'use client';

import { useState, useRef } from 'react';
import NeonButton from '../../components/neon-button';
import Visualizer from '../../components/visualizer';
import Meyda from 'meyda';
import { useDanmuPipeline } from '../../hooks/useDanmuPipeline';
import MobileAudioPermission from '../../components/mobile-audio-permission';
import AudioFallback from '../../components/audio-fallback';
import {
  getSharedInstrumentClassifier,
  InstrumentDetectionResult,
} from '../../lib/instrument-classifier';
import { EnhancedFeatureAggregator } from '../../lib/enhanced-feature-aggregator';

type AudioFeatureSnapshot = {
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
    'pulse' | 'accretion' | 'spiral' | 'mosaic' | 'wave'
  >('pulse');
  const [accretionCtrl, setAccretionCtrl] = useState({
    sensMin: 0.92,
    sensMax: 1.18,
    gainScale: 1.2,
    flickerStrength: 0.16,
    flickerFreq: 16,
    overallBoost: 1.2,
  });
  const [mosaicCtrl, setMosaicCtrl] = useState({
    cellSize: 20,
    maxAge: 80,
    growthRate: 0.05,
    spawnRate: 0.02,
    colorScheme: 2,
    colorFlowSpeed: 0.02,
    alpha: 0.85,
  });
  const [features, setFeatures] = useState<AudioFeatureSnapshot | null>(null);
  const [sensitivity, setSensitivity] = useState<number>(1.5);
  const [rawMic, setRawMic] = useState<boolean>(false);
  const [autoCalibrate, setAutoCalibrate] = useState<boolean>(true);
  const noiseFloorRef = useRef<number>(0);

  const danmuPipeline = useDanmuPipeline({
    enabled: true,
    autoStart: false,
    useSimple: false,
    needComments: 4,
    locale: 'zh-CN',
    rmsThreshold: 0.0001,
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
  type SharedInstrumentClassifier = ReturnType<typeof getSharedInstrumentClassifier>;
  const instrumentClassifierRef = useRef<SharedInstrumentClassifier | null>(null);
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
    const flat = typeof f?.spectralFlatness === 'number' ? f.spectralFlatness : undefined;
    const centroid = typeof f?.spectralCentroid === 'number' ? f.spectralCentroid : undefined;
    const flux = typeof f?.spectralFlux === 'number' ? f.spectralFlux : undefined;

    let voiceProb: number | undefined;
    if (flat != null || centroid != null) {
      const flatFactor = flat != null ? clamp01(1 - flat) : 0.5;
      const centroidNorm = centroid != null ? clamp01((centroid - 1500) / 2500) : 0.5;
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
    const sampleRate = instrumentSampleRateRef.current || audioContextRef.current?.sampleRate || 44100;
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
    const sampleRate = instrumentSampleRateRef.current || audioContextRef.current?.sampleRate || 44100;
    const buffer = instrumentBufferRef.current;
    if (buffer.length < sampleRate) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - instrumentLastEvalRef.current < 800) return;

    instrumentPendingRef.current = true;
    instrumentLastEvalRef.current = now;

    try {
      if (!instrumentClassifierRef.current) {
        instrumentClassifierRef.current = getSharedInstrumentClassifier();
      }
      const segment = buffer.slice(buffer.length - sampleRate);
      const result = await instrumentClassifierRef.current.classify(segment, sampleRate);
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
    const isMobile = /Mobile|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      setShowMobilePermission(true);
    } else {
      startDesktopAudio();
    }
  };

  const startDesktopAudio = async () => {
    try {
      setStatus('请求麦克风权限...');
      let provisionalStream: MediaStream;
      try {
        provisionalStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (permErr: any) {
        const name = permErr?.name || '';
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          setError('麦克风权限被拒绝。请在浏览器为本页开启麦克风权限，然后重试。');
          setStatus('权限被拒绝');
          return;
        }
        if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          setError('未检测到音频输入设备。');
          setStatus('未检测到设备');
          return;
        }
        setError(`无法请求麦克风权限：${name || '未知错误'}`);
        setStatus('权限请求失败');
        return;
      }

      setStatus('检查音频设备...');
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(d => d.kind === 'audioinput');
      if (audioInputs.length === 0) {
        provisionalStream.getTracks().forEach(t => t.stop());
        throw new Error('未检测到音频输入设备');
      }
      const preferred = audioInputs.find(d => !!d.label) ?? audioInputs[0];
      const deviceId = preferred.deviceId;
      provisionalStream.getTracks().forEach(t => t.stop());

      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            echoCancellation: rawMic ? false : true,
            noiseSuppression: rawMic ? false : true,
            autoGainControl: rawMic ? false : true,
            sampleRate: 44100,
          },
        });
      } catch (err: any) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: rawMic ? false : true,
            noiseSuppression: rawMic ? false : true,
            autoGainControl: rawMic ? false : true,
            sampleRate: 44100,
          },
        });
      }

      const nameList = audioInputs.map(d => d.label || '未知设备').join(', ');
      setDeviceInfo(`检测到 ${audioInputs.length} 个音频设备，当前: ${preferred.label || '未知'}；全部: ${nameList}`);

      setStatus('初始化音频分析...');
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      instrumentSampleRateRef.current = audioContext.sampleRate;
      instrumentBufferRef.current = new Float32Array(0);
      instrumentLastEvalRef.current = 0;
      instrumentInfoRef.current = null;

      try { if (audioContext.state !== 'running') { await audioContext.resume(); } } catch {}
      try { stream.getAudioTracks().forEach(track => { if (!track.enabled) track.enabled = true; }); } catch {}

      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.5;
      microphone.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      microphoneRef.current = microphone;
      streamRef.current = stream;

      try {
        if (Meyda && (Meyda as any).isBrowser) {
          meydaAnalyzerRef.current = Meyda.createMeydaAnalyzer({
            audioContext,
            source: microphone,
            bufferSize: 1024,
            featureExtractors: [
              'rms','spectralCentroid','zcr','mfcc','spectralFlatness','spectralFlux','chroma','spectralBandwidth','spectralRolloff','spectralContrast','spectralSpread','spectralSkewness','spectralKurtosis','loudness','perceptualSpread','perceptualSharpness'
            ],
            callback: (f: any) => {
              try {
                const hints = deriveAudioHints(f);
                const instrumentInfo = instrumentInfoRef.current;
                const loudnessValue = typeof f.loudness === 'number' ? f.loudness : typeof f?.loudness?.total === 'number' ? f.loudness.total : undefined;
                const probabilities = instrumentInfo?.probabilities;
                const voiceModel = clampOptional(probabilities?.voice);
                const drumsModel = clampOptional(probabilities?.drums);
                const bassModel = clampOptional(probabilities?.bass);
                const synthModel = clampOptional(probabilities?.synth);
                const percussiveModel = clamp01(drumsModel * 0.7 + bassModel * 0.2 + synthModel * 0.1);
                const heuristicVoice = hints.voiceProb ?? 0;
                const heuristicPercussive = hints.percussiveRatio ?? 0;
                const heuristicHarmonic = hints.harmonicRatio ?? undefined;

                const blendedVoice = voiceModel > 0 ? clamp01(heuristicVoice * 0.4 + voiceModel * 0.6) : heuristicVoice;
                voiceLevelRef.current = voiceLevelRef.current * 0.7 + blendedVoice * 0.3;
                const finalVoiceProb = clamp01(voiceLevelRef.current);

                const blendedPercussive = clamp01(heuristicPercussive * 0.5 + percussiveModel * 0.5);
                percussiveLevelRef.current = percussiveLevelRef.current * 0.7 + blendedPercussive * 0.3;
                const finalPercussive = clamp01(percussiveLevelRef.current);

                const harmonicModel = clamp01(1 - finalPercussive + finalVoiceProb * 0.2);
                const blendedHarmonic = heuristicHarmonic !== undefined ? clamp01(heuristicHarmonic * 0.5 + harmonicModel * 0.5) : harmonicModel;
                harmonicLevelRef.current = harmonicLevelRef.current * 0.6 + blendedHarmonic * 0.4;
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

                if (enhancedFeatureAggregatorRef.current && audioContextRef.current) {
                  try {
                    const audioBuffer = new Float32Array(analyser.fftSize);
                    analyser.getFloatTimeDomainData(audioBuffer);
                    const sampleRate = audioContextRef.current.sampleRate;

                    const enhancedFrame = {
                      ...snapshot,
                      audioBuffer,
                      sampleRate,
                      timestamp: Date.now(),
                      pitch: undefined,
                      tempo: undefined,
                      timbre: undefined,
                      instruments: undefined,
                      enhancedHPSS: undefined,
                    };

                    enhancedFeatureAggregatorRef.current
                      .addEnhancedFrame(enhancedFrame)
                      .then(() => {
                        const enhancedWindow = enhancedFeatureAggregatorRef.current?.getLatestEnhancedWindow();
                        if (enhancedWindow) {
                          snapshot.pitch = enhancedWindow.pitchStats
                            ? {
                                fundamentalFreq: enhancedWindow.pitchStats.avgFundamentalFreq,
                                pitchConfidence: enhancedWindow.pitchStats.pitchConfidence,
                                pitchClass: enhancedWindow.pitchStats.dominantPitch,
                                octave: Math.floor(
                                  Math.log2(
                                    enhancedWindow.pitchStats.avgFundamentalFreq / 16.35
                                  )
                                ) - 1,
                                cents: 0,
                                harmonicity: 0.8,
                                isVoiced: enhancedWindow.pitchStats.pitchConfidence > 0.5,
                              }
                            : undefined;

                          snapshot.tempo = enhancedWindow.tempoStats
                            ? {
                                bpm: enhancedWindow.tempoStats.avgBpm,
                                tempoConfidence: enhancedWindow.tempoStats.tempoConfidence,
                                timeSignature: enhancedWindow.tempoStats.dominantTimeSignature
                                  .split('/')
                                  .map(Number) as [number, number],
                                rhythmPattern:
                                  enhancedWindow.tempoStats.tempoStability > 0.8
                                    ? 'regular'
                                    : 'irregular',
                              }
                            : undefined;

                          snapshot.timbre = enhancedWindow.timbreStats
                            ? {
                                brightness: enhancedWindow.timbreStats.avgBrightness,
                                warmth: enhancedWindow.timbreStats.avgWarmth,
                                roughness: enhancedWindow.timbreStats.avgRoughness,
                                timbreCategory: enhancedWindow.timbreStats.dominantTimbre,
                              }
                            : undefined;

                          snapshot.instruments = enhancedWindow.instrumentStats
                            ? {
                                dominantInstrument:
                                  enhancedWindow.instrumentStats.dominantInstrument,
                                instrumentCount:
                                  enhancedWindow.instrumentStats.instrumentCount,
                                polyphony: enhancedWindow.instrumentStats.polyphony,
                              }
                            : undefined;

                          snapshot.enhancedHPSS = enhancedWindow.enhancedHPSSStats
                            ? {
                                musicComplexity:
                                  enhancedWindow.enhancedHPSSStats.avgMusicalComplexity,
                                overallStability:
                                  enhancedWindow.enhancedHPSSStats.avgMusicalStability,
                                overallRichness:
                                  enhancedWindow.enhancedHPSSStats.avgMusicalRichness,
                                dominantComponent: 'mixed' as const,
                              }
                            : undefined;
                        }
                      })
                      .catch(err => {
                        console.warn('增强特征提取失败:', err);
                      });
                  } catch (err) {
                    console.warn('增强特征处理错误:', err);
                  }
                }

                featureSnapshotRef.current = snapshot;
                setFeatures(snapshot);
              } catch {}
            },
          });
          meydaAnalyzerRef.current.start();
        }
      } catch (e) {
        console.warn('Meyda 初始化失败:', e);
      }

      setStatus('开始音频分析...');
      isRunningRef.current = true;
      setIsStarted(true);
      startAudioAnalysis();

      setTimeout(() => {
        setTimeout(() => danmuPipeline.start(), 500);
      }, 1000);

      setStatus('音频分析已启动');
      setError(null);
    } catch (err) {
      console.error('启动失败:', err);
      setError(err instanceof Error ? err.message : '启动失败');
      setStatus('启动失败');
    }
  };

  const startAudioAnalysis = () => {
    if (!analyserRef.current) return;
    const analyser = analyserRef.current;
    const bufferLength = analyser.fftSize;
    const timeDomainData = new Float32Array(bufferLength);
    const analyze = () => {
      if (!isRunningRef.current) return;
      if (testMode) {
        const testLevel = Math.sin(Date.now() * 0.01) * 0.5 + 0.5;
        setAudioLevel(testLevel);
        setPeak(testLevel);
        setSignalOn(testLevel > 0.01);
      } else {
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
          const sample = timeDomainData[i];
          if (sample === 0) zeroCount++;
          sumSquares += sample * sample;
          if (sample > maxVal) maxVal = sample;
          if (sample < minVal) minVal = sample;
          const abs = Math.abs(sample);
          if (abs > maxAbs) maxAbs = abs;
        }
        const rms = Math.sqrt(sumSquares / bufferLength);
        let normalizedLevel = Math.min(Math.max(rms, 0), 1);
        setAudioLevel(normalizedLevel);
        setPeak(maxAbs);
        setSignalOn(maxAbs > 0.008);
        const latestFeatures = featureSnapshotRef.current;
        if (danmuPipeline.isActive) {
          const pipelineFeatures: AudioFeatureSnapshot = {
            ...(latestFeatures ?? {}),
            rms: latestFeatures?.rms ?? normalizedLevel,
            loudness: latestFeatures?.loudness ?? normalizedLevel * 10,
            dominantInstrument: instrumentInfoRef.current?.label ?? latestFeatures?.dominantInstrument,
            instrumentProbabilities: instrumentInfoRef.current?.probabilities ?? latestFeatures?.instrumentProbabilities,
            instrumentConfidence: instrumentInfoRef.current?.probability ?? latestFeatures?.instrumentConfidence,
          };
          danmuPipeline.handleAudioFeatures(normalizedLevel, pipelineFeatures);
        }
        if (normalizedLevel > 0.1) {
          danmuPipeline.trigger();
        }
      }
      animationFrameRef.current = requestAnimationFrame(analyze);
    };
    animationFrameRef.current = requestAnimationFrame(analyze);
  };

  const handleStop = () => {
    isRunningRef.current = false;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    try { if (meydaAnalyzerRef.current) { meydaAnalyzerRef.current.stop(); meydaAnalyzerRef.current = null; } } catch {}
    if (microphoneRef.current) { microphoneRef.current.disconnect(); microphoneRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(track => track.stop()); streamRef.current = null; }
    if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; }
    analyserRef.current = null;
    danmuPipeline.stop();
    setIsStarted(false);
    setStatus('等待启动');
    setAudioLevel(0);
  };

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center relative">
      <div className="text-center mb-8 z-10">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">SonoScope</h1>
        <p className="text-lg text-gray-300">实时音乐可视化与弹幕引擎（测试主页）</p>
      </div>
      {error && (
        <div className="mb-4 z-10 p-4 bg-red-900/50 border border-red-500 rounded-lg">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}
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
      </div>
      <div className="flex gap-4 z-10">
        <div className="flex gap-2">
          <NeonButton variant={preset === 'pulse' ? 'cyan' : 'purple'} size="md" glowing onClick={() => setPreset('pulse')}>脉冲</NeonButton>
          <NeonButton variant={preset === 'accretion' ? 'cyan' : 'purple'} size="md" glowing onClick={() => setPreset('accretion')}>Accretion</NeonButton>
          <NeonButton variant={preset === 'spiral' ? 'cyan' : 'purple'} size="md" glowing onClick={() => setPreset('spiral')}>Spiral</NeonButton>
          <NeonButton variant={preset === 'mosaic' ? 'cyan' : 'purple'} size="md" glowing onClick={() => setPreset('mosaic')}>Mosaic</NeonButton>
          <NeonButton variant={preset === 'wave' ? 'cyan' : 'purple'} size="md" glowing onClick={() => setPreset('wave')}>Wave</NeonButton>
        </div>
        <div className="flex items-center gap-2 text-gray-300">
          <span className="text-xs">反应强度</span>
          <input type="range" min={0.5} max={3} step={0.1} value={sensitivity} onChange={e => setSensitivity(Number(e.target.value))} className="w-32" aria-label="反应强度" />
          <span className="text-xs w-8 text-right">{sensitivity.toFixed(1)}x</span>
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-300">
          <input type="checkbox" checked={rawMic} onChange={e => setRawMic(e.target.checked)} />
          原始麦克风
        </label>
        <label className="flex items-center gap-2 text-xs text-gray-300">
          <input type="checkbox" checked={autoCalibrate} onChange={e => setAutoCalibrate(e.target.checked)} />
          自适应校准
        </label>
        <NeonButton variant="green" size="lg" glowing onClick={handleStart} disabled={isStarted}>开始</NeonButton>
        <NeonButton variant="pink" size="lg" glowing onClick={handleStop} disabled={!isStarted}>停止</NeonButton>
      </div>
      <div id="visual-canvas" className="absolute inset-0 pointer-events-none" />
      <div id="danmu-container" className="absolute inset-0 pointer-events-none" />
      <Visualizer key={preset} audioLevel={testMode ? Math.sin(Date.now() * 0.01) * 0.5 + 0.5 : audioLevel} running={isStarted} preset={preset} features={features} sensitivity={sensitivity} accretionControls={accretionCtrl} mosaicControls={mosaicCtrl} />
    </main>
  );
}


