import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { RecordingControls } from '../../app/components/recording-controls';
import { RecordingLibrary } from '../../app/components/recording-library';
import type { RecordingManifest } from '@sonoscope/core';
afterEach(cleanup);
it('distinguishes arming, saving, saved and failure without allowing a duplicate start', () => {
  const onStart = vi.fn(), onStop = vi.fn(), onLibrary = vi.fn(), state = { status: 'arming' as const, id: null, durationMs: 0, bytes: 0, pendingBytes: 0, message: null };
  const props = { running: true, supported: true, ready: true, onStart, onStop, onLibrary };
  const view = render(<RecordingControls state={state} {...props} />); fireEvent.click(screen.getByRole('button', { name: '取消录制准备' })); expect(onStop).toHaveBeenCalledOnce();
  view.rerender(<RecordingControls state={{ ...state, status: 'finalizing' }} {...props} />); expect((screen.getByRole('button', { name: '正在保存…' }) as HTMLButtonElement).disabled).toBe(true);
  view.rerender(<RecordingControls state={{ ...state, status: 'saved', durationMs: 15000 }} {...props} />); fireEvent.click(screen.getByRole('button', { name: '查看录播' })); expect(onLibrary).toHaveBeenCalledOnce();
  view.rerender(<RecordingControls state={{ ...state, status: 'error', message: '空间不足' }} {...props} />); expect(screen.getByRole('alert').textContent).toBe('空间不足'); expect(onStart).not.toHaveBeenCalled();
});
it('requires an explicit deletion choice and restores focus when the library closes', () => {
  const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus();
  const recording: RecordingManifest = { version: '1', id: 'take', title: '录播一', createdAt: 1, status: 'saved', durationMs: 10000, bytes: 12000, mimeType: 'audio/mp4', sampleRate: 48000, channels: 1, mediaStorage: 'opfs', lastEventSeq: 30, commentCount: 16, appVersion: '1', message: null };
  const onRemove = vi.fn(), onClose = vi.fn();
  const view = render(<RecordingLibrary recordings={[recording]} busy={null} message={null} activeRecordingId={null} onClose={onClose} onRemove={onRemove} onOpen={() => {}} onExport={() => {}} onRecover={() => {}} onRestore={() => {}} />);
  expect(screen.getByText(/16 条弹幕/)).toBeTruthy(); fireEvent.click(screen.getByRole('button', { name: '删除' })); expect(onRemove).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '保留' })); expect(onRemove).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: '删除' })); fireEvent.click(screen.getByRole('button', { name: '确认删除' })); expect(onRemove).toHaveBeenCalledExactlyOnceWith('take');
  view.unmount(); expect(document.activeElement).toBe(trigger); trigger.remove();
});
