'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AudioState, SonoRuntime, AudioSource, FeatureStatus } from '@sonoscope/sdk';
import type { FeatureFrame } from '@sonoscope/core';
import type { DanmuState, DomCommentSink } from '@sonoscope/danmu-pipeline';
import { appPath } from '../lib/paths';

export function useSonoScope(container: React.RefObject<HTMLDivElement | null>, reducedMotion: boolean) {
  const runtime = useRef<SonoRuntime | null>(null);
  const sink = useRef<DomCommentSink | null>(null);
  const latestFrame = useRef<FeatureFrame | null>(null);
  const [ready, setReady] = useState(false);
  const [audio, setAudio] = useState<AudioState>({ status: 'idle', audioSessionId: null, error: null, capture: null });
  const [danmu, setDanmu] = useState<DanmuState | null>(null);
  const [analysis, setAnalysis] = useState<FeatureStatus>({ dsp: 'worker', model: 'unavailable', message: null });
  const [aiAvailable, setAiAvailable] = useState(false);
  const [telemetry, setTelemetry] = useState<{ model: FeatureFrame['model']; metrics: ReturnType<SonoRuntime['metrics']['snapshot']> | null }>({ model: null, metrics: null });
  useEffect(() => {
    let cancelled = false;
    let telemetryTimer: ReturnType<typeof setInterval> | undefined;
    const abort = new AbortController();
    void (async () => {
      const [{ SonoRuntime: Runtime }, { DomCommentSink: Sink, streamingClient }] = await Promise.all([import('@sonoscope/sdk/runtime'), import('@sonoscope/danmu-pipeline')]);
      if (cancelled || !container.current) return;
      const experience = container.current.parentElement;
      const renderer = new Sink(container.current, { top: experience?.querySelector<HTMLElement>('header'), bottom: experience?.querySelector<HTMLElement>('footer') }); sink.current = renderer;
      const r = new Runtime({ sink: renderer, workletUrl: appPath('/audio/capture-worklet.js'),
        workerFactory: () => new Worker(new URL('../lib/workers/dsp.worker.ts', import.meta.url)),
        modelWorkerFactory: () => new Worker(new URL('../lib/workers/features.worker.ts', import.meta.url)),
        workerAssets: { wasmUrl: new URL(appPath('/vendor/mediapipe-audio-1.1.0/wasm'), location.origin).href, modelUrl: new URL(appPath('/model/yamnet-1.tflite'), location.origin).href, modelVersion: 'yamnet-float32-1-temporal-1' },
        generate: streamingClient(appPath('/api/danmu/stream')),
      });
      runtime.current = r;
      const sample = () => { if (!cancelled) setTelemetry({ model: latestFrame.current?.model ?? null, metrics: r.metrics.snapshot(Date.now()) }); };
      r.audio.subscribeState(state => {
        if (cancelled) return;
        setAudio(state); if (state.status !== 'running') latestFrame.current = null;
        if (telemetryTimer) clearInterval(telemetryTimer); telemetryTimer = undefined;
        sample(); if (state.status === 'running') telemetryTimer = setInterval(sample, 1000);
      });
      r.danmu.subscribe(setDanmu); r.features.onStatus(setAnalysis); r.features.onFrame(frame => { latestFrame.current = frame; });
      setReady(true);
      try { const response = await fetch(appPath('/api/runtime-config'), { signal: abort.signal }); const config = await response.json(); if (!cancelled) setAiAvailable(config.aiEnabled === true); } catch { /* local experience remains available */ }
    })().catch(() => { if (!cancelled) setAudio({ status: 'error', audioSessionId: null, capture: null, error: { code: 'init-failed', message: '声音引擎未能加载，请刷新后重试。' } }); });
    return () => { cancelled = true; abort.abort(); runtime.current?.dispose(); if (telemetryTimer) clearInterval(telemetryTimer); runtime.current = null; sink.current?.dispose(); sink.current = null; latestFrame.current = null; };
  }, [container]);
  useEffect(() => { sink.current?.setReducedMotion(reducedMotion); }, [reducedMotion, ready]);
  const start = useCallback(async (source?: AudioSource) => {
    try { await runtime.current?.start(source); } catch { /* AudioSession publishes actionable errors; cancelled starts stay silent. */ }
  }, []);
  const stop = useCallback(() => runtime.current?.stop(), []);
  const setDanmuEnabled = useCallback((value: boolean) => runtime.current?.setDanmuEnabled(value), []);
  const setCloudEnabled = useCallback((value: boolean) => runtime.current?.setCloudEnabled(value), []);
  const recordRender = useCallback((frame: FeatureFrame | null, at: number) => runtime.current?.metrics.rendered(frame, at), []);
  return { ready, audio, danmu, analysis, aiAvailable, latestFrame, telemetry, start, stop, setDanmuEnabled, setCloudEnabled, recordRender };
}
