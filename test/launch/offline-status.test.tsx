import { MessageChannel } from 'node:worker_threads';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { OfflineStatus } from '../../app/components/offline-status';

afterEach(() => {
  cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'serviceWorker'); Reflect.deleteProperty(navigator, 'onLine');
});
function browser({ ready = true, offline = false, registerFails = false } = {}) {
  vi.stubEnv('NODE_ENV', 'production'); vi.stubGlobal('isSecureContext', true); vi.stubGlobal('MessageChannel', MessageChannel);
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: !offline });
  const active = Object.assign(new EventTarget(), {
    scriptURL: new URL('/SonoScope/sonoscope-sw.js', location.origin).href,
    postMessage: vi.fn((_message: unknown, ports: { postMessage(data: unknown): void; close(): void }[]) => { ports[0].postMessage({ type: 'SONOSCOPE_OFFLINE_STATUS', ready }); ports[0].close(); }),
  });
  const registration = Object.assign(new EventTarget(), { active, waiting: null, installing: null, scope: new URL('/SonoScope', location.origin).href });
  const register = registerFails ? vi.fn().mockRejectedValue(new Error('offline')) : vi.fn().mockResolvedValue(registration);
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { register, getRegistration: vi.fn().mockResolvedValue(registration) } });
  return { register, active };
}
it('registers the exact public entry scope and only announces readiness after the cache acknowledgement', async () => {
  const env = browser(); render(<OfflineStatus />); fireEvent.load(window);
  expect((await screen.findByText('离线已就绪')).dataset.offlineReady).toBe('true');
  expect(env.register).toHaveBeenCalledExactlyOnceWith('/SonoScope/sonoscope-sw.js', { scope: '/SonoScope', updateViaCache: 'none' });
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false }); fireEvent(window, new Event('offline'));
  expect(screen.getByText('离线模式 · 本地录播可回看')).toBeTruthy();
});
it('shows failed or incomplete preparation without claiming that the app can start offline', async () => {
  browser({ ready: false }); render(<OfflineStatus />); fireEvent.load(window);
  expect((await screen.findByText('离线准备未完成，联网后重开可重试')).dataset.offlineReady).toBe('false');
});
it('uses the installed worker when a cold offline update registration fails', async () => {
  browser({ offline: true, registerFails: true }); render(<OfflineStatus />); fireEvent.load(window);
  expect((await screen.findByText('离线模式 · 本地录播可回看')).dataset.offlineReady).toBe('true');
});
