'use client';
import type { RecordingState } from '@sonoscope/sdk';
import { recordingTime, recordingSize } from '../lib/recording-format';
export function RecordingControls({ state, running, supported, ready, onStart, onStop, onLibrary }: { state: RecordingState; running: boolean; supported: boolean; ready: boolean; onStart(): void; onStop(): void; onLibrary(): void }) {
  const busy = ['arming', 'finalizing'].includes(state.status), recording = state.status === 'recording';
  return <div className="recording-controls">
    {state.status === 'arming' ? <button type="button" className="action-button" onClick={onStop}>取消录制准备</button> :
      <button type="button" className={`action-button${recording ? ' is-recording' : ''}`} disabled={!ready || !supported || !running || busy} onClick={recording ? onStop : onStart} title={!supported ? '此浏览器暂不支持本地录播' : !running ? '先开启声音，再录制这一段' : undefined}>{state.status === 'finalizing' ? '正在保存…' : recording ? '停止并保存' : '开始录制'}</button>}
    {recording && <span className="recording-status" role="status"><span className="recording-dot" />正在录制 {recordingTime(state.durationMs)}<span className="recording-bytes"> · {recordingSize(state.bytes)}</span></span>}
    {state.status === 'saved' && <span className="recording-status">已保存 {recordingTime(state.durationMs)} <button type="button" className="text-button" onClick={onLibrary}>查看录播</button></span>}
    {state.message && <p className="recording-note" role={state.status === 'error' ? 'alert' : 'status'}>{state.message}</p>}
  </div>;
}
