import { Zip, ZipPassThrough, Unzip } from 'fflate';
import { isRecordingEvent, isRecordingManifest, type RecordingManifest, type RecordingEvent } from '@sonoscope/core';
import { verifyRecordedMedia } from './recorder-backend';
import { RecordingWriteQueue, type RecordingStore } from './recording-store';
import { crcUpdate, crcResult } from './recording-checksum';

const encoder = new TextEncoder();

/** Encoded media and event pages stream to a temporary local file, not an in-memory ZIP. */
export async function exportRecording(store: RecordingStore, id: string, signal?: AbortSignal): Promise<{ blob: Blob; dispose(): Promise<void> }> {
  checkCancellation(signal);
  const manifest = await store.get(id);
  if (!manifest || !['saved', 'interrupted'].includes(manifest.status)) throw new Error('请先完成录播保存。');
  const media = await store.media(id);
  if (media.size > 0xffffffff - 1024 * 1024) throw new Error('这段录播超过当前 ZIP 备份格式的大小范围。');
  const stage = await store.staging(), queue = new RecordingWriteQueue();
  let failure: Error | null = null;
  const zip = new Zip((error, data) => {
    if (error) { failure = error; return; }
    const stable = new Uint8Array(data);
    void queue.enqueue(stable.byteLength, () => stage.write(stable)).catch(error => { failure = error; });
  });
  const drain = async () => { await queue.drain(); checkCancellation(signal); if (failure) throw failure; };
  const smallFile = async (name: string, object: unknown) => { const entry = new ZipPassThrough(name); zip.add(entry); entry.push(encoder.encode(JSON.stringify(object)), true); await drain(); };
  try {
    await smallFile('manifest.json', manifest);
    const audio = new ZipPassThrough('audio'); zip.add(audio); let mediaCrc = -1;
    const reader = media.stream().getReader();
    try { for (;;) { checkCancellation(signal); const part = await reader.read(); if (part.done) break; mediaCrc = crcUpdate(mediaCrc, part.value); audio.push(part.value); await drain(); } } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
    audio.push(new Uint8Array(), true); await drain();
    if (manifest.mediaCrc32 !== undefined && manifest.mediaCrc32 !== crcResult(mediaCrc)) throw new Error('录播音频的校验值不符，请保留原材料并检查。');
    const events = new ZipPassThrough('events.ndjson'); zip.add(events);
    let seq = 0, eventsCrc = -1;
    for (;;) {
      checkCancellation(signal);
      const page = await store.events(id, seq); if (!page.length) break;
      for (const event of page) if (event.seq !== ++seq || !isRecordingEvent(event)) throw new Error('录播时间线不完整，无法导出。');
      const bytes = encoder.encode(page.map(event => JSON.stringify(event)).join('\n') + '\n'); eventsCrc = crcUpdate(eventsCrc, bytes); events.push(bytes); await drain();
    }
    if (seq !== manifest.lastEventSeq) throw new Error('录播时间线不完整，无法导出。');
    events.push(new Uint8Array(), true); await drain();
    await smallFile('integrity.json', { version: 1, mediaCrc32: crcResult(mediaCrc), eventsCrc32: crcResult(eventsCrc), bytes: media.size, eventCount: seq });
    zip.end(); await drain();
    const file = await stage.finish(); checkCancellation(signal); return { blob: file.slice(0, file.size, 'application/zip'), dispose: () => stage.dispose() };
  } catch (error) { zip.terminate(); await queue.drain().catch(() => undefined); await stage.dispose().catch(() => undefined); throw error; }
}

