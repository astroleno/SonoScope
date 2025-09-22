# Mosaic Visualization Enhancement Technical Specification

## Specific Code Implementations for Audio Feature Optimization

## 1. Enhanced Audio Feature Mapping

### 1.1 MosaicAudioUniforms Extension

```typescript
// Enhanced audio uniforms with additional features
export type EnhancedMosaicAudioUniforms = {
  // Original features
  level: number;
  flux: number;
  centroid: number;
  flatness: number;
  zcr: number;
  mfcc: [number, number, number, number];
  pulse: number;

  // New features
  spectralBandwidth: number;
  harmonicRatio: number;
  percussiveRatio: number;
  chroma: number[]; // 12 chroma bands
  spectralContrast: number[];
  tempo: number;
  loudness: number;
};

// Weight configuration interface
export interface AudioWeights {
  level: {
    spawnRate: number;
    sizeMultiplier: number;
    alphaBoost: number;
  };
  flux: {
    growthRate: number;
    birthThreshold: number;
    mutationRate: number;
  };
  centroid: {
    colorFlow: number;
    spatialBias: number;
    sizeModulation: number;
    colorShift: number;
  };
  flatness: {
    patternDiversity: number;
    noiseThreshold: number;
    blendMode: number;
  };
  zcr: {
    textureInfluence: number;
    edgeDetection: number;
    decayRate: number;
  };
  mfcc: {
    shapeBias: [number, number, number, number];
    colorPalette: number;
    patternComplexity: number;
  };
  pulse: {
    burstSpawn: number;
    chainReaction: number;
    sizeSpike: number;
  };
  harmonicRatio: {
    organicGrowth: number;
    smoothTransitions: number;
  };
  percussiveRatio: {
    geometricPatterns: number;
    sharpEdges: number;
  };
}

// Default optimized weights
export const DEFAULT_AUDIO_WEIGHTS: AudioWeights = {
  level: {
    spawnRate: 0.4,
    sizeMultiplier: 0.3,
    alphaBoost: 0.2
  },
  flux: {
    growthRate: 0.4,
    birthThreshold: 0.3,
    mutationRate: 0.6
  },
  centroid: {
    colorFlow: 0.6, // Reduced from 0.8
    spatialBias: 0.8,
    sizeModulation: 0.3,
    colorShift: 0.4
  },
  flatness: {
    patternDiversity: 0.5,
    noiseThreshold: 0.7,
    blendMode: 0.3
  },
  zcr: {
    textureInfluence: 0.4,
    edgeDetection: 0.5,
    decayRate: 0.3
  },
  mfcc: {
    shapeBias: [0.4, 0.3, 0.2, 0.1],
    colorPalette: 0.5,
    patternComplexity: 0.6
  },
  pulse: {
    burstSpawn: 0.8,
    chainReaction: 0.6,
    sizeSpike: 0.7
  },
  harmonicRatio: {
    organicGrowth: 0.6,
    smoothTransitions: 0.7
  },
  percussiveRatio: {
    geometricPatterns: 0.7,
    sharpEdges: 0.5
  }
};
```

### 1.2 Enhanced Cellular Automata Rules

