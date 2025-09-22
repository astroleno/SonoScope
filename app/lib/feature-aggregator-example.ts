/**
 * FeatureAggregator 使用示例
 * 展示Phase 1新增功能的用法
 */

import { FeatureAggregator, FeatureFrame, FeatureWindow } from './feature-aggregator';

// 创建特征聚合器实例
const aggregator = new FeatureAggregator();

// 示例：添加特征帧
const sampleFrame: FeatureFrame = {
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
};

// 添加多个帧到聚合器
for (let i = 0; i < 20; i++) {
  const frame = { ...sampleFrame, timestamp: Date.now() + i * 100 };
  aggregator.addFrame(frame);
}

// 计算窗口特征
const window = aggregator.computeWindowFeatures();
if (window) {
  console.log('🎵 特征窗口计算成功:');
  console.log(`- 窗口大小: ${window.window_ms}ms`);
  console.log(`- RMS均值: ${window.features.rms_mean.toFixed(4)}`);
  console.log(`- 频谱质心: ${window.features.spectralCentroid_mean.toFixed(2)}`);
  console.log(`- 响度 (LKFS): ${window.features.loudness_lkfs.toFixed(2)}`);
  console.log(`- 动态范围: ${window.features.dynamic_range.toFixed(2)}`);
  console.log(`- 主导乐器: ${window.features.dominantInstrument}`);
  console.log(`- 节拍 (BPM): ${window.features.tempo_bpm.toFixed(1)}`);
  console.log(`- 节拍强度: ${window.features.beat_strength.toFixed(3)}`);

  // 示例：特征归一化
  console.log('\n🔧 特征归一化示例:');
  const normalizedRms = aggregator.normalizeFeature(
    window.features.rms_mean, 
    0, 1
  );
  console.log(`- RMS归一化: ${normalizedRms.toFixed(4)}`);

  const normalizedChroma = aggregator.normalizeFeatureArray(
    window.features.chroma_mean,
    0, 1
  );
  console.log(`- Chroma归一化: [${normalizedChroma.slice(0, 3).map(v => v.toFixed(2)).join(', ')}...]`);

  // 示例：特征验证
  console.log('\n✅ 特征验证示例:');
  const validRms = aggregator.validateFeature(
    window.features.rms_mean, 
    'rms_mean', 
    0, 1
  );
  console.log(`- RMS验证: ${validRms.toFixed(4)}`);

  const validChroma = aggregator.validateFeatureArray(
    window.features.chroma_mean,
    'chroma_mean',
    12
  );
  console.log(`- Chroma验证: 长度 ${validChroma.length}`);

  // 示例：特征序列化
  console.log('\n💾 特征序列化示例:');
  const serialized = aggregator.serializeFeatureWindow(window);
  console.log(`- 序列化长度: ${serialized.length} 字符`);
  
  // 示例：特征反序列化
  const deserialized = aggregator.deserializeFeatureWindow(serialized);
  if (deserialized) {
    console.log(`- 反序列化成功: ${deserialized.window_ms}ms 窗口`);
  }

  // 示例：获取统计信息
  console.log('\n📊 统计信息:');
  const stats = aggregator.getFeatureStatistics();
  console.log(`- 总帧数: ${stats.totalFrames}`);
  console.log(`- 窗口大小: ${stats.windowSize}ms`);
  console.log(`- 最后更新时间: ${new Date(stats.lastUpdateTime).toLocaleTimeString()}`);

  // 示例：稳定性检测
  console.log('\n🎯 稳定性检测:');
  const stability = aggregator.checkStability();
  console.log(`- 整体稳定: ${stability.overall_stable ? '是' : '否'}`);
  console.log(`- 质心稳定: ${stability.centroid_stable ? '是' : '否'}`);
  console.log(`- Chroma稳定: ${stability.chroma_stable ? '是' : '否'}`);
  console.log(`- 节拍稳定: ${stability.tempo_stable ? '是' : '否'}`);
  console.log(`- 稳定持续时间: ${stability.stability_duration}ms`);
  console.log(`- 置信度: ${stability.confidence.toFixed(3)}`);
}

export { aggregator, sampleFrame };
