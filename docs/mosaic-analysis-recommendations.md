# Mosaic Visualization Audio Feature Analysis & Recommendations

## Executive Summary

The mosaic visualization effectively uses 7 audio features (level, flux, centroid, flatness, zcr, mfcc, pulse) to drive a cellular automata-based visualization with color flow and shape generation. While the current implementation shows good integration of audio features, there are opportunities for optimization, particularly in weight distribution, cellular automata responsiveness, and integration of additional features.

## 1. Current Parameter Mapping Analysis

### Feature Usage Summary:

1. **Level (Audio Volume)**:
   - **Primary Mappings**: Cell size multiplier (1 + level × 0.3), spawn rate (1 + level × 0.5), alpha brightness
   - **Impact**: Medium-High. Directly affects cell visibility and density
   - **Current Weight**: Moderate (0.3-0.5 multipliers)

2. **Flux (Spectral Change)**:
   - **Primary Mappings**: Growth rate (1 + flux × 0.5), cell size (1 + flux × 0.2)
   - **Impact**: High. Drives cellular growth dynamics
   - **Current Weight**: High (0.5 multiplier for growth)

3. **Centroid (Pitch/Brightness)**:
   - **Primary Mappings**: Horizontal position spawning, color flow speed (1 + centroid × 0.8), cell size (1 + centroid × 0.4), alpha brightness (1 + centroid × 0.2)
   - **Impact**: Very High. Affects spatial distribution, color dynamics, and size
   - **Current Weight**: Very High (used in 4 different aspects)

4. **Flatness (Noise vs. Tone)**:
   - **Primary Mappings**: Not directly used in cellular automata
   - **Impact**: Low. Only passed through but not utilized
   - **Current Weight**: None

5. **ZCR (Zero Crossing Rate)**:
   - **Primary Mappings**: Growth rate (1 + zcr × 0.3)
   - **Impact**: Low-Medium. Minor effect on growth
   - **Current Weight**: Low (0.3 multiplier)

6. **MFCC (Timbre Coefficients)**:
   - **Primary Mappings**: Not directly used
   - **Impact**: None. Only stored in audio object
   - **Current Weight**: None

7. **Pulse (Transient Detection)**:
   - **Primary Mappings**: Spawn rate (1 + pulse × 0.3)
   - **Impact**: Medium. Affects new cell generation
   - **Current Weight**: Low (0.3 multiplier)

### Strongest Impact Parameters:
1. **Centroid** - Affects color flow, spatial positioning, and size
2. **Flux** - Controls growth rate dynamics
3. **Level** - Influences cell density and visibility

### Underutilized Features:
- **Flatness**: Could indicate noisy vs. tonal sections
- **MFCC**: Rich timbre information not being used
- **ZCR**: Could better indicate noisiness/texture

## 2. Weight Distribution Optimization

### Current Weight Issues:
- Centroid is over-utilized (4 different mappings)
- Flatness and MFCC are completely unused
- ZCR contribution is minimal
- No clear separation between rhythmic and tonal features

### Recommended Weight Distribution:

```typescript
// Suggested optimal weights for MosaicAudioUniforms
const OPTIMAL_WEIGHTS = {
  // Volume/Loudness Features
  level: {
    spawnRate: 0.4,      // Cell density control
    sizeMultiplier: 0.3, // Cell size scaling
    alphaBoost: 0.2      // Brightness control
  },

  // Spectral Change Features
  flux: {
    growthRate: 0.4,     // Cellular automata growth
    birthThreshold: 0.3, // Neighbor requirements
    mutationRate: 0.6    // Shape change probability
  },

  // Pitch/Timbral Features
  centroid: {
    colorFlow: 0.6,      // Color wave speed
    spatialBias: 0.8,    // Horizontal positioning
    sizeModulation: 0.3, // Pitch-based size variation
    colorShift: 0.4      // Hue modification
  },

  // Texture Features
  flatness: {
    patternDiversity: 0.5, // Pattern complexity
    noiseThreshold: 0.7,  // Background noise response
    blendMode: 0.3       // Color mixing behavior
  },

  // Rhythmic Features
  zcr: {
    textureInfluence: 0.4, // Pattern texture
    edgeDetection: 0.5,    // Cell boundary behavior
    decayRate: 0.3        // Cell aging speed
  },

  // Timbre Features
  mfcc: {
    shapeBias: [0.4, 0.3, 0.2, 0.1], // Shape selection weights
    colorPalette: 0.5,              // Color scheme influence
    patternComplexity: 0.6         // Visual complexity
  },

  // Transient Features
  pulse: {
    burstSpawn: 0.8,     // Sudden cell generation
    chainReaction: 0.6,  // Neighbor activation
    sizeSpike: 0.7       // Temporary size increase
  }
};
```

## 3. Parameter Enhancement Suggestions

### Additional Audio Features to Integrate:

1. **Spectral Bandwidth**:
   - Controls cell size variance
   - Wider spectrum = more size diversity

