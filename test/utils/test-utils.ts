import { FeatureAggregator } from '../../app/lib/feature-aggregator';
import { StyleDetector } from '../../app/lib/style-detector';
import { InstrumentClassifier } from '../../app/lib/instrument-classifier';
import { EnhancedDanmuPipeline } from '../../app/lib/danmu-pipeline-enhanced';

// Test interfaces
export interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: any;
}

export interface TestSuite {
  name: string;
  tests: TestResult[];
  passed: number;
  failed: number;
  duration: number;
}

// Audio test fixtures
export const AudioFixtures = {
  // Simulated audio data for testing
  generateSineWave: (frequency: number, duration: number, sampleRate: number = 44100): Float32Array => {
    const samples = Math.floor(duration * sampleRate);
    const data = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      data[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate);
    }
    return data;
  },

  generateNoise: (duration: number, sampleRate: number = 44100): Float32Array => {
    const samples = Math.floor(duration * sampleRate);
    const data = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      data[i] = (Math.random() - 0.5) * 2;
    }
    return data;
  },

  generateChord: (frequencies: number[], duration: number, sampleRate: number = 44100): Float32Array => {
    const samples = Math.floor(duration * sampleRate);
    const data = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      let sum = 0;
      for (const freq of frequencies) {
        sum += Math.sin(2 * Math.PI * freq * i / sampleRate);
      }
      data[i] = sum / frequencies.length;
    }
    return data;
  }
};

// Feature test helpers
export const FeatureTestHelpers = {
  createMockMeydaFeatures: (overrides = {}) => ({
    loudness: { total: -12, specific: [-15, -18, -20] },
    spectralCentroid: 2000,
    spectralFlatness: 0.3,
    spectralRolloff: 0.85,
    spectralSpread: 1200,
    spectralSkewness: 0.1,
    spectralKurtosis: 3.2,
    chroma: [0.1, 0.2, 0.3, 0.1, 0.05, 0.05, 0.1, 0.2, 0.3, 0.1, 0.05, 0.05],
    mfcc: [1.2, -0.5, 0.8, -0.3, 0.6, -0.2, 0.4, -0.1, 0.2, 0.0, -0.1, 0.1, -0.05],
    spectralContrast: [2.1, 1.8, 1.5, 1.2, 0.9, 0.6],
    spectralBandwidth: 800,
    spectralRolloff: 0.85,
    tempo: 120,
    ...overrides
  }),

  validateFeatureRange: (feature: any, name: string, min: number, max: number): boolean => {
    if (typeof feature !== 'number' || isNaN(feature)) {
      console.error(`Feature ${name} is not a valid number:`, feature);
      return false;
    }
    if (feature < min || feature > max) {
      console.error(`Feature ${name} (${feature}) is out of range [${min}, ${max}]`);
      return false;
    }
    return true;
  },

  validateArrayLength: (array: any[], name: string, expectedLength: number): boolean => {
    if (!Array.isArray(array)) {
      console.error(`${name} is not an array:`, array);
      return false;
    }
    if (array.length !== expectedLength) {
      console.error(`${name} length (${array.length}) != expected (${expectedLength})`);
      return false;
    }
    return true;
  }
};

// Performance test helpers
export const PerformanceTestHelpers = {
  measureExecutionTime: async (fn: () => Promise<any> | any): Promise<number> => {
    const start = performance.now();
    await fn();
    return performance.now() - start;
  },

  runMemoryBenchmark: (): { used: number; total: number; percentage: number } => {
    const used = performance.memory ? performance.memory.usedJSHeapSize : 0;
    const total = performance.memory ? performance.memory.totalJSHeapSize : 1;
    return {
      used,
      total,
      percentage: (used / total) * 100
    };
  }
};

// Test runner
export class TestRunner {
  private results: TestResult[] = [];
  private currentSuite: string = '';

  constructor(private verbose: boolean = false) {}

  suite(name: string): void {
    this.currentSuite = name;
    if (this.verbose) {
      console.log(`\n🧪 Test Suite: ${name}`);
    }
  }

  async test(name: string, fn: () => Promise<void> | void): Promise<void> {
    const start = performance.now();
    try {
      await fn();
      const duration = performance.now() - start;
      this.results.push({ name, passed: true, duration });
      if (this.verbose) {
        console.log(`✅ ${name} (${duration.toFixed(2)}ms)`);
      }
    } catch (error) {
      const duration = performance.now() - start;
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.results.push({ name, passed: false, duration, error: errorMsg });
      if (this.verbose) {
        console.log(`❌ ${name} (${duration.toFixed(2)}ms) - ${errorMsg}`);
      }
    }
  }

  generateReport(): TestSuite {
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const duration = this.results.reduce((sum, r) => sum + r.duration, 0);

    return {
      name: this.currentSuite,
      tests: this.results,
      passed,
      failed,
      duration
    };
  }

  reset(): void {
    this.results = [];
    this.currentSuite = '';
  }
}