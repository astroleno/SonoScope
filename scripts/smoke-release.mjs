import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const directory = resolve('release/app');
const platformCheck = spawnSync(process.execPath, [resolve('release/assert-platform.mjs')], { encoding: 'utf8' });
if (platformCheck.status !== 0) throw new Error('Release platform check failed; build a package for this host before smoke testing.');
const { config } = JSON.parse(await readFile(join(directory, '.next/required-server-files.json'), 'utf8'));
const basePath = config.basePath ?? '';
const socket = createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, [join(directory, 'server.js')], {
  env: { ...process.env, NODE_ENV: 'production', HOSTNAME: '127.0.0.1', PORT: String(port), APP_ORIGIN: origin, AI_ENABLED: '0', AI_DAILY_CALLS: '0', AI_DAILY_TOKENS: '0', AI_MAX_CONCURRENCY: '0' },
  stdio: ['ignore', 'ignore', 'ignore']
});
let spawnError; child.on('error', error => { spawnError = error; });
const report = { source: 'local standalone release (same platform/architecture)', measuredAt: new Date().toISOString(), basePath, routes: [], staticFiles: 0, providerKeyInPublicOutput: false };
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const secret = process.env.GLM_API_KEY;
report.providerKeyInPublicOutput = secret ? false : null;
const hasSecret = text => !!secret && text.includes(secret);
const get = path => fetch(origin + basePath + path, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
try {
  const deadline = Date.now() + 30000;
  while (true) {
    assert(!spawnError && child.exitCode === null, 'Standalone server failed to start');
    try { const response = await get('/api/health'); if (response.status === 200) { await response.arrayBuffer(); break; } } catch { /* startup is bounded by the deadline */ }
    assert(Date.now() < deadline, 'Standalone health did not become ready');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const routes = [ ['', 200], ['/api/health', 200], ['/api/runtime-config', 200], ['/standalone-client', 307], ['/mochi', 200], ['/test', 404], ['/icon.png', 200], ['/apple-icon.png', 200], ['/manifest.webmanifest', 200], ['/audio/capture-worklet.js', 200], ['/model/yamnet-1.tflite', 200], ['/vendor/mediapipe-audio-1.1.0/wasm/audio_wasm_internal.wasm', 200] ];
  for (const [path, expected] of routes) {
    const response = await get(path), bytes = new Uint8Array(await response.arrayBuffer());
    const body = new TextDecoder().decode(bytes), location = response.headers.get('location');
    assert(response.status === expected, `Unexpected status at ${path || basePath}: ${response.status}`);
    assert(!hasSecret(body), `Provider key in public response at ${path}`);
    if (path === '/api/runtime-config') {
      const value = JSON.parse(body);
      assert(value.aiEnabled === false && Object.keys(value).every(key => ['version', 'aiEnabled', 'mode'].includes(key)), 'Public runtime config exposes unexpected fields');
    }
    if (path === '/standalone-client') {
      const target = new URL(location, origin);
      assert(target.origin === origin && [basePath || '/', `${basePath}/`].includes(target.pathname), 'Legacy redirect repeats or escapes the application prefix');
      const final = await fetch(target, { signal: AbortSignal.timeout(10000) });
      assert(final.status === 200 && new URL(final.url).pathname === (basePath || '/'), 'Legacy entry does not reach the canonical root'); await final.arrayBuffer();
    }
    report.routes.push({ path: path || basePath || '/', status: response.status, ...(location ? { location } : {}) });
  }
  for (const path of ['/api/analyze', '/api/llm-danmu', '/api/danmu/stream']) {
    const response = await fetch(origin + basePath + path, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(10000) });
    assert(response.status === 400, `Invalid requests accepted at ${path}`); await response.arrayBuffer();
  }
  async function inspectStatic(path, prefix = '') {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const relative = `${prefix}${entry.name}`, absolute = join(path, entry.name);
      if (entry.isDirectory()) await inspectStatic(absolute, `${relative}/`);
      else {
        const bytes = await readFile(absolute); assert(!hasSecret(bytes.toString('utf8')), `Provider key in static file ${relative}`);
        const response = await get(`/_next/static/${relative}`); assert(response.status === 200, `Missing static file ${relative}`); await response.arrayBuffer(); report.staticFiles++;
      }
    }
  }
  await inspectStatic(join(directory, '.next/static'));
  await mkdir(resolve('test/artifacts'), { recursive: true });
  await writeFile(resolve('test/artifacts/release-smoke.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`Standalone routes and ${report.staticFiles} static resources passed; cloud calls disabled.`);
} finally {
  if (child.exitCode === null && !spawnError) {
    const exited = once(child, 'exit'); child.kill('SIGTERM'); const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
    try { await exited; } finally { clearTimeout(timer); }
  }
}
