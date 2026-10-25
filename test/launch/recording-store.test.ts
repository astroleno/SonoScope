import { expect, it } from 'vitest';
import { RecordingWriteQueue } from '../../packages/sdk/src/recording-store';
import { deferred } from './fixtures';

it('bounds slow storage and does not execute writes beyond the recording budget', async () => {
  const queue = new RecordingWriteQueue(10), saved = deferred<void>(); let writes = 0;
  const first = queue.enqueue(8, () => { writes++; return saved.promise; });
  await expect(queue.enqueue(3, async () => { writes++; })).rejects.toThrow('保存速度');
  expect(queue.pendingBytes).toBe(8); saved.resolve(); await first; await queue.drain();
  expect(writes).toBe(1); expect(queue.pendingBytes).toBe(0);
});

it('keeps a failed write visible and rejects subsequent queued work without marking it saved', async () => {
  const queue = new RecordingWriteQueue(), failed = deferred<void>(); let secondRan = false;
  const first = queue.enqueue(1, () => failed.promise), second = queue.enqueue(1, async () => { secondRan = true; });
  const firstCheck = expect(first).rejects.toThrow('disk full'), secondCheck = expect(second).rejects.toThrow('disk full');
  failed.reject(new Error('disk full')); await firstCheck; await secondCheck;
  await expect(queue.drain()).rejects.toThrow('disk full'); expect(secondRan).toBe(false);
});
