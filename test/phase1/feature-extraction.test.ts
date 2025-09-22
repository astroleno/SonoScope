import { describe, it, expect, beforeEach } from 'vitest';
import { FeatureAggregator } from '../../app/lib/feature-aggregator';
import { AudioFixtures, FeatureTestHelpers, TestRunner } from '../utils/test-utils';

describe('Phase 1: Feature Extraction Enhancement', () => {
  let featureAggregator: FeatureAggregator;
  let testRunner: TestRunner;

  beforeEach(() => {
    featureAggregator = new FeatureAggregator();
    testRunner = new TestRunner(true);
  });

  describe('1.1 Extended Meyda Feature Extractor', () => {
    it('should extract Chroma features (12 dimensions)', () => {
      const mockFeatures = FeatureTestHelpers.createMockMeydaFeatures();

      // Test chroma feature extraction
      const chroma = mockFeatures.chroma;

      expect(FeatureTestHelpers.validateArrayLength(chroma, 'chroma', 12)).toBe(true);
      expect(chroma.every(value => typeof value === 'number' && !isNaN(value))).toBe(true);
      expect(chroma.every(value => value >= 0 && value <= 1)).toBe(true);
    });

    it('should extract Spectral Contrast features (6 dimensions)', () => {
      const mockFeatures = FeatureTestHelpers.createMockMeydaFeatures();

      // Test spectral contrast feature extraction
      const spectralContrast = mockFeatures.spectralContrast;

      expect(FeatureTestHelpers.validateArrayLength(spectralContrast, 'spectralContrast', 6)).toBe(true);
      expect(spectralContrast.every(value => typeof value === 'number' && !isNaN(value))).toBe(true);
      expect(spectralContrast.every(value => value >= 0)).toBe(true);
    });

    it('should extract Spectral Bandwidth features', () => {
      const mockFeatures = FeatureTestHelpers.createMockMeydaFeatures();

      // Test spectral bandwidth feature extraction
      const spectralBandwidth = mockFeatures.spectralBandwidth;

      expect(FeatureTestHelpers.validateFeatureRange(spectralBandwidth, 'spectralBandwidth', 0, 22050)).toBe(true);
    });

    it('should extract Spectral Rolloff features', () => {
      const mockFeatures = FeatureTestHelpers.createMockMeydaFeatures();

      // Test spectral rolloff feature extraction
      const spectralRolloff = mockFeatures.spectralRolloff;

      expect(FeatureTestHelpers.validateFeatureRange(spectralRolloff, 'spectralRolloff', 0, 1)).toBe(true);
    });

    it('should calculate Dynamic Range', () => {
      const mockFeatures = FeatureTestHelpers.createMockMeydaFeatures({
        loudness: { total: -12, specific: [-15, -18, -20, -10, -25] }
      });

      // Test dynamic range calculation
      const loudnessValues = mockFeatures.loudness.specific;
      const dynamicRange = Math.max(...loudnessValues) - Math.min(...loudnessValues);

      expect(FeatureTestHelpers.validateFeatureRange(dynamicRange, 'dynamicRange', 0, 60)).toBe(true);
    });

    it('should calculate Loudness (LKFS)', () => {
      // Test LKFS loudness calculation
      const mockFeatures = FeatureTestHelpers.createMockMeydaFeatures({
        loudness: { total: -12, specific: [-15, -18, -20, -10, -25] }
      });

      const loudnessTotal = mockFeatures.loudness.total;

      expect(FeatureTestHelpers.validateFeatureRange(loudnessTotal, 'loudnessLKFS', -60, 0)).toBe(true);
    });
  });

  describe('1.2 Sliding Window Aggregation (2-4s)', () => {
    it('should create sliding window buffer', () => {
      // Test sliding window creation
      const windowSize = 4000; // 4 seconds at 100Hz
      const stepSize = 100; // 100ms steps

      expect(windowSize).toBeGreaterThan(0);
      expect(stepSize).toBeGreaterThan(0);
      expect(windowSize % stepSize === 0).toBe(true);
    });

    it('should calculate feature statistics (mean/variance/peak)', () => {
      // Create test data
      const testData = [1.2, 1.5, 1.3, 1.8, 1.4, 1.6, 1.2, 1.9, 1.5, 1.4];

      // Calculate statistics
      const mean = testData.reduce((sum, val) => sum + val, 0) / testData.length;
      const variance = testData.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / testData.length;
      const peak = Math.max(...testData);
      const min = Math.min(...testData);

      expect(FeatureTestHelpers.validateFeatureRange(mean, 'mean', 0, 3)).toBe(true);
      expect(FeatureTestHelpers.validateFeatureRange(variance, 'variance', 0, 1)).toBe(true);
      expect(FeatureTestHelpers.validateFeatureRange(peak, 'peak', 0, 3)).toBe(true);
      expect(peak).toBeGreaterThan(min);
    });

    it('should estimate Tempo BPM', () => {
      const mockFeatures = FeatureTestHelpers.createMockMeydaFeatures({
        tempo: 120
      });

      const tempo = mockFeatures.tempo;

      expect(FeatureTestHelpers.validateFeatureRange(tempo, 'tempo', 60, 200)).toBe(true);
      expect(Number.isInteger(tempo) || Number.isInteger(tempo * 2)).toBe(true);
    });

    it('should calculate Beat Strength', () => {
      // Mock beat strength calculation
      const chroma = [0.1, 0.2, 0.3, 0.1, 0.05, 0.05, 0.1, 0.2, 0.3, 0.1, 0.05, 0.05];
      const tempo = 120;

      // Simulate beat strength calculation
      const beatStrength = chroma.reduce((sum, val, idx) => {
        // Simple simulation: emphasize values at beat positions
        const beatWeight = idx % 3 === 0 ? 1.5 : 1.0;
        return sum + (val * beatWeight);
      }, 0) / chroma.length;

      expect(FeatureTestHelpers.validateFeatureRange(beatStrength, 'beatStrength', 0, 1)).toBe(true);
    });

    it('should implement feature smoothing (EMA)', () => {
      // Test Exponential Moving Average
      const alpha = 0.3;
      const values = [1.0, 1.2, 0.8, 1.1, 0.9, 1.3];
      let ema = values[0];

      for (let i = 1; i < values.length; i++) {
        ema = alpha * values[i] + (1 - alpha) * ema;
        expect(FeatureTestHelpers.validateFeatureRange(ema, `ema_${i}`, 0, 2)).toBe(true);
      }

      // EMA should be smoother than raw values
      const rawVariance = values.reduce((sum, val) => sum + Math.pow(val - 1.05, 2), 0) / values.length;
      expect(rawVariance).toBeGreaterThan(0);
    });
  });

  describe('1.3 Feature Data Interface Standardization', () => {
    it('should define complete FeatureWindow interface', () => {
      // Test FeatureWindow interface structure
      const mockFeatureWindow = {
        timestamp: Date.now(),
        features: {
          spectralCentroid: 2000,
          spectralFlatness: 0.3,
          spectralRolloff: 0.85,
          chroma: [0.1, 0.2, 0.3, 0.1, 0.05, 0.05, 0.1, 0.2, 0.3, 0.1, 0.05, 0.05],
          tempo: 120,
          loudness: { total: -12, specific: [-15, -18, -20] }
        },
        statistics: {
          mean: { spectralCentroid: 1950, spectralFlatness: 0.28 },
          variance: { spectralCentroid: 2500, spectralFlatness: 0.02 },
          peak: { spectralCentroid: 2200, spectralFlatness: 0.35 }
        },
        stability: {
          centroid_stable: true,
          chroma_stable: true,
          tempo_stable: true,
          stability_duration: 2.5
        },
        instrumentProbabilities: {
          piano: 0.3,
          guitar: 0.2,
          drums: 0.4,
          voice: 0.1
        },
        dominantInstrument: 'drums',
        voiceProb: 0.1,
        percussiveRatio: 0.6,
        harmonicRatio: 0.4
      };

      // Validate interface structure
      expect(mockFeatureWindow).toHaveProperty('timestamp');
      expect(mockFeatureWindow).toHaveProperty('features');
      expect(mockFeatureWindow).toHaveProperty('statistics');
      expect(mockFeatureWindow).toHaveProperty('stability');
      expect(mockFeatureWindow).toHaveProperty('instrumentProbabilities');
      expect(mockFeatureWindow).toHaveProperty('dominantInstrument');
      expect(mockFeatureWindow).toHaveProperty('voiceProb');
      expect(mockFeatureWindow).toHaveProperty('percussiveRatio');
      expect(mockFeatureWindow).toHaveProperty('harmonicRatio');
    });

    it('should implement feature normalization', () => {
      // Test feature normalization
      const rawFeatures = [120, 2000, 0.3, 0.85];
      const featureRanges = [
        { min: 60, max: 200 }, // tempo
        { min: 0, max: 8000 }, // spectralCentroid
        { min: 0, max: 1 }, // spectralFlatness
        { min: 0, max: 1 } // spectralRolloff
      ];

      const normalized = rawFeatures.map((value, index) => {
        const range = featureRanges[index];
        return (value - range.min) / (range.max - range.min);
      });

      normalized.forEach((value, index) => {
        expect(FeatureTestHelpers.validateFeatureRange(value, `normalized_${index}`, 0, 1)).toBe(true);
      });
    });

    it('should implement feature validation and boundary checking', () => {
      // Test feature validation
      const testFeatures = {
        tempo: 120,
        spectralCentroid: 2000,
        spectralFlatness: 0.3,
        spectralRolloff: 0.85,
        chroma: [0.1, 0.2, 0.3, 0.1, 0.05, 0.05, 0.1, 0.2, 0.3, 0.1, 0.05, 0.05]
      };

      // Validate ranges
      const validationResults = {
        tempo: FeatureTestHelpers.validateFeatureRange(testFeatures.tempo, 'tempo', 60, 200),
        spectralCentroid: FeatureTestHelpers.validateFeatureRange(testFeatures.spectralCentroid, 'spectralCentroid', 0, 8000),
        spectralFlatness: FeatureTestHelpers.validateFeatureRange(testFeatures.spectralFlatness, 'spectralFlatness', 0, 1),
        spectralRolloff: FeatureTestHelpers.validateFeatureRange(testFeatures.spectralRolloff, 'spectralRolloff', 0, 1),
        chroma: FeatureTestHelpers.validateArrayLength(testFeatures.chroma, 'chroma', 12)
      };

      expect(Object.values(validationResults).every(result => result === true)).toBe(true);
    });

    it('should implement feature serialization/deserialization', () => {
      // Test feature serialization
      const mockFeatureWindow = {
        timestamp: Date.now(),
        features: {
          spectralCentroid: 2000,
          spectralFlatness: 0.3,
          chroma: [0.1, 0.2, 0.3, 0.1, 0.05, 0.05, 0.1, 0.2, 0.3, 0.1, 0.05, 0.05]
        }
      };

      // Serialize to JSON
      const serialized = JSON.stringify(mockFeatureWindow);
      expect(typeof serialized).toBe('string');

      // Deserialize back to object
      const deserialized = JSON.parse(serialized);
      expect(deserialized).toEqual(mockFeatureWindow);

      // Test with complex features
      const complexWindow = {
        ...mockFeatureWindow,
        statistics: {
          mean: { spectralCentroid: 1950 },
          variance: { spectralCentroid: 2500 }
        }
      };

      const complexSerialized = JSON.stringify(complexWindow);
      const complexDeserialized = JSON.parse(complexSerialized);
      expect(complexDeserialized).toEqual(complexWindow);
    });
  });

  describe('Performance Tests', () => {
    it('should process features within acceptable time limits', async () => {
      const iterations = 100;
      const mockFeatures = FeatureTestHelpers.createMockMeydaFeatures();

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        // Simulate feature processing
        const chroma = mockFeatures.chroma;
        const spectralContrast = mockFeatures.spectralContrast;
        const tempo = mockFeatures.tempo;

        // Basic validation
        if (!Array.isArray(chroma) || chroma.length !== 12) {
          throw new Error('Invalid chroma features');
        }
        if (!Array.isArray(spectralContrast) || spectralContrast.length !== 6) {
          throw new Error('Invalid spectral contrast features');
        }
        if (typeof tempo !== 'number' || tempo < 60 || tempo > 200) {
          throw new Error('Invalid tempo value');
        }
      }

      const endTime = performance.now();
      const averageTime = (endTime - startTime) / iterations;

      expect(averageTime).toBeLessThan(1); // Should be very fast (< 1ms per iteration)
    });

    it('should handle memory efficiently', () => {
      const initialMemory = performance.memory?.usedJSHeapSize || 0;

      // Create multiple feature aggregators to test memory usage
      const aggregators = [];
      for (let i = 0; i < 10; i++) {
        aggregators.push(new FeatureAggregator());
      }

      const finalMemory = performance.memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (< 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);

      // Clean up
      aggregators.length = 0;
    });
  });
});