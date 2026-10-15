import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const path = process.argv[2] ? resolve(process.argv[2]) : new URL('./release-manifest.json', import.meta.url);
try {
  const manifest = JSON.parse(await readFile(path, 'utf8'));
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (manifest.version !== 1 || manifest.platform !== process.platform || manifest.arch !== process.arch || major < 22 || (major === 22 && minor < 13)) {
    throw new Error('Release platform/architecture or Node version does not match this host. Rebuild on the target platform with Node 22.13+.');
  }
  console.log(`Release platform verified: ${process.platform}/${process.arch}.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Release platform check failed.');
  process.exitCode = 1;
}
