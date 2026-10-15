import type { CoreConfig, CoreEvents, AudioSource, VisualizationPreset, VisualizationControls, AudioFeatures, ThemeTokens } from './types';
import type { VisualAdapter } from './adapters/visual';
import { SonoRuntime, type RuntimeOptions } from './runtime';
import { toLegacyFeatures } from './adapters/audio';

/** Compatibility facade over the shared runtime; no independent audio/danmu engine. */
export class Core {
  readonly runtime: SonoRuntime;
  private config: CoreConfig;
  private source: AudioSource = { type: 'device' };
  private visual: VisualAdapter | null = null;
  private handlers = new Map<keyof CoreEvents, Set<CoreEvents[keyof CoreEvents]>>();
  private ready = false;
  constructor(config: CoreConfig = {}, options: Partial<RuntimeOptions> = {}) {
    this.config = config;
    this.runtime = new SonoRuntime({ ...options, sink: options.sink ?? { clear() {}, show: c => { this.emit('danmu', { id: c.commentId, command: { text: c.text, style: c.source, duration: 6500 }, timestamp: c.createdAt }); return true; } } });
    this.runtime.features.onFrame(frame => this.emit('features', toLegacyFeatures(frame)));
    this.runtime.audio.subscribeState(state => { if (state.error) this.emit('error', new Error(state.error.message)); });
  }
  async init() { if (this.ready) return; this.ready = true; this.emit('ready'); }
  start() { if (!this.ready) void this.init(); return this.runtime.start(this.source); }
  stop() { this.runtime.stop(); this.emit('stopped'); }
  dispose() { this.runtime.dispose(); this.visual?.dispose(); this.handlers.clear(); this.ready = false; }
  async setAudioSource(source: AudioSource) { const running = this.running; this.runtime.stop('source-change'); this.source = source; if (running) await this.runtime.start(source); }
  setVisualAdapter(adapter: VisualAdapter) { this.visual?.dispose(); this.visual = adapter; }
  setPreset(preset: VisualizationPreset, controls?: VisualizationControls) { this.visual?.setPreset(preset, controls); }
  render(canvas: HTMLCanvasElement) { this.visual?.render(canvas, this.features ?? undefined); }
  resize(width: number, height: number) { this.visual?.resize(width, height); }
  triggerDanmu(payload?: { text?: string }) { return this.runtime.danmu.manual(payload?.text); }
  setConfig(config: Partial<CoreConfig>) { this.config = { ...this.config, ...config }; if (config.themeTokens) this.applyThemeTokens(config.themeTokens); }
  applyThemeTokens(tokens: ThemeTokens) { if (typeof document === 'undefined') return; for (const [key, value] of Object.entries(tokens)) if (value) document.documentElement.style.setProperty(`--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`, value); }
  on<K extends keyof CoreEvents>(event: K, handler: CoreEvents[K]) { if (!this.handlers.has(event)) this.handlers.set(event, new Set()); this.handlers.get(event)!.add(handler); }
  off<K extends keyof CoreEvents>(event: K, handler: CoreEvents[K]) { this.handlers.get(event)?.delete(handler); }
  private emit<K extends keyof CoreEvents>(event: K, ...args: Parameters<CoreEvents[K]>) { for (const handler of this.handlers.get(event) ?? []) (handler as (...values: Parameters<CoreEvents[K]>) => void)(...args); }
  get initialized() { return this.ready; }
  get running() { return this.runtime.audio.current.status === 'running'; }
  get features(): AudioFeatures | null { return this.runtime.latestFrame ? toLegacyFeatures(this.runtime.latestFrame) : null; }
  get danmuStatus() { const s = this.runtime.danmu.current; return { isReady: this.ready, isActive: s.active, count: s.displayed, pendingRequests: s.pendingRequests, currentStyle: s.cloud === 'off' ? 'local' : 'hybrid' }; }
}
