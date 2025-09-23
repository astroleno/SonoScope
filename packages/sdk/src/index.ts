// SonoScope Core SDK
export { Core } from './core';
export { WebAudioAdapter } from './adapters/audio';
export { P5VisualAdapter } from './adapters/visual';
export { SimpleVisualAdapter } from './adapters/visual-simple';
export { SimpleDanmuAdapter } from './adapters/danmu-simple';
export { EnhancedDanmuAdapter, DanmuCoreFeatures } from './adapters/danmu-enhanced';
export { MemoryTransport } from './transports/memory';
export { WorkerTransport } from './transports/worker';

// Types
export type {
  AudioFeatures,
  VisualizationPreset,
  VisualizationControls,
  DanmuCommand,
  DanmuEvent,
  ThemeTokens,
  CoreConfig,
  AudioSource,
  CoreEvents,
  Transport,
} from './types';

// Re-export from packages for convenience
export type { EventBus } from '@sonoscope/core';
