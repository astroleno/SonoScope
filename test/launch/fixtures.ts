import { FeatureExtractor, makeFrame, summarizeFrames, type CommentCandidate, type GenerationRequest } from '@sonoscope/core';
export function frame(audioSessionId = 'audio-1', seq = 0, time = Date.now()) {
  const pcm = Float32Array.from({ length: 1024 }, (_, i) => 0.2 * Math.sin(2 * Math.PI * 440 * i / 44100));
  return makeFrame(audioSessionId, seq, seq / 43, time, 44100, new FeatureExtractor().extract(pcm, 44100, seq / 43));
}
export function request(requestId = 'req-1'): GenerationRequest {
  const now = Date.now(); const frames = [frame('audio-1', 0, now - 2000), frame('audio-1', 1, now)];
  return { version: '2', requestId, audioSessionId: 'audio-1', danmuRunId: 'run-1', snapshot: summarizeFrames(frames, 'snapshot-1')!, locale: 'zh-CN', history: [] };
}
export function comment(overrides: Partial<CommentCandidate> = {}): CommentCandidate {
  return { commentId: 'c-1', audioSessionId: 'audio-1', danmuRunId: 'run-1', snapshotId: 'snapshot-1', text: '声音轻轻展开', source: 'ai', kind: 'regular', createdAt: Date.now(), expiresAt: Date.now() + 10000, ...overrides };
}
export function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
