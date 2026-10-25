import { expect, it, vi } from 'vitest';
import { createBrowserRecorder } from '../../packages/sdk/src/recorder-backend';
import type { RecordingTap } from '../../packages/sdk/src/audio-session';

it('keeps the last data event before stop and releases only its own audio branch', async () => {
  class Native {
    static isTypeSupported() { return true; }
    mimeType = 'audio/mp4'; state = 'inactive';
    onstart?: () => void; onstop?: () => void; ondataavailable?: (event: { data: Blob }) => void;
    start() { this.state = 'recording'; queueMicrotask(() => this.onstart?.()); }
    stop() { this.state = 'inactive'; queueMicrotask(() => { this.ondataavailable?.({ data: new Blob(['last']) }); this.onstop?.(); }); }
  }
  const dispose = vi.fn(), finalizeAfter = vi.fn(), tap = { stream: {}, sampleRate: 48000, channels: 1, sourceSeconds: () => 0, finalizeAfter, dispose } as RecordingTap;
  const data = vi.fn(), backend = createBrowserRecorder(tap, data, vi.fn(), Native as unknown as typeof MediaRecorder);
  await backend.start(); const finishing = backend.stop(); expect(finalizeAfter).toHaveBeenCalledWith(finishing); await finishing; expect(data).toHaveBeenCalledOnce(); expect(await data.mock.calls[0][0].text()).toBe('last');
  backend.dispose(); expect(dispose).toHaveBeenCalledOnce();
});
