import type { AudioSource } from './types';

export type AudioState = { status: 'idle' | 'requesting' | 'running' | 'error' | 'disposed'; audioSessionId: string | null; error: { code: string; message: string } | null; capture: 'worklet' | 'compatibility' | null; sourceType?: AudioSource['type'] };
export interface CaptureHandle { dispose(): void; mode: 'worklet' | 'compatibility' }
export interface FileSourceHandle { input: AudioNode; play(): Promise<void>; dispose(): void }
export interface AudioEnvironment {
  getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream>;
  createContext(): AudioContext;
  openFile?(context: AudioContext, file: File, onEnded: () => void): Promise<FileSourceHandle>;
  capture(context: AudioContext, input: AudioNode, onPCM: (pcm: Float32Array, time: number) => void, signal?: AbortSignal): Promise<CaptureHandle>;
  id(): string;
}
export function audioError(error: unknown) {
  const name = error instanceof Error ? error.name : '';
  const errors: Record<string, [string, string]> = {
    NotAllowedError: ['permission-denied', '麦克风未获授权。请在浏览器的网站设置中允许麦克风，再点重试。'],
    NotFoundError: ['no-device', '没有找到麦克风。连接设备后重试，或选择音频文件。'],
    NotReadableError: ['device-busy', '麦克风暂时无法使用。关闭占用它的应用后重试。'],
    SecurityError: ['insecure-context', '麦克风需要 HTTPS 或本机 localhost 环境。'],
  };
  const [code, message] = errors[name] ?? ['audio-failed', '音频启动失败。请重试，或选择音频文件。'];
  return { code, message };
}
export function browserAudioEnvironment(workletUrl: string): AudioEnvironment {
  return {
    id: () => crypto.randomUUID(),
    getUserMedia: constraints => {
      if (!globalThis.isSecureContext || !navigator.mediaDevices?.getUserMedia) return Promise.reject(new DOMException('Secure capture unavailable', 'SecurityError'));
      return navigator.mediaDevices.getUserMedia(constraints);
    },
    createContext: () => new AudioContext({ latencyHint: 'interactive' }),
    async openFile(context, file, onEnded) {
      const url = URL.createObjectURL(file), element = new Audio();
      element.preload = 'auto'; element.src = url; element.onended = onEnded;
      const input = context.createMediaElementSource(element);
      return { input, play: () => element.play(), dispose: () => { element.onended = null; element.pause(); element.removeAttribute('src'); element.load(); URL.revokeObjectURL(url); } };
    },
    async capture(context, input, onPCM, signal) {
      if (context.audioWorklet && typeof AudioWorkletNode !== 'undefined') {
        let timer: ReturnType<typeof setTimeout> | undefined;
        let removeAbort = () => {};
        try {
          const timeout = new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => reject(new Error('Capture module timeout')), 2000);
            const abort = () => reject(new DOMException('Capture cancelled', 'AbortError'));
            if (signal?.aborted) abort(); else { signal?.addEventListener('abort', abort, { once: true }); removeAbort = () => signal?.removeEventListener('abort', abort); }
          });
          await Promise.race([context.audioWorklet.addModule(workletUrl), timeout]);
        } catch (error) {
          if (signal?.aborted || context.state === 'closed') throw error;
          return scriptCapture(context, input, onPCM);
        } finally { if (timer) clearTimeout(timer); removeAbort(); }
        const node = new AudioWorkletNode(context, 'sonoscope-capture', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1 });
        const mute = context.createGain(); mute.gain.value = 0;
        node.port.onmessage = e => {
          if (e.data?.pcm instanceof Float32Array && typeof e.data.audioTime === 'number') onPCM(e.data.pcm, e.data.audioTime);
        };
        input.connect(node); node.connect(mute); mute.connect(context.destination);
        return { mode: 'worklet', dispose: () => { node.port.onmessage = null; node.port.close(); input.disconnect(); node.disconnect(); mute.disconnect(); } };
      }
      return scriptCapture(context, input, onPCM);
    }
  };
}
function scriptCapture(context: AudioContext, input: AudioNode, onPCM: (pcm: Float32Array, time: number) => void): CaptureHandle {
  const node = context.createScriptProcessor(1024, 1, 1);
  const mute = context.createGain(); mute.gain.value = 0;
  node.onaudioprocess = e => onPCM(e.inputBuffer.getChannelData(0).slice(), e.playbackTime);
  input.connect(node); node.connect(mute); mute.connect(context.destination);
  return { mode: 'compatibility', dispose: () => { node.onaudioprocess = null; input.disconnect(); node.disconnect(); mute.disconnect(); } };
}

