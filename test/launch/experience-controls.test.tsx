import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SonoScopeExperience from '../../app/components/sonoscope-experience';

const mock = vi.hoisted(() => ({ session: {} as any }));
vi.mock('../../app/hooks/use-sonoscope', () => ({ useSonoScope: () => mock.session }));
vi.mock('../../app/node_modules/next/dynamic', () => ({ default: () => () => null }));
beforeEach(() => {
  mock.session = {
    ready: true, aiAvailable: false, audio: { status: 'idle', error: null, sourceType: 'device' }, analysis: {}, telemetry: {}, inputMonitor: null,
    playback: { status: 'idle', id: null }, recording: { status: 'idle', durationMs: 0 }, replayControls: {},
    start: vi.fn().mockResolvedValue(undefined), stop: vi.fn(), setDanmuEnabled: vi.fn(), setCloudEnabled: vi.fn(),
    refreshRecordings: vi.fn(), setRecordingControls: vi.fn(), openPlayback: vi.fn(), recordingSupported: true, finishRecording: vi.fn().mockResolvedValue(undefined),
  };
});
afterEach(cleanup);

function dismissPrompt() { fireEvent.click(screen.getByRole('button', { name: '先看看' })); }
function showInterface() { dismissPrompt(); fireEvent.click(screen.getByRole('button', { name: '显示界面' })); }

it('asks before using the microphone and defaults to only two icon controls', () => {
  render(<SonoScopeExperience />);
  expect(screen.getByRole('dialog', { name: '开启麦克风？' })).toBeTruthy();
  expect(mock.session.start).not.toHaveBeenCalled(); expect(screen.queryByRole('radiogroup')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '允许麦克风' }));
  expect(mock.session.start).toHaveBeenCalledOnce(); expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.queryByRole('radiogroup')).toBeNull();
  const controls = screen.getByRole('group', { name: '快捷控制' });
  expect(controls.querySelectorAll('button')).toHaveLength(2);
  for (const button of controls.querySelectorAll('button')) { expect(button.querySelector('svg')).toBeTruthy(); expect(button.textContent).toBe(''); }
});
it('can skip or cancel the entry prompt without requesting microphone access', () => {
  const view = render(<SonoScopeExperience />); dismissPrompt();
  expect(mock.session.start).not.toHaveBeenCalled(); expect(screen.queryByRole('dialog')).toBeNull(); expect(screen.queryByRole('radiogroup')).toBeNull();
  view.unmount(); render(<SonoScopeExperience />);
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
  expect(screen.queryByRole('dialog')).toBeNull(); expect(mock.session.start).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '开启麦克风' })); expect(mock.session.start).toHaveBeenCalledOnce();
});

it('starts capture from a preset, changes visuals without a second capture, and stops from the current preset', () => {
  const view = render(<SonoScopeExperience />);
  showInterface();
  fireEvent.click(screen.getByRole('radio', { name: 'Wave' })); expect(mock.session.start).toHaveBeenCalledOnce();
  mock.session.audio = { status: 'running', error: null, sourceType: 'device' }; view.rerender(<SonoScopeExperience />);
  fireEvent.click(screen.getByRole('radio', { name: 'Accretion' })); expect(mock.session.start).toHaveBeenCalledOnce(); expect(mock.session.stop).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('radio', { name: 'Accretion' })); expect(mock.session.stop).toHaveBeenCalledOnce();
});
it('defaults to a clear canvas, keeps tools out of the tab order until expanded, and supports a full hide/restore', () => {
  render(<SonoScopeExperience />);
  dismissPrompt();
  expect(screen.queryByRole('radiogroup')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '显示界面' }));
  expect(document.querySelector('.start-panel')).toBeNull(); expect(screen.queryByRole('button', { name: '选择音频文件' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '工具' })); expect(screen.getByRole('button', { name: '选择音频文件' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '收起工具' })); expect(screen.queryByRole('button', { name: '选择音频文件' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '隐藏界面' }));
  expect(screen.queryByRole('radiogroup')).toBeNull(); expect(document.activeElement).toBe(screen.getByRole('button', { name: '显示界面' }));
  fireEvent.click(screen.getByRole('button', { name: '显示界面' }));
  expect(screen.getByRole('radiogroup')).toBeTruthy(); expect(document.activeElement).toBe(screen.getByRole('button', { name: '隐藏界面' })); expect(mock.session.stop).not.toHaveBeenCalled();
});
it('keeps stop-and-save reachable while tools or the whole interface are hidden', () => {
  mock.session.audio = { status: 'running', error: null }; mock.session.recording = { status: 'recording', durationMs: 2000, bytes: 1024 };
  render(<SonoScopeExperience />);
  showInterface();
  expect(screen.getByRole('button', { name: '停止并保存' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '隐藏界面' }));
  fireEvent.click(screen.getByRole('button', { name: '停止并保存' })); expect(mock.session.finishRecording).toHaveBeenCalledOnce();
  expect(screen.getByRole('button', { name: '关闭麦克风' })).toBeTruthy(); expect(mock.session.stop).not.toHaveBeenCalled();
});
it('shows pending permission guidance, permits cancellation, and keeps a later failure actionable even after hiding', () => {
  mock.session.audio = { status: 'requesting', error: null, sourceType: 'device' };
  const view = render(<SonoScopeExperience />);
  dismissPrompt();
  expect(screen.getAllByRole('status').some(node => node.textContent?.includes('没有弹出提示'))).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: '取消启动' })); expect(mock.session.stop).toHaveBeenCalledOnce();
  mock.session.audio = { status: 'error', error: { code: 'permission-denied', message: '请在网站设置中允许麦克风，再点重试。' } }; view.rerender(<SonoScopeExperience />);
  expect(screen.getByRole('alert').textContent).toContain('网站设置'); expect(screen.getByRole('button', { name: '重试麦克风' })).toBeTruthy();
});
it('keeps file playback independent from a microphone toggle and blocks preset actions until ready', () => {
  mock.session.ready = false; const view = render(<SonoScopeExperience />);
  expect(screen.getAllByRole('button', { name: '声音准备中…' }).every(button => button.hasAttribute('disabled'))).toBe(true);
  showInterface();
  fireEvent.click(screen.getByRole('radio', { name: 'Wave' })); expect(mock.session.start).not.toHaveBeenCalled();
  mock.session.ready = true; mock.session.audio = { status: 'running', error: null, sourceType: 'file' }; view.rerender(<SonoScopeExperience />);
  fireEvent.click(screen.getByRole('radio', { name: 'Wave' })); expect(mock.session.stop).not.toHaveBeenCalled(); expect(mock.session.start).not.toHaveBeenCalled();
});

it('closes the expanded interface with Escape and toggles it with H without starting capture', () => {
  render(<SonoScopeExperience />); showInterface();
  fireEvent.keyDown(window, { key: 'Escape' }); expect(screen.queryByRole('radiogroup')).toBeNull();
  fireEvent.keyDown(window, { key: 'h' }); expect(screen.getByRole('radiogroup')).toBeTruthy();
  fireEvent.keyDown(window, { key: 'h' }); expect(screen.queryByRole('radiogroup')).toBeNull();
  expect(mock.session.start).not.toHaveBeenCalled();
});
