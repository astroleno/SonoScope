import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: false, // Disable DTS for now
  clean: true,
  sourcemap: true,
  external: ['meyda'],
  treeshake: true,
  minify: false, // Keep readable for debugging
  splitting: false,
  outDir: 'dist',
});
