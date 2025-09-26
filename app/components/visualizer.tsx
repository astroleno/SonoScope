'use client';

import React, { useEffect, useRef } from 'react';

interface Features {
  rms?: number;
  spectralCentroid?: number;
  zcr?: number;
  mfcc?: number[];
  spectralFlatness?: number;
  spectralFlux?: number;
  voiceProb?: number;
  percussiveRatio?: number;
  harmonicRatio?: number;
  // 频谱优先模型
  bandLow?: number;
  bandMid?: number;
  bandHigh?: number;
  bandColumns?: number[];
  tempo?: { bpm: number; confidence: number };
}

export type Particle = {
  x: number;
  y: number;
  r: number;
  a: number;
  vx: number;
  vy: number;
};

// 统一的音频权重配置
interface AudioWeights {
  level: number;
  bandLow: number;
  bandMid: number;
  bandHigh: number;
  fluxPulse: number;
  tempo: number;
}

interface VisualizerProps {
  audioLevel: number; // 0 ~ 1
  running: boolean;
  preset?: 'pulse' | 'accretion' | 'spiral' | 'mosaic' | 'wave';
  features?: Features | null;
  sensitivity?: number;
  // 频谱优先模式开关
  spectrumPriority?: boolean;
  // 统一音频权重配置
  audioWeights?: Partial<AudioWeights>;
  accretionControls?: {
    sensMin?: number;
    sensMax?: number;
    gainScale?: number;
    flickerStrength?: number;
    flickerFreq?: number;
    overallBoost?: number;
  };
  mosaicControls?: {
    cellSize?: number;
    maxAge?: number;
    growthRate?: number;
    spawnRate?: number;
    colorScheme?: number; // index into MOSAIC_COLOR_SCHEMES
    colorFlowSpeed?: number;
    alpha?: number;
  };
}

