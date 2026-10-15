import type { VisualizationPreset, VisualizationControls, AudioFeatures } from '../types';
export interface VisualAdapter { setPreset(preset: VisualizationPreset, controls?: VisualizationControls): void; render(canvas: HTMLCanvasElement | unknown, features?: AudioFeatures): void; resize(width: number, height: number): void; dispose(): void }
export interface PresetRenderer { render(context: unknown, features: AudioFeatures | undefined, controls: VisualizationControls): void; resize?(width: number, height: number): void; dispose?(): void }
/** Host supplies visual assets. Shared SDK never imports application shaders. */
export class P5VisualAdapter implements VisualAdapter {
  private preset: VisualizationPreset = 'pulse';
  private controls: VisualizationControls = {};
  constructor(private context: unknown, private renderers: Partial<Record<VisualizationPreset, PresetRenderer>> = {}) {}
  register(preset: VisualizationPreset, renderer: PresetRenderer) { this.renderers[preset] = renderer; }
  setPreset(preset: VisualizationPreset, controls: VisualizationControls = {}) { this.preset = preset; this.controls = controls; }
  render(_canvas: unknown, features?: AudioFeatures) { const renderer = this.renderers[this.preset]; if (!renderer) throw new Error(`Register a renderer for ${this.preset}`); renderer.render(this.context, features, this.controls); }
  resize(width: number, height: number) { this.renderers[this.preset]?.resize?.(width, height); }
  dispose() { for (const renderer of Object.values(this.renderers)) renderer?.dispose?.(); this.renderers = {}; }
}
