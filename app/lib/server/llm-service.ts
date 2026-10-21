import { createHash } from 'node:crypto';
import { cleanComment, textKey, type GenerationRequest, type StreamEvent } from '@sonoscope/core';
import type { LlmConfig } from './config';
import { FileQuotaStore, ServiceError } from './quota-store';
import { GlmProvider, isGroundedComment, promptFor, type Provider, type ProviderUsage } from './provider';

export class LlmService {
  constructor(readonly config: LlmConfig, readonly quota: FileQuotaStore, private provider: Provider = new GlmProvider(config)) {}
  async prepare(request: GenerationRequest, fingerprint: string) {
    if (!this.config.enabled) throw new ServiceError('ai-disabled', 503, 'AI 尚未开放；本地反馈照常工作。');
    const now = Date.now();
    if (request.snapshot.endAt < now - 10000 || request.snapshot.endAt > now + 5000) throw new ServiceError('stale-snapshot', 400, '声音特征已过期，请重新采集。');
    const prompt = JSON.stringify(promptFor(request));
    if (prompt.length > this.config.maxInputChars) throw new ServiceError('input-too-large', 400, '声音特征过长。');
    const upper = Buffer.byteLength(prompt, 'utf8') + this.config.maxOutputTokens + 256;
    const digest = createHash('sha256').update(JSON.stringify(request)).digest('hex');
    await this.quota.reserve(request.requestId, digest, fingerprint, upper);
    return { deadlineAt: now + this.config.deadlineMs };
  }
  async stream(request: GenerationRequest, signal: AbortSignal, emit: (event: StreamEvent) => void, deadlineAt = Date.now() + this.config.deadlineMs) {
    const deadline = new AbortController(), abort = () => deadline.abort(signal.reason);
    if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => deadline.abort(new Error('deadline')), Math.max(0, deadlineAt - Date.now()));
    let sent = false, count = 0, regular = 0, company = 0, usage: ProviderUsage | null = null;
    const seen = new Set(request.history.map(textKey)), started = Date.now();
    try {
      emit({ type: 'accepted', requestId: request.requestId });
      if (Date.now() >= deadlineAt) deadline.abort(new Error('deadline'));
      if (deadline.signal.aborted) return;
      await this.quota.markSent(request.requestId); sent = true;
      if (Date.now() >= deadlineAt) deadline.abort(new Error('deadline'));
      if (deadline.signal.aborted) return;
      const generated = this.provider.generate(request, deadline.signal, (text, kind) => {
        if (Date.now() >= deadlineAt) deadline.abort(new Error('deadline'));
        if (deadline.signal.aborted || count >= 7 || (kind === 'regular' && regular >= 5) || (kind === 'companionship' && company >= 2)) return;
        const valid = cleanComment(text); if (!valid || Array.from(valid).length < 8 || Array.from(valid).length > 24 || !isGroundedComment(request.snapshot, valid) || seen.has(textKey(valid))) return;
        seen.add(textKey(valid)); count++; if (kind === 'regular') regular++; else company++;
        const now = Date.now();
        emit({ type: 'comment', requestId: request.requestId, comment: { commentId: `${request.requestId}_${count}`, audioSessionId: request.audioSessionId, danmuRunId: request.danmuRunId, snapshotId: request.snapshot.snapshotId, source: 'ai', kind, text: valid, createdAt: now, expiresAt: Math.min(now + 10000, started + 15000) } });
      });
      let unsubscribe = () => {};
      const stopped = new Promise<never>((_resolve, reject) => {
        const onAbort = () => reject(new DOMException('Generation cancelled', 'AbortError'));
        if (deadline.signal.aborted) onAbort(); else { deadline.signal.addEventListener('abort', onAbort, { once: true }); unsubscribe = () => deadline.signal.removeEventListener('abort', onAbort); }
      });
      try { usage = await Promise.race([generated, stopped]); } finally { unsubscribe(); }
      if (Date.now() >= deadlineAt) deadline.abort(new Error('deadline'));
    } catch (error) {
      if (!signal.aborted) emit({ type: 'error', requestId: request.requestId, code: deadline.signal.aborted ? 'deadline' : error instanceof ServiceError ? error.code : 'provider-failed', message: deadline.signal.aborted ? 'AI 响应超时；本地反馈继续工作。' : 'AI 暂不可用；本地反馈继续工作。' });
    } finally {
      clearTimeout(timer); signal.removeEventListener('abort', abort);
      if (sent) await this.quota.settle(request.requestId, usage ? usage.inputTokens + usage.outputTokens : null); else await this.quota.release(request.requestId);
      if (!signal.aborted) emit({ type: 'done', requestId: request.requestId, status: deadline.signal.aborted ? 'cancelled' : regular === 5 && company >= 1 ? 'complete' : 'partial', count, ...(usage ? { usage } : {}) });
    }
  }
}
