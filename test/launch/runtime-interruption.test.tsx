import { afterEach, expect, it, vi } from 'vitest';
import { SonoRuntime } from '../../packages/sdk/src/runtime';
afterEach(() => vi.restoreAllMocks());
it('ends a hidden live session and removes its page lifecycle listeners on disposal', () => {
  const runtime = new SonoRuntime({ feedbackMode: 'acoustic', sink: { show: () => true, clear() {} } });
  vi.spyOn(runtime.audio, 'current', 'get').mockReturnValue({ status: 'running', audioSessionId: 'test', capture: 'worklet', error: null });
  const stop = vi.spyOn(runtime, 'stop').mockImplementation(() => {});
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden'); document.dispatchEvent(new Event('visibilitychange'));
  expect(stop).toHaveBeenCalledExactlyOnceWith('page-hidden'); runtime.dispose();
  document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('pagehide')); expect(stop).toHaveBeenCalledOnce();
});