export default function Visualizer({
  audioLevel,
  running,
  preset = 'pulse',
  features = null,
  sensitivity = 1.5,
  spectrumPriority = false,
  audioWeights,
  accretionControls,
  mosaicControls,
}: VisualizerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const p5InstanceRef = useRef<any | null>(null);
  const levelRef = useRef<number>(0);
  const runningRef = useRef<boolean>(false);
  const presetRef = useRef<'pulse' | 'accretion' | 'spiral' | 'mosaic' | 'wave'>(preset);
  const featuresRef = useRef<Features | null>(features);
  const sensitivityRef = useRef<number>(sensitivity);
  const accretionControlsRef = useRef<
    VisualizerProps['accretionControls'] | undefined
  >(accretionControls);
  const mosaicControlsRef = useRef<
    VisualizerProps['mosaicControls'] | undefined
  >(mosaicControls);
  const spectrumPriorityRef = useRef<boolean>(spectrumPriority);
  const audioWeightsRef = useRef<Partial<AudioWeights> | undefined>(audioWeights);

  useEffect(() => {
    levelRef.current = audioLevel;
  }, [audioLevel]);
  useEffect(() => {
    runningRef.current = running;
  }, [running]);
  useEffect(() => {
    presetRef.current = preset;
  }, [preset]);
  useEffect(() => {
    featuresRef.current = features;
  }, [features]);
  useEffect(() => {
    sensitivityRef.current = sensitivity;
  }, [sensitivity]);
  useEffect(() => {
    accretionControlsRef.current = accretionControls;
  }, [accretionControls]);
  useEffect(() => {
    mosaicControlsRef.current = mosaicControls;
  }, [mosaicControls]);
  useEffect(() => {
    spectrumPriorityRef.current = spectrumPriority;
  }, [spectrumPriority]);
  useEffect(() => {
    audioWeightsRef.current = audioWeights;
  }, [audioWeights]);

  useEffect(() => {
    if (!containerRef.current) return;
    let isCancelled = false;

    (async () => {
      try {
        const mod = await import('p5');
        const P5 = (mod as any).default ?? mod;
        if (isCancelled) return;

        // 按需加载：仅加载当前预设；其余在空闲时预取
        const presetNow = presetRef.current;
        const loadPulse = () => import('../visuals/pulse');
        const loadAccretion = () => import('../visuals/accretion');
        const loadSpiral = () => import('../visuals/spiral');
        const loadMosaic = () => import('../visuals/mosaic');
        const loadWave = () => import('../visuals/wave');

        let pulseMod: any = presetNow === 'pulse' ? await loadPulse() : null;
        let accretionMod: any = presetNow === 'accretion' ? await loadAccretion() : null;
        let spiralMod: any = presetNow === 'spiral' ? await loadSpiral() : null;
        let mosaicMod: any = presetNow === 'mosaic' ? await loadMosaic() : null;
        let waveMod: any = presetNow === 'wave' ? await loadWave() : null;

        // 预取其余模块（非阻塞）
        const ric = (cb: () => void) => {
          if (typeof (window as any).requestIdleCallback === 'function') {
            (window as any).requestIdleCallback(cb);
          } else {
            setTimeout(cb, 1000);
          }
        };
        ric(async () => { if (!pulseMod) pulseMod = await loadPulse().catch(() => null); });
        ric(async () => { if (!accretionMod) accretionMod = await loadAccretion().catch(() => null); });
        ric(async () => { if (!spiralMod) spiralMod = await loadSpiral().catch(() => null); });
        ric(async () => { if (!mosaicMod) mosaicMod = await loadMosaic().catch(() => null); });
        ric(async () => { if (!waveMod) waveMod = await loadWave().catch(() => null); });

        const sketch = (p: any) => {
          // 简易移动端检测：用于性能模式（降帧/减粒子）
          const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
          const isMobile = /iphone|ipad|android|mobile/.test(ua);
          let shaderProgram: any | null = null;
          let spiralProgram: any | null = null;
          let waveProgram: any | null = null;
          let mosaicVisual: any | null = null;
          const particles: Particle[] = [];
          // 移动端采用更少的粒子，降低首屏成本
          const maxParticles = isMobile ? 45 : 90;
          // 统一音频模型：频谱优先的核心参数
          const audioModel = {
            level: 0,
            bandLow: 0,
            bandMid: 0,
            bandHigh: 0,
            fluxPulse: 0,
            tempo: 0,
            // 保留原始特征用于兼容
            centroid: 0,
            zcr: 0,
            flatness: 0,
            flux: 0,
            mfcc0: 0,
            mfcc1: 0,
            mfcc2: 0,
            mfcc3: 0,
            voice: 0,
            perc: 0,
            harmonic: 0,
          };
          // 频谱优先权重配置
          const defaultWeights: AudioWeights = {
            level: 1.0,
            bandLow: 1.2,
            bandMid: 1.0,
            bandHigh: 1.4,
            fluxPulse: 1.6,
            tempo: 1.0,
          };

          const initParticles = () => {
            particles.length = 0;
            for (let i = 0; i < maxParticles; i++) {
              particles.push({
                x: p.random(p.width),
                y: p.random(p.height),
                r: p.random(1, 3),
                a: p.random(40, 110),
                vx: p.random(-0.35, 0.35),
                vy: p.random(-0.35, 0.35),
              });
            }
          };

          p.setup = () => {
            const mode = presetRef.current;
            const renderer =
              mode === 'accretion' || mode === 'spiral' || mode === 'wave' ? p.WEBGL : p.P2D;
            const canvas = p.createCanvas(
              p.windowWidth,
              p.windowHeight,
              renderer
            );
            canvas.parent(containerRef.current!);
            p.pixelDensity(1);
            // 降低移动端帧率，优先保证交互流畅
            p.frameRate(isMobile ? 45 : 60);

            if (mode === 'accretion') {
              try {
                const V = accretionMod?.ACCRETION_VERTEX;
                const F = accretionMod?.ACCRETION_FRAGMENT;
                if (V && F) {
                  shaderProgram = p.createShader(V, F);
                }
              } catch (e) {
                console.error('Accretion shader 编译失败:', e);
              }
            } else if (mode === 'spiral') {
              try {
                const V = spiralMod?.SPIRAL_VERTEX;
                const F = spiralMod?.SPIRAL_FRAGMENT;
                if (V && F) {
                  spiralProgram = p.createShader(V, F);
                }
              } catch (e) {
                console.error('Spiral shader 编译失败:', e);
              }
            } else if (mode === 'mosaic') {
              try {
                const controls = {
                  cellSize: mosaicControlsRef.current?.cellSize ?? 20,
                  maxAge: mosaicControlsRef.current?.maxAge ?? 80,
                  growthRate: mosaicControlsRef.current?.growthRate ?? 0.05,
                  spawnRate: mosaicControlsRef.current?.spawnRate ?? 0.02,
                  colorScheme: mosaicControlsRef.current?.colorScheme ?? 0,
                  colorFlowSpeed: mosaicControlsRef.current?.colorFlowSpeed ?? 0.01,
                  alpha: mosaicControlsRef.current?.alpha ?? 0.7,
                };
                const audio = {
                  level: 0,
                  flux: 0,
                  centroid: 0,
                  flatness: 0,
                  zcr: 0,
                  mfcc: [0, 0, 0, 0] as [number, number, number, number],
                  pulse: 0,
                };
                if (mosaicMod?.MosaicVisual) {
                  mosaicVisual = new mosaicMod.MosaicVisual(p, controls, audio);
                }
              } catch (e) {
                console.error('Mosaic 初始化失败:', e);
              }
            } else if (mode === 'wave') {
              try {
                const V = waveMod?.WAVE_VERTEX;
                const F = waveMod?.WAVE_FRAGMENT;
                if (V && F) {
                  waveProgram = p.createShader(V, F);
                }
              } catch (e) {
                console.error('Wave shader 编译失败:', e);
              }
            } else {
              initParticles();
            }
          };

          p.windowResized = () => {
            p.resizeCanvas(p.windowWidth, p.windowHeight);
            if (presetRef.current === 'pulse') {
              initParticles();
            } else if (presetRef.current === 'mosaic' && mosaicVisual) {
              mosaicVisual.resize();
            }
          };

          p.draw = () => {
            const mode = presetRef.current;
            const rawLvl = levelRef.current;
            const f = featuresRef.current;
            
            // 调试日志 - 每100帧输出一次
            if (Math.random() < 0.01) {
              console.log('Visualizer - 模式:', mode, '音频级别:', rawLvl.toFixed(3), '特征:', f);
            }

            // 频谱优先模式：更激进的响应，减少平滑
            const isSpectrumPriority = spectrumPriorityRef.current;
            const weights = { ...defaultWeights, ...audioWeightsRef.current };
            
            // 根据模式调整平滑参数
            const attack = isSpectrumPriority ? 0.6 : 0.35;
            const decay = isSpectrumPriority ? 0.25 : 0.12;
            const smooth = (cur: number, target: number) =>
              cur + (target > cur ? attack : decay) * (target - cur);

            const norm = (v: number, min: number, max: number) =>
              Math.max(0, Math.min(1, (v - min) / Math.max(1e-6, max - min)));
            const sqrt01 = (x: number) =>
              Math.sqrt(Math.max(0, Math.min(1, x)));

            // 频谱优先：直接使用频段数据，减少计算
            const bandLow = Math.max(0, Math.min(1, f?.bandLow ?? 0));
            const bandMid = Math.max(0, Math.min(1, f?.bandMid ?? 0));
            const bandHigh = Math.max(0, Math.min(1, f?.bandHigh ?? 0));
            const tempoBpm = f?.tempo?.bpm ?? 0;
            const tempoConf = f?.tempo?.confidence ?? 0;
            
            // 传统特征（兼容模式）
            const centroidNorm =
              f?.spectralCentroid != null
                ? sqrt01(norm(f.spectralCentroid, 200, 6000))
                : 0;
            const zcrNorm =
              f?.zcr != null ? Math.max(0, Math.min(1, f.zcr)) : 0;
            const flatNorm =
              f?.spectralFlatness != null
                ? Math.max(0, Math.min(1, f.spectralFlatness))
                : 0;
            const fluxRaw =
              f?.spectralFlux != null
                ? Math.max(0, Math.min(1, f.spectralFlux))
                : 0;
            const voiceRaw =
              f?.voiceProb != null ? Math.max(0, Math.min(1, f.voiceProb)) : 0;
            const percRaw =
              f?.percussiveRatio != null
                ? Math.max(0, Math.min(1, f.percussiveRatio))
                : 0;
            const harmRaw =
              f?.harmonicRatio != null
                ? Math.max(0, Math.min(1, f.harmonicRatio))
                : 0;
            const m0 = f?.mfcc?.[0] ?? 0,
              m1 = f?.mfcc?.[1] ?? 0,
              m2 = f?.mfcc?.[2] ?? 0,
              m3 = f?.mfcc?.[3] ?? 0;
            const mapM = (v: number) =>
              Math.max(0, Math.min(1, (v + 100) / 200));

            // 更新统一音频模型
            audioModel.level = smooth(audioModel.level, rawLvl);
            audioModel.bandLow = smooth(audioModel.bandLow, bandLow);
            audioModel.bandMid = smooth(audioModel.bandMid, bandMid);
            audioModel.bandHigh = smooth(audioModel.bandHigh, bandHigh);
            audioModel.tempo = smooth(audioModel.tempo, tempoBpm > 0 ? tempoConf : 0);
            
            // 保留传统特征用于兼容
            audioModel.centroid = smooth(audioModel.centroid, centroidNorm);
            audioModel.zcr = smooth(audioModel.zcr, zcrNorm);
            audioModel.flatness = smooth(audioModel.flatness, flatNorm);
            audioModel.flux = smooth(audioModel.flux, fluxRaw);
            audioModel.mfcc0 = smooth(audioModel.mfcc0, mapM(m0));
            audioModel.mfcc1 = smooth(audioModel.mfcc1, mapM(m1));
            audioModel.mfcc2 = smooth(audioModel.mfcc2, mapM(m2));
            audioModel.mfcc3 = smooth(audioModel.mfcc3, mapM(m3));
            audioModel.voice = smooth(audioModel.voice, voiceRaw);
            audioModel.perc = smooth(audioModel.perc, percRaw);
            audioModel.harmonic = smooth(audioModel.harmonic, harmRaw);

            // 频谱优先的脉冲检测：更敏感
            const fluxThresh = isSpectrumPriority ? 0.08 : 0.12;
            if (fluxRaw > fluxThresh && fluxRaw > audioModel.flux + 0.02) {
              audioModel.fluxPulse = 1;
            } else {
              audioModel.fluxPulse *= isSpectrumPriority ? 0.88 : 0.92; // 更快的衰减
            }
            audioModel.fluxPulse = Math.max(0, Math.min(1, audioModel.fluxPulse));

            // 自适应权重微调：低频长期占优时，降低高频权重；无可靠节拍且脉冲频繁时，降低脉冲权重
            const lowDominant = audioModel.bandLow > audioModel.bandHigh + 0.12;
            const hasStableTempo = !!(f as any)?.tempo && ((f as any).tempo.confidence ?? 0) >= 0.6;
            let effBandHigh = weights.bandHigh;
            if (lowDominant) effBandHigh = Math.max(1.0, effBandHigh - 0.2);
            let effPulse = weights.fluxPulse;
            if (!hasStableTempo && audioModel.flux > 0.35) effPulse = Math.min(effPulse, 1.3);

            if (mode === 'accretion' && shaderProgram && accretionMod) {
              // 频谱优先：Accretion 简化为 bandLow→整体增益、bandHigh→闪烁、level→亮度
              const c = accretionControlsRef.current;
              let sens = sensitivityRef.current ?? 1;
              
              if (isSpectrumPriority) {
                // 频谱优先：更直接的映射，减少钳制
                sens = 1.0 + (audioModel.level * weights.level + audioModel.bandLow * weights.bandLow) * 0.8;
                if (isMobile) sens *= 0.95; // 移动端微调
              } else {
                // 传统模式：保持原有逻辑
                const base = Math.max(audioModel.level, audioModel.flux);
                sens = (1.0 + 0.25 * (base - 0.15)) * sens;
                sens *= 0.9 + 0.5 * audioModel.bandMid;
                const sMin = Math.max(0.8, Math.min(1.2, c?.sensMin ?? 0.9));
                const sMax = Math.max(sMin, Math.min(1.6, c?.sensMax ?? 1.15));
                sens = Math.max(sMin, Math.min(sMax, sens));
                if (isMobile) sens *= 0.9;
              }
              
              accretionMod.applyAccretionAudioUniforms(
                p,
                shaderProgram,
                audioModel.level,
                {
                  spectralCentroid: audioModel.centroid * 6000,
                  zcr: audioModel.zcr,
                  mfcc: [
                    audioModel.mfcc0,
                    audioModel.mfcc1,
                    audioModel.mfcc2,
                    audioModel.mfcc3,
                  ],
                  spectralFlux: audioModel.flux,
                  spectralFlatness: audioModel.flatness,
                  // @ts-ignore allow extended fields
                  _pulse: audioModel.fluxPulse,
                } as any,
                sens,
                {
                  // 频谱优先：低频→增益，高频→闪烁
                  gainScale: isSpectrumPriority 
                    ? Math.max(0.5, Math.min(2.5, (c?.gainScale ?? 1.1) * (0.8 + 1.2 * audioModel.bandLow * weights.bandLow)))
                    : Math.max(0.5, Math.min(2.0, (c?.gainScale ?? 1.1) * (0.9 + 0.6 * audioModel.bandLow))),
                  flickerStrength: isSpectrumPriority
                    ? Math.max(0.0, Math.min(0.6, (c?.flickerStrength ?? 0.12) * (0.6 + 1.4 * audioModel.bandHigh * effBandHigh)))
                    : Math.max(0.0, Math.min(0.4, (c?.flickerStrength ?? 0.12) * (0.8 + 0.8 * audioModel.bandHigh))),
                  flickerFreq: c?.flickerFreq,
                  overallBoost: isSpectrumPriority
                    ? Math.max(0.7, Math.min(2.0, (c?.overallBoost ?? 1.0) * (0.9 + 0.5 * audioModel.level * weights.level)))
                    : Math.max(0.7, Math.min(1.6, (c?.overallBoost ?? 1.0) * (0.95 + 0.3 * audioModel.bandLow))),
                }
              );
              accretionMod.drawAccretion(p, shaderProgram);
            } else if (mode === 'spiral' && spiralProgram && spiralMod) {
              // 频谱优先：Spiral 简化为 bandHigh→扰动、bandLow→体规模、fluxPulse→高光
              let spiralLevel = audioModel.level;
              let spiralSensitivity = sensitivityRef.current ?? 1.5;
              
              if (isSpectrumPriority) {
                // 频谱优先：低频→体规模，高频→扰动强度
                spiralLevel = Math.max(0, Math.min(1, 
                  0.6 * audioModel.level * weights.level + 
                  0.4 * audioModel.bandLow * weights.bandLow
                ));
                spiralSensitivity = 1.0 + (
                  audioModel.bandHigh * effBandHigh * 0.8 + 
                  audioModel.fluxPulse * effPulse * 0.6
                );
                if (isMobile) spiralSensitivity *= 0.9;
              } else {
                // 传统模式
                spiralLevel = Math.max(0, Math.min(1, 0.7 * audioModel.level + 0.3 * audioModel.bandLow));
                spiralSensitivity = spiralSensitivity * (0.9 + 0.35 * audioModel.bandHigh + 0.2 * audioModel.bandLow);
              }
              
              const spiralAudio = {
                level: spiralLevel,
                flux: audioModel.flux,
                centroid: audioModel.centroid,
                flatness: audioModel.flatness,
                zcr: audioModel.zcr,
                mfcc: [
                  audioModel.mfcc0,
                  audioModel.mfcc1,
                  audioModel.mfcc2,
                  audioModel.mfcc3,
                ] as [number, number, number, number],
                pulse: audioModel.fluxPulse,
              };
              spiralMod.applySpiralUniforms(
                p,
                spiralProgram,
                spiralAudio,
                spiralSensitivity
              );
              spiralMod.drawSpiral(p, spiralProgram);
            } else if (mode === 'mosaic' && mosaicVisual && mosaicMod) {
              // 频谱优先：Mosaic 简化为列响度→横向生成、bandLow→密度、bandHigh→颜色
              const mosaicAudio = {
                level: audioModel.level,
                flux: audioModel.flux,
                centroid: audioModel.centroid,
                flatness: audioModel.flatness,
                zcr: audioModel.zcr,
                mfcc: [
                  audioModel.mfcc0,
                  audioModel.mfcc1,
                  audioModel.mfcc2,
                  audioModel.mfcc3,
                ] as [number, number, number, number],
                pulse: audioModel.fluxPulse,
              };
              
              // 频谱优先：优化列响度计算，减少过度平滑
              let columns = Array.isArray((f as any)?.bandColumns) ? (f as any).bandColumns : [];
              if (isSpectrumPriority && columns.length > 0) {
                // 减少平滑，提高响应性
                const prevColumns = (mosaicVisual as any)?._prevColumns || columns;
                const alpha = 0.3; // 降低平滑系数
                columns = columns.map((v: number, i: number) => 
                  alpha * v + (1 - alpha) * (prevColumns[i] || v)
                );
                (mosaicVisual as any)._prevColumns = columns;
              }
              
              const controls = mosaicControlsRef.current;
              // 相位驱动的 colorFlowSpeed 轻度调制（有节拍时 0.85~1.25，无节拍回落 1.0），并做平滑
              let colorFlowSpeed = controls?.colorFlowSpeed ?? 0.01;
              try {
                const tempoObj: any = (f as any)?.tempo;
                const conf = Number(tempoObj?.confidence ?? 0);
                const phase = Number(tempoObj?.phase ?? 0);
                const good = conf >= 0.6;
                const phaseBoost = good ? (0.85 + 0.4 * (0.5 + 0.5 * Math.sin(phase * Math.PI * 2))) : 1.0;
                const prev = (mosaicVisual as any)?._flowSpeedPrev ?? colorFlowSpeed;
                const target = (controls?.colorFlowSpeed ?? 0.01) * phaseBoost;
                const alpha = 0.8; // 平滑，避免抖动
                colorFlowSpeed = alpha * prev + (1 - alpha) * target;
                (mosaicVisual as any)._flowSpeedPrev = colorFlowSpeed;
              } catch (_) {}
              let mosaicSensitivity = sensitivityRef.current ?? 1.5;
              let cellSize = controls?.cellSize ?? 20;
              let maxAge = controls?.maxAge ?? 80;
              let growthRate = controls?.growthRate ?? 0.05;
              let spawnRate = controls?.spawnRate ?? 0.02;
              
              if (isSpectrumPriority) {
                // 频谱优先：更激进的参数调整
                mosaicSensitivity = 1.0 + (
                  audioModel.bandLow * weights.bandLow * 0.6 + 
                  audioModel.level * weights.level * 0.4
                );
                if (isMobile) mosaicSensitivity *= 0.9;
                
                // 低频影响细胞大小和寿命
                cellSize = cellSize * (0.8 + 0.4 * audioModel.bandLow * weights.bandLow);
                maxAge = maxAge * (0.7 + 0.6 * audioModel.bandLow * weights.bandLow);
                
                // 高频影响生长和生成率
                growthRate = growthRate * (0.5 + 1.0 * audioModel.bandHigh * effBandHigh);
                spawnRate = spawnRate * (0.3 + 1.4 * audioModel.bandHigh * effBandHigh);
              } else {
                // 传统模式
                mosaicSensitivity = mosaicSensitivity * (isMobile ? 0.9 : 1);
                maxAge = maxAge * (isMobile ? 0.85 : 1);
              }
              
              mosaicMod.applyMosaicUniforms(
                p,
                mosaicVisual,
                mosaicAudio,
                mosaicSensitivity,
                cellSize,
                maxAge,
                growthRate,
                spawnRate,
                controls?.colorScheme ?? 0,
                colorFlowSpeed,
                controls?.alpha ?? 0.7,
                columns
              );
              mosaicMod.drawMosaic(p, mosaicVisual);
            } else if (mode === 'wave' && waveProgram && waveMod) {
              // 频谱优先：Wave 简化为 bandLow→线宽/振幅、bandHigh→频率、fluxPulse→速度
              const waveAudio = {
                level: audioModel.level,
                flux: audioModel.flux,
                centroid: audioModel.centroid,
                flatness: audioModel.flatness,
                zcr: audioModel.zcr,
                mfcc: [
                  audioModel.mfcc0,
                  audioModel.mfcc1,
                  audioModel.mfcc2,
                  audioModel.mfcc3,
                ] as [number, number, number, number],
                pulse: audioModel.fluxPulse,
              };
              
              let waveSensitivity = sensitivityRef.current ?? 1.5;
              let amplitude = 0.25;
              let frequency = 0.9;
              let speed = 0.08;
              let thickness = 0.02;
              let phaseJitter = 0.02;
              
              if (isSpectrumPriority) {
                // 频谱优先：更直接的频段映射
                waveSensitivity = 1.0 + (
                  audioModel.bandLow * weights.bandLow * 0.4 + 
                  audioModel.bandHigh * effBandHigh * 0.3 +
                  audioModel.fluxPulse * effPulse * 0.5
                );
                if (isMobile) waveSensitivity *= 0.9;
                
                // 低频→振幅和线宽
                amplitude = Math.max(0.08, Math.min(0.4, 
                  0.15 + 0.3 * audioModel.bandLow * weights.bandLow
                ));
                thickness = Math.max(0.005, Math.min(0.05, 
                  0.01 + 0.04 * audioModel.bandLow * weights.bandLow
                ));
                
                // 高频→频率和相位抖动
                frequency = Math.max(0.4, Math.min(1.0, 
                  0.6 + 0.5 * audioModel.bandHigh * effBandHigh
                ));
                phaseJitter = Math.max(0.005, Math.min(0.08, 
                  0.01 + 0.07 * audioModel.bandHigh * effBandHigh
                ));
                
                // 脉冲和节拍→速度
                const tempoObj: any = (f as any)?.tempo;
                const tempoBpm = tempoObj?.confidence >= 0.6 ? tempoObj?.bpm : 0;
                if (tempoBpm && tempoBpm > 0) {
                  speed = Math.max(0.04, Math.min(0.25, tempoBpm / 400)); // 优先跟拍
                } else {
                  speed = Math.max(0.04, Math.min(0.2, 
                    0.08 + 0.12 * audioModel.fluxPulse * effPulse
                  ));
                }
              } else {
                // 传统模式
                const fAny = f as any;
                const bandLow = Math.max(0, Math.min(1, fAny?.bandLow ?? 0));
                const bandMid = Math.max(0, Math.min(1, fAny?.bandMid ?? 0));
                const bandHigh = Math.max(0, Math.min(1, fAny?.bandHigh ?? 0));
                const tempoBpm = fAny?.tempo?.bpm ?? undefined;
                
                waveSensitivity = waveSensitivity * (isMobile ? 0.9 : 1);
                const bpmSpeed = tempoBpm ? Math.max(0.04, Math.min(0.18, tempoBpm / 600)) : 0.08;
                amplitude = 0.10 + 0.22 * Math.max(0, Math.min(1, bandLow * 0.8 + audioModel.level * 0.2));
                frequency = 0.7 + 0.5 * Math.max(0, Math.min(1, bandHigh));
                speed = bpmSpeed;
                thickness = 0.02;
                phaseJitter = 0.01 + 0.03 * Math.max(0, Math.min(1, bandMid));
              }

              waveMod.applyWaveUniforms(
                p,
                waveProgram,
                waveAudio,
                waveSensitivity,
                {
                  amplitude: Math.max(0.08, Math.min(0.4, amplitude)),
                  frequency: Math.max(0.4, Math.min(1.0, frequency)),
                  speed: speed,
                  phaseBase: 0.0,
                  phaseDelta: 0.45,
                  phaseJitter: phaseJitter,
                  phaseSpeed: 0.7,
                  thickness: thickness,
                  glowStrength: 0.55,
                  rgbSeparation: 0.8,
                  brightness: 1.15,
                }
              );
              waveMod.drawWave(p, waveProgram);
            } else {
              p.background(0, 0, 0);
              const drawPulseFn = pulseMod?.drawPulse;
              if (typeof drawPulseFn === 'function') {
                drawPulseFn(p, particles, audioModel.level);
              }
            }

            const label =
              mode === 'accretion'
                ? 'Accretion'
                : mode === 'spiral'
                  ? 'Spiral'
                  : mode === 'mosaic'
                    ? 'Mosaic'
                    : 'Pulse';
            p.resetMatrix?.();
            p.noStroke();
            // 避免 WEBGL 模式下的字体警告，只在 P2D 模式下绘制文本
            if (mode === 'pulse') {
              p.fill(200);
              p.textAlign(p.CENTER, p.TOP);
              p.textSize(12);
              const x = p.width / 2;
              const yBase =
                p.height * 0.55 + Math.min(p.width, p.height) * 0.18 + 24;
              const stateText = runningRef.current ? label : 'Paused';
              p.text(stateText, x, yBase);
            }
          };
        };

        const instance = new P5(sketch);
        p5InstanceRef.current = instance;
      } catch (e) {
        console.error('Visualizer 初始化失败:', e);
      }
    })();

    return () => {
      isCancelled = true;
      try {
        if (p5InstanceRef.current) {
          p5InstanceRef.current.remove();
          p5InstanceRef.current = null;
        }
      } catch (e) {
        console.warn('Visualizer 卸载时出错:', e);
      }
    };
  }, [preset]);

  return <div ref={containerRef} className="absolute inset-0" aria-hidden />;
}