/** Only SS's four store-only entries are accepted; arbitrary ZIP extraction is excluded. */
export async function restoreRecording(store: RecordingStore, archive: Blob, verify = verifyRecordedMedia, signal?: AbortSignal): Promise<RecordingManifest> {
  checkCancellation(signal);
  await validateZipEnd(archive);
  const seen = new Set<string>(), finished = new Set<string>();
  let manifest: RecordingManifest | null = null, integrity: { version: number; bytes: number; mediaCrc32: number; eventsCrc32: number; eventCount: number } | null = null;
  let created = false, chunkIndex = 0, mediaBytes = 0, mediaCrc = -1, eventsCrc = -1, seq = 0, comments = 0;
  let failure: Error | null = null;
  const queue = new RecordingWriteQueue();
  const append = (bytes: number, work: () => Promise<unknown>) => { void queue.enqueue(bytes, work).catch(error => { failure = error; }); };
  const unzip = new Unzip(file => {
    if (!['manifest.json', 'audio', 'events.ndjson', 'integrity.json'].includes(file.name) || seen.has(file.name) || file.compression !== 0) throw new Error('这不是有效的 SS 录播备份。');
    if (seen.size === 0 && file.name !== 'manifest.json') throw new Error('备份缺少开头的录播清单。');
    seen.add(file.name);
    const small: Uint8Array[] = []; let smallBytes = 0, text = ''; const decoder = new TextDecoder('utf-8', { fatal: true });
    file.ondata = (error, data, final) => {
      if (error) { failure = error; return; }
      try {
        if (file.name === 'manifest.json' || file.name === 'integrity.json') {
          smallBytes += data.byteLength; if (smallBytes > 65536) throw new Error('备份清单过大。'); small.push(new Uint8Array(data));
          if (final) {
            const object = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(combine(small, smallBytes)));
            if (file.name === 'manifest.json') {
              if (!isRecordingManifest(object) || !['saved', 'interrupted'].includes(object.status)) throw new Error('备份版本或录播信息无效。');
              manifest = object;
              append(smallBytes, async () => {
                if (await store.get(object.id)) throw new Error('这段录播已在库中，未覆盖现有内容。');
                await store.create({ ...object, status: 'recording', bytes: 0, lastEventSeq: 0, commentCount: 0, message: null }); created = true;
              });
            } else integrity = object;
          }
        } else {
          if (!manifest) throw new Error('备份缺少录播信息。');
          if (file.name === 'audio') {
            mediaBytes += data.byteLength; if (mediaBytes > manifest.bytes || mediaBytes > archive.size) throw new Error('备份音频大小不符。');
            mediaCrc = crcUpdate(mediaCrc, data);
            if (data.byteLength) { const blob = new Blob([new Uint8Array(data)]), index = chunkIndex++, id = manifest.id; append(blob.size, () => store.appendMedia(id, index, blob)); }
          } else {
            eventsCrc = crcUpdate(eventsCrc, data); text += decoder.decode(data, { stream: !final });
            const lines = text.split('\n'); text = lines.pop()!;
            if (text.length > 128 * 1024) throw new Error('备份时间线条目过大。');
            if (final && text) { lines.push(text); text = ''; }
            const events: RecordingEvent[] = [];
            for (const line of lines) {
              if (!line) continue;
              if (line.length > 128 * 1024) throw new Error('备份时间线条目过大。');
              const event = JSON.parse(line);
              if (!isRecordingEvent(event) || event.seq !== ++seq || event.atMs > manifest.durationMs + 200) throw new Error('备份时间线无效。');
              if (event.type === 'comment-show') comments++; events.push(event);
            }
            const id = manifest.id;
            for (let offset = 0; offset < events.length; offset += 128) { const page = events.slice(offset, offset + 128); append(JSON.stringify(page).length * 2, () => store.appendEvents(id, page)); }
          }
        }
        if (final) finished.add(file.name);
      } catch (error) { failure = error instanceof Error ? error : new Error('录播备份损坏。'); file.terminate(); }
    };
    file.start();
  });
  const reader = archive.stream().getReader();
  try {
    for (;;) { checkCancellation(signal); const part = await reader.read(); if (part.done) break; unzip.push(part.value); await queue.drain(); if (failure) throw failure; }
    unzip.push(new Uint8Array(), true); await queue.drain(); if (failure) throw failure;
    if (!manifest || !integrity || finished.size !== 4 || integrity.version !== 1 || mediaBytes !== manifest.bytes || comments !== manifest.commentCount || seq !== manifest.lastEventSeq || integrity.bytes !== mediaBytes || integrity.eventCount !== seq || integrity.mediaCrc32 !== crcResult(mediaCrc) || integrity.eventsCrc32 !== crcResult(eventsCrc) || manifest.mediaCrc32 !== undefined && manifest.mediaCrc32 !== crcResult(mediaCrc)) throw new Error('录播备份的完整性校验未通过。');
    await store.finish(manifest.id, { status: 'finalizing', durationMs: manifest.durationMs });
    const blob = await store.media(manifest.id), durationMs = await verify(blob, manifest.durationMs);
    checkCancellation(signal);
    return await store.finish(manifest.id, { status: manifest.status, durationMs, message: manifest.message });
  } catch (error) {
    await queue.drain().catch(() => undefined);
    if (created && manifest) { await store.finish(manifest.id, { status: 'failed', message: '备份恢复未完成。' }).catch(() => undefined); await store.remove(manifest.id).catch(() => undefined); }
    throw error;
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}

