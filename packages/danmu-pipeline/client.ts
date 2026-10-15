import { isStreamEvent, type GenerationRequest, type StreamEvent } from '@sonoscope/core';

export type Generate = (request: GenerationRequest, signal: AbortSignal, emit: (event: StreamEvent) => void) => Promise<void>;
export function streamingClient(endpoint: string, fetcher: typeof fetch = fetch): Generate {
  return async (request, signal, emit) => {
    const response = await fetcher(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request), signal, credentials: 'same-origin' });
    if (!response.ok) {
      let message = 'AI 暂不可用；本地反馈继续工作。', code = `http-${response.status}`;
      try { const body = await response.json(); if (typeof body?.message === 'string') message = body.message.slice(0, 200); if (typeof body?.code === 'string') code = body.code.slice(0, 50); } catch { /* non-JSON proxy error */ }
      const delay = Number(response.headers.get('Retry-After'));
      emit({ type: 'error', requestId: request.requestId, code, message, ...(Number.isFinite(delay) && delay > 0 ? { retryAfterMs: Math.min(86400000, delay * 1000) } : {}) });
      return;
    }
    if (!response.body || !response.headers.get('content-type')?.includes('application/x-ndjson')) throw new Error('Invalid streaming response');
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let buffer = '', bytes = 0, complete = false;
    const consume = (line: string) => {
      if (!line.trim()) return;
      const event: unknown = JSON.parse(line);
      if (!isStreamEvent(event) || event.requestId !== request.requestId) throw new Error('Invalid stream event');
      if (event.type === 'comment' && (event.comment.audioSessionId !== request.audioSessionId || event.comment.danmuRunId !== request.danmuRunId || event.comment.snapshotId !== request.snapshot.snapshotId)) throw new Error('Mismatched session');
      if (complete) throw new Error('Event after done');
      if (event.type === 'done') complete = true;
      emit(event);
    };
    try {
      while (!signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength; if (bytes > 65536) throw new Error('Stream too large');
        buffer += decoder.decode(value, { stream: true }); if (buffer.length > 16384) throw new Error('Stream line too large');
        let newline: number;
        while ((newline = buffer.indexOf('\n')) >= 0) { consume(buffer.slice(0, newline)); buffer = buffer.slice(newline + 1); }
      }
      if (!signal.aborted) { buffer += decoder.decode(); consume(buffer); if (!complete) throw new Error('Stream ended without done'); }
    } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
  };
}
