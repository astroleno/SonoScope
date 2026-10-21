import { CONTRACT_VERSION, cleanComment, instrumentComment, instrumentEvidence, type CommentCandidate, type FeatureFrame, type FeatureSnapshot, type GenerationRequest } from '@sonoscope/core';
import { CommentQueue, type CommentSink } from './comment-queue';
import type { Generate } from './client';

export interface DanmuState {
  active: boolean; audioSessionId: string | null; danmuRunId: string | null;
  pendingRequests: number; queued: number; displayed: number; localDisplayed: number; aiDisplayed: number;
  cloud: 'off' | 'ready' | 'loading' | 'error' | 'limited'; message: string | null;
  history: CommentCandidate[];
  metrics: { localFirstMs: number | null; aiFirstMs: number | null; aiFirstSnapshotId: string | null };
}
export interface ControllerOptions { generate?: Generate; now?: () => number; id?: () => string; intervalMs?: number; minRequestIntervalMs?: number; deadlineMs?: number }
export class DanmuController {
  private audioId: string | null = null;
  private runId: string | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private requests = new Map<string, AbortController>();
  private queue: CommentQueue;
  private now: () => number;
  private id: () => string;
  private state: DanmuState;
  private listeners = new Set<(state: DanmuState) => void>();
  private lastLocal = -Infinity;
  private baseline: { rms: number; low: number; high: number } | null = null;
  private previousRms = 0;
  private voiceActive = false;
  private lastTempo: number | null = null;
  private lastInstrument: string | null = null;
  private lastRequest = -Infinity;
  private effectiveSoundAt: number | null = null;
  private cooldownUntil = 0;
  private cloudEnabled = false;
  private cloudGeneration = 0;
  private firstRequests = new Set<string>();
  private published: DanmuState | null = null;
  constructor(sink: CommentSink, private options: ControllerOptions = {}) {
    this.now = options.now ?? Date.now; this.id = options.id ?? (() => crypto.randomUUID());
    this.state = this.initialState();
    this.queue = new CommentQueue(sink, { now: this.now, intervalMs: options.intervalMs, onShown: (c, at) => {
      if (!this.matches(c.audioSessionId, c.danmuRunId)) return;
      const firstAI = c.source === 'ai' && c.requestStartedAt !== undefined && !this.firstRequests.has(c.snapshotId);
      if (firstAI) { this.firstRequests.add(c.snapshotId); if (this.firstRequests.size > 100) this.firstRequests.delete(this.firstRequests.values().next().value!); }
      this.state = { ...this.state, displayed: this.state.displayed + 1, localDisplayed: this.state.localDisplayed + Number(c.source === 'local'), aiDisplayed: this.state.aiDisplayed + Number(c.source === 'ai'), history: [...this.state.history, c].slice(-12), metrics: { localFirstMs: this.state.metrics.localFirstMs ?? (c.source === 'local' && this.effectiveSoundAt !== null ? at - this.effectiveSoundAt : null), aiFirstMs: firstAI ? at - c.requestStartedAt! : this.state.metrics.aiFirstMs, aiFirstSnapshotId: firstAI ? c.snapshotId : this.state.metrics.aiFirstSnapshotId } };
      this.publish();
    } });
  }
  private initialState(): DanmuState { return { active: false, audioSessionId: null, danmuRunId: null, pendingRequests: 0, queued: 0, displayed: 0, localDisplayed: 0, aiDisplayed: 0, cloud: 'off', message: null, history: [], metrics: { localFirstMs: null, aiFirstMs: null, aiFirstSnapshotId: null } }; }
  subscribe(fn: (state: DanmuState) => void) { this.listeners.add(fn); fn(this.state); return () => { this.listeners.delete(fn); }; }
  get current() { return this.state; }
  private publish() {
    this.state = { ...this.state, pendingRequests: this.requests.size, queued: this.queue.size };
    const prev = this.published, next = this.state;
    if (prev && prev.active === next.active && prev.danmuRunId === next.danmuRunId && prev.pendingRequests === next.pendingRequests && prev.queued === next.queued && prev.displayed === next.displayed && prev.cloud === next.cloud && prev.message === next.message) return;
    this.published = next; for (const fn of this.listeners) fn(next);
  }
  private matches(audioId: string, runId: string) { return this.audioId === audioId && this.runId === runId; }
  setCloudEnabled(enabled: boolean) {
    const next = enabled && !!this.options.generate; if (next === this.cloudEnabled) return;
    this.cloudEnabled = next; ++this.cloudGeneration;
    if (!next) { for (const controller of this.requests.values()) controller.abort(); this.requests.clear(); this.queue.discardAI(); }
    this.state = { ...this.state, cloud: next ? 'ready' : 'off', message: null }; this.publish();
  }
  start(audioSessionId: string) {
    if (this.audioId === audioSessionId && this.runId) return;
    this.stop(); this.audioId = audioSessionId; this.runId = this.id(); this.lastLocal = -Infinity; this.lastRequest = -Infinity; this.baseline = null; this.previousRms = 0; this.voiceActive = false; this.lastTempo = null; this.lastInstrument = null; this.effectiveSoundAt = null; this.cooldownUntil = 0;
    this.queue.start(audioSessionId, this.runId); this.state = { ...this.initialState(), active: true, audioSessionId, danmuRunId: this.runId, cloud: this.cloudEnabled ? 'ready' : 'off' };
    this.timer = setInterval(() => { this.queue.tick(); this.publish(); }, 50); this.publish();
  }
  feedFrame(frame: FeatureFrame) {
    if (!this.runId || frame.audioSessionId !== this.audioId) return;
    const now = this.now(), v = frame.values, previous = this.baseline, priorRms = this.previousRms;
    const total = v.bands.low + v.bands.mid + v.bands.high || 1;
    const low = v.bands.low / total, high = v.bands.high / total;
    this.baseline = previous ? { rms: previous.rms * .96 + v.rms * .04, low: previous.low * .96 + low * .04, high: previous.high * .96 + high * .04 } : { rms: v.rms, low, high };
    this.previousRms = v.rms;
    const model = frame.model && frame.validity.classification.state === 'valid' && frame.capturedAt - frame.model.capturedAt >= 0 && frame.capturedAt - frame.model.capturedAt <= 3000 ? frame.model : null;
    const voice = model?.voiceProbability ?? null;
    const instrument = instrumentEvidence(model)?.label ?? null;
    const musical = !model || model.categories.some(c => /^(Music|Singing|Choir)$/.test(c.label) && c.score >= .5);
    const tempo = musical && frame.validity.tempo.state === 'valid' && v.tempo && v.tempo.confidence >= .7 ? v.tempo : null;
    if (voice !== null && voice < .3) this.voiceActive = false;
    if (v.rms < .008) return;
    const first = this.effectiveSoundAt === null;
    if (first) this.effectiveSoundAt = frame.capturedAt;
    if (now - this.lastLocal < 950) return;
    let text = '', event: 'sound' | 'voice' | 'instrument' | 'energy' | 'spectrum' | 'onset' | 'tempo' = 'sound';
    if (first) text = '声音进来了，开始听这一段';
    else if (instrument && instrument !== this.lastInstrument && instrumentComment(instrument)) { text = instrumentComment(instrument)!; event = 'instrument'; }
    else if (voice !== null && voice >= .8 && !this.voiceActive) { text = '像是有人声进来了'; event = 'voice'; }
    else if (tempo && (this.lastTempo === null || Math.abs(tempo.bpm - this.lastTempo) >= 8)) { text = `节拍大约 ${Math.round(tempo.bpm)} BPM`; event = 'tempo'; }
    else if (now - this.lastLocal < 1500) return;
    else if (previous && v.rms > Math.max(.03, previous.rms * 1.8)) { text = '声音变得更有力了'; event = 'energy'; }
    else if (previous && previous.rms > .03 && v.rms < previous.rms * .55) { text = '声音轻了下来'; event = 'energy'; }
    else if (v.flux > .25 && v.rms > .02 && v.rms > priorRms * 1.2) { text = '声音刚刚有了新的变化'; event = 'onset'; }
    else if (previous && low - previous.low > .3) { text = '低频的声音更明显了'; event = 'spectrum'; }
    else if (previous && high - previous.high > .3) { text = '高频的声音更明显了'; event = 'spectrum'; }
    if (!text) return; // Stable sound keeps the picture alive without periodic filler comments.
    if (this.offer({ commentId: this.id(), source: 'local', kind: 'regular', audioSessionId: this.audioId!, danmuRunId: this.runId, snapshotId: `${frame.audioSessionId}_${frame.seq}`, text, createdAt: now, expiresAt: now + 3000 })) {
      this.lastLocal = now; if (event === 'voice') this.voiceActive = true; if (event === 'tempo') this.lastTempo = tempo!.bpm; if (event === 'instrument') this.lastInstrument = instrument;
    }
  }
  offer(comment: CommentCandidate) { const accepted = this.queue.enqueue(comment); this.queue.tick(); this.publish(); return accepted; }
  async feedSnapshot(snapshot: FeatureSnapshot) {
    if (!this.runId || snapshot.audioSessionId !== this.audioId || !this.cloudEnabled || !this.options.generate || this.requests.size || snapshot.stats.rmsMean < 0.008) return;
    const started = this.now();
    if (started < this.cooldownUntil || started - this.lastRequest < (this.options.minRequestIntervalMs ?? 12000)) return;
    this.lastRequest = started;
    const request: GenerationRequest = { version: CONTRACT_VERSION, requestId: this.id(), audioSessionId: this.audioId!, danmuRunId: this.runId, snapshot, locale: 'zh-CN', history: this.state.history.map(c => c.text) };
    const controller = new AbortController(); this.requests.set(request.requestId, controller);
    const generation = this.cloudGeneration;
    const current = () => this.cloudEnabled && generation === this.cloudGeneration && this.matches(request.audioSessionId, request.danmuRunId);
    const timer = setTimeout(() => controller.abort(new Error('deadline')), this.options.deadlineMs ?? 8000);
    let cancelWait!: () => void;
    const cancelled = new Promise<never>((_resolve, reject) => { cancelWait = () => { clearTimeout(timer); reject(new DOMException('Generation cancelled', 'AbortError')); }; });
    // A custom transport may throw synchronously or ignore AbortSignal entirely.
    void cancelled.catch(() => undefined); controller.signal.addEventListener('abort', cancelWait, { once: true });
    this.state = { ...this.state, cloud: 'loading', message: null }; this.publish();
    try {
      await Promise.race([cancelled, this.options.generate(request, controller.signal, event => {
        if (controller.signal.aborted || !current()) return;
        if (event.type === 'comment') this.offer({ ...event.comment, createdAt: this.now(), expiresAt: Math.min(this.now() + 10000, started + 15000), requestStartedAt: started });
        if (event.type === 'error') { this.cooldownUntil = this.now() + (event.retryAfterMs ?? 30000); this.state = { ...this.state, cloud: event.retryAfterMs ? 'limited' : 'error', message: event.message }; this.publish(); }
        if (event.type === 'done' && this.state.cloud === 'loading') {
          const unavailable = event.count === 0 || event.status === 'cancelled';
          if (unavailable) this.cooldownUntil = this.now() + 30000;
          this.state = { ...this.state, cloud: unavailable ? 'error' : 'ready', message: event.status === 'complete' && event.count > 0 ? null : event.count === 0 ? '这次 AI 没有生成新弹幕；本地反馈继续。' : 'AI 这一轮回应不完整；本地反馈继续。' };
          this.publish();
        }
      })]);
      if (current() && this.state.cloud === 'loading') { this.cooldownUntil = this.now() + 30000; this.state = { ...this.state, cloud: 'error', message: 'AI 响应暂未完成；本地反馈继续工作。' }; }
    } catch {
      if (current()) { this.cooldownUntil = this.now() + 30000; this.state = { ...this.state, cloud: 'error', message: 'AI 响应暂未完成；本地反馈继续工作。' }; }
    } finally { clearTimeout(timer); controller.signal.removeEventListener('abort', cancelWait); if (this.requests.get(request.requestId) === controller) this.requests.delete(request.requestId); if (current()) this.publish(); }
  }
  manual(text: unknown) {
    const valid = cleanComment(text); if (!valid || !this.runId) return false;
    const now = this.now(); return this.offer({ commentId: this.id(), source: 'local', kind: 'regular', audioSessionId: this.audioId!, danmuRunId: this.runId, snapshotId: this.id(), text: valid, createdAt: now, expiresAt: now + 6000 });
  }
  stop() {
    ++this.cloudGeneration;
    this.audioId = null; this.runId = null; if (this.timer) clearInterval(this.timer); this.timer = null;
    for (const controller of this.requests.values()) controller.abort(); this.requests.clear(); this.firstRequests.clear(); this.queue?.stop(); this.state = { ...this.initialState(), history: this.state?.history ?? [] }; this.publish();
  }
  dispose() { this.stop(); this.listeners.clear(); }
}
