import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FileQuotaStore } from '../../app/lib/server/quota-store';
import { LlmService } from '../../app/lib/server/llm-service';
import { readLlmConfig } from '../../app/lib/server/config';
import { IncrementalComments, GlmProvider, isGroundedComment } from '../../app/lib/server/provider';
import { handleGeneration } from '../../app/lib/server/route-handler';
import { request, deferred } from './fixtures';

const stores: FileQuotaStore[] = [], paths: string[] = [];
async function quota(limits = { dailyCalls: 10, dailyTokens: 100000, concurrency: 2 }) { const path = await mkdtemp(join(tmpdir(), 'sono-test-')); paths.push(path); const store = new FileQuotaStore(join(path, 'quota.json'), limits); stores.push(store); return store; }
afterEach(async () => { vi.restoreAllMocks(); for (const s of stores.splice(0)) await s.close(); for (const p of paths.splice(0)) await rm(p, { recursive: true, force: true }); });
const config = () => readLlmConfig({ GLM_API_KEY: 'test-only', AI_ENABLED: '1', AI_DAILY_CALLS: '10', AI_DAILY_TOKENS: '100000', AI_MAX_CONCURRENCY: '2' });
describe('durable server guards', () => {
  it('no explicit deployment quota means cloud stays off, even when key is present', () => {
    expect(readLlmConfig({ GLM_API_KEY: 'secret', NEXT_PUBLIC_GLM_API_KEY: 'public-secret', AI_ENABLED: '1' }).enabled).toBe(false);
    expect(readLlmConfig({ NEXT_PUBLIC_GLM_API_KEY: 'public-secret' }).key).toBe('');
  });
  it('atomically caps concurrent reservations and preserves quota across restart', async () => {
    const store = await quota({ dailyCalls: 1, dailyTokens: 1000, concurrency: 1 });
    const results = await Promise.allSettled([store.reserve('r1', 'd1', 'p1', 600), store.reserve('r2', 'd2', 'p2', 600)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1); await store.markSent('r1'); await store.settle('r1', null);
    const ledger = await store.snapshot(); expect(Object.values(ledger.days)[0]).toEqual({ calls: 1, tokens: 600 });
    await store.close(); const reopened = new FileQuotaStore(join(paths.at(-1)!, 'quota.json'), { dailyCalls: 1, dailyTokens: 1000, concurrency: 1 }); stores.push(reopened);
    await expect(reopened.reserve('r3', 'd3', 'p3', 100)).rejects.toMatchObject({ code: 'daily-limit' });
    await expect(reopened.reserve('r1', 'd1', 'p1', 600)).rejects.toMatchObject({ code: 'duplicate-request' });
  });
  it('only unsent reservations can refund a call; unknown usage is charged conservatively', async () => {
    const store = await quota(); await store.reserve('r1', 'd1', 'p1', 900); await store.release('r1');
    expect(Object.values((await store.snapshot()).days)[0].calls).toBe(0);
    await store.reserve('r2', 'd2', 'p2', 900); await store.markSent('r2'); await store.release('r2'); await store.settle('r2', null);
    expect(Object.values((await store.snapshot()).days)[0]).toEqual({ calls: 1, tokens: 900 });
  });
  it('a malformed persisted ledger fails closed instead of silently resetting the budget', async () => {
    const store = await quota();
    await writeFile(join(paths.at(-1)!, 'quota.json'), JSON.stringify({ version: 1, days: { '2026-10-14': { calls: -1, tokens: 0 } }, reservations: {}, rates: {} }));
    await expect(store.reserve('r1', 'd1', 'p1', 100)).rejects.toMatchObject({ code: 'quota-store-invalid' });
  });
  it('invalid/cross-origin/oversized requests never call the provider', async () => {
    const generate = vi.fn(), service = new LlmService(config(), await quota(), { generate });
    const make = (body: string, origin = 'https://example.test') => new Request('https://example.test/SonoScope/api/danmu/stream', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body });
    expect((await handleGeneration(make(JSON.stringify(request()), 'https://wrong.test'), service)).status).toBe(403);
    expect((await handleGeneration(make('{'), service)).status).toBe(400);
    expect((await handleGeneration(make(JSON.stringify({ ...request(), needDanmu: 100000 })), service)).status).toBe(400);
    expect((await handleGeneration(make(' '.repeat(13000)), service)).status).toBe(413);
    expect(generate).not.toHaveBeenCalled();
  });
  it('a comment reaches HTTP stream while the model batch is still in progress', async () => {
    const finish = deferred<void>(); const service = new LlmService(config(), await quota(), { async generate(_r, _s, emit) { emit('这一段声音轻轻展开', 'regular'); await finish.promise; return { inputTokens: 20, outputTokens: 10 }; } });
    const r = request(), response = await handleGeneration(new Request('https://example.test/SonoScope/api/danmu/stream', { method: 'POST', headers: { origin: 'https://example.test', 'content-type': 'application/json' }, body: JSON.stringify(r) }), service);
    expect(response.headers.get('X-Accel-Buffering')).toBe('no'); const reader = response.body!.getReader(); let received = '';
    while (!received.includes('"type":"comment"')) received += new TextDecoder().decode((await reader.read()).value);
    expect(received).toContain('这一段声音'); expect(received).not.toContain('"type":"done"');
    finish.resolve(); while (true) { const part = await reader.read(); if (part.done) break; received += new TextDecoder().decode(part.value); }
    expect(received).toContain('"status":"partial"'); expect(received).not.toContain('test-only');
  });
  it('rejects comments after the absolute deadline even before a delayed timer fires', async () => {
    const store = await quota(), r = request(); let now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => now), events: unknown[] = [];
    const service = new LlmService(config(), store, { async generate(_r, _s, emit) { now += 9000; emit('过期的声音反馈', 'regular'); return { inputTokens: 20, outputTokens: 10 }; } });
    const { deadlineAt } = await service.prepare(r, 'p1');
    await service.stream(r, new AbortController().signal, e => events.push(e), deadlineAt);
    expect(events).not.toContainEqual(expect.objectContaining({ type: 'comment' }));
    expect(events).toContainEqual(expect.objectContaining({ type: 'done', status: 'cancelled', count: 0 })); clock.mockRestore();
  });
  it('stream parser handles escaped braces/quotes and emits before closing array', () => {
    const emit = vi.fn(), parser = new IncrementalComments(emit);
    const text = '[{"text":"声音像 { 光 }，\\"慢慢\\"展开","kind":"regular"}';
    for (const c of text) parser.feed(c);
    expect(emit).toHaveBeenCalledOnce(); expect(emit.mock.calls[0][0]).toContain('{ 光 }');
  });
  it('skips a malformed output item without losing later valid comments or repairing model text', () => {
    const emit = vi.fn(), parser = new IncrementalComments(emit);
    parser.feed('[{"text": missing_quotes,"kind":"companionship"},{"text":"这一段声音轻轻展开","kind":"regular"}]');
    expect(emit).toHaveBeenCalledOnce(); expect(emit).toHaveBeenCalledWith('这一段声音轻轻展开', 'regular');
  });
  it('uses actual upstream SSE increments and ignores reasoning text', async () => {
    const encoder = new TextEncoder(), emit = vi.fn();
    const sse = [ { choices: [{ delta: { reasoning_content: 'private thought' } }] }, { choices: [{ delta: { content: '[{"text":"声音慢慢展开","kind":"regular"}' } }] }, { choices: [{ delta: { content: ']' } }], usage: { prompt_tokens: 12, completion_tokens: 24 } } ];
    const stream = new ReadableStream({ start(c) { for (const event of sse) c.enqueue(encoder.encode('data: ' + JSON.stringify(event) + '\n\n')); c.close(); } });
    const fetcher = vi.fn().mockResolvedValue(new Response(stream)); const provider = new GlmProvider(config(), fetcher);
    expect(await provider.generate(request(), new AbortController().signal, emit)).toEqual({ inputTokens: 12, outputTokens: 24 });
    expect(emit).toHaveBeenCalledWith('声音慢慢展开', 'regular');
    const payload = JSON.parse(fetcher.mock.calls[0][1].body); expect(payload.stream).toBe(true); expect(payload.max_tokens).toBeLessThanOrEqual(768); expect(payload.messages.join(' ')).not.toContain('test-only');
  });
  it('filters unsupported music/tempo claims without retries, and allows them when current evidence supports them', async () => {
    const generate = vi.fn().mockImplementation(async (_r, _s, emit) => { emit('节奏感很强，跟着动起来', 'regular'); emit('这一段旋律慢慢展开', 'regular'); emit('这一段声音轻轻展开', 'regular'); return { inputTokens: 30, outputTokens: 40 }; });
    const r = request(); r.snapshot.stats.tempo = null; r.snapshot.validity.tempo = { state: 'unknown', source: 'heuristic', unit: 'BPM' };
    const service = new LlmService(config(), await quota(), { generate }), events: any[] = [];
    const prepared = await service.prepare(r, 'p1'); await service.stream(r, new AbortController().signal, e => events.push(e), prepared.deadlineAt);
    expect(events.filter(e => e.type === 'comment').map(e => e.comment.text)).toEqual(['这一段声音轻轻展开']);
    expect(events).toContainEqual(expect.objectContaining({ type: 'done', status: 'partial', count: 1 })); expect(generate).toHaveBeenCalledTimes(1);
    const supported = request('supported'); supported.snapshot.stats.tempo = { bpm: 120, confidence: .9 }; supported.snapshot.validity.tempo = { state: 'valid', source: 'heuristic', unit: 'BPM' };
    supported.snapshot.model = { version: 'yamnet-1', capturedAt: supported.snapshot.endAt, categories: [{ label: 'Music', score: .95 }], voiceProbability: .01, instrument: null };
    supported.snapshot.validity.classification = { state: 'valid', source: 'model', unit: 'score' };
    const accepted: any[] = [], next = await service.prepare(supported, 'p2'); await service.stream(supported, new AbortController().signal, e => accepted.push(e), next.deadlineAt);
    expect(accepted.filter(e => e.type === 'comment')).toHaveLength(3); expect(generate).toHaveBeenCalledTimes(2);
  });
  it('does not infer music, instruments, voice, pitch or a direction of change from an unsupported window', () => {
    const r = request();
    for (const text of ['这段音乐听起来层次丰富', '这一段钢琴声音比较清脆', '声音层次中打击乐比较突出', '这一段人声听起来很清晰', '音量逐渐增强', '高频声音突然出现', '节奏感明显增强', '音调偏高但十分清晰', '声音轻了下来，细节较为柔和', '平均RMS值在0.08左右', '频谱质心在一千赫兹左右', '频谱rolloff较高，高频能量不少']) expect(isGroundedComment(r.snapshot, text), text).toBe(false);
    expect(isGroundedComment(r.snapshot, '当前这一段声音比较清亮')).toBe(true);
  });
  it('allows fresh supported instrument and voice labels, but never treats stale labels as evidence', () => {
    const r = request(); r.snapshot.validity.classification = { state: 'valid', source: 'model', unit: 'score' };
    r.snapshot.model = { version: 'yamnet-1', capturedAt: r.snapshot.endAt, categories: [{ label: 'Music', score: .95 }], voiceProbability: .9, instrument: { label: 'Piano', confidence: .8 } };
    expect(isGroundedComment(r.snapshot, '这一段钢琴声音比较清脆')).toBe(true);
    expect(isGroundedComment(r.snapshot, '这一段人声听起来很清晰')).toBe(true);
    expect(isGroundedComment(r.snapshot, '声音层次中打击乐比较突出')).toBe(false);
    r.snapshot.model.capturedAt -= 4000;
    expect(isGroundedComment(r.snapshot, '这一段钢琴声音比较清脆')).toBe(false);
    expect(isGroundedComment(r.snapshot, '这一段人声听起来很清晰')).toBe(false);
  });
  it('enforces the promised AI text length and reports a partial batch without issuing a replacement call', async () => {
    const generate = vi.fn(async (_r, _s, emit) => {
      emit('音色清脆', 'regular'); emit('声音'.repeat(13), 'regular');
      emit('当前这一段声音比较清亮', 'regular');
      return { inputTokens: 30, outputTokens: 40 };
    });
    const r = request(), service = new LlmService(config(), await quota(), { generate }), events: any[] = [];
    const prepared = await service.prepare(r, 'length-test'); await service.stream(r, new AbortController().signal, event => events.push(event), prepared.deadlineAt);
    expect(events.filter(e => e.type === 'comment').map(e => e.comment.text)).toEqual(['当前这一段声音比较清亮']);
    expect(events).toContainEqual(expect.objectContaining({ type: 'done', status: 'partial', count: 1 })); expect(generate).toHaveBeenCalledOnce();
  });
});
