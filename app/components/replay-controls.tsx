'use client';
import { useRef, useState } from 'react';
import type { PlaybackState } from '@sonoscope/sdk';
import { recordingTime } from '../lib/recording-format';
export function ReplayControls({ state, onPlay, onPause, onSeek, onRate, onClose }: { state: PlaybackState; onPlay(): void; onPause(): void; onSeek(value: number): void; onRate(value: number): void; onClose(): void }) {
  const [draft, setDraft] = useState<number | null>(null), dragging = useRef(false), draftRef = useRef<number | null>(null);
  const playing = state.status === 'playing', loading = ['loading', 'buffering'].includes(state.status);
  const commit = () => { dragging.current = false; if (draftRef.current !== null) onSeek(draftRef.current); draftRef.current = null; setDraft(null); };
  return <div className="replay-controls" aria-label="录播播放控制">
    <div className="replay-heading"><span className="replay-label">录播回看</span><span className="replay-title">{state.title || '正在打开录播'}</span><button type="button" className="text-button" onClick={onClose}>结束回看</button></div>
    <div className="replay-transport">
      <button type="button" className="action-button" onClick={playing ? onPause : onPlay} disabled={loading || state.status === 'error'}>{playing ? '暂停' : state.status === 'ended' ? '重播' : loading ? '载入片段…' : '播放'}</button>
      <span className="replay-time" aria-live="off">{recordingTime(draft ?? state.positionMs)} / {recordingTime(state.durationMs)}</span>
      <label className="replay-rate">速度<select aria-label="播放速度" value={state.rate} onChange={event => onRate(Number(event.target.value))}>{[.5, 1, 1.5, 2].map(rate => <option key={rate} value={rate}>{rate}×</option>)}</select></label>
    </div>
    <label className="replay-progress"><span className="sr-only">播放进度</span><input type="range" min={0} max={Math.max(1, state.durationMs)} step={100} value={draft ?? state.positionMs} disabled={state.status === 'loading' || state.status === 'error'} aria-valuetext={recordingTime(draft ?? state.positionMs)} onPointerDown={() => { dragging.current = true; }} onPointerUp={commit} onPointerCancel={() => { dragging.current = false; draftRef.current = null; setDraft(null); }} onBlur={() => { if (dragging.current) commit(); }} onChange={event => { const value = Number(event.target.value); if (dragging.current) { draftRef.current = value; setDraft(value); } else onSeek(value); }} /></label>
    {state.message && <p className="recording-note" role={state.status === 'error' ? 'alert' : 'status'}>{state.message}</p>}
  </div>;
}
