import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { prepareOffline } from '../../scripts/prepare-offline.mjs';

const directories: string[] = [];
afterEach(async () => { for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true }); });
async function fixture(basePath = '/SonoScope') {
  const directory = await mkdtemp(join(tmpdir(), 'sonoscope-offline-')); directories.push(directory);
  for (const path of ['.next/static/chunks', '.next/static/css', '.next/server/app', 'public/audio']) await mkdir(join(directory, path), { recursive: true });
  const files = {
    '.next/required-server-files.json': JSON.stringify({ config: { basePath } }), '.next/BUILD_ID': 'test-build',
    '.next/static/chunks/app.js': 'app code', '.next/static/chunks/worker.js': 'lazy worker code', '.next/static/chunks/app.js.map': 'source map', '.next/static/css/app.css': 'body{}',
    '.next/server/app/index.html': `<html>SonoScope<script src="${basePath}/_next/static/chunks/app.js"></script></html>`,
    '.next/server/app/mochi.html': '<html>SonoScope Mochi</html>', 'public/audio/capture-worklet.js': 'worklet code',
  };
  for (const [path, content] of Object.entries(files)) await writeFile(join(directory, path), content);
  return directory;
}
it.each(['/SonoScope', '', '/tools/SonoScope'])('builds a complete deterministic cache for base path %s', async base => {
  const directory = await fixture(base), result = await prepareOffline(directory);
  expect(result.scope).toBe(base || '/'); expect(result.pages).toEqual([base || '/', `${base}/mochi`]);
  expect(result.assets).toContain(`${base}/_next/static/chunks/worker.js`);
  expect(result.assets).not.toContain(`${base}/_next/static/chunks/app.js.map`);
  const worker = await readFile(join(directory, 'public/sonoscope-sw.js'), 'utf8');
  expect(worker).toContain(`sha256-${createHash('sha256').update('worklet code').digest('base64')}`);
  expect(worker).not.toContain('/api/'); expect(worker).not.toContain('/vendor/');
  expect((await prepareOffline(directory)).version).toBe(result.version);
});
it('fails the build rather than shipping a document with a missing script', async () => {
  const directory = await fixture();
  await writeFile(join(directory, '.next/server/app/index.html'), '<html>SonoScope<script src="/SonoScope/_next/static/missing.js"></script></html>');
  await expect(prepareOffline(directory)).rejects.toThrow('uncached asset');
});
it('changes the offline version when fixed-URL audio worklet code changes', async () => {
  const directory = await fixture(), before = await prepareOffline(directory);
  await writeFile(join(directory, 'public/audio/capture-worklet.js'), 'new worklet code');
  expect((await prepareOffline(directory)).version).not.toBe(before.version);
});
