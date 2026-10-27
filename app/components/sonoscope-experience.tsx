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
import { AudioInputStatus } from './audio-input-status';
import { MicrophonePrompt } from './microphone-prompt';

const Visualizer = dynamic(() => import('./visualizer'), { ssr: false });
const presets = [ { id: 'wave', label: 'Wave' }, { id: 'accretion', label: 'Accretion' }, { id: 'spiral', label: 'Spiral' }, { id: 'mosaic', label: 'Mosaic' }, { id: 'mochi', label: 'Mochi' } ];

function MicrophoneIcon({ off }: { off: boolean }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" />{off && <path d="m3 3 18 18" />}</svg>;
}
function MoreIcon() {
  return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>;
}

export default function SonoScopeExperience({ initialPreset = 'wave', diagnostics = false }: { initialPreset?: PresetId; diagnostics?: boolean }) {
  const [preset, setPreset] = useState<PresetId>(initialPreset);
  const [danmuEnabled, setDanmuEnabled] = useState(true);
  const [spectrum, setSpectrum] = useState(false);
  const [cloud, setCloud] = useState(false);
  const [pausedMotion, setPausedMotion] = useState(false);
  const [notice, setNotice] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showRecordings, setShowRecordings] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [interfaceHidden, setInterfaceHidden] = useState(true);
  const [introOpen, setIntroOpen] = useState(true);
  const container = useRef<HTMLDivElement>(null);
  const replayContainer = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const { reducedMotion } = useAccessibility();
  const session = useSonoScope(container, reducedMotion || pausedMotion, replayContainer);
  const { ready, aiAvailable, setDanmuEnabled: applyDanmu, setCloudEnabled: applyCloud, start: startAudio, stop: stopAudio } = session;
  const audioSourceType = session.audio.sourceType;
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
  const toggleInterface = useCallback(() => { setShowHistory(false); setToolsOpen(false); setInterfaceHidden(value => !value); }, []);
  const toggleMicrophone = useCallback(() => {
    if (running || requesting) { stopAudio(); return; }
    if (session.audio.error?.code === 'init-failed') { location.reload(); return; }
    if (ready && !recordingBusy && !replaying) { setIntroOpen(false); void startAudio(); }
  }, [running, requesting, stopAudio, session.audio.error?.code, ready, recordingBusy, replaying, startAudio]);
  const selectPreset = useCallback((id: string) => {
    if (!ready || requesting || replaying || recordingBusy && !running) return;
    if (running && audioSourceType !== 'file' && id === preset) { stopAudio(); setNotice('麦克风已关闭'); return; }
    setPreset(id as PresetId); setNotice(`画面：${presets.find(option => option.id === id)?.label ?? id}`);
    if (!running) void startAudio();
  }, [ready, requesting, replaying, recordingBusy, running, audioSourceType, startAudio, stopAudio, preset]);
  useEffect(() => {
    if (!introOpen) menuButton.current?.focus();
  }, [interfaceHidden, introOpen]);
  useEffect(() => { if (!replaying) setRecordingControls({ preset, spectrum, pausedMotion, danmuEnabled }); }, [replaying, preset, spectrum, pausedMotion, danmuEnabled, setRecordingControls]);
  useEffect(() => { applyDanmu(danmuEnabled); }, [danmuEnabled, ready, applyDanmu]);
  useEffect(() => { applyCloud(cloud && aiAvailable); }, [cloud, aiAvailable, ready, applyCloud]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 1800); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (introOpen || event.repeat || event.altKey || event.ctrlKey || event.metaKey || target?.closest('dialog') || target?.matches('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key.toLowerCase() === 'h') { toggleInterface(); return; }
      if (event.key === 'Escape') { if (showHistory) setShowHistory(false); else if (toolsOpen) setToolsOpen(false); else setInterfaceHidden(true); return; }
      if (replaying) return;
      const index = Number(event.key) - 1;
      if (index >= 0 && index < presets.length && /^\d$/.test(event.key)) selectPreset(presets[index].id);
      if (event.key.toLowerCase() === 'd') { setDanmuEnabled(v => !v); setNotice('弹幕已切换'); }
      if (event.key.toLowerCase() === 's') { setSpectrum(v => !v); setNotice('频谱模式已切换'); }
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, [replaying, selectPreset, toggleInterface, showHistory, toolsOpen, introOpen]);
  const status = replaying ? session.playback.status === 'playing' ? '正在回看录播' : '录播回看' : requesting ? session.audio.sourceType === 'file' ? '正在加载音频' : '等待麦克风授权' : running ? session.audio.sourceType === 'file' ? '正在播放音频' : '麦克风已开启' : session.audio.error ? '音频未启动' : ready ? '麦克风未开启' : '正在准备声音…';
  const cloudLabel = session.danmu?.cloud === 'loading' ? 'AI 正在回应' : session.danmu?.cloud === 'error' || session.danmu?.cloud === 'limited' ? 'AI 暂不可用' : cloud ? 'AI 增强已开' : '本地反馈';
  const microphoneLabel = replaying ? '回看期间不可开启麦克风' : requesting ? '取消启动' : running ? audioSourceType === 'file' ? '停止声音' : '关闭麦克风' : session.audio.error?.code === 'init-failed' ? '重新加载声音' : session.audio.error ? '重试麦克风' : !ready ? '声音准备中…' : '开启麦克风';
  return (
    <main className="experience" data-interface-hidden={interfaceHidden} data-audio-status={session.audio.status} data-model-status={session.analysis.model} data-model-label={session.telemetry.model?.categories[0]?.label ?? ''} data-model-result={JSON.stringify(session.telemetry.model)} data-runtime-metrics={JSON.stringify(replaying ? session.replayMetrics : session.telemetry.metrics)} data-recording-state={JSON.stringify(session.recording)} data-playback-state={JSON.stringify(session.playback)}>
      <h1 className="sr-only">SonoScope · 让声音有个形状</h1>
      <ErrorBoundary fallback={<div className="visual-error" role="alert">画面暂不可用。声音控制仍可操作，请切换预设或刷新。</div>}>
        <Visualizer audioLevel={0} running={running || replaying} preset={shownPreset} liveFrame={replaying ? session.replayFrame : session.latestFrame} onRendered={replaying ? session.recordReplayRender : session.recordRender} spectrumPriority={shownSpectrum} reducedMotion={motionPaused} playbackClock={replaying ? session.playbackClock : undefined} playbackRevision={session.replayRevision} />
      </ErrorBoundary>
      <div ref={container} className="danmu-layer" aria-hidden="true" />
      <div ref={replayContainer} className="danmu-layer replay-layer" aria-hidden="true" />
      <div className="experience-top" data-danmu-top-boundary>
      <div className="corner-controls" role="group" aria-label="快捷控制">
        <button type="button" className="corner-icon" data-active={running} aria-label={microphoneLabel} title={microphoneLabel} aria-pressed={running} aria-busy={requesting} disabled={replaying || !running && !requesting && session.audio.error?.code !== 'init-failed' && (!ready || recordingBusy)} onClick={toggleMicrophone}><MicrophoneIcon off={!running && !requesting} /></button>
        <button ref={menuButton} type="button" className="corner-icon" aria-label={interfaceHidden ? '显示界面' : '隐藏界面'} title={interfaceHidden ? '显示界面' : '隐藏界面'} aria-expanded={!interfaceHidden} aria-controls="experience-header experience-footer" onClick={toggleInterface}><MoreIcon /></button>
      </div>
      <header id="experience-header" className="experience-header" hidden={interfaceHidden}>
        <div className="brand-row"><span className="wordmark">SonoScope<span className="brand-cn">声象</span></span></div>
        <FlipOptionList options={presets.map(option => ({ ...option, disabled: replaying || !ready || requesting || recordingBusy && !running }))} value={shownPreset} onChange={selectPreset} animation={motionPaused ? 'off' : 'auto'} aria-label={replaying ? '录播中的画面预设' : '画面预设'} className="preset-selector" />
      </header>
      </div>
      <input ref={fileInput} hidden type="file" accept="audio/*" aria-label="选择音频文件" tabIndex={-1} onChange={event => { const file = event.target.files?.[0]; if (file) { session.stop(); void session.start({ type: 'file', file }); } event.target.value = ''; }} />
      <footer id="experience-footer" className="experience-footer" hidden={interfaceHidden}>
        <div className="dock-row">
          <button type="button" className="action-button tools-toggle" aria-expanded={toolsOpen} aria-controls="experience-tools" onClick={() => setToolsOpen(value => !value)}>{toolsOpen ? '收起工具' : '工具'}<span aria-hidden="true">{toolsOpen ? '−' : '+'}</span></button>
          {!replaying && <AudioInputStatus monitor={session.inputMonitor} paused={motionPaused} />}
        </div>
        {!running && !requesting && !replaying && !session.audio.error && ready && <p className="input-guidance">点选上方画面即可开启麦克风，再点当前画面可关闭。</p>}
        {requesting && <p className="input-guidance" role="status">{session.audio.sourceType === 'file' ? '正在读取音频文件…' : '请在浏览器中允许麦克风。没有弹出提示时，请检查地址栏的网站设置。'}</p>}
        {session.audio.error && <p className="audio-error" role="alert">{session.audio.error.message}</p>}
        {replaying && <ReplayControls state={session.playback} onPlay={session.play} onPause={session.pause} onSeek={session.seek} onRate={session.setRate} onClose={session.closePlayback} />}
        <section id="experience-tools" className="tools-panel" aria-label="声音与画面工具" hidden={!toolsOpen}>
        <div className="toolbar" role="group" aria-label="声音与画面控制">
          {!replaying && <button className="action-button" type="button" disabled={!ready || requesting || recordingBusy} onClick={() => fileInput.current?.click()}>选择音频文件</button>}
          {!replaying && <><button type="button" className="action-button" aria-pressed={danmuEnabled} onClick={() => { setDanmuEnabled(v => !v); setNotice(danmuEnabled ? '弹幕已关' : '弹幕已开'); }}>弹幕 <span>{danmuEnabled ? '开' : '关'}</span></button>
          <button type="button" className="action-button" aria-pressed={spectrum} onClick={() => { setSpectrum(v => !v); setNotice(spectrum ? '频谱模式已关' : '频谱模式已开'); }}>频谱 <span>{spectrum ? '开' : '关'}</span></button>
          <button type="button" className="action-button" aria-pressed={cloud} disabled={!session.aiAvailable} title={session.aiAvailable ? '只发送声音特征' : 'AI 尚未开放，本地反馈照常工作'} onClick={() => { setCloud(v => !v); setNotice(cloud ? '已切换到本地反馈' : 'AI 增强已开'); }}>AI 增强 <span>{cloud ? '开' : '关'}</span></button></>}
          <button type="button" className="action-button" aria-pressed={reducedMotion || pausedMotion} disabled={reducedMotion} onClick={() => setPausedMotion(v => !v)}>{reducedMotion ? '系统已减少动态' : pausedMotion ? '恢复动态' : '暂停动态'}</button>
          <button type="button" className="action-button" aria-expanded={showHistory} aria-controls="comment-history" onClick={() => setShowHistory(v => !v)}>弹幕记录</button>
          <button type="button" className="action-button" aria-haspopup="dialog" onClick={openRecordings} disabled={!ready}>我的录播</button>
        </div>
        <p className="privacy-note">原始音频留在浏览器。开启 AI 时，仅发送声音特征与最近的弹幕。</p>
        <div className="footer-meta"><span>{replaying ? '同步读取原弹幕 · 不重新生成' : cloudLabel}{!replaying && !session.aiAvailable ? ' · AI 尚未开放' : ''}</span><span className="keyboard-hint">1–5 切画面 · D 弹幕 · S 频谱 · H 隐藏界面</span></div>
        </section>
        {!replaying && (toolsOpen || recordingBusy || ['saved', 'error'].includes(session.recording.status)) && <RecordingControls compact={!toolsOpen} state={session.recording} running={running} supported={session.recordingSupported} ready={ready} onStart={() => { void session.startRecording(); }} onStop={() => { void session.finishRecording(); }} onLibrary={openRecordings} />}
        <div className="offline-indicator"><OfflineStatus /></div>
        {session.recordingMessage && !showRecordings && <p className="recording-note" role="status">{session.recordingMessage}</p>}
        {running && (session.analysis.message || session.danmu?.message) && <p className="service-note">{session.danmu?.message || session.analysis.message}</p>}
      </footer>
      {interfaceHidden && !introOpen && (requesting || session.audio.error) && <div className="corner-feedback">
        {session.audio.error ? <p className="audio-error" role="alert">{session.audio.error.message}</p> : <p role="status">{audioSourceType === 'file' ? '正在读取音频文件…' : '请在浏览器中允许麦克风。没有弹出提示时，请检查地址栏的网站设置。'}</p>}
      </div>}
      {interfaceHidden && recordingBusy && <div className="hidden-controls">
        {recordingBusy && <RecordingControls compact state={session.recording} running={running} supported={session.recordingSupported} ready={ready} onStart={() => {}} onStop={() => { void session.finishRecording(); }} onLibrary={openRecordings} />}
      </div>}
      {introOpen && <MicrophonePrompt ready={ready} failed={session.audio.error?.code === 'init-failed'} onAllow={() => { setIntroOpen(false); toggleMicrophone(); }} onDismiss={() => setIntroOpen(false)} />}
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{notice || status}</p>
      {notice && <div className="toast" aria-hidden="true">{notice}</div>}
      {showHistory && <section id="comment-history" className="history-panel" aria-label={replaying ? '录播弹幕记录' : '最近弹幕'}><div className="history-heading"><h2>{replaying ? '录播弹幕记录' : '最近弹幕'}</h2><button type="button" className="action-button" onClick={() => setShowHistory(false)}>关闭记录</button></div>{replaying ? <><ol>{session.replayComments.map(c => <li key={c.seq}><button type="button" className="transcript-comment" onClick={() => session.seek(c.atMs)}><time>{recordingTime(c.atMs)}</time><span className="source-tag">{c.source === 'ai' ? 'AI' : '本地'}</span><span>{c.text}</span></button></li>)}</ol>{!session.replayComments.length && <p>这段录播没有已显示的弹幕。</p>}{session.hasMoreComments && <button type="button" className="action-button" onClick={session.loadMoreComments}>读取更多弹幕</button>}</> : session.danmu?.history.length ? <ol>{session.danmu.history.map(c => <li key={c.commentId}><span className="source-tag">{c.source === 'ai' ? 'AI' : '本地'}</span>{c.text}</li>)}</ol> : <p>开启声音与弹幕后，这里会保留最近 12 条记录。完整录播另行保存。</p>}</section>}
      {showRecordings && <RecordingLibrary recordings={session.recordings} busy={session.recordingBusy} message={session.recordingMessage ?? (session.playback.status === 'error' ? session.playback.message : null)} activeRecordingId={recordingBusy ? session.recording.id ?? 'preparing' : null} onClose={closeRecordings} onOpen={id => { void openRecording(id); }} onRemove={id => { void session.removeRecording(id); }} onExport={id => { void session.exportRecording(id); }} onRecover={id => { void session.recoverRecording(id); }} onRestore={file => { void session.restoreRecording(file); }} />}
      {diagnostics && <aside className="diagnostics" aria-label="运行诊断"><p>DSP：{session.analysis.dsp} · 模型：{session.analysis.model} · 采集：{session.audio.capture ?? '未开始'}</p><p>已显示：{session.danmu?.displayed ?? 0} · 排队：{session.danmu?.queued ?? 0} · 请求：{session.danmu?.pendingRequests ?? 0}</p><p>本地首条：{session.danmu?.metrics.localFirstMs ?? '—'} ms · AI 首条：{session.danmu?.metrics.aiFirstMs ?? '—'} ms</p></aside>}
    </main>
  );
}
