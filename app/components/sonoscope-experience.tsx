'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PresetId } from '@sonoscope/core';
import { useSonoScope } from '../hooks/use-sonoscope';
import { useAccessibility } from './accessibility-provider';
import { FlipOptionList } from './flip-option-list';
import { ErrorBoundary } from './error-boundary';
import { RecordingControls } from './recording-controls';
import { RecordingLibrary } from './recording-library';
import { ReplayControls } from './replay-controls';
import { recordingTime } from '../lib/recording-format';
import { OfflineStatus } from './offline-status';

const Visualizer = dynamic(() => import('./visualizer'), { ssr: false });
const presets = [ { id: 'wave', label: 'Wave' }, { id: 'accretion', label: 'Accretion' }, { id: 'spiral', label: 'Spiral' }, { id: 'mosaic', label: 'Mosaic' }, { id: 'mochi', label: 'Mochi' } ];

export default function SonoScopeExperience({ initialPreset = 'wave', diagnostics = false }: { initialPreset?: PresetId; diagnostics?: boolean }) {
  const [preset, setPreset] = useState<PresetId>(initialPreset);
  const [danmuEnabled, setDanmuEnabled] = useState(true);
  const [spectrum, setSpectrum] = useState(false);
  const [cloud, setCloud] = useState(false);
  const [pausedMotion, setPausedMotion] = useState(false);
  const [notice, setNotice] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showRecordings, setShowRecordings] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const replayContainer = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const { reducedMotion } = useAccessibility();
  const session = useSonoScope(container, reducedMotion || pausedMotion, replayContainer);
  const { ready, aiAvailable, setDanmuEnabled: applyDanmu, setCloudEnabled: applyCloud } = session;
  const { refreshRecordings, setRecordingControls, openPlayback } = session;
  const running = session.audio.status === 'running', requesting = session.audio.status === 'requesting';
  const replaying = session.playback.id !== null;
  const recordingBusy = ['arming', 'recording', 'finalizing'].includes(session.recording.status);
  const shownPreset = replaying ? session.replayControls.preset : preset;
  const shownSpectrum = replaying ? session.replayControls.spectrum : spectrum;
  const motionPaused = reducedMotion || pausedMotion || replaying && (session.replayControls.pausedMotion || session.playback.status !== 'playing');
  const closeRecordings = useCallback(() => setShowRecordings(false), []);
  const openRecordings = useCallback(() => { void refreshRecordings(); setShowRecordings(true); }, [refreshRecordings]);
  const openRecording = useCallback(async (id: string) => { if (await openPlayback(id)) { setShowRecordings(false); setShowHistory(false); } }, [openPlayback]);
  useEffect(() => { if (!replaying) setRecordingControls({ preset, spectrum, pausedMotion, danmuEnabled }); }, [replaying, preset, spectrum, pausedMotion, danmuEnabled, setRecordingControls]);
  useEffect(() => { applyDanmu(danmuEnabled); }, [danmuEnabled, ready, applyDanmu]);
  useEffect(() => { applyCloud(cloud && aiAvailable); }, [cloud, aiAvailable, ready, applyCloud]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 1800); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (replaying || event.repeat || event.altKey || event.ctrlKey || event.metaKey || target?.closest('dialog') || target?.matches('input, textarea, select, [contenteditable="true"]')) return;
      const index = Number(event.key) - 1;
      if (index >= 0 && index < presets.length && /^\d$/.test(event.key)) { setPreset(presets[index].id as PresetId); setNotice(`画面：${presets[index].label}`); }
      if (event.key.toLowerCase() === 'd') { setDanmuEnabled(v => !v); setNotice('弹幕已切换'); }
      if (event.key.toLowerCase() === 's') { setSpectrum(v => !v); setNotice('频谱模式已切换'); }
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, [replaying]);
  const status = replaying ? session.playback.status === 'playing' ? '正在回看录播' : '录播回看' : requesting ? session.audio.sourceType === 'file' ? '正在加载音频' : '等待麦克风授权' : running ? '正在听声音' : session.audio.error ? '音频未启动' : '等待开始';
  const cloudLabel = session.danmu?.cloud === 'loading' ? 'AI 正在回应' : session.danmu?.cloud === 'error' || session.danmu?.cloud === 'limited' ? 'AI 暂不可用' : cloud ? 'AI 增强已开' : '本地反馈';
  return (
    <main className="experience" data-model-status={session.analysis.model} data-model-label={session.telemetry.model?.categories[0]?.label ?? ''} data-model-result={JSON.stringify(session.telemetry.model)} data-runtime-metrics={JSON.stringify(replaying ? session.replayMetrics : session.telemetry.metrics)} data-recording-state={JSON.stringify(session.recording)} data-playback-state={JSON.stringify(session.playback)}>
      <ErrorBoundary fallback={<div className="visual-error" role="alert">画面暂不可用。声音控制仍可操作，请切换预设或刷新。</div>}>
        <Visualizer audioLevel={0} running={running || replaying} preset={shownPreset} liveFrame={replaying ? session.replayFrame : session.latestFrame} onRendered={replaying ? session.recordReplayRender : session.recordRender} spectrumPriority={shownSpectrum} reducedMotion={motionPaused} playbackClock={replaying ? session.playbackClock : undefined} playbackRevision={session.replayRevision} />
      </ErrorBoundary>
      <div ref={container} className="danmu-layer" aria-hidden="true" />
      <div ref={replayContainer} className="danmu-layer replay-layer" aria-hidden="true" />
      <header className="experience-header">
        <div className="brand-row"><span className="wordmark">SonoScope<span className="brand-cn">声象</span></span><span className="status-indicator" data-active={running}>{status}</span></div>
        <FlipOptionList options={replaying ? presets.map(option => ({ ...option, disabled: true })) : presets} value={shownPreset} onChange={id => { setPreset(id as PresetId); setNotice(`画面：${presets.find(p => p.id === id)?.label ?? id}`); }} animation={motionPaused ? 'off' : 'auto'} aria-label={replaying ? '录播中的画面预设' : '画面预设'} className="preset-selector" />
      </header>
      {!running && !replaying && (
        <section className="start-panel" aria-labelledby="start-title">
          <p className="eyebrow">声音 · 画面 · 此刻</p>
          <h1 id="start-title">让声音有个形状</h1>
          <p className="start-description">开启麦克风，让画面和弹幕跟着声音回应。开始后可录下这一段，随时回看。</p>
          <p className="privacy-note">原始音频留在浏览器。开启 AI 时，仅发送声音特征与最近的弹幕。</p>
          {session.audio.error && <p className="audio-error" role="alert">{session.audio.error.message}</p>}
          <div className="start-actions">
            <button className="action-button primary-action" type="button" disabled={!session.ready || requesting || recordingBusy} onClick={() => { void session.start(); }}>{requesting ? session.audio.sourceType === 'file' ? '加载声音…' : '等待授权…' : session.audio.error ? '重试麦克风' : '开启麦克风'}</button>
            {requesting ? <button className="action-button" type="button" onClick={session.stop}>取消</button> : <button className="action-button" type="button" disabled={!session.ready || recordingBusy} onClick={() => fileInput.current?.click()}>选择音频文件</button>}
          </div>
        </section>
      )}
      <input ref={fileInput} className="sr-only" type="file" accept="audio/*" aria-label="选择音频文件" tabIndex={-1} onChange={event => { const file = event.target.files?.[0]; if (file) { session.stop(); void session.start({ type: 'file', file }); } event.target.value = ''; }} />
      <footer className="experience-footer">
        {replaying && <ReplayControls state={session.playback} onPlay={session.play} onPause={session.pause} onSeek={session.seek} onRate={session.setRate} onClose={session.closePlayback} />}
        <div className="toolbar" role="group" aria-label="声音与画面控制">
          {running && <button type="button" className="action-button" onClick={session.stop}>停止声音</button>}
          {!replaying && <><button type="button" className="action-button" aria-pressed={danmuEnabled} onClick={() => { setDanmuEnabled(v => !v); setNotice(danmuEnabled ? '弹幕已关' : '弹幕已开'); }}>弹幕 <span>{danmuEnabled ? '开' : '关'}</span></button>
          <button type="button" className="action-button" aria-pressed={spectrum} onClick={() => { setSpectrum(v => !v); setNotice(spectrum ? '频谱模式已关' : '频谱模式已开'); }}>频谱 <span>{spectrum ? '开' : '关'}</span></button>
          <button type="button" className="action-button" aria-pressed={cloud} disabled={!session.aiAvailable} title={session.aiAvailable ? '只发送声音特征' : 'AI 尚未开放，本地反馈照常工作'} onClick={() => { setCloud(v => !v); setNotice(cloud ? '已切换到本地反馈' : 'AI 增强已开'); }}>AI 增强 <span>{cloud ? '开' : '关'}</span></button></>}
          <button type="button" className="action-button" aria-pressed={pausedMotion} onClick={() => setPausedMotion(v => !v)}>{pausedMotion ? '恢复动态' : '暂停动态'}</button>
          <button type="button" className="action-button" aria-expanded={showHistory} aria-controls="comment-history" onClick={() => setShowHistory(v => !v)}>弹幕记录</button>
          <button type="button" className="action-button" aria-haspopup="dialog" onClick={openRecordings} disabled={!ready}>我的录播</button>
        </div>
        {!replaying && <RecordingControls state={session.recording} running={running} supported={session.recordingSupported} ready={ready} onStart={() => { void session.startRecording(); }} onStop={() => { void session.finishRecording(); }} onLibrary={openRecordings} />}
        <div className="footer-meta"><span>{replaying ? '同步读取原弹幕 · 不重新生成' : cloudLabel}{!replaying && !session.aiAvailable ? ' · AI 尚未开放' : ''}</span>{!replaying && <span className="keyboard-hint">1–5 切画面 · D 弹幕 · S 频谱</span>}</div>
        <OfflineStatus />
        {session.recordingMessage && !showRecordings && <p className="recording-note" role="status">{session.recordingMessage}</p>}
        {running && (session.analysis.message || session.danmu?.message) && <p className="service-note">{session.danmu?.message || session.analysis.message}</p>}
      </footer>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{notice || status}</p>
      {notice && <div className="toast" aria-hidden="true">{notice}</div>}
      {showHistory && <section id="comment-history" className="history-panel" aria-label={replaying ? '录播弹幕记录' : '最近弹幕'}><div className="history-heading"><h2>{replaying ? '录播弹幕记录' : '最近弹幕'}</h2><button type="button" className="action-button" onClick={() => setShowHistory(false)}>关闭记录</button></div>{replaying ? <><ol>{session.replayComments.map(c => <li key={c.seq}><button type="button" className="transcript-comment" onClick={() => session.seek(c.atMs)}><time>{recordingTime(c.atMs)}</time><span className="source-tag">{c.source === 'ai' ? 'AI' : '本地'}</span><span>{c.text}</span></button></li>)}</ol>{!session.replayComments.length && <p>这段录播没有已显示的弹幕。</p>}{session.hasMoreComments && <button type="button" className="action-button" onClick={session.loadMoreComments}>读取更多弹幕</button>}</> : session.danmu?.history.length ? <ol>{session.danmu.history.map(c => <li key={c.commentId}><span className="source-tag">{c.source === 'ai' ? 'AI' : '本地'}</span>{c.text}</li>)}</ol> : <p>开启声音与弹幕后，这里会保留最近 12 条记录。完整录播另行保存。</p>}</section>}
      {showRecordings && <RecordingLibrary recordings={session.recordings} busy={session.recordingBusy} message={session.recordingMessage ?? (session.playback.status === 'error' ? session.playback.message : null)} activeRecordingId={recordingBusy ? session.recording.id ?? 'preparing' : null} onClose={closeRecordings} onOpen={id => { void openRecording(id); }} onRemove={id => { void session.removeRecording(id); }} onExport={id => { void session.exportRecording(id); }} onRecover={id => { void session.recoverRecording(id); }} onRestore={file => { void session.restoreRecording(file); }} />}
      {diagnostics && <aside className="diagnostics" aria-label="运行诊断"><p>DSP：{session.analysis.dsp} · 模型：{session.analysis.model} · 采集：{session.audio.capture ?? '未开始'}</p><p>已显示：{session.danmu?.displayed ?? 0} · 排队：{session.danmu?.queued ?? 0} · 请求：{session.danmu?.pendingRequests ?? 0}</p><p>本地首条：{session.danmu?.metrics.localFirstMs ?? '—'} ms · AI 首条：{session.danmu?.metrics.aiFirstMs ?? '—'} ms</p></aside>}
    </main>
  );
}
