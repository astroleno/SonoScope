import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./utils/setup.ts'],
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: [
      'node_modules',
      'dist',
      '.idea',
      '.git',
      '.cache',
      // exclude known legacy integration/perf scripts without suites
      'worker-integration.test.cjs',
      'worker-integration-full.test.cjs',
      'worker-performance.test.cjs',
      'hpss-algorithm.test.cjs'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/coverage/**'
      ]
    },
    reporters: ['verbose'],
    outputFile: {
      junit: 'test-results/junit.xml'
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './app'),
      '@test': resolve(__dirname, './'),
      '@tensorflow/tfjs': resolve(__dirname, './utils/mocks/tfjs.js'),
      '@mediapipe/tasks-audio': resolve(__dirname, './utils/mocks/mediapipe-tasks-audio.js'),
    }
  },
  define: {
    'import.meta.vitest': 'undefined'
  }
});