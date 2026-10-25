import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';
import { offlineWorker } from '../../scripts/offline-worker.mjs';

const basePath = '/SonoScope', origin = 'https://tongye.me';
const prefix = 'sonoscope-offline:%2FSonoScope:';
const assets = ['/SonoScope/_next/static/chunks/app.js', '/SonoScope/audio/capture-worklet.js'];
const pages = [{ path: basePath, html: '<html>SonoScope same-build</html>' }, { path: `${basePath}/mochi`, html: '<html>Mochi same-build</html>' }];

function environment() {
  const listeners = new Map<string, (event: unknown) => void>();
  const stores = new Map<string, Map<string, Response>>();
  let failing = false;
  const fetch = vi.fn().mockRejectedValue(new Error('Network is offline'));
  const addAll = vi.fn(async (requests: Request[], store: Map<string, Response>) => {
    if (failing) throw new Error('Asset unavailable');
    for (const request of requests) store.set(request.url, new Response('script', { headers: { 'Content-Type': 'text/javascript' } }));
  });
  const caches = {
    keys: async () => [...stores.keys()],
    delete: vi.fn(async (key: string) => stores.delete(key)),
    open: async (key: string) => {
      if (!stores.has(key)) stores.set(key, new Map());
      const store = stores.get(key)!;
      return {
        keys: async () => [...store.keys()].map(url => new Request(url)),
        addAll: (requests: Request[]) => addAll(requests, store),
        put: async (key: string, response: Response) => { store.set(key, response.clone()); },
        match: async (key: string) => store.get(key)?.clone(),
      };
    },
  };
  const skipWaiting = vi.fn(), claim = vi.fn();
  const config = { basePath, version: 'new', assets, pages, integrity: { [assets[1]]: 'sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' } };
  runInNewContext(`(${offlineWorker.toString()})(${JSON.stringify(config)})`, {
    self: { location: { origin }, addEventListener: (name: string, listener: (event: unknown) => void) => listeners.set(name, listener), skipWaiting, clients: { claim } },
    caches, Request, Response, URL, AbortController, setTimeout, clearTimeout, fetch,
  });
  function dispatch(type: string, data = {}) {
    let completion: Promise<unknown> | undefined;
    listeners.get(type)!({ ...data, waitUntil: (promise: Promise<unknown>) => { completion = promise; }, respondWith: (promise: Promise<unknown>) => { completion = promise; } });
    return completion;
  }
  const request = (path: string, mode = 'navigate', method = 'GET') => dispatch('fetch', { request: { url: path.startsWith('https:') ? path : origin + path, method, mode } });
  return { stores, caches, addAll, fetch, skipWaiting, claim, dispatch, request, fail: () => { failing = true; } };
}

it('starts the exact public URL offline, with the same-build HTML, isolation headers and lazy resources', async () => {
  const env = environment(); await env.dispatch('install'); await env.dispatch('activate');
  const response = await env.request('/SonoScope') as Response;
  expect(await response.text()).toContain('same-build');
  expect(response.headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
  expect(response.headers.get('Cross-Origin-Embedder-Policy')).toBe('require-corp');
  expect((await env.request('/SonoScope/', 'navigate') as Response).status).toBe(200);
  expect(await (await env.request(assets[0], 'same-origin') as Response).text()).toBe('script');
  const redirect = await env.request('/SonoScope/standalone-client') as Response;
  expect(redirect.headers.get('location')).toBe(origin + '/SonoScope');
  expect(env.fetch).not.toHaveBeenCalled(); expect(env.skipWaiting).not.toHaveBeenCalled(); expect(env.claim).not.toHaveBeenCalled();
  const requests = env.addAll.mock.calls[0][0];
  expect(requests.every(request => request.credentials === 'omit' && request.cache === 'reload')).toBe(true);
  expect(requests[1].integrity).toMatch(/^sha256-/);
});

it('never handles API, RSC, foreign-origin, unrelated site, model or user-media requests', async () => {
  const env = environment(); await env.dispatch('install');
  for (const path of ['/SonoScope/api/runtime-config', '/SonoScope/api/health', '/SonoScope/.env', '/SonoScope/test', '/SonoScopeOther', '/', '/SonoScope/model/yamnet-1.tflite', '/SonoScope/recordings/take.mp4', 'https://other.example/SonoScope/_next/static/chunks/app.js']) expect(env.request(path, 'same-origin')).toBeUndefined();
  expect(env.request('/SonoScope?_rsc=next', 'cors')).toBeUndefined();
  expect(env.request(assets[0], 'same-origin', 'POST')).toBeUndefined();
  expect(env.request('/SonoScope/api/health', 'navigate')).toBeUndefined();
});

it('preserves the active build and unrelated app caches when a new installation fails', async () => {
  const env = environment(); env.stores.set(prefix + 'old', new Map()); env.stores.set('other-app', new Map()); env.fail();
  await expect(env.dispatch('install')).rejects.toThrow('Asset unavailable');
  expect([...env.stores.keys()]).toEqual([prefix + 'old', 'other-app']);
});

it('cleans only older caches belonging to this application prefix on activation', async () => {
  const env = environment(); env.stores.set(prefix + 'old', new Map()); env.stores.set('sonoscope-offline:%2FElsewhere:old', new Map()); env.stores.set('another-project', new Map());
  await env.dispatch('install'); await env.dispatch('activate');
  expect([...env.stores.keys()]).toEqual(['sonoscope-offline:%2FElsewhere:old', 'another-project', prefix + 'new']);
});

it('checks and repairs incomplete caches without reporting failed preparation as ready', async () => {
  const env = environment(); await env.dispatch('install');
  const postMessage = vi.fn();
  env.stores.get(prefix + 'new')!.delete(origin + assets[0]); env.fail();
  await env.dispatch('message', { data: { type: 'SONOSCOPE_PREPARE_OFFLINE' }, ports: [{ postMessage }] });
  expect(postMessage).toHaveBeenLastCalledWith({ type: 'SONOSCOPE_OFFLINE_STATUS', ready: false });
  expect(env.stores.has(prefix + 'new')).toBe(true);
});

it('restores a missing document from its frozen build without fetching a newer HTML document', async () => {
  const env = environment(); await env.dispatch('install');
  env.stores.get(prefix + 'new')!.delete(origin + basePath);
  const postMessage = vi.fn();
  await env.dispatch('message', { data: { type: 'SONOSCOPE_PREPARE_OFFLINE' }, ports: [{ postMessage }] });
  expect(postMessage).toHaveBeenLastCalledWith({ type: 'SONOSCOPE_OFFLINE_STATUS', ready: true });
  expect(env.addAll).toHaveBeenCalledOnce();
  expect(await (await env.request(basePath) as Response).text()).toContain('same-build');
});
