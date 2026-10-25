import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { offlineWorker } from './offline-worker.mjs';

export async function prepareOffline(app = resolve(dirname(fileURLToPath(import.meta.url)), '../app')) {
  const next = join(app, '.next');
  const { config } = JSON.parse(await readFile(join(next, 'required-server-files.json'), 'utf8'));
  const basePath = config.basePath ?? '';
  if (basePath && !/^\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(basePath)) throw new Error('Invalid offline base path');
  const assets = [];
  const integrity = {};
  const digest = bytes => `sha256-${createHash('sha256').update(bytes).digest('base64')}`;
  async function collect(directory, prefix = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) await collect(join(directory, entry.name), `${prefix}${entry.name}/`);
      else if (entry.isFile() && !entry.name.endsWith('.map')) {
        const path = `${basePath}/_next/static/${prefix}${entry.name}`;
        assets.push(path); integrity[path] = digest(await readFile(join(directory, entry.name)));
      }
    }
  }
  await collect(join(next, 'static'));
  if (!assets.some(path => path.endsWith('.js')) || !assets.some(path => path.endsWith('.css'))) throw new Error('Offline build is missing application assets');
  integrity[`${basePath}/audio/capture-worklet.js`] = digest(await readFile(join(app, 'public/audio/capture-worklet.js')));
  assets.push(...['/audio/capture-worklet.js', '/manifest.webmanifest', '/icon.png', '/apple-icon.png'].map(path => basePath + path));
  assets.sort();
  const pages = await Promise.all([
    { path: basePath || '/', file: 'index.html' },
    { path: `${basePath}/mochi`, file: 'mochi.html' },
  ].map(async page => ({ path: page.path, html: await readFile(join(next, 'server/app', page.file), 'utf8') })));
  const allowed = new Set(assets);
  for (const page of pages) {
    if (!page.html.includes('SonoScope')) throw new Error('Offline document is not an application page');
    for (const [, path] of page.html.matchAll(/(?:src|href)="([^"?#]+\.(?:js|css))(?:\?[^"#]*)?"/g)) {
      if (!allowed.has(path)) throw new Error(`Offline document references an uncached asset: ${path}`);
    }
  }
  const buildId = (await readFile(join(next, 'BUILD_ID'), 'utf8')).trim();
  const version = createHash('sha256').update(JSON.stringify({ buildId, assets, pages, integrity, worker: offlineWorker.toString() })).digest('hex').slice(0, 24);
  const worker = `// SonoScope offline build ${buildId}\n(${offlineWorker.toString()})(${JSON.stringify({ basePath, version, assets, pages, integrity })});\n`;
  await writeFile(join(app, 'public/sonoscope-sw.js'), worker);
  const report = { buildId, version, basePath, scope: basePath || '/', assetCount: assets.length, assets, pages: pages.map(page => page.path), workerBytes: Buffer.byteLength(worker) };
  await writeFile(join(next, 'offline-manifest.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`Offline startup prepared: ${assets.length} assets and ${pages.length} application pages.`);
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await prepareOffline();
