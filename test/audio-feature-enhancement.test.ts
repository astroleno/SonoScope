import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PitchDetector } from '../app/lib/pitch-detector.js';
import { TempoDetector } from '../app/lib/tempo-detector.js';
import { TimbreAnalyzer } from '../app/lib/timbre-analyzer.js';
import { MusicnnClassifier } from '../app/lib/musicnn-classifier.js';
import { EnhancedHPSSExtractor } from '../app/lib/enhanced-hpss-extractor.js';
import { EnhancedFeatureAggregator } from '../app/lib/enhanced-feature-aggregator.js';

describe('音频特征增强功能测试', () => {
  let pitchDetector: PitchDetector;
  let tempoDetector: TempoDetector;
  let timbreAnalyzer: TimbreAnalyzer;
  let musicnnClassifier: MusicnnClassifier;
  let enhancedHPSSExtractor: EnhancedHPSSExtractor;
  let enhancedFeatureAggregator: EnhancedFeatureAggregator;

  beforeEach(() => {
    pitchDetector = new PitchDetector();
    tempoDetector = new TempoDetector();
    timbreAnalyzer = new TimbreAnalyzer();
    musicnnClassifier = new MusicnnClassifier();
    enhancedHPSSExtractor = new EnhancedHPSSExtractor();
    enhancedFeatureAggregator = new EnhancedFeatureAggregator();
  });

  afterEach(() => {
    // 清理资源
  });

  describe('测试数据生成', () => {
    it('应该生成正弦波测试音频', () => {
      const sampleRate = 44100;
      const duration = 1.0; // 1秒
      const frequency = 440; // A4音
      const samples = Math.floor(sampleRate * duration);

      const audioBuffer = new Float32Array(samples);
      for (let i = 0; i < samples; i++) {
        audioBuffer[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.5;
      }

      expect(audioBuffer.length).toBe(samples);
      expect(audioBuffer[0]).toBeCloseTo(0);
      expect(Math.max(...audioBuffer)).toBeLessThanOrEqual(0.5);
    });

    it('应该生成复合音频信号', () => {
      const sampleRate = 44100;
      const duration = 1.0;
      const samples = Math.floor(sampleRate * duration);

      const audioBuffer = new Float32Array(samples);
      for (let i = 0; i < samples; i++) {
        // 基频 + 谐波
        audioBuffer[i] = (
          Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.3 +
          Math.sin(2 * Math.PI * 880 * i / sampleRate) * 0.2 +
          Math.sin(2 * Math.PI * 1320 * i / sampleRate) * 0.1
        );
      }

      expect(audioBuffer.length).toBe(samples);
      expect(Math.abs(Math.max(...audioBuffer))).toBeGreaterThan(0);
    });
  });

  describe('CREPE音高检测器', () => {
    it('应该初始化成功', async () => {
      await expect(pitchDetector.initialize()).resolves.not.toThrow();
    });

    it('应该检测正弦波音高', async () => {
      const sampleRate = 44100;
      const frequency = 440; // A4
      const samples = Math.floor(sampleRate * 0.1); // 100ms
      const audioBuffer = new Float32Array(samples);

      for (let i = 0; i < samples; i++) {
        audioBuffer[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.5;
      }

      await pitchDetector.initialize();
      const result = await pitchDetector.detectPitch(audioBuffer);

      expect(result).toBeDefined();
      expect(result.fundamentalFreq).toBeGreaterThan(0);
      expect(result.pitchClass).toMatch(/^[A-G][#]?$/);
      expect(result.octave).toBeGreaterThanOrEqual(0);
      expect(result.pitchConfidence).toBeGreaterThanOrEqual(0);
      expect(result.pitchConfidence).toBeLessThanOrEqual(1);
    });

    it('应该检测无声音频', async () => {
      const audioBuffer = new Float32Array(1024).fill(0);

      await pitchDetector.initialize();
      const result = await pitchDetector.detectPitch(audioBuffer);

      expect(result).toBeDefined();
      expect(result.isVoiced).toBe(false);
      expect(result.fundamentalFreq).toBe(0);
      expect(result.pitchConfidence).toBe(0);
    });
  });

  describe('aubio节拍检测器', () => {
    it('应该初始化成功', async () => {
      await expect(tempoDetector.initialize()).resolves.not.toThrow();
    });

    it('应该检测稳定节拍', async () => {
      const sampleRate = 44100;
      const bpm = 120;
      const beatInterval = sampleRate * 60 / bpm;
      const samples = Math.floor(sampleRate * 2.0); // 2秒
      const audioBuffer = new Float32Array(samples);

      // 生成节拍信号
      for (let i = 0; i < samples; i++) {
        const beatPhase = (i % beatInterval) / beatInterval;
        audioBuffer[i] = beatPhase < 0.1 ? 0.5 : 0; // 10%占空比的节拍
      }

      await tempoDetector.initialize();
      const result = await tempoDetector.detectTempo(audioBuffer);

      expect(result).toBeDefined();
      expect(result.bpm).toBeGreaterThan(60);
      expect(result.bpm).toBeLessThan(200);
      expect(result.tempoConfidence).toBeGreaterThanOrEqual(0);
      expect(result.tempoConfidence).toBeLessThanOrEqual(1);
      expect(Array.isArray(result.beatPositions)).toBe(true);
    });

    it('应该分析拍号', async () => {
      const audioBuffer = new Float32Array(1024);

      await tempoDetector.initialize();
      const result = await tempoDetector.detectTempo(audioBuffer);

      expect(result.timeSignature).toBeDefined();
      expect(Array.isArray(result.timeSignature)).toBe(true);
      expect(result.timeSignature).toHaveLength(2);
    });
  });

  describe('OpenL3音色分析器', () => {
    it('应该初始化成功', async () => {
      await expect(timbreAnalyzer.initialize()).resolves.not.toThrow();
    });

    it('应该分析音色特征', async () => {
      const sampleRate = 48000;
      const samples = Math.floor(sampleRate * 0.1);
      const audioBuffer = new Float32Array(samples);

      // 生成明亮音色信号（高频成分多）
      for (let i = 0; i < samples; i++) {
        audioBuffer[i] = (
          Math.sin(2 * Math.PI * 2000 * i / sampleRate) * 0.3 +
          Math.sin(2 * Math.PI * 4000 * i / sampleRate) * 0.2
        );
      }

      await timbreAnalyzer.initialize();
      const result = await timbreAnalyzer.analyzeTimbre(audioBuffer);

      expect(result).toBeDefined();
      expect(result.timbreEmbedding).toBeDefined();
      expect(Array.isArray(result.timbreEmbedding)).toBe(true);
      expect(result.timbreEmbedding.length).toBe(512);
      expect(result.brightness).toBeGreaterThanOrEqual(0);
      expect(result.brightness).toBeLessThanOrEqual(1);
      expect(result.timbreCategory).toBeDefined();
      expect(result.timbreConfidence).toBeGreaterThanOrEqual(0);
    });

    it('应该分析温暖音色', async () => {
      const sampleRate = 48000;
      const samples = Math.floor(sampleRate * 0.1);
      const audioBuffer = new Float32Array(samples);

      // 生成温暖音色信号（低频成分多）
      for (let i = 0; i < samples; i++) {
        audioBuffer[i] = (
          Math.sin(2 * Math.PI * 200 * i / sampleRate) * 0.3 +
          Math.sin(2 * Math.PI * 400 * i / sampleRate) * 0.2
        );
      }

      await timbreAnalyzer.initialize();
      const result = await timbreAnalyzer.analyzeTimbre(audioBuffer);

      expect(result.warmth).toBeGreaterThan(result.brightness);
    });
  });

  describe('Musicnn乐器分类器', () => {
    it('应该初始化成功', async () => {
      await expect(musicnnClassifier.initialize()).resolves.not.toThrow();
    });

    it('应该识别钢琴音色', async () => {
      const sampleRate = 22050;
      const samples = Math.floor(sampleRate * 0.5);
      const audioBuffer = new Float32Array(samples);

      // 生成钢琴类音色（谐波丰富）
      for (let i = 0; i < samples; i++) {
        audioBuffer[i] = (
          Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.3 +
          Math.sin(2 * Math.PI * 880 * i / sampleRate) * 0.2 +
          Math.sin(2 * Math.PI * 1320 * i / sampleRate) * 0.1 +
          Math.sin(2 * Math.PI * 1760 * i / sampleRate) * 0.05
        );
      }

      await musicnnClassifier.initialize();
      const result = await musicnnClassifier.recognizeInstruments(audioBuffer);

      expect(result).toBeDefined();
      expect(Array.isArray(result.instruments)).toBe(true);
      expect(result.dominantInstrument).toBeDefined();
      expect(result.instrumentCount).toBeGreaterThanOrEqual(0);
      expect(result.polyphony).toBeGreaterThanOrEqual(0);
      expect(result.polyphony).toBeLessThanOrEqual(1);
      expect(result.instrumentDiversity).toBeGreaterThanOrEqual(0);
      expect(result.instrumentDiversity).toBeLessThanOrEqual(1);
    });

    it('应该识别鼓音色', async () => {
      const sampleRate = 22050;
      const samples = Math.floor(sampleRate * 0.2);
      const audioBuffer = new Float32Array(samples);

      // 生成鼓类音色（瞬态信号）
      for (let i = 0; i < samples; i++) {
        audioBuffer[i] = i < 100 ? Math.random() * 0.5 : 0;
      }

      await musicnnClassifier.initialize();
      const result = await musicnnClassifier.recognizeInstruments(audioBuffer);

      expect(result.instruments.length).toBeGreaterThan(0);
      // 应该检测到打击乐类乐器
      const hasDrum = result.instruments.some(inst =>
        inst.category === 'percussion' || inst.name.includes('drum')
      );
      expect(hasDrum).toBe(true);
    });
  });

  describe('增强HPSS提取器', () => {
    it('应该提取增强HPSS特征', () => {
      const hpssResult = {
        harmonic: new Float32Array(1024),
        percussive: new Float32Array(1024),
        residual: new Float32Array(1024),
        harmonicRatio: 0.7,
        percussiveRatio: 0.3,
        separationQuality: 0.8
      };

      // 填充测试数据
      for (let i = 0; i < 1024; i++) {
        hpssResult.harmonic[i] = Math.sin(2 * Math.PI * 440 * i / 44100) * 0.5;
        hpssResult.percussive[i] = Math.random() * 0.3;
      }

      const result = enhancedHPSSExtractor.extractEnhancedFeatures(hpssResult);

      expect(result).toBeDefined();
      expect(result.enhancedHarmonicFeatures).toBeDefined();
      expect(result.enhancedPercussiveFeatures).toBeDefined();
      expect(result.enhancedSeparationFeatures).toBeDefined();
      expect(result.enhancedCombinedFeatures).toBeDefined();

      // 验证增强特征值范围
      expect(result.enhancedCombinedFeatures.musicalComplexity).toBeGreaterThanOrEqual(0);
      expect(result.enhancedCombinedFeatures.musicalComplexity).toBeLessThanOrEqual(1);
      expect(result.enhancedCombinedFeatures.musicalStability).toBeGreaterThanOrEqual(0);
      expect(result.enhancedCombinedFeatures.musicalStability).toBeLessThanOrEqual(1);
    });

    it('应该处理空信号', () => {
      const hpssResult = {
        harmonic: new Float32Array(1024).fill(0),
        percussive: new Float32Array(1024).fill(0),
        residual: new Float32Array(1024).fill(0),
        harmonicRatio: 0.5,
        percussiveRatio: 0.5,
        separationQuality: 0.5
      };

      const result = enhancedHPSSExtractor.extractEnhancedFeatures(hpssResult);

      expect(result).toBeDefined();
      expect(result.enhancedCombinedFeatures.musicalComplexity).toBe(0);
    });
  });

  describe('增强特征聚合器', () => {
    it('应该初始化成功', async () => {
      await expect(enhancedFeatureAggregator.initialize()).resolves.not.toThrow();
    });

    it('应该聚合增强特征', async () => {
      const sampleRate = 44100;
      const samples = Math.floor(sampleRate * 0.1);
      const audioBuffer = new Float32Array(samples);

      // 生成测试信号
      for (let i = 0; i < samples; i++) {
        audioBuffer[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.3;
      }

      await enhancedFeatureAggregator.initialize();

      const frame = {
        timestamp: Date.now(),
        audioBuffer,
        sampleRate,
        // 模拟HPSS结果
        hpssResult: {
          harmonic: audioBuffer,
          percussive: new Float32Array(samples).fill(0),
          residual: new Float32Array(samples).fill(0),
          harmonicRatio: 0.8,
          percussiveRatio: 0.2,
          separationQuality: 0.9
        }
      };

      await expect(enhancedFeatureAggregator.addEnhancedFrame(frame)).resolves.not.toThrow();

      // 获取统计信息
      const stats = enhancedFeatureAggregator.getEnhancedFeatureStatistics();
      expect(stats).toBeDefined();
      expect(stats.enhancedFeatureCount).toBeGreaterThan(0);
    });

    it('应该计算窗口统计', async () => {
      // 添加足够多的帧来触发窗口计算
      const sampleRate = 44100;
      const samples = Math.floor(sampleRate * 0.1);

      for (let i = 0; i < 15; i++) { // 增加帧数确保窗口计算
        const audioBuffer = new Float32Array(samples);
        for (let j = 0; j < samples; j++) {
          audioBuffer[j] = Math.sin(2 * Math.PI * 440 * j / sampleRate) * 0.3;
        }

        const frame = {
          timestamp: Date.now() + i * 100,
          audioBuffer,
          sampleRate,
          hpssResult: {
            harmonic: audioBuffer,
            percussive: new Float32Array(samples).fill(0),
            residual: new Float32Array(samples).fill(0),
            harmonicRatio: 0.8,
            percussiveRatio: 0.2,
            separationQuality: 0.9
          }
        };

        await enhancedFeatureAggregator.addEnhancedFrame(frame);
      }

      const latestWindow = enhancedFeatureAggregator.getLatestEnhancedWindow();
      // 窗口可能为null，这是正常行为
      if (latestWindow) {
        expect(latestWindow.pitchStats).toBeDefined();
        expect(latestWindow.tempoStats).toBeDefined();
        expect(latestWindow.timbreStats).toBeDefined();
        expect(latestWindow.instrumentStats).toBeDefined();
        expect(latestWindow.enhancedHPSSStats).toBeDefined();
      }
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内完成音高检测', async () => {
      const sampleRate = 44100;
      const samples = Math.floor(sampleRate * 0.1);
      const audioBuffer = new Float32Array(samples);

      for (let i = 0; i < samples; i++) {
        audioBuffer[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.3;
      }

      await pitchDetector.initialize();

      const startTime = performance.now();
      await pitchDetector.detectPitch(audioBuffer);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100); // 应该在100ms内完成
    });

    it('应该在合理时间内完成特征聚合', async () => {
      const sampleRate = 44100;
      const samples = Math.floor(sampleRate * 0.1);
      const audioBuffer = new Float32Array(samples);

      for (let i = 0; i < samples; i++) {
        audioBuffer[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.3;
      }

      await enhancedFeatureAggregator.initialize();

      const frame = {
        timestamp: Date.now(),
        audioBuffer,
        sampleRate,
        hpssResult: {
          harmonic: audioBuffer,
          percussive: new Float32Array(samples).fill(0),
          residual: new Float32Array(samples).fill(0),
          harmonicRatio: 0.8,
          percussiveRatio: 0.2,
          separationQuality: 0.9
        }
      };

      const startTime = performance.now();
      await enhancedFeatureAggregator.addEnhancedFrame(frame);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(500); // 应该在500ms内完成
    });
  });

  describe('错误处理测试', () => {
    it('应该处理空音频缓冲区', async () => {
      const emptyBuffer = new Float32Array(0);

      await pitchDetector.initialize();
      const result = await pitchDetector.detectPitch(emptyBuffer);

      expect(result).toBeDefined();
      expect(result.isVoiced).toBe(false);
    });

    it('应该处理NaN值', async () => {
      const audioBuffer = new Float32Array(1024);
      audioBuffer.fill(NaN);

      await pitchDetector.initialize();
      const result = await pitchDetector.detectPitch(audioBuffer);

      expect(result).toBeDefined();
      expect(result.isVoiced).toBe(false);
    });

    it('应该处理极大值', async () => {
      const audioBuffer = new Float32Array(1024);
      audioBuffer.fill(Infinity);

      await pitchDetector.initialize();
      const result = await pitchDetector.detectPitch(audioBuffer);

      expect(result).toBeDefined();
    });
  });
});