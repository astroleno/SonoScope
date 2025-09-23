import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['useDanmuPipeline.ts', 'danmu-pipeline.ts', 'danmu-engine.ts'],
  format: ['cjs', 'esm'],
  dts: false, // 暂时禁用DTS生成
  clean: true,
  sourcemap: true,
  treeshake: true,
  minify: false,
  splitting: false,
  outDir: 'dist',
  external: ['react'], // 将react标记为外部依赖
});
