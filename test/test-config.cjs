/**
 * 测试配置文件
 * 定义测试环境、路径和通用配置
 */

const path = require('path');

const config = {
  // 项目根目录
  projectRoot: path.resolve(__dirname, '..'),
  
  // 应用目录
  appDir: path.resolve(__dirname, '../app'),
  
  // 测试输出目录
  testOutputDir: path.resolve(__dirname, 'output'),
  
  // 测试数据目录
  testDataDir: path.resolve(__dirname, 'data'),
  
  // 测试超时时间
  timeout: 10000,
  
  // 测试覆盖率阈值
  coverageThreshold: {
    statements: 80,
    branches: 70,
    functions: 80,
    lines: 80
  },
  
  // 测试环境
  environment: {
    NODE_ENV: 'test',
    LOG_LEVEL: 'error'
  },
  
  // 测试数据
  sampleData: {
    // 模拟音频特征数据
    mockFeatureFrame: {
      timestamp: Date.now(),
      rms: 0.5,
      spectralCentroid: 2000,
      zcr: 0.3,
      mfcc: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
      spectralFlatness: 0.4,
      spectralFlux: 0.6,
      chroma: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 0.8, 0.6],
      spectralBandwidth: 1500,
      spectralRolloff: 3000,
      spectralContrast: [0.2, 0.4, 0.6, 0.8, 1.0, 0.8],
      spectralSpread: 1200,
      spectralSkewness: 0.5,
      spectralKurtosis: 2.0,
      loudness: -20,
      perceptualSpread: 0.7,
      perceptualSharpness: 0.8,
      voiceProb: 0.6,
      percussiveRatio: 0.4,
      harmonicRatio: 0.6,
      instrumentProbabilities: {
        piano: 0.3,
        guitar: 0.4,
        drums: 0.2,
        voice: 0.1
      },
      dominantInstrument: 'guitar',
      instrumentConfidence: 0.8
    },
    
    // 边界测试数据
    boundaryTestData: {
      minValues: {
        rms: 0,
        spectralCentroid: 0,
        zcr: 0,
        spectralFlatness: 0,
        spectralFlux: 0,
        loudness: -70,
        voiceProb: 0,
        percussiveRatio: 0,
        harmonicRatio: 0
      },
      maxValues: {
        rms: 1,
        spectralCentroid: 10000,
        zcr: 1,
        spectralFlatness: 1,
        spectralFlux: 10,
        loudness: -10,
        voiceProb: 1,
        percussiveRatio: 1,
        harmonicRatio: 1
      },
      invalidValues: {
        undefined: undefined,
        null: null,
        nan: NaN,
        infinity: Infinity,
        negativeInfinity: -Infinity,
        string: 'invalid',
        object: {},
        array: []
      }
    }
  }
};

module.exports = config;
