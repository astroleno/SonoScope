import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
export default defineConfig({
  test: {
    projects: [
      { test: { name: 'launch-node', include: ['launch/**/*.test.ts', 'audio-feature-enhancement.test.ts', 'phase2-5/**/*.test.ts'], environment: 'node', testTimeout: 10000, hookTimeout: 10000 } },
      { test: { name: 'launch-ui', include: ['launch/**/*.test.tsx'], environment: 'jsdom', testTimeout: 30000 }, resolve: { alias: { '@': resolve(import.meta.dirname, '../app') } }, esbuild: { jsx: 'automatic' } }
    ],
    maxWorkers: 1,
    reporters: ['default']
  }
});