2. **Chroma Features**:
   - Map to color schemes based on musical key
   - Create key-specific color palettes

3. **Spectral Contrast**:
   - Enhance edge detection in cellular patterns
   - Create more defined boundaries

4. **Harmonic/Percussive Ratio**:
   - Switch between organic (harmonic) and geometric (percussive) patterns
   - Modify cellular automata rules based on content

### Cellular Automata Rule Enhancements:

```typescript
// Enhanced CA rules with audio responsiveness
private updateGrowth() {
  // Calculate audio-modulated parameters
  const harmonyFactor = this.audio.harmonicRatio || 0.5;
  const percussiveness = this.audio.percussiveRatio || 0.5;
  const texture = this.audio.zcr * this.audio.flatness;

  // Dynamic neighbor thresholds based on audio
  const birthMin = Math.floor(2 + this.audio.flux * 2);
  const birthMax = Math.floor(3 + this.audio.centroid * 2);
  const surviveMin = Math.floor(1 + harmonyFactor * 2);
  const surviveMax = Math.floor(4 + percussiveness * 2);

  // Apply rules with audio modulation
  for each cell {
    const neighbors = this.countAliveNeighbors(x, y);

    // Birth rule with audio influence
    if (!cell.alive && neighbors >= birthMin && neighbors <= birthMax) {
      const audioProbability = this.audio.level * (1 + this.audio.pulse);
      if (Math.random() < audioProbability * this.controls.growthRate) {
        // Spawn new cell with audio-determined properties
        newCell.alive = true;
        newCell.shape = this.selectShapeByMFCC();
        newCell.audioBirth = true; // Mark as audio-triggered
      }
    }

    // Survival rule with texture influence
    if (cell.alive) {
      const survivalChance = 1 - texture * 0.3; // Noisy textures reduce survival
      if (neighbors < surviveMin || neighbors > surviveMax ||
          Math.random() > survivalChance) {
        newCell.alive = false;
      }
    }
  }
}
```

### Color Flow Improvements:

1. **Key-Based Color Mapping**:
   ```typescript
   private getKeyBasedColorScheme(chroma: number[]): MosaicColorScheme {
     // Detect musical key from chroma
     const keyIndex = chroma.indexOf(Math.max(...chroma));
     const keyColors = KEY_COLOR_MAPPINGS[keyIndex];
     return keyColors || this.defaultColorScheme;
   }
   ```

2. **Dynamic Color Transitions**:
   ```typescript
   private getDynamicColor(cell: MosaicCell, position: Vector): Color {
     // Base color from age and position
     let baseColor = this.getFlowingColor(position);

     // Modulate with spectral features
     const brightness = 1 + this.audio.centroid * 0.3;
     const saturation = 1 + this.audio.flatness * 0.5;
     const hueShift = this.audio.mfcc[0] * 0.2;

     // Apply audio-responsive color transformations
     return baseColor
       .brightness(brightness)
       .saturation(saturation)
       .hue(hueShift);
   }
   ```

## 4. Performance Considerations

### Grid Rendering Optimizations:

1. **Spatial Partitioning**:
   - Implement quadtree for efficient neighbor queries
   - Only update active regions of the grid

2. **Level-of-Detail**:
   ```typescript
   private updateGrid() {
     // Calculate required detail based on camera/zoom
     const detailLevel = this.calculateDetailLevel();

     // Adjust cell size dynamically
     if (detailLevel === 'low') {
       this.processCellsInChunks(4); // Process 2x2 blocks
     } else {
       this.processIndividualCells();
     }
   }
   ```

3. **Web Worker Integration**:
   - Offload cellular automata calculations to worker
   - Use transferable objects for grid data

### Memory Usage Improvements:

1. **Typed Arrays for Grid**:
   ```typescript
   // Use typed arrays for compact storage
   private grid: {
     alive: Uint8Array;    // 0 or 1
     age: Uint16Array;    // 0-65535
     shape: Uint8Array;   // 0,1,2 for circle/triangle/rect
   };
   ```

2. **Object Pooling**:
   - Reuse cell objects instead of creating new ones
   - Pool color objects to prevent GC pressure

3. **Incremental Updates**:
   - Only process dirty regions of the grid
   - Use dirty flags to minimize full grid scans

## Implementation Priority

1. **High Priority**:
   - Implement flatness mapping for pattern diversity
   - Add MFCC-based shape selection
   - Optimize centroid usage (reduce over-reliance)

2. **Medium Priority**:
   - Add spectral bandwidth integration
   - Implement enhanced CA rules
   - Add key-based color schemes

3. **Low Priority**:
   - Web Worker integration
   - Spatial partitioning
   - Advanced performance optimizations

## Conclusion

The mosaic visualization has a solid foundation but can be significantly enhanced by:
1. Better balancing the feature weights (reduce centroid dominance)
2. Integrating unused features (flatness, MFCC)
3. Adding musical context awareness (key, harmony)
4. Optimizing performance for larger grids

These changes will create a more responsive, musically-intelligent visualization that better represents the full spectrum of audio features.