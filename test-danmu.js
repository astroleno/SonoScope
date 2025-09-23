#!/usr/bin/env node

/**
 * 弹幕功能测试脚本
 * 测试EnhancedDanmuAdapter的各种功能
 */

const { EnhancedDanmuAdapter } = require('./packages/sdk/dist/index.js');

console.log('🧪 开始弹幕功能测试...\n');

// 创建弹幕适配器实例
const danmuAdapter = new EnhancedDanmuAdapter();

// 设置弹幕事件监听
danmuAdapter.onDanmu((event) => {
  console.log('📺 弹幕事件:', {
    id: event.id,
    text: event.command.text,
    style: event.command.style,
    color: event.command.color,
    size: event.command.size,
    timestamp: new Date(event.timestamp).toLocaleTimeString()
  });
});

// 启动弹幕适配器
danmuAdapter.start();
console.log('✅ 弹幕适配器已启动\n');

// 模拟音频特征数据
const mockFeatures = [
  // 节拍强度变化测试
  {
    rms: 0.5,
    tempo: { bpm: 128, tempoConfidence: 0.9 },
    percussiveRatio: 0.3,
    harmonicRatio: 0.7,
    voiceProb: 0.4,
    instruments: { dominantInstrument: 'drums' },
    instrumentProbabilities: { drums: 0.8, bass: 0.6, guitar: 0.4 },
    instrumentConfidence: 0.85,
    enhancedHPSS: { musicComplexity: 0.6, overallStability: 0.7, overallRichness: 0.8 }
  },
  // 节拍强度大幅变化
  {
    rms: 0.7,
    tempo: { bpm: 140, tempoConfidence: 0.95 },
    percussiveRatio: 0.8, // 大幅增加
    harmonicRatio: 0.2,
    voiceProb: 0.3,
    instruments: { dominantInstrument: 'drums' },
    instrumentProbabilities: { drums: 0.9, bass: 0.7, guitar: 0.5 },
    instrumentConfidence: 0.9,
    enhancedHPSS: { musicComplexity: 0.8, overallStability: 0.8, overallRichness: 0.9 }
  },
  // 人声概率变化测试
  {
    rms: 0.6,
    tempo: { bpm: 120, tempoConfidence: 0.8 },
    percussiveRatio: 0.4,
    harmonicRatio: 0.6,
    voiceProb: 0.8, // 大幅增加
    instruments: { dominantInstrument: 'vocals' },
    instrumentProbabilities: { vocals: 0.9, piano: 0.7, strings: 0.5 },
    instrumentConfidence: 0.85,
    enhancedHPSS: { musicComplexity: 0.7, overallStability: 0.6, overallRichness: 0.8 }
  },
  // 复杂度变化测试
  {
    rms: 0.8,
    tempo: { bpm: 160, tempoConfidence: 0.9 },
    percussiveRatio: 0.6,
    harmonicRatio: 0.4,
    voiceProb: 0.5,
    instruments: { dominantInstrument: 'guitar' },
    instrumentProbabilities: { guitar: 0.8, drums: 0.7, bass: 0.6, piano: 0.5, strings: 0.4 },
    instrumentConfidence: 0.8,
    enhancedHPSS: { musicComplexity: 0.9, overallStability: 0.7, overallRichness: 0.9 } // 高复杂度
  }
];

// 测试1: 自动触发测试
console.log('🎵 测试1: 自动触发测试');
console.log('模拟音频特征变化，观察弹幕自动生成...\n');

let testIndex = 0;
const autoTestInterval = setInterval(() => {
  if (testIndex >= mockFeatures.length) {
    clearInterval(autoTestInterval);
    console.log('✅ 自动触发测试完成\n');
    
    // 测试2: 手动触发测试
    console.log('🎮 测试2: 手动触发测试');
    console.log('手动触发弹幕...\n');
    
    danmuAdapter.trigger({
      text: '🎵 手动触发测试弹幕',
      style: 'manual',
      color: '#ff6b6b',
      size: 18,
    });
    
    setTimeout(() => {
      console.log('✅ 手动触发测试完成\n');
      
      // 测试3: 特征摘要测试
      console.log('📊 测试3: 特征摘要测试');
      const lastFeatures = mockFeatures[mockFeatures.length - 1];
      const summary = danmuAdapter.generateFeatureSummary(danmuAdapter.extractCoreFeatures(lastFeatures));
      console.log('特征摘要:', summary);
      console.log('✅ 特征摘要测试完成\n');
      
      // 测试4: 状态检查
      console.log('📈 测试4: 状态检查');
      console.log('弹幕适配器状态:', {
        isReady: danmuAdapter.isReady,
        danmuCount: danmuAdapter.danmuCount,
        pendingRequests: danmuAdapter.pendingRequests,
        currentStyle: danmuAdapter.currentStyle
      });
      console.log('✅ 状态检查完成\n');
      
      // 停止适配器
      danmuAdapter.stop();
      console.log('🛑 弹幕适配器已停止');
      console.log('🎉 所有测试完成！');
      
      process.exit(0);
    }, 1000);
    
    return;
  }
  
  const features = mockFeatures[testIndex];
  console.log(`📊 处理特征 ${testIndex + 1}:`, {
    bpm: features.tempo.bpm,
    percussiveRatio: features.percussiveRatio,
    voiceProb: features.voiceProb,
    complexity: features.enhancedHPSS.musicComplexity,
    instrument: features.instruments.dominantInstrument
  });
  
  danmuAdapter.handleAudioFeatures(features.rms, features);
  testIndex++;
}, 2000);

// 错误处理
process.on('uncaughtException', (error) => {
  console.error('❌ 未捕获的异常:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未处理的Promise拒绝:', reason);
  process.exit(1);
});
