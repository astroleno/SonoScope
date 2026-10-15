import { DanmuController } from '@sonoscope/danmu-pipeline';
import type { DanmuEvent, AudioFeatures } from '../types';
export interface DanmuAdapter { trigger(payload?: { text?: string }): void; start(): void; stop(): void; onDanmu(callback: (event: DanmuEvent) => void): void; dispose(): void }
/** Legacy manual adapter shares queue, cancellation and display accounting. */
export class SimpleDanmuAdapter implements DanmuAdapter {
  private callback: ((event: DanmuEvent) => void) | null = null;
  protected controller = new DanmuController({ clear() {}, show: c => { this.callback?.({ id: c.commentId, command: { text: c.text, style: c.source, duration: 6500 }, timestamp: c.createdAt }); return true; } });
  trigger(payload?: { text?: string }) { this.controller.manual(payload?.text); }
  start() { this.controller.start(crypto.randomUUID()); }
  stop() { this.controller.stop(); }
  onDanmu(fn: (event: DanmuEvent) => void) { this.callback = fn; }
  handleAudioFeatures(_level: number, _features: AudioFeatures) { /* Shared Core runtime owns automatic feature processing. */ }
  get isReady() { return true; }
  get danmuCount() { return this.controller.current.displayed; }
  get pendingRequests() { return this.controller.current.pendingRequests; }
  get currentStyle() { return 'local'; }
  dispose() { this.controller.dispose(); this.callback = null; }
}
