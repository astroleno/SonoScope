import { cleanComment, type AudioValues, type PresetId } from './contracts';

export const RECORDING_VERSION = '1' as const;
export const RECORDING_WRITE_LIMIT = 8 * 1024 * 1024;
export const RECORDING_CACHE_LIMIT = 4 * 1024 * 1024;
export type RecordingStatus = 'recording' | 'finalizing' | 'saved' | 'interrupted' | 'failed' | 'deleting';
export interface RecordingManifest {
  version: typeof RECORDING_VERSION;
  id: string;
  title: string;
  createdAt: number;
  status: RecordingStatus;
  durationMs: number;
  bytes: number;
  mimeType: string;
  sampleRate: number;
  channels: number;
  mediaStorage: 'opfs' | 'indexeddb';
  lastEventSeq: number;
  commentCount: number;
  appVersion: string;
  sourceType?: 'device' | 'stream' | 'file';
  message: string | null;
  mediaCrc32?: number;
}
export interface RecordingControls { preset: PresetId; spectrum: boolean; pausedMotion: boolean; danmuEnabled: boolean }
export interface RecordedComment {
  id: string;
  text: string;
  source: 'local' | 'ai';
  startMs: number;
  endMs: number;
  durationMs: number;
  elapsedMs: number;
  order: number;
}
export type RecordingEvent = { seq: number; atMs: number } & (
  | { type: 'comment-show'; id: string; text: string; source: 'local' | 'ai'; durationMs: number; elapsedMs?: number }
  | { type: 'comment-hide'; id: string }
  | { type: 'visual'; values: AudioValues; sampleRate: number }
  | { type: 'controls'; controls: RecordingControls }
  | { type: 'interruption'; reason: string }
);
export const DEFAULT_RECORDING_CONTROLS: RecordingControls = { preset: 'wave', spectrum: false, pausedMotion: false, danmuEnabled: true };
const presets = new Set(['wave', 'accretion', 'spiral', 'mosaic', 'mochi', 'pulse']);
const statuses = new Set<RecordingStatus>(['recording', 'finalizing', 'saved', 'interrupted', 'failed', 'deleting']);
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown, max = Number.MAX_SAFE_INTEGER) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max;
const integer = (v: unknown, max = Number.MAX_SAFE_INTEGER) => finite(v, max) && Number.isInteger(v);
export const validRecordingId = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,96}$/.test(v);
export function isRecordingManifest(v: unknown): v is RecordingManifest {
  if (!object(v)) return false;
  return v.version === RECORDING_VERSION && validRecordingId(v.id) && typeof v.title === 'string' && v.title.length <= 160 && cleanComment(v.title) === v.title &&
    finite(v.createdAt) && statuses.has(v.status as RecordingStatus) && finite(v.durationMs) && integer(v.bytes) &&
    typeof v.mimeType === 'string' && /^audio\/[a-z0-9.+-]+(?:;[a-z0-9=., _"-]+)?$/i.test(v.mimeType) && v.mimeType.length <= 150 &&
    typeof v.sampleRate === 'number' && v.sampleRate >= 8000 && v.sampleRate <= 192000 && integer(v.channels, 32) && v.channels !== 0 &&
    ['opfs', 'indexeddb'].includes(String(v.mediaStorage)) && integer(v.lastEventSeq) && integer(v.commentCount) &&
    typeof v.appVersion === 'string' && v.appVersion.length <= 100 && (v.sourceType === undefined || ['device', 'stream', 'file'].includes(String(v.sourceType))) && (v.message === null || typeof v.message === 'string' && v.message.length <= 500) && (v.mediaCrc32 === undefined || integer(v.mediaCrc32, 0xffffffff));
}
export function isRecordingControls(v: unknown): v is RecordingControls {
  return object(v) && presets.has(String(v.preset)) && ['spectrum', 'pausedMotion', 'danmuEnabled'].every(k => typeof v[k] === 'boolean');
}
function isVisual(v: unknown): v is AudioValues {
  if (!object(v) || !object(v.bands)) return false;
  if (!['rms', 'zcr', 'centroidHz', 'bandwidthHz', 'rolloffHz', 'flatness', 'flux'].every(k => finite(v[k], 192000))) return false;
  if (!['low', 'mid', 'high'].every(k => finite((v.bands as Record<string, unknown>)[k], 1e12))) return false;
  if (![v.bands.columns, v.mfcc, v.chroma, v.contrastDb].every(a => Array.isArray(a) && a.length <= 64 && a.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1e12))) return false;
  if (v.tempo !== null && (!object(v.tempo) || !finite(v.tempo.bpm, 1000) || !finite(v.tempo.confidence, 1))) return false;
  return v.hpss === null || object(v.hpss) && finite(v.hpss.harmonic, 1) && finite(v.hpss.percussive, 1);
}
export function isRecordingEvent(v: unknown): v is RecordingEvent {
  if (!object(v) || !integer(v.seq) || v.seq === 0 || !finite(v.atMs)) return false;
  if (v.type === 'comment-show') return validRecordingId(v.id) && typeof v.text === 'string' && cleanComment(v.text) === v.text && ['local', 'ai'].includes(String(v.source)) && finite(v.durationMs, 30000) && v.durationMs !== 0 && (v.elapsedMs === undefined || finite(v.elapsedMs, v.durationMs as number) && v.elapsedMs !== v.durationMs);
  if (v.type === 'comment-hide') return validRecordingId(v.id);
  if (v.type === 'controls') return isRecordingControls(v.controls);
  if (v.type === 'visual') return typeof v.sampleRate === 'number' && v.sampleRate >= 8000 && v.sampleRate <= 192000 && isVisual(v.values);
  return v.type === 'interruption' && typeof v.reason === 'string' && v.reason.length <= 200;
}
/** Only the inputs consumed by visual presets are persisted; classification never is. */
export function recordingVisual(values: AudioValues): AudioValues {
  return { ...values, bands: { ...values.bands, columns: values.bands.columns.slice(0, 32) }, mfcc: values.mfcc.slice(0, 4), chroma: [], contrastDb: [], tempo: values.tempo ? { ...values.tempo } : null, hpss: values.hpss ? { ...values.hpss } : null };
}