/** Recovery creates a verified partial copy and preserves the original material. */
export async function recoverRecording(store: RecordingStore, id: string, verify = verifyRecordedMedia, signal?: AbortSignal): Promise<RecordingManifest> {
  checkCancellation(signal);
  return store.exclusive(id, async () => {
    const original = await store.get(id); if (!original || !original.bytes || original.status === 'saved' || original.status === 'deleting') throw new Error('这段录播没有可恢复的中断材料。');
    const media = await store.media(id), durationMs = await verify(media);
    checkCancellation(signal);
    const recoveredId = crypto.randomUUID(); let created = false;
    try {
      await store.create({ ...original, id: recoveredId, title: `${original.title.slice(0, 65)}（恢复）`, status: 'recording', bytes: 0, durationMs: 0, lastEventSeq: 0, commentCount: 0, message: null, mediaCrc32: undefined }); created = true;
      const reader = media.stream().getReader(); let index = 0, crc = -1;
      try { for (;;) { checkCancellation(signal); const part = await reader.read(); if (part.done) break; crc = crcUpdate(crc, part.value); await store.appendMedia(recoveredId, index++, new Blob([new Uint8Array(part.value)])); } } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
      let sourceSeq = 0, destinationSeq = 0;
      for (;;) {
        checkCancellation(signal);
        const events = await store.events(id, sourceSeq); if (!events.length) break;
        sourceSeq = events.at(-1)!.seq;
        const prefix = events.filter(event => event.atMs <= durationMs).map(event => ({ ...event, seq: ++destinationSeq }));
        if (prefix.length) await store.appendEvents(recoveredId, prefix);
      }
      const result = await store.finish(recoveredId, { status: 'interrupted', durationMs, mediaCrc32: crcResult(crc), message: '已恢复可播放音频和现存弹幕，弹幕同步未经验证；原始材料仍保留。' });
      await store.finish(id, { status: 'failed', message: '已生成可回看的恢复副本；原始材料仍保留。' }); return result;
    } catch (error) {
      if (created) { await store.finish(recoveredId, { status: 'failed' }).catch(() => undefined); await store.remove(recoveredId).catch(() => undefined); }
      throw error;
    }
  });
}

function checkCancellation(signal?: AbortSignal) { if (signal?.aborted) throw new DOMException('Recording operation cancelled', 'AbortError'); }

function combine(parts: Uint8Array[], size: number) { const bytes = new Uint8Array(size); let offset = 0; for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; } return bytes; }
async function validateZipEnd(blob: Blob) {
  if (blob.size < 22 || blob.size > 0xffffffff) throw new Error('录播备份大小无效。');
  const begin = Math.max(0, blob.size - 65557), tail = new DataView(await blob.slice(begin).arrayBuffer());
  for (let offset = tail.byteLength - 22; offset >= 0; offset--) {
    if (tail.getUint32(offset, true) !== 0x06054b50 || offset + 22 + tail.getUint16(offset + 20, true) !== tail.byteLength) continue;
    if (tail.getUint16(offset + 4, true) !== 0 || tail.getUint16(offset + 6, true) !== 0 || tail.getUint16(offset + 8, true) !== 4 || tail.getUint16(offset + 10, true) !== 4 || tail.getUint32(offset + 16, true) + tail.getUint32(offset + 12, true) > begin + offset) break;
    return;
  }
  throw new Error('备份文件不完整或不是 SS 录播格式。');
}
