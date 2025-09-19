"use client";

import React, { useEffect, useRef } from "react";

interface Features {
  rms?: number;
  spectralCentroid?: number;
  zcr?: number;
  mfcc?: number[];
  spectralFlatness?: number;
  spectralFlux?: number;
}

export type Particle = { x: number; y: number; r: number; a: number; vx: number; vy: number };

interface VisualizerProps {
  audioLevel: number; // 0 ~ 1
  running: boolean;
  preset?: 'pulse' | 'accretion' | 'spiral';
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
}

export default function Visualizer({ audioLevel, running, preset = 'pulse', features = null, sensitivity = 1.5, accretionControls }: VisualizerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const p5InstanceRef = useRef<any | null>(null);
  const levelRef = useRef<number>(0);
  const runningRef = useRef<boolean>(false);
  const presetRef = useRef<'pulse' | 'accretion' | 'spiral'>(preset);
  const featuresRef = useRef<Features | null>(features);
  const sensitivityRef = useRef<number>(sensitivity);
  const accretionControlsRef = useRef<VisualizerProps['accretionControls'] | undefined>(accretionControls);

  useEffect(() => { levelRef.current = audioLevel; }, [audioLevel]);
  useEffect(() => { runningRef.current = running; }, [running]);
  useEffect(() => { presetRef.current = preset; }, [preset]);
  useEffect(() => { featuresRef.current = features; }, [features]);
  useEffect(() => { sensitivityRef.current = sensitivity; }, [sensitivity]);
  useEffect(() => { accretionControlsRef.current = accretionControls; }, [accretionControls]);

  useEffect(() => {
    if (!containerRef.current) return;
    let isCancelled = false;

    (async () => {
      try {
        const mod = await import("p5");
        const P5 = (mod as any).default ?? mod;
        if (isCancelled) return;

        const [{ drawPulse }, { ACCRETION_VERTEX, ACCRETION_FRAGMENT, drawAccretion, applyAccretionAudioUniforms }, { SPIRAL_VERTEX, SPIRAL_FRAGMENT, applySpiralUniforms, drawSpiral }] = await Promise.all([
          import('../visuals/pulse'),
          import('../visuals/accretion'),
          import('../visuals/spiral'),
        ]);

        const sketch = (p: any) => {
          let shaderProgram: any | null = null;
          let spiralProgram: any | null = null;
          const particles: Particle[] = [];
          const maxParticles = 90;
          // smoothed feature state for obvious yet stable response
          let smoothed = {
            level: 0,
            centroid: 0,
            zcr: 0,
            flatness: 0,
            flux: 0,
            mfcc0: 0,
            mfcc1: 0,
            mfcc2: 0,
            mfcc3: 0,
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
            const renderer = (mode === 'accretion' || mode === 'spiral') ? p.WEBGL : p.P2D;
            const canvas = p.createCanvas(p.windowWidth, p.windowHeight, renderer);
            canvas.parent(containerRef.current!);
            p.pixelDensity(1);

            if (mode === 'accretion') {
              try { shaderProgram = p.createShader(ACCRETION_VERTEX, ACCRETION_FRAGMENT); } catch (e) { console.error('Accretion shader 编译失败:', e); }
            } else if (mode === 'spiral') {
              try { spiralProgram = p.createShader(SPIRAL_VERTEX, SPIRAL_FRAGMENT); } catch (e) { console.error('Spiral shader 编译失败:', e); }
            } else {
              initParticles();
            }
          };

          p.windowResized = () => {
            p.resizeCanvas(p.windowWidth, p.windowHeight);
            if (presetRef.current !== 'accretion') initParticles();
          };

          p.draw = () => {
            const mode = presetRef.current;
            const rawLvl = levelRef.current;
            const f = featuresRef.current;

            // update smoothed features (attack/decay)
            const attack = 0.35;
            const decay = 0.12;
            const smooth = (cur: number, target: number) => cur + ((target > cur ? attack : decay) * (target - cur));

            const norm = (v: number, min: number, max: number) => Math.max(0, Math.min(1, (v - min) / Math.max(1e-6, (max - min))));
            const sqrt01 = (x: number) => Math.sqrt(Math.max(0, Math.min(1, x)));

            const centroidNorm = f?.spectralCentroid != null ? sqrt01(norm(f.spectralCentroid, 200, 6000)) : 0; // emphasize highs
            const zcrNorm = f?.zcr != null ? Math.max(0, Math.min(1, f.zcr)) : 0;
            const flatNorm = f?.spectralFlatness != null ? Math.max(0, Math.min(1, f.spectralFlatness)) : 0;
            const fluxRaw = f?.spectralFlux != null ? Math.max(0, Math.min(1, f.spectralFlux)) : 0;
            const m0 = f?.mfcc?.[0] ?? 0, m1 = f?.mfcc?.[1] ?? 0, m2 = f?.mfcc?.[2] ?? 0, m3 = f?.mfcc?.[3] ?? 0;
            const mapM = (v: number) => Math.max(0, Math.min(1, (v + 100) / 200));

            smoothed.level = smooth(smoothed.level, rawLvl);
            smoothed.centroid = smooth(smoothed.centroid, centroidNorm);
            smoothed.zcr = smooth(smoothed.zcr, zcrNorm);
            smoothed.flatness = smooth(smoothed.flatness, flatNorm);
            smoothed.flux = smooth(smoothed.flux, fluxRaw);
            smoothed.mfcc0 = smooth(smoothed.mfcc0, mapM(m0));
            smoothed.mfcc1 = smooth(smoothed.mfcc1, mapM(m1));
            smoothed.mfcc2 = smooth(smoothed.mfcc2, mapM(m2));
            smoothed.mfcc3 = smooth(smoothed.mfcc3, mapM(m3));

            // trigger/decay a visible pulse on flux spikes
            const fluxThresh = 0.12;
            if (fluxRaw > fluxThresh && fluxRaw > smoothed.flux + 0.02) {
              fluxPulse = 1;
            } else {
              fluxPulse *= 0.92; // decay
            }

            if (mode === 'accretion' && shaderProgram) {
              // Gentle sensitivity; clamp by external controls if provided
              const base = Math.max(smoothed.level, smoothed.flux);
              let sens = (1.0 + 0.25 * (base - 0.15)) * (sensitivityRef.current ?? 1);
              const c = accretionControlsRef.current;
              const sMin = Math.max(0.8, Math.min(1.2, c?.sensMin ?? 0.9));
              const sMax = Math.max(sMin, Math.min(1.6, c?.sensMax ?? 1.15));
              sens = Math.max(sMin, Math.min(sMax, sens));
              applyAccretionAudioUniforms(p, shaderProgram, smoothed.level, {
                spectralCentroid: smoothed.centroid * 6000, // reverse map only for completeness
                zcr: smoothed.zcr,
                mfcc: [smoothed.mfcc0, smoothed.mfcc1, smoothed.mfcc2, smoothed.mfcc3],
                spectralFlux: smoothed.flux,
                spectralFlatness: smoothed.flatness,
                // @ts-ignore allow extended fields
                _pulse: fluxPulse,
              } as any, sens, {
                gainScale: c?.gainScale,
                flickerStrength: c?.flickerStrength,
                flickerFreq: c?.flickerFreq,
                overallBoost: c?.overallBoost,
              });
              drawAccretion(p, shaderProgram);
            } else if (mode === 'spiral' && spiralProgram) {
              applySpiralUniforms(p, spiralProgram, smoothed.level, sensitivityRef.current);
              drawSpiral(p, spiralProgram);
            } else {
              p.background(0, 0, 0);
              drawPulse(p, particles, smoothed.level);
            }

            const label = mode === 'accretion' ? 'Accretion' : mode === 'spiral' ? 'Spiral' : 'Pulse';
            p.resetMatrix?.();
            p.noStroke();
            // Avoid p5 WEBGL text font warnings by skipping text in accretion mode
            if (mode !== 'accretion') {
              p.fill(200);
              p.textAlign(p.CENTER, p.TOP);
              p.textSize(12);
              const x = p.width / 2;
              const yBase = p.height * 0.55 + Math.min(p.width, p.height) * 0.18 + 24;
              const stateText = runningRef.current ? label : 'Paused';
              p.text(stateText, x, yBase);
            }
          };
        };

        const instance = new P5(sketch);
        p5InstanceRef.current = instance;
      } catch (e) {
        console.error("Visualizer 初始化失败:", e);
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
        console.warn("Visualizer 卸载时出错:", e);
      }
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0" aria-hidden />;
}
