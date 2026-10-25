import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts', runtime: 'src/runtime.ts', 'recording-archive': 'src/recording-archive.ts' },
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ['meyda'],
  treeshake: true,
  minify: false, // Keep readable for debugging
  splitting: false,
  outDir: 'dist',
});
