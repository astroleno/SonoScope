// Core types for SonoScope SDK

export interface AudioFeatures {
  // Basic Meyda features
  rms?: number;
  spectralCentroid?: number;
  zcr?: number;
  mfcc?: number[];
  spectralFlatness?: number;
  spectralFlux?: number;
  chroma?: number[];
  spectralBandwidth?: number;
  spectralRolloff?: number;
  spectralContrast?: number[];
  spectralSpread?: number;
  spectralSkewness?: number;
  spectralKurtosis?: number;
  loudness?: number;
  perceptualSpread?: number;
  perceptualSharpness?: number;
  
  // Enhanced features
  voiceProb?: number;
  percussiveRatio?: number;
  harmonicRatio?: number;
  dominantInstrument?: string;
  instrumentProbabilities?: Record<string, number>;
  instrumentConfidence?: number;
  
  // Advanced features
  pitch?: {
    fundamentalFreq: number;
    pitchConfidence: number;
    pitchClass: string;
    octave: number;
    cents: number;
    harmonicity: number;
    isVoiced: boolean;
  };
  tempo?: {
    bpm: number;
    tempoConfidence: number;
    timeSignature: [number, number];
    rhythmPattern: string;
  };
  timbre?: {
    brightness: number;
    warmth: number;
    roughness: number;
    timbreCategory: string;
  };
  instruments?: {
    dominantInstrument: string;
    instrumentCount: number;
    polyphony: number;
  };
  enhancedHPSS?: {
    musicComplexity: number;
    overallStability: number;
    overallRichness: number;
    dominantComponent: 'harmonic' | 'percussive' | 'mixed';
  };
}

export type VisualizationPreset = 'pulse' | 'accretion' | 'spiral' | 'mosaic';

export interface VisualizationControls {
  // Accretion controls
  gainScale?: number;
  flickerStrength?: number;
  flickerFreq?: number;
  overallBoost?: number;
  genre?: 'electronic' | 'acoustic' | 'rock' | 'jazz';
  
  // Mosaic controls
  cellSize?: number;
  maxAge?: number;
  growthRate?: number;
  spawnRate?: number;
  colorScheme?: number;
  colorFlowSpeed?: number;
  alpha?: number;
  
  // Common controls
  sensitivity?: number;
}

export interface DanmuCommand {
  text: string;
  style?: string;
  color?: string;
  size?: number;
  speed?: number;
  position?: 'left' | 'right' | 'center';
  duration?: number;
}

export interface DanmuEvent {
  id: string;
  command: DanmuCommand;
  timestamp: number;
  features?: AudioFeatures;
}

export interface ThemeTokens {
  // Neon colors
  neonBlue?: string;
  neonPurple?: string;
  neonPink?: string;
  neonGreen?: string;
  
  // Background colors
  bgDark?: string;
  bgMedium?: string;
  bgLight?: string;
  
  // UI colors
  textPrimary?: string;
  textSecondary?: string;
  borderColor?: string;
  accentColor?: string;
}

export interface CoreConfig {
  themeTokens?: ThemeTokens;
  sensitivity?: number;
  genre?: string;
  flags?: Record<string, boolean>;
  transports?: {
    type: 'worker' | 'ipc' | 'websocket';
    options?: any;
  };
  storage?: {
    type: 'memory' | 'localStorage' | 'indexedDB';
    options?: any;
  };
  modelProviders?: {
    instrument?: string;
    style?: string;
  };
}

export interface AudioSource {
  type: 'device' | 'stream' | 'file';
  deviceId?: string;
  stream?: MediaStream;
  file?: File;
  options?: {
    echoCancellation?: boolean;
    noiseSuppression?: boolean;
    autoGainControl?: boolean;
    sampleRate?: number;
  };
}

export interface CoreEvents {
  'features': (features: AudioFeatures) => void;
  'danmu': (event: DanmuEvent) => void;
  'log': (level: 'info' | 'warn' | 'error', message: string, data?: any) => void;
  'error': (error: Error) => void;
  'ready': () => void;
  'stopped': () => void;
}

export interface Transport {
  send(type: string, data: any): void;
  on(type: string, handler: (data: any) => void): void;
  off(type: string, handler: (data: any) => void): void;
  dispose(): void;
}
