import { createHash } from 'node:crypto';
import { validateGenerationRequest } from '@sonoscope/core';
import { readLlmConfig } from './config';
import { FileQuotaStore, ServiceError } from './quota-store';
import { LlmService } from './llm-service';

const globalService = globalThis as typeof globalThis & { sonoLlmService?: LlmService };
export function getLlmService() {
  if (!globalService.sonoLlmService) { const config = readLlmConfig(); globalService.sonoLlmService = new LlmService(config, new FileQuotaStore(config.quotaPath, config)); }
  return globalService.sonoLlmService;
}
async function limitedJSON(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new ServiceError('content-type', 415, '需要 JSON 请求。');
  if (Number(request.headers.get('content-length')) > 12288 || !request.body) throw new ServiceError('body-too-large', 413, '请求体过大。');
  const reader = request.body.getReader(); let size = 0, text = ''; const decoder = new TextDecoder();
  try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 12288) throw new ServiceError('body-too-large', 413, '请求体过大。'); text += decoder.decode(part.value, { stream: true }); } text += decoder.decode(); return JSON.parse(text) as unknown; }
  catch (error) { if (error instanceof ServiceError) throw error; throw new ServiceError('invalid-json', 400, '请求格式无效。'); }
  finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}
export async function handleGeneration(request: Request, service = getLlmService()) {
  try {
    const expectedOrigin = process.env.APP_ORIGIN || new URL(request.url).origin;
    if (request.headers.get('origin') !== expectedOrigin || request.headers.get('sec-fetch-site') === 'cross-site') throw new ServiceError('origin-denied', 403, '请求来源不受支持。');
    const body = await limitedJSON(request);
    if (!validateGenerationRequest(body)) throw new ServiceError('invalid-request', 400, '声音特征或会话信息无效。');
    const peer = process.env.TRUST_PROXY === '1' ? request.headers.get('x-real-ip')?.slice(0, 80) || 'unknown-peer' : 'direct-peer';
    const fingerprint = createHash('sha256').update(peer).digest('hex');
    const prepared = await service.prepare(body, fingerprint);
    const encoder = new TextEncoder(), cancellation = new AbortController();
    const cancel = () => cancellation.abort(request.signal.reason);
    request.signal.addEventListener('abort', cancel, { once: true });
    if (request.signal.aborted) cancel();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        void service.stream(body, cancellation.signal, event => { if (!cancellation.signal.aborted) controller.enqueue(encoder.encode(JSON.stringify(event) + '\n')); }, prepared.deadlineAt).then(() => { try { controller.close(); } catch { /* cancelled */ } }).catch(() => { try { controller.error(new Error('Stream unavailable')); } catch { /* cancelled */ } }).finally(() => request.signal.removeEventListener('abort', cancel));
      },
      cancel() { cancellation.abort(); }
    });
    return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store, no-transform', 'X-Accel-Buffering': 'no', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) {
    const e = error instanceof ServiceError ? error : new ServiceError('service-unavailable', 503, 'AI 服务暂不可用；本地反馈继续工作。');
    return Response.json({ code: e.code, message: e.message }, { status: e.status, headers: { 'Cache-Control': 'no-store', ...(e.retryAfterSeconds ? { 'Retry-After': String(e.retryAfterSeconds) } : {}) } });
  }
}
