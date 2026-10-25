import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(new URL('../../packages/sdk/package.json', import.meta.url));
const bundler = createRequire(require.resolve('tsup'))('esbuild');
await bundler.build({ entryPoints: { 'internal-recording-replay': `${root}test/browser/internal-recording-replay.ts`, 'recording-storage.worker': `${root}app/lib/workers/recording-storage.worker.ts` }, outdir: `${root}test/browser/dist`, bundle: true, format: 'esm', target: 'es2022', platform: 'browser' });
console.log('Browser recording probes built in test/browser/dist. Serve the repository over localhost or HTTPS.');
