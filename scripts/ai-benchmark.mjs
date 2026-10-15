import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

// Compile only these server modules into a private temporary folder; no credentials enter output.
const root = resolve('.'),
  require = createRequire(import.meta.url);
const ts = require('typescript'),
  validateOnly = process.argv.includes('--validate-only');
const work = await mkdtemp(join(tmpdir(), 'sonoscope-ai-'));
try {
  if (!validateOnly)
    process.loadEnvFile(
      resolve(process.env.SONO_BENCH_ENV || 'app/.env.local')
    );
  for (const name of ['config', 'quota-store', 'provider', 'llm-service']) {
    const source = await readFile(resolve(`app/lib/server/${name}.ts`), 'utf8');
    let js = ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    }).outputText;
    js = js
      .replace(/from '(\.\/[a-z-]+)'/g, "from '$1.mjs'")
      .replace(
        /from '@sonoscope\/core'/g,
        `from '${pathToFileURL(resolve('packages/core/dist/index.js')).href}'`
      );
    await writeFile(join(work, `${name}.mjs`), js);
  }
  const { readLlmConfig } = await import(
    pathToFileURL(join(work, 'config.mjs')).href
  );
  const { FileQuotaStore } = await import(
    pathToFileURL(join(work, 'quota-store.mjs')).href
  );
  const { LlmService } = await import(
    pathToFileURL(join(work, 'llm-service.mjs')).href
  );
  const {
    FeatureExtractor,
    makeFrame,
    summarizeFrames,
  } = require('../packages/core/dist/index.js');
  if (validateOnly) {
    console.log(
      'Benchmark modules loaded; no credentials read or provider calls made.'
    );
  } else {
    const config = {
      ...readLlmConfig(),
      enabled: true,
      dailyCalls: 6,
      dailyTokens: 60000,
      concurrency: 1,
      maxOutputTokens: 512,
    };
    if (!config.key) throw new Error('Missing server API credential');
    const quota = new FileQuotaStore(join(work, 'quota.json'), config),
      service = new LlmService(config, quota);
    const samples = [];
    for (const frequency of [220, 440, 1000]) {
      const audioSessionId = randomUUID(),
        extractor = new FeatureExtractor(),
        now = Date.now();
      const frames = Array.from({ length: 90 }, (_, seq) => {
        const pcm = Float32Array.from(
          { length: 1024 },
          (_, i) =>
            0.12 *
            Math.sin((2 * Math.PI * frequency * (seq * 1024 + i)) / 44100)
        );
        return makeFrame(
          audioSessionId,
          seq,
          (seq * 1024) / 44100,
          now - 2100 + seq * 23,
          44100,
          extractor.extract(pcm, 44100, (seq * 1024) / 44100)
        );
      });
      const snapshot = summarizeFrames(frames, randomUUID());
      const request = {
        version: '2',
        requestId: randomUUID(),
        audioSessionId,
        danmuRunId: randomUUID(),
        snapshot,
        locale: 'zh-CN',
        history: [],
      };
      let first = null,
        count = 0,
        usage = null,
        status = 'unavailable',
        error = null;
      const start = performance.now();
      try {
        const prepared = await service.prepare(
          request,
          `benchmark-${frequency}`
        );
        await service.stream(
          request,
          new AbortController().signal,
          event => {
            if (event.type === 'comment') {
              first ??= Math.round(performance.now() - start);
              count++;
            }
            if (event.type === 'error') error = event.code;
            if (event.type === 'done') {
              status = event.status;
              usage = event.usage ?? null;
            }
          },
          prepared.deadlineAt
        );
      } catch (cause) {
        error =
          typeof cause.code === 'string' ? cause.code : 'test-unavailable';
      }
      const result = {
        frequencyHz: frequency,
        firstCommentMs: first,
        totalMs: Math.round(performance.now() - start),
        count,
        status,
        usage,
        error,
      };
      samples.push(result);
      console.log(JSON.stringify(result));
    }
    const ledger = await quota.snapshot();
    await quota.close();
    const report = {
      testedAt: new Date().toISOString(),
      endpointHost: new URL(config.endpoint).hostname,
      model: config.model,
      concurrency: 1,
      samples,
      calls: Object.values(ledger.days).reduce((a, d) => a + d.calls, 0),
      chargedOrReservedTokens: Object.values(ledger.days).reduce(
        (a, d) => a + d.tokens,
        0
      ),
      note: 'Small synthetic-feature pilot, not a statistically valid p95 or production quota decision. Timing ends at parsed comment, not browser display.',
    };
    await mkdir(resolve('test/artifacts'), { recursive: true });
    const label = config.model.replace(/[^a-zA-Z0-9_-]/g, '_');
    await writeFile(
      resolve(`test/artifacts/ai-${label}.json`),
      JSON.stringify(report, null, 2) + '\n'
    );
    console.log('Report saved without credentials.');
  }
} finally {
  await rm(work, { recursive: true, force: true });
}
