export type AnalyzeEvent =
  | { type: 'style'; style: string; confidence: number }
  | { type: 'comment'; idx: number; text: string }
  | { type: 'done' };

export type StreamHandlers = {
  onStyle?: (e: Extract<AnalyzeEvent, { type: 'style' }>) => void;
  onComment?: (e: Extract<AnalyzeEvent, { type: 'comment' }>) => void;
  onDone?: () => void;
  onError?: (err: unknown) => void;
};

export async function fetchAnalyze(
  apiPath: string,
  body: unknown,
  handlers: StreamHandlers
): Promise<void> {
  try {
    const res = await fetch(apiPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
    if (!res.ok || !res.body) throw new Error(`Bad response: ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      // Process complete lines
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line) continue;
        try {
          const evt = JSON.parse(line) as AnalyzeEvent;
          if (evt.type === 'style') handlers.onStyle?.(evt);
          else if (evt.type === 'comment') handlers.onComment?.(evt);
          else if (evt.type === 'done') handlers.onDone?.();
        } catch (e) {
          handlers.onError?.(e);
        }
      }
    }
    // Flush any remaining
    if (buffer.trim()) {
      try {
        const evt = JSON.parse(buffer.trim()) as AnalyzeEvent;
        if (evt.type === 'style') handlers.onStyle?.(evt);
        else if (evt.type === 'comment') handlers.onComment?.(evt);
        else if (evt.type === 'done') handlers.onDone?.();
      } catch (e) {
        // ignore
      }
    }
  } catch (err) {
    handlers.onError?.(err);
  }
}
