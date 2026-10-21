import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserAudioEnvironment } from '../../packages/sdk/src/audio-session';

function captureEnvironment(failure?: 'constructor' | 'connection') {
  const port = { onmessage: null as ((event: MessageEvent) => void) | null, close: vi.fn() };
  const worklet = { port, connect: vi.fn(), disconnect: vi.fn() };
  const compatible = { onaudioprocess: null, connect: vi.fn(), disconnect: vi.fn() };
  const gain = { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() };
  const input = { connect: vi.fn(), disconnect: vi.fn() };
  const context = {
    state: 'running', destination: {},
    audioWorklet: { addModule: vi.fn().mockResolvedValue(undefined) },
    createGain: vi.fn(() => gain), createScriptProcessor: vi.fn(() => compatible),
  };
  if (failure === 'connection') worklet.connect.mockImplementation(() => { throw new Error('Worklet graph unavailable'); });
  vi.stubGlobal('AudioWorkletNode', class {
    constructor() { if (failure === 'constructor') throw new Error('Processor unavailable'); return worklet; }
  });
  return { port, worklet, compatible, gain, input, context, env: browserAudioEnvironment('/SonoScope/audio/capture-worklet.js') };
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('browser capture fallback', () => {
  it('falls back when the browser loads the module but cannot construct its processor', async () => {
    const e = captureEnvironment('constructor');
    const capture = await e.env.capture(e.context as unknown as AudioContext, e.input as unknown as AudioNode, () => {});
    expect(capture.mode).toBe('compatibility');
    expect(e.context.createScriptProcessor).toHaveBeenCalledOnce();
    capture.dispose(); expect(e.compatible.disconnect).toHaveBeenCalledOnce();
  });

  it('cleans up a partially connected worklet and preserves other input destinations during fallback', async () => {
    const e = captureEnvironment('connection');
    const capture = await e.env.capture(e.context as unknown as AudioContext, e.input as unknown as AudioNode, () => {});
    expect(capture.mode).toBe('compatibility');
    expect(e.port.close).toHaveBeenCalledOnce(); expect(e.worklet.disconnect).toHaveBeenCalledOnce();
    expect(e.input.disconnect).toHaveBeenCalledWith(e.worklet);
    expect(e.input.disconnect).not.toHaveBeenCalledWith();
    expect(e.input.connect).toHaveBeenLastCalledWith(e.compatible);
    capture.dispose();
  });

  it('does not start a worklet download or a compatibility graph after cancellation', async () => {
    const e = captureEnvironment(), cancelled = new AbortController(); cancelled.abort();
    await expect(e.env.capture(e.context as unknown as AudioContext, e.input as unknown as AudioNode, () => {}, cancelled.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(e.context.audioWorklet.addModule).not.toHaveBeenCalled();
    expect(e.context.createScriptProcessor).not.toHaveBeenCalled();
  });

  it('uses the native worklet and delivers PCM without creating the compatibility processor', async () => {
    const e = captureEnvironment(), onPCM = vi.fn();
    const capture = await e.env.capture(e.context as unknown as AudioContext, e.input as unknown as AudioNode, onPCM);
    expect(capture.mode).toBe('worklet'); expect(e.context.createScriptProcessor).not.toHaveBeenCalled();
    const pcm = new Float32Array(1024); e.port.onmessage!({ data: { pcm, audioTime: 1.25 } } as MessageEvent);
    expect(onPCM).toHaveBeenCalledWith(pcm, 1.25);
    capture.dispose(); expect(e.port.onmessage).toBeNull(); expect(e.port.close).toHaveBeenCalledOnce();
  });
});
