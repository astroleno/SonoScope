import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('refuses a release built for a different deployment platform or architecture before server startup', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sonoscope-platform-')), manifest = join(directory, 'release-manifest.json');
  const script = resolve(import.meta.dirname, '../../scripts/assert-release-platform.mjs');
  const run = () => spawnSync(process.execPath, [script, manifest], { encoding: 'utf8' });
  try {
    await writeFile(manifest, JSON.stringify({ version: 1, platform: process.platform, arch: process.arch }));
    expect(run().status).toBe(0);
    await writeFile(manifest, JSON.stringify({ version: 1, platform: process.platform === 'linux' ? 'darwin' : 'linux', arch: process.arch }));
    expect(run().status).toBe(1);
    await writeFile(manifest, JSON.stringify({ version: 1, platform: process.platform, arch: process.arch === 'arm64' ? 'x64' : 'arm64' }));
    expect(run().status).toBe(1);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
