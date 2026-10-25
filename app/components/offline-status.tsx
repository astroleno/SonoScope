'use client';

import { useEffect, useState } from 'react';
import { appPath, BASE_PATH } from '../lib/paths';

type OfflineState = { online: boolean; ready: boolean; failed: boolean; updating: boolean };

export function OfflineStatus() {
  const [state, setState] = useState<OfflineState | null>(null);
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator) || !window.isSecureContext) return;
    let cancelled = false, registration: ServiceWorkerRegistration | undefined;
    const cleanup: (() => void)[] = [];
    const pending = new Set<() => void>();
    const publish = (patch: Partial<OfflineState>) => { if (!cancelled) setState(previous => ({ ready: false, failed: false, updating: false, ...previous, ...patch, online: navigator.onLine })); };
    const prepare = async () => {
      const worker = registration?.active;
      if (!worker) return;
      const ready = await new Promise<boolean>(resolve => {
        const channel = new MessageChannel();
        const cancel = () => finish(false);
        const finish = (value: boolean) => { clearTimeout(timer); channel.port1.close(); pending.delete(cancel); resolve(value); };
        const timer = setTimeout(() => finish(false), 20000);
        pending.add(cancel);
        channel.port1.onmessage = event => { if (event.data?.type === 'SONOSCOPE_OFFLINE_STATUS') finish(event.data.ready === true); };
        try { worker.postMessage({ type: 'SONOSCOPE_PREPARE_OFFLINE' }, [channel.port2]); } catch { finish(false); }
      });
      publish({ ready, failed: !ready, updating: !!registration?.waiting });
    };
    const connectivity = () => { publish({ online: navigator.onLine }); if (navigator.onLine) void prepare(); };
    window.addEventListener('online', connectivity); window.addEventListener('offline', connectivity);
    cleanup.push(() => { window.removeEventListener('online', connectivity); window.removeEventListener('offline', connectivity); });
    const start = async () => {
      publish({});
      try {
        try {
          registration = await navigator.serviceWorker.register(appPath('/sonoscope-sw.js'), { scope: BASE_PATH || '/', updateViaCache: 'none' });
        } catch (error) {
          // An installed application remains usable when an offline update check fails.
          const previous = await navigator.serviceWorker.getRegistration(BASE_PATH || '/');
          if (previous?.active?.scriptURL !== new URL(appPath('/sonoscope-sw.js'), location.origin).href || previous.scope !== new URL(BASE_PATH || '/', location.origin).href) throw error;
          registration = previous;
        }
        if (cancelled) return;
        const observe = (worker: ServiceWorker | null) => {
          if (!worker) return;
          const changed = () => {
            if (worker.state === 'activated') void prepare();
            if (worker.state === 'installed') publish({ updating: !!registration?.active && registration.active !== worker });
            if (worker.state === 'redundant' && !registration?.active) publish({ failed: true });
          };
          worker.addEventListener('statechange', changed); cleanup.push(() => worker.removeEventListener('statechange', changed));
        };
        const found = () => observe(registration?.installing ?? null);
        registration.addEventListener('updatefound', found); cleanup.push(() => registration?.removeEventListener('updatefound', found));
        observe(registration.installing);
        if (registration.active) await prepare();
      } catch { publish({ failed: true }); }
    };
    // Defer precaching until the initial page has finished loading.
    if (document.readyState === 'complete') void start();
    else { window.addEventListener('load', start, { once: true }); cleanup.push(() => window.removeEventListener('load', start)); }
    return () => { cancelled = true; for (const dispose of cleanup) dispose(); for (const cancel of pending) cancel(); };
  }, []);
  if (!state) return null;
  const label = !state.online ? state.ready ? '离线模式 · 本地录播可回看' : '离线尚未就绪，请联网打开一次' : state.failed ? '离线准备未完成，联网后重开可重试' : state.ready ? '离线已就绪' : '正在准备离线…';
  return <p className="service-note" role="status" data-offline-ready={state.ready}>{label}{state.updating ? ' · 新版本已就绪，关闭本站页面后重开即可更新' : ''}</p>;
}