```typescript
private updateGrowth() {
  const next: MosaicGrid = [];
  const weights = this.audioWeights;

  // Calculate audio-modulated parameters
  const harmony = this.audio.harmonicRatio || 0.5;
  const percussive = this.audio.percussiveRatio || 0.5;
  const texture = this.audio.zcr * this.audio.flatness;
  const energy = this.audio.level;

  // Dynamic rules based on audio content
  const isHarmonicContent = harmony > percussive;
  const isPercussiveContent = percussive > harmony;

  for (let i = 0; i < this.cols; i++) {
    next[i] = [];
    for (let j = 0; j < this.rows; j++) {
      const cell = this.grid[i][j];
      const neighbors = this.countAliveNeighbors(i, j);
      const newCell = { ...cell };

      // Enhanced birth rule
      if (!cell.alive) {
        let birthProbability = 0;

        if (isHarmonicContent) {
          // Organic growth for harmonic content
          birthProbability = weights.flux.growthRate * harmony *
            (neighbors >= 2 && neighbors <= 3 ? 1 : 0);
        } else if (isPercussiveContent) {
          // Structured growth for percussive content
          birthProbability = weights.pulse.burstSpawn * percussive *
            (neighbors === 2 ? 1 : 0);
        }

        // Apply energy modulation
        birthProbability *= (1 + energy * weights.level.spawnRate);

        // Texture influence
        birthProbability *= (1 - texture * weights.flatness.patternDiversity);

        if (Math.random() < birthProbability) {
          newCell.alive = true;
          newCell.age = 0;
          // Shape selection based on MFCC
          newCell.shape = this.selectShapeByAudioFeatures();
        }
      }

      // Enhanced survival rule
      if (cell.alive) {
        let survives = true;

        // Age-based survival
        const ageFactor = cell.age / this.controls.maxAge;
        const decayRate = weights.zcr.decayRate * texture;

        // Harmony extends life, percussive shortens it
        const ageModifier = isHarmonicContent ? 1.2 : 0.8;

        if (ageFactor > (1 - decayRate) * ageModifier) {
          survives = false;
        }

        // Neighbor-based survival with audio modulation
        const minNeighbors = Math.floor(2 + weights.flux.birthThreshold);
        const maxNeighbors = Math.floor(4 + weights.percussiveRatio * 2);

        if (neighbors < minNeighbors || neighbors > maxNeighbors) {
          survives = false;
        }

        // Pulse-triggered death for dramatic effect
        if (this.audio.pulse > 0.7 && Math.random() < this.audio.pulse * 0.1) {
          survives = false;
        }

        newCell.alive = survives;
      }

      next[i][j] = newCell;
    }
  }

  // Audio-driven spawning enhancements
  this.enhancedAudioSpawning(next);

  this.grid = next;
}

private selectShapeByAudioFeatures(): 'circle' | 'triangle' | 'rect' {
  const weights = this.audioWeights.mfcc.shapeBias;
  const mfcc = this.audio.mfcc;

  // Calculate shape probability based on MFCC
  const circleScore = mfcc[0] * weights[0] + mfcc[1] * weights[1];
  const triangleScore = mfcc[1] * weights[1] + mfcc[2] * weights[2];
  const rectScore = mfcc[2] * weights[2] + mfcc[3] * weights[3];

  const scores = [
    { shape: 'circle', score: circleScore },
    { shape: 'triangle', score: triangleScore },
    { shape: 'rect', score: rectScore }
  ];

  // Weighted random selection
  scores.sort((a, b) => b.score - a.score);
  const rand = Math.random();

  if (rand < 0.6) return scores[0].shape as any;
  if (rand < 0.85) return scores[1].shape as any;
  return scores[2].shape as any;
}
```

### 1.3 Enhanced Color Flow System

```typescript
private getEnhancedFlowingColor(i: number, j: number, age: number): any {
  const weights = this.audioWeights;
  const px = i / this.cols;
  const py = j / this.rows;

  // Base time-based flow
  const t = this.frameCount * this.controls.colorFlowSpeed;

  // Audio modulations
  const pitchFlow = weights.centroid.colorFlow * this.audio.centroid;
  const energyFlow = weights.level.alphaBoost * this.audio.level;
  const textureFlow = weights.flatness.blendMode * this.audio.flatness;

  // Multi-layered wave patterns
  const wave1 = Math.sin(px * 2 + py + t * pitchFlow);
  const wave2 = Math.cos(px + py * 2 + t * energyFlow);
  const wave3 = Math.sin((px + py) * 3 + t * textureFlow);

  // Combine waves with audio influence
  const combinedWave = (wave1 + wave2 * 0.5 + wave3 * 0.3) / 1.8;
  const n = combinedWave * 0.5 + 0.5;

  // Age factor with decay modulation
  const ageFactor = this.p.constrain(age / this.controls.maxAge, 0, 1);
  const decayModulation = 1 - ageFactor * weights.zcr.decayRate * this.audio.zcr;

  // Chroma-based color selection if available
  let colorOffset = 0;
  if (this.audio.chroma && this.audio.chroma.length === 12) {
    // Find dominant chroma
    const dominantChroma = this.audio.chroma.indexOf(Math.max(...this.audio.chroma));
    colorOffset = dominantChroma / 12;
  }

  // MFCC-based color modification
  const mfccInfluence = weights.mfcc.colorPalette;
  const hueShift = (this.audio.mfcc[0] + this.audio.mfcc[1]) * mfccInfluence * 0.1;

  // Final blend calculation
  const blend = (ageFactor * decayModulation + n + colorOffset + hueShift) % 1;

  // Color interpolation
  const indexA = Math.floor(blend * (this.colors.length - 1));
  const indexB = (indexA + 1) % this.colors.length;
  const mix = (blend * (this.colors.length - 1)) % 1;

  const c = this.p.lerpColor(
    this.p.color(this.colors[indexA]),
    this.p.color(this.colors[indexB]),
    mix
  );

  // Alpha with multiple modulations
  const baseAlpha = this.controls.alpha;
  const pulseAlpha = 1 + this.audio.pulse * weights.pulse.sizeSpike * 0.3;
  const centroidAlpha = 1 + this.audio.centroid * weights.centroid.sizeModulation * 0.2;

  c.setAlpha(baseAlpha * pulseAlpha * centroidAlpha * 255);
  return c;
}
```

