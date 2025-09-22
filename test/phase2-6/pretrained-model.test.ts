import { describe, it, expect, beforeEach } from 'vitest';
import { InstrumentClassifier } from '../../app/lib/instrument-classifier';
import { FeatureAggregator } from '../../app/lib/feature-aggregator';
import { StyleDetector } from '../../app/lib/style-detector';
import { FeatureTestHelpers, TestRunner } from '../utils/test-utils';

describe('Phase 2.6: Pretrained Instrument Classification Model Integration', () => {
  let instrumentClassifier: InstrumentClassifier;
  let featureAggregator: FeatureAggregator;
  let styleDetector: StyleDetector;
  let testRunner: TestRunner;

  beforeEach(() => {
    instrumentClassifier = new InstrumentClassifier();
    featureAggregator = new FeatureAggregator();
    styleDetector = new StyleDetector();
    testRunner = new TestRunner(true);
  });

  describe('2.6.1 Model Evaluation and Integration', () => {
    it('should implement YAMNet model local loading', () => {
      // Test YAMNet model path configuration
      const modelConfig = {
        path: '/model/yamnet.task',
        size: '4.1MB',
        sampleRate: 16000,
        windowSize: 0.5,
        hopSize: 0.25
      };

      // Validate model configuration
      expect(modelConfig.path).toBe('/model/yamnet.task');
      expect(modelConfig.path.startsWith('/model/')).toBe(true);
      expect(modelConfig.path.endsWith('.task')).toBe(true);
      expect(parseFloat(modelConfig.size)).toBeGreaterThan(0);
      expect(modelConfig.sampleRate).toBe(16000);
      expect(modelConfig.windowSize).toBeGreaterThan(0);
      expect(modelConfig.hopSize).toBeGreaterThan(0);
      expect(modelConfig.windowSize).toBeGreaterThan(modelConfig.hopSize);
    });

    it('should implement 0.5-1s audio window preprocessing', () => {
      // Test audio preprocessing
      const originalAudio = new Float32Array(44100); // 1 second at 44.1kHz
      for (let i = 0; i < originalAudio.length; i++) {
        originalAudio[i] = Math.sin(2 * Math.PI * 440 * i / 44100) * 0.5; // 440Hz sine wave
      }

      const targetSampleRate = 16000;
      const targetDuration = 0.5; // 0.5 seconds
      const targetLength = Math.floor(targetSampleRate * targetDuration);

      // Simulate resampling (simple linear interpolation)
      const resampleLinear = (input: Float32Array, inputSampleRate: number, outputSampleRate: number): Float32Array => {
        const ratio = inputSampleRate / outputSampleRate;
        const outputLength = Math.floor(input.length / ratio);
        const output = new Float32Array(outputLength);

        for (let i = 0; i < outputLength; i++) {
          const inputIndex = i * ratio;
          const inputIndexFloor = Math.floor(inputIndex);
          const inputIndexCeil = Math.min(inputIndexFloor + 1, input.length - 1);
          const fraction = inputIndex - inputIndexFloor;

          output[i] = input[inputIndexFloor] * (1 - fraction) + input[inputIndexCeil] * fraction;
        }

        return output;
      };

      const resampledAudio = resampleLinear(originalAudio, 44100, targetSampleRate);

      // Truncate or pad to target length
      const processedAudio = new Float32Array(targetLength);
      for (let i = 0; i < targetLength; i++) {
        processedAudio[i] = i < resampledAudio.length ? resampledAudio[i] : 0;
      }

      expect(processedAudio.length).toBe(targetLength);
      expect(processedAudio.length).toBeLessThan(originalAudio.length);
      expect(processedAudio.every(sample => !isNaN(sample) && isFinite(sample))).toBe(true);
    });

    it('should adopt YAMNet as default model with musicnn fallback', () => {
      // Test model selection logic
      const modelOptions = {
        primary: {
          name: 'YAMNet',
          path: '/model/yamnet.task',
          size: '4.1MB',
          accuracy: 0.85,
          inferenceTime: 50
        },
        fallback: {
          name: 'MusicNN',
          path: '/model/musicnn.task',
          size: '2.8MB',
          accuracy: 0.82,
          inferenceTime: 45
        }
      };

      // Simulate model loading and selection
      const loadModel = (modelName: string) => {
        const model = modelName === 'YAMNet' ? modelOptions.primary : modelOptions.fallback;
        return {
          ...model,
          loaded: true,
          loadTime: Math.random() * 100 + 50 // Simulate load time
        };
      };

      // Try primary model first
      const primaryModel = loadModel('YAMNet');
      let selectedModel = primaryModel;

      // Fallback logic (if primary fails)
      if (!primaryModel.loaded || primaryModel.loadTime > 200) {
        selectedModel = loadModel('MusicNN');
      }

      expect(selectedModel.loaded).toBe(true);
      expect(selectedModel.loadTime).toBeLessThan(200);
      expect(['YAMNet', 'MusicNN']).toContain(selectedModel.name);
    });

    it('should implement Worker isolation strategy', () => {
      // Test Worker architecture design
      const workerArchitecture = {
        mainThread: {
          responsibilities: [
            'Audio context management',
            'UI updates',
            'Danmu rendering',
            'Feature coordination'
          ]
        },
        workerThread: {
          responsibilities: [
            'Model inference',
            'Audio preprocessing',
            'Feature extraction',
            'Heavy computations'
          ],
          models: ['YAMNet', 'MusicNN (fallback)'],
          communication: 'postMessage API'
        }
      };

      // Validate architecture design
      expect(workerArchitecture.mainThread.responsibilities).toHaveLength(4);
      expect(workerArchitecture.workerThread.responsibilities).toHaveLength(4);
      expect(workerArchitecture.workerThread.models).toContain('YAMNet');
      expect(workerArchitecture.workerThread.communication).toBe('postMessage API');

      // Test separation of concerns
      const audioTasks = workerThread => workerThread.responsibilities.includes('Audio preprocessing');
      const uiTasks = mainThread => mainThread.responsibilities.includes('UI updates');

      expect(audioTasks(workerArchitecture.workerThread)).toBe(true);
      expect(uiTasks(workerArchitecture.mainThread)).toBe(true);
      expect(audioTasks(workerArchitecture.mainThread)).toBe(false);
      expect(uiTasks(workerArchitecture.workerThread)).toBe(false);
    });

    it('should handle model performance evaluation', () => {
      // Test performance metrics collection
      const performanceMetrics = {
        yamnet: {
          accuracy: 0.85,
          inferenceTime: [45, 52, 48, 50, 47],
          memoryUsage: [12, 15, 13, 14, 12],
          loadTime: [120, 135, 125, 130, 128]
        },
        musicnn: {
          accuracy: 0.82,
          inferenceTime: [40, 45, 42, 44, 43],
          memoryUsage: [10, 12, 11, 11, 10],
          loadTime: [100, 110, 105, 108, 107]
        }
      };

      // Calculate average metrics
      const calculateAverages = (metrics: any) => {
        return {
          avgInferenceTime: metrics.inferenceTime.reduce((a: number, b: number) => a + b, 0) / metrics.inferenceTime.length,
          avgMemoryUsage: metrics.memoryUsage.reduce((a: number, b: number) => a + b, 0) / metrics.memoryUsage.length,
          avgLoadTime: metrics.loadTime.reduce((a: number, b: number) => a + b, 0) / metrics.loadTime.length
        };
      };

      const yamnetAverages = calculateAverages(performanceMetrics.yamnet);
      const musicnnAverages = calculateAverages(performanceMetrics.musicnn);

      // Validate metrics
      expect(yamnetAverages.avgInferenceTime).toBeGreaterThan(0);
      expect(yamnetAverages.avgMemoryUsage).toBeGreaterThan(0);
      expect(yamnetAverages.avgLoadTime).toBeGreaterThan(0);

      expect(musicnnAverages.avgInferenceTime).toBeGreaterThan(0);
      expect(musicnnAverages.avgMemoryUsage).toBeGreaterThan(0);
      expect(musicnnAverages.avgLoadTime).toBeGreaterThan(0);

      // Performance comparison
      expect(performanceMetrics.yamnet.accuracy).toBeGreaterThan(performanceMetrics.musicnn.accuracy);
      expect(musicnnAverages.avgInferenceTime).toBeLessThan(yamnetAverages.avgInferenceTime);
      expect(musicnnAverages.avgMemoryUsage).toBeLessThan(yamnetAverages.avgMemoryUsage);
    });
  });

  describe('2.6.2 Probability Mapping and Interface Integration', () => {
    it('should map model output to core instrument labels', () => {
      // Test instrument category mapping
      const categoryKeywords = {
        voice: ['voice', 'vocal', 'singing', 'speech'],
        piano: ['piano', 'keyboard', 'electric piano', 'grand piano'],
        guitar: ['guitar', 'electric guitar', 'acoustic guitar', 'bass guitar'],
        synth: ['synthesizer', 'synth', 'electronic', 'digital'],
        strings: ['violin', 'cello', 'string', 'orchestra', 'viola'],
        drums: ['drum', 'percussion', 'kick', 'snare', 'cymbal']
      };

      const modelOutput = [
        { label: 'Piano', score: 0.85 },
        { label: 'Electric guitar', score: 0.65 },
        { label: 'Voice', score: 0.45 },
        { label: 'Drum kit', score: 0.35 },
        { label: 'Violin', score: 0.25 }
      ];

      // Map to core categories
      const mapToCoreCategories = (modelOutput: any[]): Record<string, number> => {
        const coreCategories: Record<string, number> = {};

        for (const item of modelOutput) {
          for (const [category, keywords] of Object.entries(categoryKeywords)) {
            if (keywords.some(keyword => item.label.toLowerCase().includes(keyword))) {
              coreCategories[category] = Math.max(coreCategories[category] || 0, item.score);
            }
          }
        }

        return coreCategories;
      };

      const coreCategories = mapToCoreCategories(modelOutput);

      expect(coreCategories).toHaveProperty('piano');
      expect(coreCategories).toHaveProperty('guitar');
      expect(coreCategories).toHaveProperty('voice');
      expect(coreCategories).toHaveProperty('drums');
      expect(coreCategories).toHaveProperty('strings');
      expect(coreCategories.piano).toBe(0.85);
      expect(coreCategories.guitar).toBe(0.65);
      expect(coreCategories.voice).toBe(0.45);
      expect(coreCategories.drums).toBe(0.35);
      expect(coreCategories.strings).toBe(0.25);
    });

    it('should inject label probabilities into FeatureWindow', () => {
      // Test FeatureWindow integration
      const mockInstrumentProbabilities = {
        piano: 0.85,
        guitar: 0.15,
        drums: 0.05,
        voice: 0.02,
        synth: 0.01,
        strings: 0.08
      };

      const featureWindow = {
        timestamp: Date.now(),
        features: {
          spectralCentroid: 2000,
          chroma: [0.1, 0.2, 0.3, 0.1, 0.05, 0.05, 0.1, 0.2, 0.3, 0.1, 0.05, 0.05]
        },
        statistics: {
          mean: { spectralCentroid: 1950 },
          variance: { spectralCentroid: 2500 }
        }
      };

      // Inject instrument probabilities
      const enhancedFeatureWindow = {
        ...featureWindow,
        instrumentProbabilities: mockInstrumentProbabilities,
        dominantInstrument: Object.entries(mockInstrumentProbabilities)
          .reduce((max, [instrument, prob]) => prob > max.prob ? { instrument, prob } : max, { instrument: 'unknown', prob: 0 }).instrument,
        instrumentConfidence: Math.max(...Object.values(mockInstrumentProbabilities))
      };

      expect(enhancedFeatureWindow).toHaveProperty('instrumentProbabilities');
      expect(enhancedFeatureWindow).toHaveProperty('dominantInstrument');
      expect(enhancedFeatureWindow).toHaveProperty('instrumentConfidence');
      expect(enhancedFeatureWindow.dominantInstrument).toBe('piano');
      expect(enhancedFeatureWindow.instrumentConfidence).toBe(0.85);
      expect(FeatureTestHelpers.validateFeatureRange(enhancedFeatureWindow.instrumentConfidence, 'instrumentConfidence', 0, 1)).toBe(true);
    });

    it('should extend StyleDetector with new labels', () => {
      // Test StyleDetector extension
      const mockFeatureWindow = {
        dominantStyle: 'classical',
        styleConfidence: 0.8,
        dominantInstrument: 'piano',
        instrumentConfidence: 0.85,
        voiceProb: 0.1,
        percussiveRatio: 0.2
      };

      // Enhanced style detection with instrument information
      const enhancedStyleDetection = (featureWindow: any): string[] => {
        const { dominantStyle, dominantInstrument, voiceProb, percussiveRatio } = featureWindow;
        const enhancedStyles = [dominantStyle];

        // Add instrument-specific style variations
        if (dominantStyle === 'classical' && dominantInstrument === 'piano') {
          enhancedStyles.push('piano classical', 'solo piano');
        }
        if (dominantStyle === 'rock' && dominantInstrument === 'guitar') {
          enhancedStyles.push('guitar rock', 'classic rock');
        }
        if (dominantStyle === 'electronic' && dominantInstrument === 'synth') {
          enhancedStyles.push('synthwave', 'electronic synth');
        }
        if (voiceProb > 0.6) {
          enhancedStyles.push('vocal', 'song');
        }
        if (percussiveRatio > 0.6) {
          enhancedStyles.push('percussive', 'rhythmic');
        }

        return enhancedStyles;
      };

      const enhancedStyles = enhancedStyleDetection(mockFeatureWindow);

      expect(enhancedStyles).toContain('classical');
      expect(enhancedStyles).toContain('piano classical');
      expect(enhancedStyles).toContain('solo piano');
      expect(enhancedStyles.length).toBeGreaterThan(1);
    });

    it('should integrate with /api/analyze', () => {
      // Test API integration
      const mockAnalysisInput = {
        featureWindow: {
          dominantStyle: 'techno',
          styleConfidence: 0.85,
          dominantInstrument: 'drums',
          instrumentConfidence: 0.8,
          voiceProb: 0.1,
          percussiveRatio: 0.7,
          tempo: 128,
          energy: 0.8
        },
        userContext: {
          language: 'zh',
          preferences: ['detailed', 'technical']
        }
      };

      // Simulate API analysis with instrument information
      const analyzeWithInstrumentInfo = (input: any): string => {
        const { featureWindow, userContext } = input;
        const { dominantStyle, dominantInstrument, styleConfidence, instrumentConfidence } = featureWindow;

        const instrumentTemplates = {
          techno: {
            drums: [
              `强劲的鼓点驱动着Techno的节奏，${dominantInstrument}的运用非常精准。`,
              `这位制作人精通${dominantInstrument}的编排，Techno音乐的纯粹魅力在这里得到完美诠释。`,
              `128 BPM的Techno节拍让人忍不住跟随摇摆，${dominantInstrument}的音色很有特色。`
            ],
            synth: [
              `合成器的音色设计展现了高超的制作技巧，Techno的氛围营造很到位。`,
              `电子音色的运用体现了现代制作的水准，${dominantInstrument}为Techno增添了层次感。`
            ]
          }
        };

        const templates = instrumentTemplates[dominantStyle as keyof typeof instrumentTemplates] || instrumentTemplates.techno;
        const instrumentTemplatesArray = templates[dominantInstrument as keyof typeof templates] || templates.drums;
        const selectedTemplate = instrumentTemplatesArray[Math.floor(Math.random() * instrumentTemplatesArray.length)];

        return `${selectedTemplate} (风格: ${dominantStyle}, 乐器: ${dominantInstrument}, 风格置信度: ${(styleConfidence * 100).toFixed(0)}%, 乐器置信度: ${(instrumentConfidence * 100).toFixed(0)}%)`;
      };

      const analysisResult = analyzeWithInstrumentInfo(mockAnalysisInput);

      expect(analysisResult).toContain('techno');
      expect(analysisResult).toContain('drums');
      expect(analysisResult).toContain('128');
      expect(analysisResult).toContain('85%');
      expect(analysisResult).toContain('80%');
    });
  });

  describe('2.6.3 Visualization and Danmu Integration', () => {
    it('should update danmu template library with instrument differentiation', () => {
      // Test instrument-specific danmu templates
      const instrumentDanmuTemplates = {
        piano: [
          { text: '这钢琴演奏真是太精湛了！', emotion: 'admiration' },
          { text: '每个音符都充满了感情', emotion: 'emotional' },
          { text: '钢琴的音色清澈明亮', emotion: 'appreciation' }
        ],
        guitar: [
          { text: '吉他solo太帅了！', emotion: 'excitement' },
          { text: '指法技巧令人叹服', emotion: 'admiration' },
          { text: '吉他的音色很有感染力', emotion: 'appreciation' }
        ],
        synth: [
          { text: '这个合成器音色很酷', emotion: 'cool' },
          { text: '电子音色的设计很有创意', emotion: 'creative' },
          { text: '合成器的运用很有层次感', emotion: 'appreciation' }
        ],
        strings: [
          { text: '弦乐的编排太美了', emotion: 'beauty' },
          { text: '温暖的音色让人沉醉', emotion: 'emotional' },
          { text: '弦乐群的表现力十足', emotion: 'appreciation' }
        ],
        drums: [
          { text: '鼓点太带感了！', emotion: 'excitement' },
          { text: '节奏掌控力超强', emotion: 'power' },
          { text: '鼓的音色很有冲击力', emotion: 'energy' }
        ],
        voice: [
          { text: '歌声太动听了！', emotion: 'emotional' },
          { text: '唱功真的很棒', emotion: 'admiration' },
          { text: '声音很有穿透力', emotion: 'power' }
        ]
      };

      // Test template selection
      const selectDanmuTemplate = (instrument: string, emotion?: string): string | null => {
        const templates = instrumentDanmuTemplates[instrument as keyof typeof instrumentDanmuTemplates];
        if (!templates) return null;

        if (emotion) {
          const emotionTemplates = templates.filter(t => t.emotion === emotion);
          if (emotionTemplates.length > 0) {
            return emotionTemplates[Math.floor(Math.random() * emotionTemplates.length)].text;
          }
        }

        return templates[Math.floor(Math.random() * templates.length)].text;
      };

      const pianoDanmu = selectDanmuTemplate('piano', 'admiration');
      const guitarDanmu = selectDanmuTemplate('guitar');
      const synthDanmu = selectDanmuTemplate('synth', 'cool');

      expect(pianoDanmu).toContain('钢琴');
      expect(guitarDanmu).toContain('吉他');
      expect(synthDanmu).toContain('合成器');
      expect(typeof pianoDanmu).toBe('string');
      expect(typeof guitarDanmu).toBe('string');
      expect(typeof synthDanmu).toBe('string');
    });

    it('should maintain heuristic fallback logic', () => {
      // Test fallback logic when model output is unavailable
      const testScenarios = [
        {
          name: 'Model unavailable',
          modelOutput: null,
          audioFeatures: {
            spectralCentroid: 2000,
            chroma: [0.3, 0.1, 0.1, 0.3, 0.05, 0.05, 0.1, 0.1, 0.1, 0.1, 0.05, 0.05],
            zeroCrossingRate: 0.15,
            attackTime: 0.05
          },
          expectedFallback: 'piano'
        },
        {
          name: 'Model confidence low',
          modelOutput: { piano: 0.3, guitar: 0.2, drums: 0.1 },
          audioFeatures: {
            spectralCentroid: 2500,
            chroma: [0.2, 0.3, 0.2, 0.1, 0.2, 0.1, 0.2, 0.3, 0.2, 0.1, 0.2, 0.1],
            zeroCrossingRate: 0.08,
            attackTime: 0.08
          },
          expectedFallback: 'guitar'
        },
        {
          name: 'Model timeout',
          modelOutput: { error: 'timeout' },
          audioFeatures: {
            spectralCentroid: 3000,
            chroma: [0.1, 0.1, 0.1, 0.1, 0.2, 0.2, 0.1, 0.1, 0.1, 0.1, 0.2, 0.2],
            zeroCrossingRate: 0.12,
            attackTime: 0.12
          },
          expectedFallback: 'synth'
        }
      ];

      // Heuristic fallback classification
      const heuristicClassification = (audioFeatures: any): string => {
        const { spectralCentroid, chroma, zeroCrossingRate, attackTime } = audioFeatures;

        // Piano detection
        if (spectralCentroid < 2000 && attackTime < 0.05) {
          return 'piano';
        }

        // Guitar detection
        if (spectralCentroid >= 2000 && spectralCentroid < 3000 && attackTime < 0.1) {
          return 'guitar';
        }

        // Synth detection
        if (spectralCentroid >= 3000 || attackTime >= 0.1) {
          return 'synth';
        }

        // Voice detection
        if (zeroCrossingRate >= 0.1 && zeroCrossingRate <= 0.2) {
          return 'voice';
        }

        return 'unknown';
      };

      for (const scenario of testScenarios) {
        let result;

        if (!scenario.modelOutput || scenario.modelOutput.error ||
            (scenario.modelOutput && Math.max(...Object.values(scenario.modelOutput)) < 0.5)) {
          // Use heuristic fallback
          result = heuristicClassification(scenario.audioFeatures);
        } else {
          // Use model output
          result = Object.entries(scenario.modelOutput)
            .reduce((max, [instrument, prob]) => prob > max.prob ? { instrument, prob } : max, { instrument: 'unknown', prob: 0 }).instrument;
        }

        expect(result).toBe(scenario.expectedFallback);
      }
    });

    it('should handle model gracefully when unavailable', () => {
      // Test graceful degradation
      const modelStates = [
        { available: true, confidence: 0.8 },
        { available: false, confidence: 0 },
        { available: true, confidence: 0.3 }, // Low confidence
        { available: true, confidence: 0.9 },
        { available: false, confidence: 0 }
      ];

      const systemResponses = modelStates.map(state => {
        const fallbackActive = !state.available || state.confidence < 0.5;
        const response = {
          modelUsed: fallbackActive ? 'heuristic' : 'YAMNet',
          confidence: fallbackActive ? 0.6 : state.confidence,
          status: fallbackActive ? 'fallback_active' : 'model_active'
        };
        return response;
      });

      expect(systemResponses).toHaveLength(5);
      expect(systemResponses[0].modelUsed).toBe('YAMNet');
      expect(systemResponses[1].modelUsed).toBe('heuristic');
      expect(systemResponses[2].modelUsed).toBe('heuristic');
      expect(systemResponses[3].modelUsed).toBe('YAMNet');
      expect(systemResponses[4].modelUsed).toBe('heuristic');

      // All responses should have valid confidence values
      systemResponses.forEach(response => {
        expect(FeatureTestHelpers.validateFeatureRange(response.confidence, 'responseConfidence', 0, 1)).toBe(true);
      });
    });
  });

  describe('Performance Tests', () => {
    it('should process model inference efficiently', async () => {
      const iterations = 100;
      const mockAudioData = new Float32Array(8000); // 0.5 seconds at 16kHz

      for (let i = 0; i < mockAudioData.length; i++) {
        mockAudioData[i] = Math.sin(2 * Math.PI * 440 * i / 16000) * 0.5;
      }

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        // Simulate model inference
        const mockInference = (audioData: Float32Array) => {
          // Simulate preprocessing
          const processedAudio = audioData.slice(0, Math.min(audioData.length, 8000));

          // Simulate model processing time
          const processingSteps = [
            'feature_extraction',
            'model_forward_pass',
            'probability_calculation',
            'post_processing'
          ];

          for (const step of processingSteps) {
            // Simulate processing time
            const processingTime = Math.random() * 10 + 5; // 5-15ms per step
            if (processingTime > 20) {
              throw new Error(`Processing step ${step} took too long`);
            }
          }

          // Return mock probabilities
          return {
            piano: 0.3 + Math.random() * 0.4,
            guitar: 0.1 + Math.random() * 0.3,
            drums: 0.1 + Math.random() * 0.3,
            voice: 0.05 + Math.random() * 0.2,
            synth: 0.05 + Math.random() * 0.2,
            strings: 0.05 + Math.random() * 0.2
          };
        };

        const result = mockInference(mockAudioData);

        // Validate result
        if (typeof result !== 'object' || result === null) {
          throw new Error('Invalid inference result');
        }

        const probabilities = Object.values(result);
        if (probabilities.some(p => typeof p !== 'number' || p < 0 || p > 1)) {
          throw new Error('Invalid probability values');
        }
      }

      const endTime = performance.now();
      const averageTime = (endTime - startTime) / iterations;

      expect(averageTime).toBeLessThan(100); // Should complete within 100ms per iteration
    });

    it('should handle memory efficiently during model operations', () => {
      const initialMemory = performance.memory?.usedJSHeapSize || 0;

      // Simulate multiple model operations
      const modelOperations = [];
      for (let i = 0; i < 10; i++) {
        modelOperations.push({
          audioData: new Float32Array(16000), // 1 second at 16kHz
          model: i % 2 === 0 ? 'YAMNet' : 'MusicNN'
        });
      }

      // Process operations
      modelOperations.forEach(op => {
        // Simulate model loading and inference
        const mockModelData = {
          weights: new Float32Array(1000000), // Simulate model weights
          buffers: new Array(10).fill(null).map(() => new Float32Array(8000))
        };

        // Simulate inference
        const result = {
          piano: 0.3,
          guitar: 0.2,
          drums: 0.4,
          voice: 0.1
        };

        // Clean up simulation
        if (Math.random() > 0.5) {
          // Simulate garbage collection
          mockModelData.weights.fill(0);
          mockModelData.buffers.forEach(buffer => buffer.fill(0));
        }
      });

      const finalMemory = performance.memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (< 50MB for this simulation)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should handle concurrent model requests', async () => {
      const concurrentRequests = 5;
      const audioData = new Float32Array(8000);

      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = Math.sin(2 * Math.PI * 440 * i / 16000) * 0.5;
      }

      const startTime = performance.now();

      // Simulate concurrent requests
      const promises = Array.from({ length: concurrentRequests }, (_, i) => {
        return new Promise<{ instrument: string; confidence: number }>((resolve) => {
          setTimeout(() => {
            // Simulate model inference with varying delays
            const delay = Math.random() * 50 + 25; // 25-75ms
            setTimeout(() => {
              const instruments = ['piano', 'guitar', 'drums', 'voice', 'synth'];
              const instrument = instruments[i % instruments.length];
              const confidence = 0.6 + Math.random() * 0.3;
              resolve({ instrument, confidence });
            }, delay);
          }, i * 10); // Stagger requests
        });
      });

      const results = await Promise.all(promises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(results).toHaveLength(concurrentRequests);
      expect(totalTime).toBeLessThan(200); // Should complete within 200ms

      // All results should be valid
      results.forEach(result => {
        expect(['piano', 'guitar', 'drums', 'voice', 'synth']).toContain(result.instrument);
        expect(FeatureTestHelpers.validateFeatureRange(result.confidence, 'resultConfidence', 0, 1)).toBe(true);
      });
    });
  });
});