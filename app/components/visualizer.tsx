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
}

export type Particle = {
  x: number;
  y: number;
  r: number;
  a: number;
  vx: number;
  vy: number;
};

interface VisualizerProps {
  audioLevel: number; // 0 ~ 1
  running: boolean;
  preset?: 'pulse' | 'accretion' | 'spiral' | 'mosaic' | 'wave';
  features?: Features | null;
  sensitivity?: number;
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
          // smoothed feature state for obvious yet stable response
          const smoothed = {
            level: 0,
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
          // transient pulse driven by spectralFlux peaks
          let fluxPulse = 0;

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

            // update smoothed features (attack/decay)
            const attack = 0.35;
            const decay = 0.12;
            const smooth = (cur: number, target: number) =>
              cur + (target > cur ? attack : decay) * (target - cur);

            const norm = (v: number, min: number, max: number) =>
              Math.max(0, Math.min(1, (v - min) / Math.max(1e-6, max - min)));
            const sqrt01 = (x: number) =>
              Math.sqrt(Math.max(0, Math.min(1, x)));

            const centroidNorm =
              f?.spectralCentroid != null
                ? sqrt01(norm(f.spectralCentroid, 200, 6000))
                : 0; // emphasize highs
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

            smoothed.level = smooth(smoothed.level, rawLvl);
            smoothed.centroid = smooth(smoothed.centroid, centroidNorm);
            smoothed.zcr = smooth(smoothed.zcr, zcrNorm);
            smoothed.flatness = smooth(smoothed.flatness, flatNorm);
            smoothed.flux = smooth(smoothed.flux, fluxRaw);
            smoothed.mfcc0 = smooth(smoothed.mfcc0, mapM(m0));
            smoothed.mfcc1 = smooth(smoothed.mfcc1, mapM(m1));
            smoothed.mfcc2 = smooth(smoothed.mfcc2, mapM(m2));
            smoothed.mfcc3 = smooth(smoothed.mfcc3, mapM(m3));
            smoothed.voice = smooth(smoothed.voice, voiceRaw);
            smoothed.perc = smooth(smoothed.perc, percRaw);
            smoothed.harmonic = smooth(smoothed.harmonic, harmRaw);

            // trigger/decay a visible pulse on flux spikes
            const fluxThresh = 0.12;
            if (fluxRaw > fluxThresh && fluxRaw > smoothed.flux + 0.02) {
              fluxPulse = 1;
            } else {
              fluxPulse *= 0.92; // decay
            }
            fluxPulse = Math.max(0, Math.min(1, fluxPulse));

            if (mode === 'accretion' && shaderProgram && accretionMod) {
              // Gentle sensitivity; clamp by external controls if provided
              const base = Math.max(smoothed.level, smoothed.flux);
              let sens =
                (1.0 + 0.25 * (base - 0.15)) * (sensitivityRef.current ?? 1);
              const c = accretionControlsRef.current;
              const sMin = Math.max(0.8, Math.min(1.2, c?.sensMin ?? 0.9));
              const sMax = Math.max(sMin, Math.min(1.6, c?.sensMax ?? 1.15));
              sens = Math.max(sMin, Math.min(sMax, sens));
              // 移动端轻量化：轻微降低整体强度，避免过度闪烁
              if (isMobile) {
                sens *= 0.9;
              }
              accretionMod.applyAccretionAudioUniforms(
                p,
                shaderProgram,
                smoothed.level,
                {
                  spectralCentroid: smoothed.centroid * 6000, // reverse map only for completeness
                  zcr: smoothed.zcr,
                  mfcc: [
                    smoothed.mfcc0,
                    smoothed.mfcc1,
                    smoothed.mfcc2,
                    smoothed.mfcc3,
                  ],
                  spectralFlux: smoothed.flux,
                  spectralFlatness: smoothed.flatness,
                  // @ts-ignore allow extended fields
                  _pulse: fluxPulse,
                } as any,
                sens,
                {
                  gainScale: c?.gainScale,
                  flickerStrength: c?.flickerStrength,
                  flickerFreq: c?.flickerFreq,
                  overallBoost: c?.overallBoost,
                }
              );
              accretionMod.drawAccretion(p, shaderProgram);
            } else if (mode === 'spiral' && spiralProgram && spiralMod) {
              const spiralAudio = {
                level: smoothed.level,
                flux: smoothed.flux,
                centroid: smoothed.centroid,
                flatness: smoothed.flatness,
                zcr: smoothed.zcr,
                mfcc: [
                  smoothed.mfcc0,
                  smoothed.mfcc1,
                  smoothed.mfcc2,
                  smoothed.mfcc3,
                ] as [number, number, number, number],
                pulse: fluxPulse,
              };
              spiralMod.applySpiralUniforms(
                p,
                spiralProgram,
                spiralAudio,
                sensitivityRef.current ?? 1.5
              );
              spiralMod.drawSpiral(p, spiralProgram);
            } else if (mode === 'mosaic' && mosaicVisual && mosaicMod) {
              const mosaicAudio = {
                level: smoothed.level,
                flux: smoothed.flux,
                centroid: smoothed.centroid,
                flatness: smoothed.flatness,
                zcr: smoothed.zcr,
                mfcc: [
                  smoothed.mfcc0,
                  smoothed.mfcc1,
                  smoothed.mfcc2,
                  smoothed.mfcc3,
                ] as [number, number, number, number],
                pulse: fluxPulse,
              };
              const controls = mosaicControlsRef.current;
              mosaicMod.applyMosaicUniforms(
                p,
                mosaicVisual,
                mosaicAudio,
                // 移动端微降敏感度与寿命，减少画面堆积
                (sensitivityRef.current ?? 1.5) * (isMobile ? 0.9 : 1),
                (controls?.cellSize ?? 20),
                (controls?.maxAge ?? 80) * (isMobile ? 0.85 : 1),
                controls?.growthRate ?? 0.05,
                controls?.spawnRate ?? 0.02,
                controls?.colorScheme ?? 0,
                controls?.colorFlowSpeed ?? 0.01,
                controls?.alpha ?? 0.7
              );
              mosaicMod.drawMosaic(p, mosaicVisual);
            } else if (mode === 'wave' && waveProgram && waveMod) {
              const waveAudio = {
                level: smoothed.level,
                flux: smoothed.flux,
                centroid: smoothed.centroid,
                flatness: smoothed.flatness,
                zcr: smoothed.zcr,
                mfcc: [
                  smoothed.mfcc0,
                  smoothed.mfcc1,
                  smoothed.mfcc2,
                  smoothed.mfcc3,
                ] as [number, number, number, number],
                pulse: fluxPulse,
              };
              const tempoBpm = (f as any)?.tempo?.bpm ?? undefined;
              const bpmSpeed = tempoBpm ? Math.max(0.04, Math.min(0.18, tempoBpm / 600)) : 0.08;
              const ampFromLevel = 0.12 + 0.14 * Math.max(0, Math.min(1, smoothed.level));
              waveMod.applyWaveUniforms(
                p,
                waveProgram,
                waveAudio,
                (sensitivityRef.current ?? 1.5) * (isMobile ? 0.9 : 1),
                {
                  amplitude: ampFromLevel,
                  frequency: 0.9,
                  speed: bpmSpeed,
                  phaseBase: 0.0,
                  phaseDelta: 0.45,
                  phaseJitter: 0.02,
                  phaseSpeed: 0.7,
                  thickness: 0.02,
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
                drawPulseFn(p, particles, smoothed.level);
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