### 1.4 Performance Optimization Implementation

```typescript
// Grid optimization with spatial partitioning
private gridRegions: { [key: string]: boolean } = {};

private updateGrowthOptimized() {
  const next: MosaicGrid = [];
  const regionSize = 10; // 10x10 cell regions

  // Mark regions that need updates
  this.markActiveRegions();

  // Only process active regions
  for (let regionX = 0; regionX < Math.ceil(this.cols / regionSize); regionX++) {
    for (let regionY = 0; regionY < Math.ceil(this.rows / regionSize); regionY++) {
      const regionKey = `${regionX}_${regionY}`;

      if (this.gridRegions[regionKey] || this.audio.level > 0.1) {
        this.processRegion(next, regionX, regionY, regionSize);
      } else {
        // Copy unchanged region
        this.copyRegion(next, regionX, regionY, regionSize);
      }
    }
  }

  this.grid = next;
}

private markActiveRegions() {
  // Reset all regions
  this.gridRegions = {};

  // Mark regions near alive cells
  for (let i = 0; i < this.cols; i++) {
    for (let j = 0; j < this.rows; j++) {
      if (this.grid[i][j].alive) {
        const regionX = Math.floor(i / 10);
        const regionY = Math.floor(j / 10);

        // Mark this region and neighbors
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const key = `${regionX + dx}_${regionY + dy}`;
            this.gridRegions[key] = true;
          }
        }
      }
    }
  }

  // Always mark regions affected by audio
  if (this.audio.pulse > 0.5) {
    const pulseRegionX = Math.floor(this.audio.centroid * Math.ceil(this.cols / 10));
    const pulseRegionY = Math.floor(Math.random() * Math.ceil(this.rows / 10));
    this.gridRegions[`${pulseRegionX}_${pulseRegionY}`] = true;
  }
}

// Typed array implementation for memory efficiency
export class OptimizedMosaicGrid {
  private cols: number;
  private rows: number;

  // Using typed arrays for compact storage
  alive: Uint8Array;    // 0 = dead, 1 = alive
  age: Uint16Array;     // 0-65535 age values
  shape: Uint8Array;    // 0 = circle, 1 = triangle, 2 = rect

  constructor(cols: number, rows: number) {
    this.cols = cols;
    this.rows = rows;
    const totalCells = cols * rows;

    this.alive = new Uint8Array(totalCells);
    this.age = new Uint16Array(totalCells);
    this.shape = new Uint8Array(totalCells);
  }

  getIndex(x: number, y: number): number {
    return y * this.cols + x;
  }

  getCell(x: number, y: number): MosaicCell {
    const i = this.getIndex(x, y);
    return {
      alive: this.alive[i] === 1,
      age: this.age[i],
      shape: this.shape[i] === 0 ? 'circle' :
             this.shape[i] === 1 ? 'triangle' : 'rect'
    };
  }

  setCell(x: number, y: number, cell: MosaicCell): void {
    const i = this.getIndex(x, y);
    this.alive[i] = cell.alive ? 1 : 0;
    this.age[i] = cell.age;
    this.shape[i] = cell.shape === 'circle' ? 0 :
                    cell.shape === 'triangle' ? 1 : 2;
  }
}
```

