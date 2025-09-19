'use client';

import { useState, useRef } from 'react';
import Visualizer from '../components/visualizer';
import Meyda from 'meyda';
import { useDanmuPipeline } from '../hooks/useDanmuPipeline';

export default function HomePage() {
  const [isStarted, setIsStarted] = useState(false);
  const [status, setStatus] = useState('等待启动');
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<string>('');
  const [testMode, setTestMode] = useState(false);
  const [signalOn, setSignalOn] = useState(false);
  const [peak, setPeak] = useState(0);
  const [preset, setPreset] = useState<'pulse' | 'accretion' | 'spiral'>(
    'pulse'
  );
  const [accretionCtrl, setAccretionCtrl] = useState({
    sensMin: 0.92,
    sensMax: 1.18,
    gainScale: 1.15,
    flickerStrength: 0.1,
    flickerFreq: 14,
    overallBoost: 1.1,
  });
  // const [frequencyBars, setFrequencyBars] = useState<number[]>([]); // legacy, not used now
  const [features, setFeatures] = useState<{
    rms?: number;
    spectralCentroid?: number;
    zcr?: number;
    mfcc?: number[];
    spectralFlatness?: number;
    spectralFlux?: number;
  } | null>(null);
  const [sensitivity, setSensitivity] = useState<number>(1.5);
  const [rawMic, setRawMic] = useState<boolean>(false);
  const [autoCalibrate, setAutoCalibrate] = useState<boolean>(true);
  const noiseFloorRef = useRef<number>(0);

  // 弹幕管线
  const danmuPipeline = useDanmuPipeline({
    enabled: true,
    autoStart: false, // 手动启动
    needComments: 4,
    locale: 'zh-CN',
    rmsThreshold: 0.05,
    maxConcurrency: 2,
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isRunningRef = useRef<boolean>(false);
  const meydaAnalyzerRef = useRef<any | null>(null);

  const handleStart = async () => {
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
            ],
            callback: (f: any) => {
              try {
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

      // 先标记为运行，再启动循环，避免闭包捕获旧状态
      isRunningRef.current = true;
      setIsStarted(true);
      startAudioAnalysis();

      // 启动弹幕管线
      if (danmuPipeline.isReady) {
        danmuPipeline.start();
      }

      setStatus('音频分析已启动');
      setError(null);
      console.log('启动成功');
    } catch (err) {
      console.error('启动失败:', err);
      setError(err instanceof Error ? err.message : '启动失败');
      setStatus('启动失败');
    }
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

      try {
        if (testMode) {
          const testLevel = Math.sin(Date.now() * 0.01) * 0.5 + 0.5;
          setAudioLevel(testLevel);
          setPeak(testLevel);
          setSignalOn(testLevel > 0.01);
        } else {
          // 使用时域数据计算 RMS 与峰值
          analyser.getFloatTimeDomainData(timeDomainData);

          let sumSquares = 0;
          let maxAbs = 0;
          let minVal = 1;
          let maxVal = -1;
          for (let i = 0; i < bufferLength; i++) {
            const sample = timeDomainData[i]; // [-1, 1]
            sumSquares += sample * sample;
            if (sample > maxVal) maxVal = sample;
            if (sample < minVal) minVal = sample;
            const abs = Math.abs(sample);
            if (abs > maxAbs) maxAbs = abs;
          }
          const rms = Math.sqrt(sumSquares / bufferLength); // [0, 1]
          let normalizedLevel = Math.min(Math.max(rms, 0), 1);
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
          if (danmuPipeline.isActive && features) {
            danmuPipeline.handleAudioFeatures(normalizedLevel, features);
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
      } catch (error) {
        console.error('音频分析错误:', error);
        animationFrameRef.current = requestAnimationFrame(analyze);
      }
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
            <span>弹幕: {danmuPipeline.isActive ? '活跃' : '停止'}</span>
            {danmuPipeline.currentStyle && (
              <span className="ml-2">风格: {danmuPipeline.currentStyle}</span>
            )}
            <span className="ml-2">数量: {danmuPipeline.danmuCount}</span>
            {danmuPipeline.pendingRequests > 0 && (
              <span className="ml-2">
                生成中: {danmuPipeline.pendingRequests}
              </span>
            )}
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
            setPreset(e.target.value as 'pulse' | 'accretion' | 'spiral')
          }
          className="px-3 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="可视化预设"
        >
          <option value="pulse">脉冲圆环</option>
          <option value="accretion">Accretion</option>
          <option value="spiral">Spiral</option>
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
      />
    </main>
  );
}
