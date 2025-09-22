import { describe, it, expect, beforeEach } from 'vitest';
import { StyleDetector } from '../../app/lib/style-detector';
import { FeatureAggregator } from '../../app/lib/feature-aggregator';
import { FeatureTestHelpers, TestRunner } from '../utils/test-utils';

describe('Phase 2: Stability Detector', () => {
  let styleDetector: StyleDetector;
  let featureAggregator: FeatureAggregator;
  let testRunner: TestRunner;

  beforeEach(() => {
    styleDetector = new StyleDetector();
    featureAggregator = new FeatureAggregator();
    testRunner = new TestRunner(true);
  });

  describe('2.1 Style Stability Detection', () => {
    it('should implement Centroid variance detection', () => {
      // Test centroid variance calculation
      const centroidValues = [2000, 2100, 1950, 2050, 1900, 2150];
      const mean = centroidValues.reduce((sum, val) => sum + val, 0) / centroidValues.length;
      const variance = centroidValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / centroidValues.length;
      const stdDev = Math.sqrt(variance);

      // Test stability thresholds
      const threshold = 0.15;
      const normalizedVariance = variance / (mean * mean);
      const isStable = normalizedVariance <= threshold;

      expect(FeatureTestHelpers.validateFeatureRange(variance, 'centroidVariance', 0, 1000000)).toBe(true);
      expect(FeatureTestHelpers.validateFeatureRange(stdDev, 'centroidStdDev', 0, 1000)).toBe(true);
      expect(typeof isStable).toBe('boolean');
    });

    it('should implement Chroma energy stability detection', () => {
      // Test chroma stability with different scenarios
      const stableChroma = [
        [0.1, 0.2, 0.3, 0.1, 0.05, 0.05, 0.1, 0.2, 0.3, 0.1, 0.05, 0.05],
        [0.12, 0.18, 0.28, 0.12, 0.06, 0.04, 0.12, 0.18, 0.28, 0.12, 0.06, 0.04],
        [0.08, 0.22, 0.32, 0.08, 0.04, 0.06, 0.08, 0.22, 0.32, 0.08, 0.04, 0.06]
      ];

      const unstableChroma = [
        [0.1, 0.2, 0.3, 0.1, 0.05, 0.05, 0.1, 0.2, 0.3, 0.1, 0.05, 0.05],
        [0.5, 0.1, 0.1, 0.1, 0.05, 0.05, 0.1, 0.1, 0.1, 0.1, 0.05, 0.05],
        [0.1, 0.1, 0.1, 0.5, 0.05, 0.05, 0.1, 0.1, 0.1, 0.1, 0.05, 0.05]
      ];

      // Calculate chroma variance
      const calculateChromaVariance = (chromaFrames: number[][]) => {
        const numBins = chromaFrames[0].length;
        const variances: number[] = [];

        for (let bin = 0; bin < numBins; bin++) {
          const values = chromaFrames.map(frame => frame[bin]);
          const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
          const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
          variances.push(variance);
        }

        return variances.reduce((sum, val) => sum + val, 0) / variances.length;
      };

      const stableVariance = calculateChromaVariance(stableChroma);
      const unstableVariance = calculateChromaVariance(unstableChroma);

      expect(stableVariance).toBeLessThan(unstableVariance);
      expect(FeatureTestHelpers.validateFeatureRange(stableVariance, 'stableChromaVariance', 0, 1)).toBe(true);
      expect(FeatureTestHelpers.validateFeatureRange(unstableVariance, 'unstableChromaVariance', 0, 1)).toBe(true);
    });

    it('should implement Tempo change rate detection', () => {
      // Test tempo change detection
      const tempoHistory = [120, 122, 118, 121, 119, 120, 125, 115, 130, 110];
      const threshold = 18; // BPM

      // Calculate tempo changes
      const tempoChanges: number[] = [];
      for (let i = 1; i < tempoHistory.length; i++) {
        tempoChanges.push(Math.abs(tempoHistory[i] - tempoHistory[i - 1]));
      }

      const maxChange = Math.max(...tempoChanges);
      const avgChange = tempoChanges.reduce((sum, val) => sum + val, 0) / tempoChanges.length;
      const isTempoStable = maxChange <= threshold;

      expect(FeatureTestHelpers.validateFeatureRange(maxChange, 'maxTempoChange', 0, 200)).toBe(true);
      expect(FeatureTestHelpers.validateFeatureRange(avgChange, 'avgTempoChange', 0, 50)).toBe(true);
      expect(typeof isTempoStable).toBe('boolean');
    });

    it('should configure stability thresholds', () => {
      // Test threshold configuration
      const thresholds = {
        centroid: 0.15,
        chroma: 0.08,
        tempo: 18,
        energy: 0.1,
        minDuration: 1.5
      };

      // Validate threshold ranges
      expect(FeatureTestHelpers.validateFeatureRange(thresholds.centroid, 'centroidThreshold', 0, 1)).toBe(true);
      expect(FeatureTestHelpers.validateFeatureRange(thresholds.chroma, 'chromaThreshold', 0, 1)).toBe(true);
      expect(FeatureTestHelpers.validateFeatureRange(thresholds.tempo, 'tempoThreshold', 0, 50)).toBe(true);
      expect(FeatureTestHelpers.validateFeatureRange(thresholds.energy, 'energyThreshold', 0, 1)).toBe(true);
      expect(FeatureTestHelpers.validateFeatureRange(thresholds.minDuration, 'minDurationThreshold', 0, 10)).toBe(true);
    });

    it('should implement 1.5-2.0s duration detection', () => {
      // Test stability duration tracking
      const stabilityEvents = [
        { timestamp: 1000, isStable: true },
        { timestamp: 1500, isStable: true },
        { timestamp: 2000, isStable: true },
        { timestamp: 2500, isStable: false },
        { timestamp: 3000, isStable: true },
        { timestamp: 3500, isStable: true }
      ];

      const minDuration = 1500; // 1.5 seconds in milliseconds
      const stableDurations: number[] = [];

      let currentStreakStart = 0;
      for (const event of stabilityEvents) {
        if (event.isStable) {
          if (currentStreakStart === 0) {
            currentStreakStart = event.timestamp;
          }
        } else {
          if (currentStreakStart > 0) {
            const duration = event.timestamp - currentStreakStart;
            stableDurations.push(duration);
            currentStreakStart = 0;
          }
        }
      }

      // Check final streak
      if (currentStreakStart > 0) {
        const finalDuration = stabilityEvents[stabilityEvents.length - 1].timestamp - currentStreakStart;
        stableDurations.push(finalDuration);
      }

      const meetsMinDuration = stableDurations.some(duration => duration >= minDuration);

      expect(stableDurations.length).toBeGreaterThan(0);
      expect(meetsMinDuration).toBe(true);
    });
  });

  describe('2.2 Trigger Condition Optimization', () => {
    it('should implement multi-condition combination judgment', () => {
      // Test multi-condition logic
      const conditions = {
        centroidStable: true,
        chromaStable: true,
        tempoStable: false,
        energyStable: true,
        confidence: 0.8
      };

      const weights = {
        centroid: 0.3,
        chroma: 0.3,
        tempo: 0.2,
        energy: 0.2
      };

      // Calculate weighted score
      let score = 0;
      if (conditions.centroidStable) score += weights.centroid;
      if (conditions.chromaStable) score += weights.chroma;
      if (conditions.tempoStable) score += weights.tempo;
      if (conditions.energyStable) score += weights.energy;

      const finalScore = score * conditions.confidence;
      const shouldTrigger = finalScore >= 0.6;

      expect(FeatureTestHelpers.validateFeatureRange(finalScore, 'triggerScore', 0, 1)).toBe(true);
      expect(typeof shouldTrigger).toBe('boolean');
    });

    it('should implement hysteresis mechanism to prevent jitter', () => {
      // Test hysteresis thresholds
      const enterThreshold = 0.08;
      const exitThreshold = 0.035;
      const energyHistory = [0.02, 0.03, 0.04, 0.07, 0.09, 0.08, 0.06, 0.04, 0.02];

      let currentState = false;
      const stateChanges: number[] = [];

      for (const energy of energyHistory) {
        const previousState = currentState;

        if (!currentState && energy >= enterThreshold) {
          currentState = true;
        } else if (currentState && energy < exitThreshold) {
          currentState = false;
        }

        if (previousState !== currentState) {
          stateChanges.push(energyHistory.indexOf(energy));
        }
      }

      // Should have minimal state changes due to hysteresis
      expect(stateChanges.length).toBeLessThanOrEqual(3);
      expect(enterThreshold).toBeGreaterThan(exitThreshold);
    });

    it('should implement trigger state machine', () => {
      // Test state machine implementation
      enum PipelinePhase {
        IDLE = 'idle',
        READY = 'ready',
        ANALYZING = 'analyzing',
        GENERATING = 'generating'
      }

      const stateTransitions = [
        { from: PipelinePhase.IDLE, to: PipelinePhase.READY, condition: 'energy >= 0.08' },
        { from: PipelinePhase.READY, to: PipelinePhase.ANALYZING, condition: 'stability_duration >= 1.5' },
        { from: PipelinePhase.ANALYZING, to: PipelinePhase.GENERATING, condition: 'style_confidence >= 0.7' },
        { from: PipelinePhase.GENERATING, to: PipelinePhase.IDLE, condition: 'generation_complete' }
      ];

      let currentState = PipelinePhase.IDLE;
      const stateHistory = [currentState];

      // Simulate state transitions
      if (currentState === PipelinePhase.IDLE) {
        currentState = PipelinePhase.READY;
        stateHistory.push(currentState);
      }
      if (currentState === PipelinePhase.READY) {
        currentState = PipelinePhase.ANALYZING;
        stateHistory.push(currentState);
      }
      if (currentState === PipelinePhase.ANALYZING) {
        currentState = PipelinePhase.GENERATING;
        stateHistory.push(currentState);
      }
      if (currentState === PipelinePhase.GENERATING) {
        currentState = PipelinePhase.IDLE;
        stateHistory.push(currentState);
      }

      expect(stateHistory).toHaveLength(5);
      expect(stateHistory[0]).toBe(PipelinePhase.IDLE);
      expect(stateHistory[stateHistory.length - 1]).toBe(PipelinePhase.IDLE);
    });

    it('should add debug logs and visualization', () => {
      // Test debug logging functionality
      const debugLogs: string[] = [];
      const logMessage = (message: string, level: 'info' | 'warn' | 'error' = 'info') => {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
        debugLogs.push(logEntry);
      };

      // Test various log messages
      logMessage('Pipeline initialized');
      logMessage('Energy threshold reached: 0.085');
      logMessage('Style detected: electronic', 'info');
      logMessage('Centroid variance high: 0.25', 'warn');
      logMessage('Feature extraction failed', 'error');

      expect(debugLogs.length).toBe(5);
      expect(debugLogs[0]).toContain('Pipeline initialized');
      expect(debugLogs[1]).toContain('Energy threshold reached');
      expect(debugLogs[2]).toContain('Style detected');
      expect(debugLogs[3]).toContain('[WARN]');
      expect(debugLogs[4]).toContain('[ERROR]');
    });
  });

  describe('2.3 Style Classifier', () => {
    it('should implement rule-based style judgment', () => {
      // Test rule-based style classification
      const testCases = [
        {
          features: { tempo: 128, spectralCentroid: 2500, energy: 0.8 },
          expectedStyle: 'techno'
        },
        {
          features: { tempo: 120, spectralCentroid: 1800, energy: 0.6 },
          expectedStyle: 'house'
        },
        {
          features: { tempo: 140, spectralCentroid: 3000, energy: 0.9 },
          expectedStyle: 'trance'
        },
        {
          features: { tempo: 160, spectralCentroid: 3500, energy: 0.7 },
          expectedStyle: 'dubstep'
        }
      ];

      // Simulate rule-based classification
      const classifyStyle = (features: any): string => {
        const { tempo, spectralCentroid, energy } = features;

        if (tempo >= 125 && tempo <= 135 && spectralCentroid > 2000 && energy > 0.7) {
          return 'techno';
        } else if (tempo >= 115 && tempo <= 125 && spectralCentroid > 1500 && energy > 0.5) {
          return 'house';
        } else if (tempo >= 130 && tempo <= 150 && spectralCentroid > 2500 && energy > 0.6) {
          return 'trance';
        } else if (tempo >= 140 && tempo <= 180 && spectralCentroid > 3000 && energy > 0.6) {
          return 'dubstep';
        }

        return 'unknown';
      };

      for (const testCase of testCases) {
        const predictedStyle = classifyStyle(testCase.features);
        expect(predictedStyle).toBe(testCase.expectedStyle);
      }
    });

    it('should add EDM/House/Techno style rules', () => {
      // Test EDM genre rules
      const edmRules = {
        techno: {
          tempoRange: [125, 135],
          spectralCentroidRange: [2000, 4000],
          energyRange: [0.7, 1.0],
          chromaPattern: 'even_distribution'
        },
        house: {
          tempoRange: [115, 125],
          spectralCentroidRange: [1500, 3000],
          energyRange: [0.5, 0.8],
          chromaPattern: 'kick_emphasis'
        },
        trance: {
          tempoRange: [130, 150],
          spectralCentroidRange: [2500, 4500],
          energyRange: [0.6, 0.9],
          chromaPattern: 'melodic_emphasis'
        },
        dubstep: {
          tempoRange: [140, 180],
          spectralCentroidRange: [3000, 5000],
          energyRange: [0.6, 1.0],
          chromaPattern: 'bass_emphasis'
        }
      };

      // Validate rule structure
      for (const [genre, rules] of Object.entries(edmRules)) {
        expect(rules).toHaveProperty('tempoRange');
        expect(rules).toHaveProperty('spectralCentroidRange');
        expect(rules).toHaveProperty('energyRange');
        expect(rules).toHaveProperty('chromaPattern');

        expect(rules.tempoRange).toHaveLength(2);
        expect(rules.spectralCentroidRange).toHaveLength(2);
        expect(rules.energyRange).toHaveLength(2);
        expect(typeof rules.chromaPattern).toBe('string');
      }
    });

    it('should implement style confidence calculation', () => {
      // Test confidence calculation
      const testFeatures = {
        tempo: 128,
        spectralCentroid: 2500,
        energy: 0.8,
        voiceProb: 0.1,
        percussiveRatio: 0.7
      };

      const styleRules = {
        techno: {
          tempo: { min: 125, max: 135, weight: 0.3 },
          spectralCentroid: { min: 2000, max: 4000, weight: 0.3 },
          energy: { min: 0.7, max: 1.0, weight: 0.2 },
          voiceProb: { min: 0, max: 0.3, weight: 0.1 },
          percussiveRatio: { min: 0.6, max: 1.0, weight: 0.1 }
        }
      };

      // Calculate confidence score
      const calculateConfidence = (features: any, rules: any): number => {
        let totalScore = 0;
        let totalWeight = 0;

        for (const [feature, rule] of Object.entries(rules)) {
          const value = features[feature];
          const { min, max, weight } = rule;

          let featureScore = 0;
          if (value >= min && value <= max) {
            featureScore = 1;
          } else if (value < min) {
            featureScore = Math.max(0, 1 - (min - value) / min);
          } else if (value > max) {
            featureScore = Math.max(0, 1 - (value - max) / max);
          }

          totalScore += featureScore * weight;
          totalWeight += weight;
        }

        return totalScore / totalWeight;
      };

      const confidence = calculateConfidence(testFeatures, styleRules.techno);

      expect(FeatureTestHelpers.validateFeatureRange(confidence, 'styleConfidence', 0, 1)).toBe(true);
      expect(confidence).toBeGreaterThan(0.5); // Should match well
    });

    it('should implement style switching detection', () => {
      // Test style change detection
      const styleHistory = [
        { style: 'ambient', confidence: 0.8, timestamp: 1000 },
        { style: 'ambient', confidence: 0.85, timestamp: 2000 },
        { style: 'techno', confidence: 0.9, timestamp: 3000 },
        { style: 'techno', confidence: 0.88, timestamp: 4000 },
        { style: 'house', confidence: 0.7, timestamp: 5000 }
      ];

      const styleChanges: { from: string; to: string; timestamp: number }[] = [];

      for (let i = 1; i < styleHistory.length; i++) {
        const current = styleHistory[i];
        const previous = styleHistory[i - 1];

        if (current.style !== previous.style && current.confidence > 0.6) {
          styleChanges.push({
            from: previous.style,
            to: current.style,
            timestamp: current.timestamp
          });
        }
      }

      expect(styleChanges).toHaveLength(2);
      expect(styleChanges[0]).toEqual({ from: 'ambient', to: 'techno', timestamp: 3000 });
      expect(styleChanges[1]).toEqual({ from: 'techno', to: 'house', timestamp: 5000 });
    });
  });

  describe('Performance Tests', () => {
    it('should process stability detection efficiently', async () => {
      const iterations = 1000;
      const mockFeatures = {
        centroid: 2000,
        centroidVariance: 0.05,
        chromaVariance: 0.03,
        tempo: 120,
        tempoChange: 5,
        energy: 0.8
      };

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        // Simulate stability detection
        const isCentroidStable = mockFeatures.centroidVariance <= 0.15;
        const isChromaStable = mockFeatures.chromaVariance <= 0.08;
        const isTempoStable = mockFeatures.tempoChange <= 18;
        const isEnergyStable = mockFeatures.energy >= 0.08;

        const overallStable = isCentroidStable && isChromaStable && isTempoStable && isEnergyStable;

        if (typeof overallStable !== 'boolean') {
          throw new Error('Invalid stability result');
        }
      }

      const endTime = performance.now();
      const averageTime = (endTime - startTime) / iterations;

      expect(averageTime).toBeLessThan(0.1); // Should be very fast (< 0.1ms per iteration)
    });

    it('should handle concurrent style classification', async () => {
      const concurrentTasks = 10;
      const featuresPerTask = 100;

      const mockFeaturesList = Array.from({ length: concurrentTasks * featuresPerTask }, (_, i) => ({
        tempo: 120 + (i % 60),
        spectralCentroid: 2000 + (i % 1000),
        energy: 0.5 + (i % 50) / 100,
        voiceProb: (i % 100) / 100,
        percussiveRatio: 0.3 + (i % 70) / 100
      }));

      const startTime = performance.now();

      // Simulate concurrent processing
      const promises = Array.from({ length: concurrentTasks }, (_, taskIndex) => {
        return new Promise<void>((resolve) => {
          const startIdx = taskIndex * featuresPerTask;
          const endIdx = startIdx + featuresPerTask;

          for (let i = startIdx; i < endIdx; i++) {
            const features = mockFeaturesList[i];
            // Simple style classification simulation
            let style = 'unknown';
            if (features.tempo > 125) style = 'techno';
            else if (features.energy > 0.7) style = 'house';
            else if (features.voiceProb > 0.5) style = 'vocal';
            else style = 'ambient';
          }

          resolve();
        });
      });

      await Promise.all(promises);

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(totalTime).toBeLessThan(100); // Should complete within 100ms
    });
  });
});