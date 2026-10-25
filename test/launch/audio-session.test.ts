import { describe, expect, it, vi } from 'vitest';
import { AudioSession, browserAudioEnvironment, type AudioEnvironment } from '../../packages/sdk/src/audio-session';
import { FeaturePipeline, type FeatureWorker } from '../../packages/sdk/src/feature-pipeline';
import { deferred, frame } from './fixtures';

function environment() {
  const permission = deferred<MediaStream>();
  const track = { stop: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() };
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  const input = { connect: vi.fn(), disconnect: vi.fn() };
  const context = { state: 'running', sampleRate: 48000, resume: vi.fn().mockResolvedValue(undefined), close: vi.fn().mockResolvedValue(undefined), createMediaStreamSource: vi.fn().mockReturnValue(input) } as unknown as AudioContext;
  const capture = { mode: 'worklet' as const, dispose: vi.fn() };
  const env: AudioEnvironment = { getUserMedia: vi.fn(() => permission.promise), createContext: () => context, capture: vi.fn(async () => capture), id: () => 'audio-id' };
  return { env, permission, stream, track, context, capture };
}
describe('audio lifecycle', () => {
  it('releases the microphone immediately while an encoder finishes its detached recording branch', async () => {
    const e = environment(), completion = deferred<void>();
    const recordedTrack = { stop: vi.fn() }, destination = { channelCount: 1, stream: { getTracks: () => [recordedTrack] }, disconnect: vi.fn() };
    Object.assign(e.context, { createMediaStreamDestination: () => destination });
    Object.assign(e.stream, { getAudioTracks: () => [{ getSettings: () => ({ channelCount: 1 }) }] });
    const session = new AudioSession(e.env), starting = session.start(); e.permission.resolve(e.stream); await starting;
    const tap = session.createRecordingTap(); tap.finalizeAfter!(completion.promise); session.stop();
    expect(e.track.stop).toHaveBeenCalledOnce(); expect(e.capture.dispose).toHaveBeenCalledOnce(); expect(recordedTrack.stop).not.toHaveBeenCalled(); expect(e.context.close).not.toHaveBeenCalled();
    completion.resolve(); await vi.waitFor(() => expect(e.context.close).toHaveBeenCalledOnce());
    expect(recordedTrack.stop).toHaveBeenCalledOnce(); tap.dispose(); session.dispose(); expect(e.context.close).toHaveBeenCalledOnce();
  });
  it('bounds encoder finalization when its completion never arrives', async () => {
    vi.useFakeTimers();
    try {
      const e = environment(), recordedTrack = { stop: vi.fn() };
      Object.assign(e.context, { createMediaStreamDestination: () => ({ channelCount: 1, stream: { getTracks: () => [recordedTrack] }, disconnect: vi.fn() }) });
      Object.assign(e.stream, { getAudioTracks: () => [{ getSettings: () => ({ channelCount: 1 }) }] });
      const session = new AudioSession(e.env), starting = session.start(); e.permission.resolve(e.stream); await starting;
      session.createRecordingTap().finalizeAfter!(new Promise(() => {})); session.stop();
      expect(e.track.stop).toHaveBeenCalledOnce(); await vi.advanceTimersByTimeAsync(10000);
      expect(recordedTrack.stop).toHaveBeenCalledOnce(); expect(e.context.close).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0); session.dispose();
    } finally { vi.useRealTimers(); }
  });
  it('records from the existing source and releases its tap without taking microphone ownership', async () => {
    const e = environment(), input = { channelCount: 1, connect: vi.fn(), disconnect: vi.fn() };
    (e.context.createMediaStreamSource as ReturnType<typeof vi.fn>).mockReturnValue(input);
    const recordedTrack = { stop: vi.fn() }, destination = { channelCount: 2, stream: { getTracks: () => [recordedTrack] }, disconnect: vi.fn() };
    Object.assign(e.context, { createMediaStreamDestination: () => destination, currentTime: 12 });
    Object.assign(e.stream, { getAudioTracks: () => [{ getSettings: () => ({ channelCount: 1 }) }] });
    const session = new AudioSession(e.env), pending = session.start(); e.permission.resolve(e.stream); await pending;
    const tap = session.createRecordingTap(); expect(e.env.getUserMedia).toHaveBeenCalledOnce(); expect(tap.channels).toBe(1); expect(tap.sourceSeconds()).toBe(12);
    tap.dispose(); tap.dispose(); expect(recordedTrack.stop).toHaveBeenCalledOnce(); expect(e.track.stop).not.toHaveBeenCalled(); expect(e.capture.dispose).not.toHaveBeenCalled();
    const before = vi.fn(() => expect(e.track.stop).not.toHaveBeenCalled()); session.beforeStop(before); session.stop('test-interruption');
    expect(before).toHaveBeenCalledWith('test-interruption'); expect(e.track.stop).toHaveBeenCalledOnce(); session.dispose();
  });
  it('releases capture on system audio suspension and announces its interruption before releasing tracks', async () => {
    const e = environment(); let changed: (() => void) | undefined;
    Object.assign(e.context, { addEventListener: (_type: string, listener: () => void) => { changed = listener; }, removeEventListener: vi.fn() });
    const session = new AudioSession(e.env), before = vi.fn(() => expect(e.track.stop).not.toHaveBeenCalled()); session.beforeStop(before);
    const starting = session.start(); e.permission.resolve(e.stream); await starting;
    Object.defineProperty(e.context, 'state', { value: 'suspended' }); changed?.();
    expect(before).toHaveBeenCalledWith('audio-interrupted'); expect(session.current.error?.code).toBe('audio-interrupted'); expect(e.track.stop).toHaveBeenCalledOnce();
    expect(e.context.removeEventListener).toHaveBeenCalledOnce(); session.dispose();
  });
  it('waits for device startup before the worklet loader and cancels a pending resume on stop', async () => {
    const e = environment(), resumed = deferred<void>(); (e.context.resume as ReturnType<typeof vi.fn>).mockReturnValue(resumed.promise);
    const session = new AudioSession(e.env), pending = session.start(); e.permission.resolve(e.stream);
    await vi.waitFor(() => expect(e.context.createMediaStreamSource).toHaveBeenCalledOnce());
    expect(e.env.capture).not.toHaveBeenCalled(); session.stop();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' }); expect(e.context.close).toHaveBeenCalledOnce(); expect(e.env.capture).not.toHaveBeenCalled();
    resumed.resolve(); session.dispose();
  });
  it('delivers the first file PCM while the media play promise is still pending', async () => {
    const e = environment(), playing = deferred<void>(); let receive!: (pcm: Float32Array, time: number) => void;
    e.env.openFile = async () => ({ input: { connect: vi.fn(), disconnect: vi.fn() } as unknown as AudioNode, play: () => playing.promise, dispose: vi.fn() });
    e.env.capture = async (_context, _input, callback) => { receive = callback; return e.capture; };
    const session = new AudioSession(e.env), listener = vi.fn(); session.onPCM(listener);
    try {
      const pending = session.start({ type: 'file', file: { size: 1000 } as File });
      await vi.waitFor(() => expect(session.current.status).toBe('running'));
      receive(new Float32Array([.1, .2]), .1); expect(listener).toHaveBeenCalledOnce();
      playing.resolve(); await pending;
    } finally { session.dispose(); }
  });
  it('maps source capture time through the AudioContext clock instead of hiding delayed callbacks', async () => {
    const e = environment(); let receive!: (pcm: Float32Array, time: number) => void;
    e.env.capture = async (_context, _input, callback) => { receive = callback; return e.capture; };
    Object.defineProperty(e.context, 'currentTime', { value: 12.5, configurable: true });
    const session = new AudioSession(e.env, () => 20000), captured = vi.fn(); session.onPCM(captured);
    try {
      const pending = session.start(); e.permission.resolve(e.stream); await pending;
      receive(new Float32Array(1024), 12); expect(captured.mock.calls[0][4]).toBe(19500);
      receive(new Float32Array(1024), 12.6); expect(captured.mock.calls[1][4]).toBe(20000);
    } finally { session.dispose(); }
  });
  it('duplicate start shares one permission promise and one resource owner', async () => {
    const e = environment(), session = new AudioSession(e.env); const a = session.start(), b = session.start(); expect(a).toBe(b);
    e.permission.resolve(e.stream); await a; expect(e.env.getUserMedia).toHaveBeenCalledTimes(1); expect(session.current.status).toBe('running');
    session.dispose(); expect(e.track.stop).toHaveBeenCalledTimes(1); expect(e.capture.dispose).toHaveBeenCalledTimes(1);
  });
  it('stop during permission prompt closes context and releases a later stream', async () => {
    const e = environment(), session = new AudioSession(e.env); const p = session.start(); session.stop(); e.permission.resolve(e.stream);
    await expect(p).rejects.toMatchObject({ name: 'AbortError' }); expect(e.track.stop).toHaveBeenCalledTimes(1); expect(session.current.status).toBe('idle'); expect(e.env.capture).not.toHaveBeenCalled();
  });
  it('permission denial has actionable public state and can retry', async () => {
    const e = environment(), session = new AudioSession(e.env); const p = session.start(); e.permission.reject(new DOMException('denied', 'NotAllowedError'));
    await expect(p).rejects.toThrow(); expect(session.current.error?.code).toBe('permission-denied'); expect(session.current.error?.message).toContain('重试');
    session.dispose();
  });
  it('twenty starts/stops keep one owner and clear all tracks', async () => {
    const environments = Array.from({ length: 20 }, environment); let n = 0;
    const session = new AudioSession({ id: () => `s-${n}`, createContext: () => environments[n].context, getUserMedia: async () => environments[n].stream, capture: async () => environments[n].capture });
    for (; n < 20; n++) { await session.start(); session.stop(); }
    for (const e of environments) { expect(e.track.stop).toHaveBeenCalledTimes(1); expect(e.capture.dispose).toHaveBeenCalledTimes(1); }
    session.dispose();
  });
  it('old worker frames and late model initialization cannot publish to the next session', () => {
    const workers: FeatureWorker[] = [];
    const factory = () => { const worker = { postMessage: vi.fn(), terminate: vi.fn(), onmessage: null, onerror: null } as FeatureWorker; workers.push(worker); return worker; };
    const pipeline = new FeaturePipeline({ workerFactory: factory }); const listener = vi.fn(); pipeline.onFrame(listener); pipeline.start('audio-old');
    const old = workers[0], callback = old.onmessage!; pipeline.start('audio-new');
    callback({ data: { type: 'frame', audioSessionId: 'audio-old', seq: 1, audioTime: 1, capturedAt: Date.now(), sampleRate: 44100, values: frame().values } } as MessageEvent);
    expect(listener).not.toHaveBeenCalled(); expect(old.terminate).toHaveBeenCalledTimes(1); pipeline.dispose();
  });
  it('a stalled DSP worker falls back instead of leaving a permanently full mailbox', async () => {
    vi.useFakeTimers();
    const worker = { postMessage: vi.fn(), terminate: vi.fn(), onmessage: null, onerror: null } as FeatureWorker;
    const pipeline = new FeaturePipeline({ workerFactory: () => worker }), listener = vi.fn(); pipeline.onFrame(listener);
    try {
      pipeline.start('session');
      worker.onmessage!({ data: { type: 'dsp-ready', audioSessionId: 'session' } } as MessageEvent);
      pipeline.feed(new Float32Array(1024).fill(.1), 44100, .1, 'session');
      await vi.advanceTimersByTimeAsync(2000); expect(worker.terminate).toHaveBeenCalledOnce();
      pipeline.feed(new Float32Array(1024).fill(.1), 44100, 1, 'session'); expect(listener).toHaveBeenCalledOnce();
      pipeline.dispose(); expect(vi.getTimerCount()).toBe(0);
    } finally { pipeline.dispose(); vi.useRealTimers(); }
  });
  it('stop during a late file-source open releases its media handle without decoding a whole long file', async () => {
    const e = environment(), opening = deferred<import('../../packages/sdk/src/audio-session').FileSourceHandle>();
    const media = { input: { connect: vi.fn(), disconnect: vi.fn() } as unknown as AudioNode, play: vi.fn().mockResolvedValue(undefined), dispose: vi.fn() };
    const session = new AudioSession({ ...e.env, openFile: () => opening.promise });
    const file = { size: 1000 } as File, pending = session.start({ type: 'file', file }); session.stop(); opening.resolve(media);
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' }); expect(media.dispose).toHaveBeenCalledOnce(); expect(media.play).not.toHaveBeenCalled(); expect(e.context.close).toHaveBeenCalledOnce();
  });
  it('an exposed but stalled worklet loader falls back within two seconds and stop clears its timer', async () => {
    vi.useFakeTimers(); vi.stubGlobal('AudioWorkletNode', class {});
    const node = { connect: vi.fn(), disconnect: vi.fn(), onaudioprocess: null }, gain = { connect: vi.fn(), disconnect: vi.fn(), gain: { value: 1 } };
    const context = { state: 'running', audioWorklet: { addModule: () => new Promise(() => {}) }, createScriptProcessor: vi.fn(() => node), createGain: () => gain, destination: {} } as unknown as AudioContext;
    const input = { connect: vi.fn(), disconnect: vi.fn() } as unknown as AudioNode;
    try {
      const env = browserAudioEnvironment('/SonoScope/audio/capture-worklet.js'), pending = env.capture(context, input, () => {});
      await vi.advanceTimersByTimeAsync(2000); const capture = await pending;
      expect(capture.mode).toBe('compatibility'); capture.dispose(); expect(vi.getTimerCount()).toBe(0);
      const cancelled = new AbortController(), retry = env.capture(context, input, () => {}, cancelled.signal); cancelled.abort();
      await expect(retry).rejects.toMatchObject({ name: 'AbortError' }); expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); vi.unstubAllGlobals(); }
  });
});
