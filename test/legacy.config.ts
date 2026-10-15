import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
export default defineConfig({ test: { include: ['phase1/**/*.test.ts', 'phase2/**/*.test.ts', 'phase2-6/**/*.test.ts'], environment: 'jsdom', globals: true, setupFiles: ['./utils/setup.ts'], maxWorkers: 2 }, resolve: { alias: { '@': resolve(import.meta.dirname, '../app'), '@tensorflow/tfjs': resolve(import.meta.dirname, './utils/mocks/tfjs.js'), '@mediapipe/tasks-audio': resolve(import.meta.dirname, './utils/mocks/mediapipe-tasks-audio.js') } } });
