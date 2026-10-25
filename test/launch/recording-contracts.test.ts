import { expect, it } from 'vitest';
import { DEFAULT_RECORDING_CONTROLS, isRecordingEvent, isRecordingManifest, validRecordingId } from '../../packages/core/src/recording-contracts';

it('rejects invalid archive paths, non-finite clocks and unsupported timeline content', () => {
  expect(validRecordingId('../other-session')).toBe(false);
  expect(isRecordingEvent({ seq: 1, atMs: 0, type: 'controls', controls: DEFAULT_RECORDING_CONTROLS })).toBe(true);
  expect(isRecordingEvent({ seq: 1, atMs: Infinity, type: 'controls', controls: DEFAULT_RECORDING_CONTROLS })).toBe(false);
  expect(isRecordingEvent({ seq: 1, atMs: 10, type: 'comment-show', id: 'safe', text: '', source: 'local', durationMs: 6500 })).toBe(false);
  expect(isRecordingEvent({ seq: 2, atMs: 1, type: 'comment-show', id: 'safe', text: '声音轻了下来', source: 'ai', durationMs: 6500 })).toBe(true);
  expect(isRecordingEvent({ seq: 3, atMs: 1, type: 'script', text: '<script>' })).toBe(false);
});

it('keeps incomplete and finalized archives versioned, with validated media metadata', () => {
  const manifest = { version: '1', id: 'archive-1', title: '一段录播', createdAt: 1000, status: 'saved', durationMs: 10000, bytes: 10240, mimeType: 'audio/mp4;codecs=mp4a.40.2', sampleRate: 48000, channels: 1, mediaStorage: 'opfs', lastEventSeq: 200, commentCount: 20, appVersion: '1', message: null };
  expect(isRecordingManifest(manifest)).toBe(true);
  expect(isRecordingManifest({ ...manifest, version: '99' })).toBe(false);
  expect(isRecordingManifest({ ...manifest, channels: 0 })).toBe(false);
  expect(isRecordingManifest({ ...manifest, mimeType: 'text/html' })).toBe(false);
  expect(isRecordingManifest({ ...manifest, bytes: -1 })).toBe(false);
});
