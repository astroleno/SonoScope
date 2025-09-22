import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/utils/setup.ts'],
    include: ['test/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],
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
      '@test': resolve(__dirname, './test')
    }
  },
  define: {
    'import.meta.vitest': 'undefined'
  }
});