### 1.5 Audio-Responsive Color Schemes

```typescript
// Key-based color scheme mapping
const KEY_COLOR_SCHEMES: { [key: number]: MosaicColorScheme } = {
  0: { // C
    name: "C Major",
    colors: ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FECA57"],
    bgColor: "#2C3E50"
  },
  1: { // C#
    name: "C# Major",
    colors: ["#6C5CE7", "#A29BFE", "#FD79A8", "#FDCB6E", "#6C5CE7"],
    bgColor: "#2D3436"
  },
  // ... add all 12 keys
};

// Dynamic color scheme selection
private updateColorSchemeByAudio(): void {
  if (this.audio.chroma && this.audio.chroma.length === 12) {
    // Detect key using chroma features
    const keyProfile = this.detectKeyFromChroma(this.audio.chroma);

    // Calculate tonal strength
    const tonalStrength = Math.max(...this.audio.chroma);
    const noiseLevel = this.audio.flatness;

    // Only change if strongly tonal
    if (tonalStrength > 0.6 && noiseLevel < 0.3) {
      const newSchemeIndex = KEY_TO_SCHEME_INDEX[keyProfile.key];
      if (newSchemeIndex !== undefined && newSchemeIndex !== this.controls.colorScheme) {
        this.updateColorScheme(newSchemeIndex);
      }
    }
  }
}

private detectKeyFromChroma(chroma: number[]): { key: number, confidence: number } {
  // Simple key detection based on chroma
  const majorPattern = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1];
  const minorPattern = [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0];

  let bestMatch = { key: 0, confidence: 0 };

  // Test all 24 keys (12 major + 12 minor)
  for (let i = 0; i < 12; i++) {
    // Major key correlation
    let majorCorrelation = 0;
    for (let j = 0; j < 12; j++) {
      majorCorrelation += chroma[j] * majorPattern[(j + i) % 12];
    }

    // Minor key correlation
    let minorCorrelation = 0;
    for (let j = 0; j < 12; j++) {
      minorCorrelation += chroma[j] * minorPattern[(j + i) % 12];
    }

    const maxCorrelation = Math.max(majorCorrelation, minorCorrelation);
    if (maxCorrelation > bestMatch.confidence) {
      bestMatch = { key: i, confidence: maxCorrelation };
    }
  }

  return bestMatch;
}
```

## 2. Integration Points

### 2.1 Visualizer Component Updates

```typescript
// In visualizer.tsx, update the mosaic audio mapping
case 'mosaic':
  const enhancedMosaicAudio = {
    level: smoothed.level,
    flux: smoothed.flux,
    centroid: smoothed.centroid,
    flatness: smoothed.flatness,
    zcr: smoothed.zcr,
    mfcc: [
      smoothed.mfcc0,
      smoothed.mfcc1,
      smoothed.mfcc2,
      smoothed.mfcc3,
    ] as [number, number, number, number],
    pulse: fluxPulse,
    // New features
    spectralBandwidth: f?.spectralBandwidth ? normalize(f.spectralBandwidth, 500, 5000) : 0,
    harmonicRatio: smoothed.harmonic,
    percussiveRatio: smoothed.perc,
    chroma: f?.chroma || Array(12).fill(0),
    spectralContrast: f?.spectralContrast || [],
    tempo: f?.tempo_bpm ? normalize(f.tempo_bpm, 60, 180) : 0,
    loudness: f?.loudness ? normalize(f.loudness, -60, 0) : 0,
  };

  applyEnhancedMosaicUniforms(p, mosaicVisual, enhancedMosaicAudio, {
    weights: enhancedWeights, // Custom weight configuration
    useOptimizedGrid: true,    // Enable optimizations
    dynamicColorSchemes: true  // Enable key-based colors
  });
```

## 3. Migration Strategy

1. **Phase 1**: Implement weight balancing and flatness/MFCC integration
2. **Phase 2**: Add enhanced cellular automata rules
3. **Phase 3**: Implement performance optimizations
4. **Phase 4**: Add advanced features (key detection, spectral contrast)

This enhancement specification provides concrete implementations for improving the mosaic visualization's audio responsiveness while maintaining performance.