'use client';

import { useEffect, useState } from 'react';
import type { SonoRuntime } from '@sonoscope/sdk';

type Signal = { state: 'idle' | 'waiting' | 'receiving' | 'silent' | 'missing' | 'analysing'; level: number; bands: number[] };
const emptySignal: Signal = { state: 'idle', level: 0, bands: Array(12).fill(0) };
type Monitor = Pick<SonoRuntime, 'audio' | 'features'>;

/** Observe the existing capture and DSP streams; never open a second microphone. */
export function AudioInputStatus({ monitor, paused = false }: { monitor: Monitor | null; paused?: boolean }) {
  const [signal, setSignal] = useState<Signal>(emptySignal);
  useEffect(() => {
    if (!monitor) return;
    let id: string | null = null, started = 0, lastPCM: number | null = null, lastFrame: number | null = null, lastSound = 0, peak = 0;
    let columns: number[] = [], timer: ReturnType<typeof setInterval> | undefined;
    const sample = () => {
      const now = performance.now();
      const freshPCM = lastPCM !== null && now - lastPCM < 2500;
      const freshFrame = lastFrame !== null && now - lastFrame < 2500;
      const state: Signal['state'] = !freshPCM ? now - started < 3000 ? 'waiting' : 'missing'
        : now - lastSound >= 3000 ? 'silent'
        : !freshFrame && now - started >= 3000 ? 'analysing' : 'receiving';
      const bands = emptySignal.bands.map((_, i) => {
        if (!freshPCM || !freshFrame) return 0;
        const start = Math.floor(i * columns.length / 12), end = Math.floor((i + 1) * columns.length / 12);
        let value = 0;
        for (let n = start; n < end; n++) value = Math.max(value, columns[n] ?? 0);
        return Math.min(1, Math.sqrt(Math.max(0, value)));
      });
      setSignal({ state, level: freshPCM ? Math.min(1, Math.sqrt(peak) * 2) : 0, bands }); peak = 0;
    };
    const unsubscribeState = monitor.audio.subscribeState(state => {
      if (timer) clearInterval(timer); timer = undefined;
      id = state.status === 'running' ? state.audioSessionId : null;
      lastPCM = lastFrame = null; columns = []; peak = 0;
      if (!id) { setSignal(emptySignal); return; }
      started = lastSound = performance.now();
      setSignal({ ...emptySignal, state: 'waiting' }); timer = setInterval(sample, 250);
    });
    const unsubscribePCM = monitor.audio.onPCM((pcm, _rate, _time, sessionId, capturedAt) => {
      if (sessionId !== id || !id || !pcm.length) return;
      let squares = 0;
      for (const value of pcm) squares += value * value;
      const rms = Math.sqrt(squares / pcm.length);
      lastPCM = performance.now() - Math.max(0, Date.now() - capturedAt);
      peak = Math.max(peak, rms); if (rms >= .002) lastSound = lastPCM;
    });
    const unsubscribeFrame = monitor.features.onFrame(frame => {
      if (frame.audioSessionId !== id || !id) return;
      lastFrame = performance.now() - Math.max(0, Date.now() - frame.capturedAt);
      columns = frame.values.bands.columns;
    });
    return () => { if (timer) clearInterval(timer); unsubscribeState(); unsubscribePCM(); unsubscribeFrame(); };
  }, [monitor]);
  if (signal.state === 'idle') return null;
  const label = signal.state === 'waiting' ? '正在检查声音输入…'
    : signal.state === 'missing' ? '未收到声音数据，请检查输入设备或停止后重试'
    : signal.state === 'silent' ? '暂未检测到明显声音，请检查麦克风静音或试着说话'
    : signal.state === 'analysing' ? '已收到声音，画面分析尚未就绪，请停止后重试'
    : paused ? '已收到声音 · 画面动态已暂停' : '已收到声音';
  return <div className="input-status" data-input-signal={signal.state}>
    <div className="input-spectrum" role="meter" aria-label="声音输入电平" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(signal.level * 100)}>
      {signal.bands.map((level, i) => <span key={i} style={{ height: `${2 + level * 22}px` }} />)}
    </div>
    <span role="status">{label}</span>
  </div>;
}
