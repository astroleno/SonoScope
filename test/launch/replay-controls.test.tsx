import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ReplayControls } from '../../app/components/replay-controls';
import type { PlaybackState } from '../../packages/sdk/src/playback-controller';
afterEach(cleanup);
const state: PlaybackState = { status: 'paused', id: 'take', title: '这一段', positionMs: 1000, durationMs: 30000, rate: 1, message: null };
it('seeks once after a touch drag, supports keyboard changes, and keeps playback actions separate', () => {
  const onSeek = vi.fn(), onPlay = vi.fn(), onPause = vi.fn(), onRate = vi.fn(), onClose = vi.fn();
  const props = { onSeek, onPlay, onPause, onRate, onClose };
  const view = render(<ReplayControls state={state} {...props} />), range = screen.getByRole('slider');
  fireEvent.pointerDown(range); fireEvent.change(range, { target: { value: '9000' } }); fireEvent.change(range, { target: { value: '15000' } }); expect(onSeek).not.toHaveBeenCalled();
  fireEvent.pointerUp(range); expect(onSeek).toHaveBeenCalledExactlyOnceWith(15000);
  fireEvent.change(range, { target: { value: '16000' } }); expect(onSeek).toHaveBeenLastCalledWith(16000);
  fireEvent.click(screen.getByRole('button', { name: '播放' })); expect(onPlay).toHaveBeenCalledOnce();
  fireEvent.change(screen.getByLabelText('播放速度'), { target: { value: '2' } }); expect(onRate).toHaveBeenCalledWith(2);
  view.rerender(<ReplayControls state={{ ...state, status: 'playing' }} {...props} />); fireEvent.click(screen.getByRole('button', { name: '暂停' })); expect(onPause).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: '结束回看' })); expect(onClose).toHaveBeenCalledOnce();
});
it('cancels an interrupted drag without submitting an unintended position', () => {
  const onSeek = vi.fn(); render(<ReplayControls state={state} onSeek={onSeek} onPlay={() => {}} onPause={() => {}} onRate={() => {}} onClose={() => {}} />);
  const range = screen.getByRole('slider'); fireEvent.pointerDown(range); fireEvent.change(range, { target: { value: '9000' } }); fireEvent.pointerCancel(range); fireEvent.pointerUp(range);
  expect(onSeek).not.toHaveBeenCalled(); expect((range as HTMLInputElement).value).toBe('1000');
});
