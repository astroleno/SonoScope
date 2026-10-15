import { mkdir, cp, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const destination = resolve('release');
await rm(destination, { recursive: true, force: true }); await mkdir(destination, { recursive: true });
const keep = source => !/^(?:\.env(?:\..*)?|\.runtime)$/.test(source.split('/').at(-1));
await cp(resolve('app/.next/standalone'), destination, { recursive: true, filter: keep, verbatimSymlinks: true });
await mkdir(join(destination, 'app/.next'), { recursive: true });
await cp(resolve('app/.next/static'), join(destination, 'app/.next/static'), { recursive: true });
await cp(resolve('app/public'), join(destination, 'app/public'), { recursive: true });
await cp(resolve('scripts/assert-release-platform.mjs'), join(destination, 'assert-platform.mjs'));
await writeFile(join(destination, 'release-manifest.json'), JSON.stringify({ version: 1, platform: process.platform, arch: process.arch, nodeVersion: process.versions.node, builtAt: new Date().toISOString() }, null, 2) + '\n');
async function check(path) { for (const entry of await readdir(path, { withFileTypes: true })) { if (/^\.env/.test(entry.name)) throw new Error('Environment file leaked into release'); if (entry.isDirectory()) await check(join(path, entry.name)); } }
await check(destination); console.log('Standalone release prepared without environment files.');