/** Sole owner of capture resources, including resources that arrive after stop(). */
export class AudioSession {
  private state: AudioState = { status: 'idle', audioSessionId: null, error: null, capture: null };
  private generation = 0;
  private pending: Promise<void> | null = null;
  private resources: { context: AudioContext; cancellation: AbortController; closed?: boolean; stream?: MediaStream; input?: AudioNode; capture?: CaptureHandle; file?: FileSourceHandle; ended?: () => void } | null = null;
  private listeners = new Set<(state: AudioState) => void>();
  private pcmListeners = new Set<(pcm: Float32Array, sampleRate: number, time: number, audioSessionId: string) => void>();
  constructor(private env: AudioEnvironment) {}
  get current() { return this.state; }
  subscribeState(fn: (state: AudioState) => void) { this.listeners.add(fn); fn(this.state); return () => { this.listeners.delete(fn); }; }
  onPCM(fn: (pcm: Float32Array, sampleRate: number, time: number, id: string) => void) { this.pcmListeners.add(fn); return () => { this.pcmListeners.delete(fn); }; }
  private set(state: AudioState) { this.state = state; for (const fn of this.listeners) fn(state); }
  start(source: AudioSource = { type: 'device' }): Promise<void> {
    if (this.state.status === 'disposed') return Promise.reject(new Error('AudioSession disposed'));
    if (this.pending) return this.pending;
    if (this.state.status === 'running') return Promise.resolve();
    const generation = ++this.generation, id = this.env.id();
    let context: AudioContext;
    try { context = this.env.createContext(); } catch (error) { this.set({ status: 'error', audioSessionId: null, error: audioError(error), capture: null }); return Promise.reject(error); }
    const r: NonNullable<typeof this.resources> = { context, cancellation: new AbortController() };
    this.resources = r;
    // Resume while still inside the explicit user gesture (important on Safari).
    const resumed = r.context.resume();
    void resumed.catch(() => undefined);
    this.set({ status: 'requesting', audioSessionId: id, error: null, capture: null, sourceType: source.type });
    const active = () => generation === this.generation && this.state.status !== 'disposed';
    const abortIfStale = () => { if (!active()) throw new DOMException('Capture cancelled', 'AbortError'); };
    const run = async () => {
      try {
        if (source.type === 'file') {
          if (!source.file) throw new Error('Missing audio file');
          if (!source.file.size || source.file.size > 100 * 1024 * 1024) throw new Error('Invalid file size');
          const ended = () => { if (active()) this.stop('file-ended'); };
          if (this.env.openFile) { r.file = await this.env.openFile(r.context, source.file, ended); r.input = r.file.input; }
          else {
            const buffer = await r.context.decodeAudioData(await source.file.arrayBuffer()); abortIfStale();
            const input = r.context.createBufferSource(); input.buffer = buffer; r.input = input; input.onended = ended;
            r.file = { input, play: async () => input.start(), dispose: () => { input.onended = null; } };
          }
          abortIfStale(); r.input.connect(r.context.destination);
        } else {
          r.stream = source.type === 'stream' && source.stream ? source.stream : await this.env.getUserMedia({ audio: { echoCancellation: source.options?.echoCancellation ?? false, noiseSuppression: source.options?.noiseSuppression ?? false, autoGainControl: source.options?.autoGainControl ?? false, ...(source.deviceId ? { deviceId: { exact: source.deviceId } } : {}) } });
          abortIfStale();
          r.input = r.context.createMediaStreamSource(r.stream);
          r.ended = () => { if (active()) { this.stop('device-ended'); this.set({ ...this.state, status: 'error', error: { code: 'device-ended', message: '音频输入已断开。连接设备后重试。' } }); } };
          for (const track of r.stream.getTracks()) track.addEventListener('ended', r.ended);
        }
        r.capture = await this.env.capture(r.context, r.input!, (pcm, time) => {
          if (active() && this.state.status === 'running') for (const fn of this.pcmListeners) fn(pcm, r.context.sampleRate, time, id);
        }, r.cancellation.signal);
        abortIfStale(); await resumed; abortIfStale();
        if (r.file) {
          let timer: ReturnType<typeof setTimeout> | undefined, removeAbort = () => {};
          try {
            const timeout = new Promise<never>((_resolve, reject) => {
              timer = setTimeout(() => reject(new Error('Audio file timeout')), 20000);
              const abort = () => reject(new DOMException('Capture cancelled', 'AbortError'));
              r.cancellation.signal.addEventListener('abort', abort, { once: true }); removeAbort = () => r.cancellation.signal.removeEventListener('abort', abort);
            });
            await Promise.race([r.file.play(), timeout]); abortIfStale();
          } finally { if (timer) clearTimeout(timer); removeAbort(); }
        }
        this.set({ status: 'running', audioSessionId: id, error: null, capture: r.capture.mode, sourceType: source.type });
      } catch (error) {
        this.release(r);
        if (active()) { this.resources = null; this.set({ status: 'error', audioSessionId: null, error: source.type === 'file' ? { code: 'file-unreadable', message: '无法读取这个音频文件。请使用 100 MB 内的 MP3、WAV 或 M4A 文件重试。' } : audioError(error), capture: null, sourceType: source.type }); }
        throw error;
      }
    };
    const p = run().finally(() => { if (this.pending === p) this.pending = null; });
    this.pending = p;
    return p;
  }
  private release(r: NonNullable<typeof this.resources>) {
    r.cancellation.abort();
    r.capture?.dispose(); r.capture = undefined;
    r.file?.dispose(); r.file = undefined;
    if (r.input) {
      if ('stop' in r.input) { try { (r.input as AudioBufferSourceNode).stop(); } catch { /* not started / already ended */ } }
      r.input.disconnect(); r.input = undefined;
    }
    if (r.stream) {
      for (const track of r.stream.getTracks()) { if (r.ended) track.removeEventListener('ended', r.ended); track.stop(); }
      r.stream = undefined;
    }
    if (!r.closed) { r.closed = true; if (r.context.state !== 'closed') void r.context.close().catch(() => undefined); }
  }
  stop(_reason = 'user') {
    if (this.state.status === 'disposed') return;
    ++this.generation; this.pending = null;
    if (this.resources) this.release(this.resources); this.resources = null;
    this.set({ status: 'idle', audioSessionId: null, error: null, capture: null });
  }
  dispose() { this.stop('dispose'); this.set({ ...this.state, status: 'disposed' }); this.listeners.clear(); this.pcmListeners.clear(); }
}
