'use client';
import { useEffect, useRef, useState } from 'react';
import type { RecordingManifest } from '@sonoscope/core';
import { recordingTime, recordingSize } from '../lib/recording-format';
const statusLabels = { saved: '已保存', interrupted: '中断内容', failed: '需检查', recording: '未完成', finalizing: '未完成', deleting: '正在删除' };
interface Props { recordings: RecordingManifest[]; busy: string | null; message: string | null; activeRecordingId: string | null; onClose(): void; onOpen(id: string): void; onRemove(id: string): void; onExport(id: string): void; onRecover(id: string): void; onRestore(file: File): void }
export function RecordingLibrary({ recordings, busy, message, activeRecordingId, onClose, onOpen, onRemove, onExport, onRecover, onRestore }: Props) {
  const dialog = useRef<HTMLDialogElement>(null), input = useRef<HTMLInputElement>(null), close = useRef(onClose);
  const [confirming, setConfirming] = useState<string | null>(null), [limit, setLimit] = useState(30);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    const element = dialog.current, previous = document.activeElement as HTMLElement | null;
    if (!element) return;
    if (element.showModal) element.showModal(); else element.setAttribute('open', '');
    element.querySelector<HTMLButtonElement>('button')?.focus();
    return () => { if (element.close) element.close(); previous?.focus(); };
  }, []);
  return <dialog ref={dialog} className="recording-library" aria-labelledby="recordings-title" onCancel={event => { event.preventDefault(); close.current(); }}>
    <header className="recordings-heading"><div><p className="eyebrow">保留这一段</p><h2 id="recordings-title">我的录播</h2></div><button type="button" className="action-button" onClick={onClose}>关闭录播库</button></header>
    <p className="recordings-description">声音、弹幕和画面状态保存在当前设备与浏览器。建议导出备份后再清理站点数据。</p>
    <div className="recordings-actions"><button type="button" className="action-button" disabled={!!busy || !!activeRecordingId} onClick={() => input.current?.click()}>导入 SS 备份</button><span>{recordings.length} 段录播</span></div>
    <input ref={input} type="file" className="sr-only" accept=".zip,.ssrec,application/zip" aria-label="选择 SS 录播备份" onChange={event => { const file = event.target.files?.[0]; if (file) onRestore(file); event.target.value = ''; }} />
    {message && <p className="recording-note" role="status">{message}</p>}
    {busy && <p className="recording-note" role="status">{busy.startsWith('export:') ? '正在整理备份…' : busy === 'restore' ? '正在恢复备份…' : busy.startsWith('recover:') ? '正在检查中断材料…' : busy.startsWith('remove:') ? '正在删除…' : '正在打开录播…'}</p>}
    {!recordings.length ? <p className="recordings-empty">还没有录播。开启声音后，点击“开始录制”保留这一段。</p> : <ol className="recordings-list">{recordings.slice(0, limit).map(recording => {
      const active = recording.id === activeRecordingId, playable = ['saved', 'interrupted'].includes(recording.status) && recording.bytes > 0;
      return <li key={recording.id}><div className="recording-row-heading"><h3>{recording.title}</h3><span className="recording-badge">{active ? '正在录制／保存' : statusLabels[recording.status]}</span></div>
        <p className="recording-row-meta">{recordingTime(recording.durationMs)} · {recordingSize(recording.bytes)} · {recording.commentCount} 条弹幕</p>
        {recording.message && <p className="recording-row-message">{recording.message}</p>}
        <div className="recording-row-actions">
          {playable && <><button type="button" className="action-button primary-action" disabled={!!busy || !!activeRecordingId} onClick={() => onOpen(recording.id)}>回看</button><button type="button" className="action-button" disabled={!!busy || active} onClick={() => onExport(recording.id)}>导出备份</button></>}
          {!playable && recording.bytes > 0 && !active && <button type="button" className="action-button" disabled={!!busy || !!activeRecordingId} onClick={() => onRecover(recording.id)}>检查可恢复内容</button>}
          {confirming === recording.id ? <><span className="delete-confirmation">删除后需通过备份恢复。</span><button type="button" className="action-button" disabled={!!busy || active} onClick={() => { onRemove(recording.id); setConfirming(null); }}>确认删除</button><button type="button" className="text-button" onClick={() => setConfirming(null)}>保留</button></> : <button type="button" className="text-button" disabled={!!busy || active} onClick={() => setConfirming(recording.id)}>删除</button>}
        </div></li>;
    })}</ol>}
    {recordings.length > limit && <button type="button" className="action-button" onClick={() => setLimit(value => value + 30)}>显示更多录播</button>}
  </dialog>;
}
