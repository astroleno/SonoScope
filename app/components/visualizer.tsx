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
            // 某些布局在首帧后才稳定，延迟一次 resize 保证满屏
            try { setTimeout(() => { p.resizeCanvas(p.windowWidth, p.windowHeight); }, 50); } catch (_) {}

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
                  bandLow: 0,
                  bandMid: 0,
                  bandHigh: 0,
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
            // 全局更稳的平滑，减少突变
            const attack = isSpectrumPriority ? 0.5 : 0.38;
            const decay = isSpectrumPriority ? 0.20 : 0.14;
            const smooth = (cur: number, target: number) =>
              cur + (target > cur ? attack : decay) * (target - cur);

            const norm = (v: number, min: number, max: number) =>
              Math.max(0, Math.min(1, (v - min) / Math.max(1e-6, max - min)));
            const sqrt01 = (x: number) =>
              Math.sqrt(Math.max(0, Math.min(1, x)));

            // 频谱优先：直接使用频段数据；当特征不可用时做回退映射
            let bandLow = Math.max(0, Math.min(1, f?.bandLow ?? 0));
            let bandMid = Math.max(0, Math.min(1, f?.bandMid ?? 0));
            let bandHigh = Math.max(0, Math.min(1, f?.bandHigh ?? 0));
            const tempoBpm = f?.tempo?.bpm ?? 0;
            const tempoConf = f?.tempo?.confidence ?? 0;

            // 回退：当没有频段信息（Meyda 未启用时），用音量大致推导
            if (!f || (f.bandLow == null && f.bandMid == null && f.bandHigh == null)) {
              const lvl = Math.max(0, Math.min(1, rawLvl));
              // 假设低频占比略高，高频略低，避免完全静止
              bandLow = Math.max(bandLow, Math.min(1, lvl * 0.8 + 0.05));
              bandMid = Math.max(bandMid, Math.min(1, lvl * 0.6 + 0.03));
              bandHigh = Math.max(bandHigh, Math.min(1, lvl * 0.5 + 0.02));
            }
            
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
            let fluxRaw =
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

            // 额外回退：用音量变化估计脉冲感（在无特征时也能动起来）
            const levelDelta = Math.abs(rawLvl - audioModel.level);
            fluxRaw = Math.max(fluxRaw, Math.min(1, levelDelta * 3));

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
                // 亮度随响度显著变化：中心提升（对低电平也可见）
                Math.max(0.0, Math.min(2.2, 0.35 + audioModel.level * 1.6)),
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
                    ? Math.max(0.0, Math.min(0.75, (c?.flickerStrength ?? 0.14) * (0.6 + 1.4 * audioModel.bandHigh * effBandHigh)))
                    : Math.max(0.0, Math.min(0.5, (c?.flickerStrength ?? 0.14) * (0.8 + 0.8 * audioModel.bandHigh))),
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
              // Mosaic：画布尺寸固定，仅使用音频特征影响颜色与节奏
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
                bandLow: audioModel.bandLow,
                bandMid: audioModel.bandMid,
                bandHigh: audioModel.bandHigh,
              };
              
              let columns = Array.isArray((f as any)?.bandColumns) ? (f as any).bandColumns : [];
              if (!columns || columns.length === 0) {
                const segs = 12;
                const low = Math.max(0, Math.min(1, audioModel.bandLow));
                const mid = Math.max(0, Math.min(1, audioModel.bandMid));
                const high = Math.max(0, Math.min(1, audioModel.bandHigh));
                const energy = Math.max(0, Math.min(1, audioModel.level));
                columns = Array.from({ length: segs }, (_, idx) => {
                  const t = segs === 1 ? 0 : idx / (segs - 1);
                  const spectrum = t < 0.5
                    ? low + (mid - low) * (t / 0.5)
                    : mid + (high - mid) * ((t - 0.5) / 0.5);
                  return Math.max(0, Math.min(1, spectrum * 0.75 + energy * 0.25));
                });
              }

              const controls = mosaicControlsRef.current;
              const mosaicSensitivity = (sensitivityRef.current ?? 1.5) * (isMobile ? 0.9 : 1);
              const cellSize = controls?.cellSize ?? 20;
              const maxAge = controls?.maxAge ?? 80;
              const growthRate = controls?.growthRate ?? 0.05;
              const spawnRate = controls?.spawnRate ?? 0.02;

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
                controls?.colorFlowSpeed ?? 0.01,
                controls?.alpha ?? 0.7,
                columns
              );
              mosaicMod.drawMosaic(p, mosaicVisual);
            } else if (mode === 'wave' && waveProgram && waveMod) {
              const levelInstant = Math.max(0, Math.min(1, rawLvl));
              const fluxInstant = Math.max(0, Math.min(1, fluxRaw));
              const centroidInstant = Math.max(0, Math.min(1, centroidNorm));
              const flatInstant = Math.max(0, Math.min(1, flatNorm));
              const zcrInstant = Math.max(0, Math.min(1, zcrNorm));
              const mfccInstant: [number, number, number, number] = [
                mapM(m0),
                mapM(m1),
                mapM(m2),
                mapM(m3),
              ];
              const pulseInstant = Math.max(
                0,
                Math.min(1, Math.max(audioModel.fluxPulse, fluxInstant))
              );

              const glowAttack = 0.28;
              const glowDecay = 0.12;
              const glowSmooth = (cur: number, target: number) =>
                cur + (target > cur ? glowAttack : glowDecay) * (target - cur);

              // @ts-ignore
              if (!p.__waveGlowState) {
                // @ts-ignore
                p.__waveGlowState = {
                  level: levelInstant,
                  flux: fluxInstant,
                  centroid: centroidInstant,
                  flatness: flatInstant,
                  zcr: zcrInstant,
                  pulse: pulseInstant,
                  mfcc0: mfccInstant[0],
                  mfcc1: mfccInstant[1],
                  mfcc2: mfccInstant[2],
                  mfcc3: mfccInstant[3],
                };
              }
              // @ts-ignore
              const glowState = p.__waveGlowState as {
                level: number;
                flux: number;
                centroid: number;
                flatness: number;
                zcr: number;
                pulse: number;
                mfcc0: number;
                mfcc1: number;
                mfcc2: number;
                mfcc3: number;
              };

              glowState.level = glowSmooth(glowState.level, levelInstant);
              glowState.flux = glowSmooth(glowState.flux, fluxInstant);
              glowState.centroid = glowSmooth(glowState.centroid, centroidInstant);
              glowState.flatness = glowSmooth(glowState.flatness, flatInstant);
              glowState.zcr = glowSmooth(glowState.zcr, zcrInstant);
              glowState.pulse = glowSmooth(glowState.pulse, pulseInstant);
              glowState.mfcc0 = glowSmooth(glowState.mfcc0, mfccInstant[0]);
              glowState.mfcc1 = glowSmooth(glowState.mfcc1, mfccInstant[1]);
              glowState.mfcc2 = glowSmooth(glowState.mfcc2, mfccInstant[2]);
              glowState.mfcc3 = glowSmooth(glowState.mfcc3, mfccInstant[3]);

              const waveAudio = {
                level: glowState.level,
                flux: glowState.flux,
                centroid: glowState.centroid,
                flatness: glowState.flatness,
                zcr: glowState.zcr,
                mfcc: [
                  glowState.mfcc0,
                  glowState.mfcc1,
                  glowState.mfcc2,
                  glowState.mfcc3,
                ] as [number, number, number, number],
                pulse: glowState.pulse,
              };

              const waveSensitivity = sensitivityRef.current ?? 1.2;
              const energySmoothing = 0.028;
              const amplitudeSmoothing = 0.012;
              const levelDrive = Math.max(0, Math.min(1, audioModel.level));
              const fluxDrive = Math.max(0, Math.min(1, audioModel.flux));
              const pulseDrive = Math.max(0, Math.min(1, audioModel.fluxPulse));
              const combined = Math.min(
                1,
                (levelDrive * 0.8) + (fluxDrive * 0.15) + (pulseDrive * 0.2)
              );
              // 先对能量做一次缓慢积分，让振幅变化具备缓冲
              // @ts-ignore
              if (typeof p.__waveEnergy !== 'number') {
                // @ts-ignore
                p.__waveEnergy = combined;
              }
              // @ts-ignore
              p.__waveEnergy =
                // @ts-ignore
                p.__waveEnergy + energySmoothing * (combined - p.__waveEnergy);
              // @ts-ignore
              const smoothedEnergy = Math.max(0, Math.min(1, p.__waveEnergy as number));
              const shaped = Math.pow(Math.max(0.0001, smoothedEnergy), 0.58);
              const targetAmp = Math.max(
                0.05,
                Math.min(0.42, 0.09 + 0.24 * 1.3 * shaped)
              );
              // 仅对振幅做音频响应和平滑
              // @ts-ignore
              if (typeof p.__waveAmp !== 'number') {
                // @ts-ignore
                p.__waveAmp = targetAmp;
              }
              // @ts-ignore
              p.__waveAmp =
                // @ts-ignore
                p.__waveAmp +
                amplitudeSmoothing * (targetAmp - p.__waveAmp);
              // @ts-ignore
              const amplitude = p.__waveAmp as number;

              waveMod.applyWaveUniforms(
                p,
                waveProgram,
                waveAudio,
                waveSensitivity,
                {
                  amplitude,
                  frequency: 0.82,
                  speed: 0.085,
                  phaseBase: 0.0,
                  phaseDelta: 0.48,
                  phaseJitter: 0.010,
                  phaseSpeed: 0.28,
                  thickness: 0.022,
                  glowStrength: 0.6,
                  rgbSeparation: 1.0,
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
