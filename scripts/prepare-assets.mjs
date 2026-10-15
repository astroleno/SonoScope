import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { cp, mkdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const app = resolve('app'), require = createRequire(join(app, 'package.json'));
const root = dirname(require.resolve('@mediapipe/tasks-audio'));
const packageInfo = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
if (packageInfo.version !== '1.1.0') throw new Error('MediaPipe asset version mismatch');
const destination = join(app, 'public/vendor/mediapipe-audio-1.1.0');
await mkdir(destination, { recursive: true });
await cp(join(root, 'wasm'), join(destination, 'wasm'), { recursive: true });
const manifest = JSON.parse(await readFile(join(app, 'public/model/assets.json'), 'utf8'));
const model = await readFile(join(app, 'public/model/yamnet-1.tflite'));
if (createHash('sha256').update(model).digest('hex') !== manifest.yamnet.sha256) throw new Error('YAMNet checksum mismatch');
console.log('Local MediaPipe WASM and verified YAMNet assets ready.');
