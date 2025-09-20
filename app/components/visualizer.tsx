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
  preset?: 'pulse' | 'accretion' | 'spiral' | 'mosaic';
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
  const presetRef = useRef<'pulse' | 'accretion' | 'spiral' | 'mosaic'>(preset);
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

        const [
          { drawPulse },
          {
            ACCRETION_VERTEX,
            ACCRETION_FRAGMENT,
            drawAccretion,
            applyAccretionAudioUniforms,
          },
          { SPIRAL_VERTEX, SPIRAL_FRAGMENT, applySpiralUniforms, drawSpiral },
          {
            MosaicVisual,
            applyMosaicUniforms,
            drawMosaic,
            MOSAIC_COLOR_SCHEMES,
          },
        ] = await Promise.all([
          import('../visuals/pulse'),
          import('../visuals/accretion'),
          import('../visuals/spiral'),
          import('../visuals/mosaic'),
        ]);

        const sketch = (p: any) => {
          let shaderProgram: any | null = null;
          let spiralProgram: any | null = null;
          let mosaicVisual: any | null = null;
          const particles: Particle[] = [];
          const maxParticles = 90;
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
              mode === 'accretion' || mode === 'spiral' ? p.WEBGL : p.P2D;
            const canvas = p.createCanvas(
              p.windowWidth,
              p.windowHeight,
              renderer
            );
            canvas.parent(containerRef.current!);
            p.pixelDensity(1);

            if (mode === 'accretion') {
              try {
                shaderProgram = p.createShader(
                  ACCRETION_VERTEX,
                  ACCRETION_FRAGMENT
                );
              } catch (e) {
                console.error('Accretion shader 编译失败:', e);
              }
            } else if (mode === 'spiral') {
              try {
                spiralProgram = p.createShader(SPIRAL_VERTEX, SPIRAL_FRAGMENT);
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
                mosaicVisual = new MosaicVisual(p, controls, audio);
              } catch (e) {
                console.error('Mosaic 初始化失败:', e);
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

            if (mode === 'accretion' && shaderProgram) {
              // Gentle sensitivity; clamp by external controls if provided
              const base = Math.max(smoothed.level, smoothed.flux);
              let sens =
                (1.0 + 0.25 * (base - 0.15)) * (sensitivityRef.current ?? 1);
              const c = accretionControlsRef.current;
              const sMin = Math.max(0.8, Math.min(1.2, c?.sensMin ?? 0.9));
              const sMax = Math.max(sMin, Math.min(1.6, c?.sensMax ?? 1.15));
              sens = Math.max(sMin, Math.min(sMax, sens));
              applyAccretionAudioUniforms(
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
              drawAccretion(p, shaderProgram);
            } else if (mode === 'spiral' && spiralProgram) {
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
              applySpiralUniforms(
                p,
                spiralProgram,
                spiralAudio,
                sensitivityRef.current ?? 1.5
              );
              drawSpiral(p, spiralProgram);
            } else if (mode === 'mosaic' && mosaicVisual) {
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
              applyMosaicUniforms(
                p,
                mosaicVisual,
                mosaicAudio,
                sensitivityRef.current ?? 1.5,
                controls?.cellSize ?? 20,
                controls?.maxAge ?? 80,
                controls?.growthRate ?? 0.05,
                controls?.spawnRate ?? 0.02,
                controls?.colorScheme ?? 0,
                controls?.colorFlowSpeed ?? 0.01,
                controls?.alpha ?? 0.7
              );
              drawMosaic(p, mosaicVisual);
            } else {
              p.background(0, 0, 0);
              drawPulse(p, particles, smoothed.level);
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
  }, []);

  return <div ref={containerRef} className="absolute inset-0" aria-hidden />;
}
