/* global self, caches */

// Serialized into a classic worker after the production build; keep it self-contained.
export function offlineWorker({ basePath, version, assets, pages, integrity = {} }) {
  const prefix = `sonoscope-offline:${encodeURIComponent(basePath || '/')}:`;
  const cacheName = prefix + version;
  const origin = self.location.origin;
  const root = basePath || '/';
  const assetPaths = new Set(assets);
  const pagePaths = new Set(pages.map(page => page.path));
  const absolute = path => new URL(path, origin).href;
  const expected = [...assets, ...pages.map(page => page.path)].map(absolute);
  let preparing;

  function prepare() {
    if (preparing) return preparing;
    preparing = (async () => {
      const cache = await caches.open(cacheName);
      const present = new Set((await cache.keys()).map(request => request.url));
      const missing = assets.filter(path => !present.has(absolute(path)));
      if (missing.length) {
        const abort = new AbortController();
        const timer = setTimeout(() => abort.abort(), 15000);
        try {
          await cache.addAll(missing.map(path => new Request(absolute(path), { cache: 'reload', credentials: 'omit', integrity: integrity[path] ?? '', signal: abort.signal })));
        } finally { clearTimeout(timer); }
      }
      for (const page of pages) {
        if (!present.has(absolute(page.path))) await cache.put(absolute(page.path), new Response(page.html, { headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cross-Origin-Opener-Policy': 'same-origin',
          'Cross-Origin-Embedder-Policy': 'require-corp',
          'Permissions-Policy': 'microphone=(self)',
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
        } }));
      }
      const complete = new Set((await cache.keys()).map(request => request.url));
      if (!expected.every(url => complete.has(url))) throw new Error('Offline cache is incomplete');
    })().finally(() => { preparing = undefined; });
    return preparing;
  }

  self.addEventListener('install', event => {
    event.waitUntil(prepare().catch(async error => { await caches.delete(cacheName); throw error; }));
  });
  // No skipWaiting or clients.claim: a recording keeps its original application version.
  self.addEventListener('activate', event => {
    event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(prefix) && key !== cacheName).map(key => caches.delete(key)))));
  });
  self.addEventListener('message', event => {
    if (event.data?.type !== 'SONOSCOPE_PREPARE_OFFLINE') return;
    event.waitUntil(prepare().then(
      () => event.ports[0]?.postMessage({ type: 'SONOSCOPE_OFFLINE_STATUS', ready: true }),
      () => event.ports[0]?.postMessage({ type: 'SONOSCOPE_OFFLINE_STATUS', ready: false }),
    ));
  });
  self.addEventListener('fetch', event => {
    const request = event.request, url = new URL(request.url);
    if (request.method !== 'GET' || url.origin !== origin) return;
    let path = url.pathname;
    if (request.mode === 'navigate') {
      if (path === `${basePath}/standalone-client`) {
        event.respondWith(Response.redirect(absolute(root), 307)); return;
      }
      if (path.endsWith('/') && path !== '/') path = path.slice(0, -1);
      if (!pagePaths.has(path)) return;
    } else if (!assetPaths.has(path)) return;
    // Each document and its lazy chunks come from the same complete build.
    event.respondWith(caches.open(cacheName).then(async cache => await cache.match(absolute(path)) ?? fetch(request)));
  });
}
