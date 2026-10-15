/** Versioned, serializable contracts. PCM is never part of GenerationRequest. */
export const CONTRACT_VERSION = '2' as const;
export type PresetId = 'wave' | 'accretion' | 'spiral' | 'mosaic' | 'mochi' | 'pulse';
export type Provenance = 'dsp' | 'model' | 'heuristic';
export interface FeatureValidity {
  state: 'valid' | 'unknown';
  source: Provenance;
  unit: string;
}
export interface ModelResult {
  version: string;
  capturedAt: number;
  categories: { label: string; score: number }[];
  voiceProbability: number;
  instrument: { label: string; confidence: number } | null;
}
export interface AudioValues {
  rms: number;
  zcr: number;
  centroidHz: number;
  bandwidthHz: number;
  rolloffHz: number;
  flatness: number;
  flux: number;
  bands: { low: number; mid: number; high: number; columns: number[] };
  chroma: number[];
  mfcc: number[];
  contrastDb: number[];
  tempo: { bpm: number; confidence: number } | null;
  hpss: { harmonic: number; percussive: number } | null;
}
export interface FeatureFrame {
  version: typeof CONTRACT_VERSION;
  audioSessionId: string;
  seq: number;
  audioTime: number;
  capturedAt: number;
  sampleRate: number;
  values: AudioValues;
  validity: Record<string, FeatureValidity>;
  model: ModelResult | null;
}
export interface FeatureSnapshot {
  version: typeof CONTRACT_VERSION;
  audioSessionId: string;
  snapshotId: string;
  startAt: number;
  endAt: number;
  sampleRate: number;
  frames: number;
  stats: {
    rmsMean: number; rmsPeak: number; centroidHzMean: number; bandwidthHzMean: number;
    rolloffHzMean: number; flatnessMean: number; fluxMean: number; onsetRate: number;
    tempo: { bpm: number; confidence: number } | null;
    hpss: { harmonic: number; percussive: number } | null;
  };
  validity: Record<string, FeatureValidity>;
  model: ModelResult | null;
  capabilities: string[];
}
export interface GenerationRequest {
  version: typeof CONTRACT_VERSION;
  requestId: string;
  audioSessionId: string;
  danmuRunId: string;
  snapshot: FeatureSnapshot;
  locale: 'zh-CN' | 'en';
  history: string[];
}
export type CommentKind = 'regular' | 'companionship';
export interface CommentCandidate {
  commentId: string;
  source: 'local' | 'ai';
  kind: CommentKind;
  audioSessionId: string;
  danmuRunId: string;
  snapshotId: string;
  text: string;
  createdAt: number;
  expiresAt: number;
  requestStartedAt?: number;
}
export type StreamEvent =
  | { type: 'accepted'; requestId: string }
  | { type: 'comment'; requestId: string; comment: CommentCandidate }
  | { type: 'error'; requestId: string; code: string; message: string; retryAfterMs?: number }
  | { type: 'done'; requestId: string; status: 'complete' | 'partial' | 'cancelled'; count: number; usage?: { inputTokens: number; outputTokens: number } };

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const id = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,96}$/.test(v);
const allowedKeys = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).every(k => keys.includes(k));
export function cleanComment(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.normalize('NFKC').replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, '').trim();
  return text.length > 0 && Array.from(text).length <= 80 ? text : null;
}
export function textKey(text: string): string {
  return text.normalize('NFKC').toLocaleLowerCase().replace(/[\p{P}\p{Z}\s]/gu, '');
}
export function validateSnapshot(value: unknown): value is FeatureSnapshot {
  if (!object(value) || !allowedKeys(value, ['version', 'audioSessionId', 'snapshotId', 'startAt', 'endAt', 'sampleRate', 'frames', 'stats', 'validity', 'model', 'capabilities'])) return false;
  if (value.version !== CONTRACT_VERSION || !id(value.audioSessionId) || !id(value.snapshotId)) return false;
  if (!finite(value.startAt, 0, 1e14) || !finite(value.endAt, value.startAt, value.startAt + 10000) || !finite(value.sampleRate, 8000, 192000) || !Number.isInteger(value.frames) || !finite(value.frames, 1, 1000)) return false;
  const s = value.stats;
  if (!object(s) || !allowedKeys(s, ['rmsMean', 'rmsPeak', 'centroidHzMean', 'bandwidthHzMean', 'rolloffHzMean', 'flatnessMean', 'fluxMean', 'onsetRate', 'tempo', 'hpss'])) return false;
  for (const k of ['rmsMean', 'rmsPeak', 'flatnessMean', 'fluxMean']) if (!finite(s[k], 0, 1)) return false;
  for (const k of ['centroidHzMean', 'bandwidthHzMean', 'rolloffHzMean']) if (!finite(s[k], 0, value.sampleRate / 2)) return false;
  if (!finite(s.onsetRate, 0, 30)) return false;
  if (s.tempo !== null && (!object(s.tempo) || !allowedKeys(s.tempo, ['bpm', 'confidence']) || !finite(s.tempo.bpm, 40, 220) || !finite(s.tempo.confidence, 0, 1))) return false;
  if (s.hpss !== null && (!object(s.hpss) || !allowedKeys(s.hpss, ['harmonic', 'percussive']) || !finite(s.hpss.harmonic, 0, 1) || !finite(s.hpss.percussive, 0, 1))) return false;
  if (!object(value.validity) || Object.keys(value.validity).length > 20) return false;
  for (const [k, v] of Object.entries(value.validity)) {
    if (!/^[a-zA-Z]{1,30}$/.test(k) || !object(v) || !allowedKeys(v, ['state', 'source', 'unit']) || !['valid', 'unknown'].includes(String(v.state)) || !['dsp', 'model', 'heuristic'].includes(String(v.source)) || typeof v.unit !== 'string' || v.unit.length > 30) return false;
  }
  if (!Array.isArray(value.capabilities) || value.capabilities.length > 20 || !value.capabilities.every(v => typeof v === 'string' && /^[a-zA-Z0-9._-]{1,40}$/.test(v))) return false;
  if (value.model !== null) {
    const m = value.model;
    if (!object(m) || !allowedKeys(m, ['version', 'capturedAt', 'categories', 'voiceProbability', 'instrument']) || typeof m.version !== 'string' || m.version.length > 100 || !finite(m.capturedAt, 0, value.endAt + 5000) || !finite(m.voiceProbability, 0, 1)) return false;
    if (!Array.isArray(m.categories) || m.categories.length > 16 || !m.categories.every(c => object(c) && allowedKeys(c, ['label', 'score']) && typeof c.label === 'string' && c.label.length <= 100 && finite(c.score, 0, 1))) return false;
    if (m.instrument !== null && (!object(m.instrument) || !allowedKeys(m.instrument, ['label', 'confidence']) || typeof m.instrument.label !== 'string' || m.instrument.label.length > 100 || !finite(m.instrument.confidence, 0, 1))) return false;
  }
  return true;
}
export function validateGenerationRequest(value: unknown): value is GenerationRequest {
  if (!object(value) || !allowedKeys(value, ['version', 'requestId', 'audioSessionId', 'danmuRunId', 'snapshot', 'locale', 'history'])) return false;
  return value.version === CONTRACT_VERSION && id(value.requestId) && id(value.audioSessionId) && id(value.danmuRunId) && validateSnapshot(value.snapshot) && value.snapshot.audioSessionId === value.audioSessionId && ['zh-CN', 'en'].includes(String(value.locale)) && Array.isArray(value.history) && value.history.length <= 12 && value.history.every(v => cleanComment(v) !== null);
}
export function isStreamEvent(value: unknown): value is StreamEvent {
  if (!object(value) || !id(value.requestId)) return false;
  if (value.type === 'accepted') return true;
  if (value.type === 'error') return typeof value.code === 'string' && value.code.length <= 50 && typeof value.message === 'string' && value.message.length <= 200 && (value.retryAfterMs === undefined || finite(value.retryAfterMs, 0, 86400000));
  if (value.type === 'done') return ['complete', 'partial', 'cancelled'].includes(String(value.status)) && Number.isInteger(value.count) && finite(value.count, 0, 7);
  if (value.type !== 'comment' || !object(value.comment)) return false;
  const c = value.comment;
  return id(c.commentId) && id(c.audioSessionId) && id(c.danmuRunId) && id(c.snapshotId) && c.source === 'ai' && ['regular', 'companionship'].includes(String(c.kind)) && cleanComment(c.text) !== null && finite(c.createdAt, 0, 1e14) && finite(c.expiresAt, c.createdAt as number, (c.createdAt as number) + 15000);
}
