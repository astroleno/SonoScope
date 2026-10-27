import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AudioInputStatus } from '../../app/components/audio-input-status';
import { frame } from './fixtures';

function monitor() {
  let stateListener: any, pcmListener: any, frameListener: any;
  const released = [vi.fn(), vi.fn(), vi.fn()];
  const value = {
    audio: { subscribeState: (fn: any) => { stateListener = fn; fn({ status: 'idle' }); return released[0]; }, onPCM: (fn: any) => { pcmListener = fn; return released[1]; } },
    features: { onFrame: (fn: any) => { frameListener = fn; return released[2]; } },
  } as any;
  return { value, released,
    state: (status = 'running', audioSessionId = 'mic') => stateListener({ status, audioSessionId }),
    pcm: (level: number, id = 'mic') => pcmListener(new Float32Array(1024).fill(level), 48000, 1, id, Date.now()),
    frame: (column: number, id = 'mic') => { const f = frame(); f.audioSessionId = id; f.capturedAt = Date.now(); f.values.bands.columns = Array.from({ length: 32 }, (_, i) => i === column ? .5 : 0); frameListener(f); },
  };
}
afterEach(() => { cleanup(); vi.useRealTimers(); });
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

it('shows real input level and changing DSP bands without synthetic activity, then clears on stop', () => {
  vi.useFakeTimers(); const m = monitor(), view = render(<AudioInputStatus monitor={m.value} />);
  expect(screen.queryByRole('meter')).toBeNull();
  act(() => { m.state(); m.pcm(.1); m.frame(1); }); advance(250);
  const meter = screen.getByRole('meter'); expect(Number(meter.getAttribute('aria-valuenow'))).toBeGreaterThan(0); expect(screen.getByText('已收到声音')).toBeTruthy();
  expect((meter.children[0] as HTMLElement).style.height).not.toBe('2px'); expect((meter.children[11] as HTMLElement).style.height).toBe('2px');
  act(() => { m.pcm(.1); m.frame(31); }); advance(250);
  expect((meter.children[0] as HTMLElement).style.height).toBe('2px'); expect((meter.children[11] as HTMLElement).style.height).not.toBe('2px');
  act(() => m.state('idle')); expect(screen.queryByRole('meter')).toBeNull(); view.unmount(); for (const release of m.released) expect(release).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
});
it('distinguishes no PCM, silent input, and recovery instead of claiming a working input', () => {
  vi.useFakeTimers(); const m = monitor(); render(<AudioInputStatus monitor={m.value} />);
  act(() => m.state()); advance(3000); expect(screen.getByText(/未收到声音数据/)).toBeTruthy(); expect(screen.getByRole('meter').getAttribute('aria-valuenow')).toBe('0');
  for (let i = 0; i < 13; i++) { act(() => m.pcm(0)); advance(250); }
  expect(screen.getByText(/暂未检测到明显声音/)).toBeTruthy();
  act(() => { m.pcm(.1); m.frame(4); }); advance(250); expect(screen.getByText('已收到声音')).toBeTruthy();
});
it('ignores another session and reports a stalled analysis or paused visual separately from live capture', () => {
  vi.useFakeTimers(); const m = monitor(), view = render(<AudioInputStatus monitor={m.value} />);
  act(() => { m.state(); m.pcm(.1, 'old'); m.frame(0, 'old'); }); advance(3000); expect(screen.getByText(/未收到声音数据/)).toBeTruthy();
  for (let i = 0; i < 4; i++) { act(() => m.pcm(.1)); advance(250); }
  expect(screen.getByText(/画面分析尚未就绪/)).toBeTruthy();
  act(() => { m.pcm(.1); m.frame(3); }); view.rerender(<AudioInputStatus monitor={m.value} paused />); advance(250);
  expect(screen.getByText('已收到声音 · 画面动态已暂停')).toBeTruthy();
});
