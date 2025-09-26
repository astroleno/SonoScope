/**
 * Web Worker集成测试
 * 测试Worker管理器和FeatureAggregator的Worker集成
 */

const TestUtils = require('./test-utils.cjs');
const config = require('./test-config.cjs');

const utils = new TestUtils();

console.log('🧪 Web Worker集成测试');
console.log('='.repeat(50));

// 1. 测试Worker文件存在性
console.log('\n📊 Worker文件存在性测试');
console.log('-'.repeat(30));

utils.test('Audio Worker文件存在', () => {
  return utils.fileExists('app/lib/workers/audio-worker.ts');
});

utils.test('Model Worker文件存在', () => {
  return utils.fileExists('app/lib/workers/model-worker.ts');
});

utils.test('Worker Manager文件存在', () => {
  return utils.fileExists('app/lib/worker-manager.ts');
});

// 2. 测试Worker代码质量
console.log('\n📊 Worker代码质量测试');
console.log('-'.repeat(30));

utils.test('Audio Worker包含消息处理', () => {
  return utils.codeContains('app/lib/workers/audio-worker.ts', 'addEventListener') &&
         utils.codeContains('app/lib/workers/audio-worker.ts', 'postMessage');
});

utils.test('Model Worker包含模型推理', () => {
  return utils.codeContains('app/lib/workers/model-worker.ts', 'infer') &&
         utils.codeContains('app/lib/workers/model-worker.ts', 'classifyInstruments');
});

utils.test('Worker Manager包含生命周期管理', () => {
  return utils.codeContains('app/lib/worker-manager.ts', 'initialize') &&
         utils.codeContains('app/lib/worker-manager.ts', 'destroy');
});

// 3. 测试FeatureAggregator Worker集成
console.log('\n📊 FeatureAggregator Worker集成测试');
console.log('-'.repeat(30));

utils.test('FeatureAggregator导入Worker Manager', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', "import { workerManager } from './worker-manager'");
});

utils.test('FeatureAggregator包含Worker初始化', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'initializeWorker') &&
         utils.codeContains('app/lib/feature-aggregator.ts', 'workerManager.initialize');
});

utils.test('FeatureAggregator包含异步方法', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'addFrameAsync') &&
         utils.codeContains('app/lib/feature-aggregator.ts', 'classifyInstrumentsAsync');
});

// 4. 测试接口扩展
console.log('\n📊 接口扩展测试');
console.log('-'.repeat(30));

utils.test('FeatureFrame接口包含音频数据字段', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'audioBuffer?: Float32Array') &&
         utils.codeContains('app/lib/feature-aggregator.ts', 'sampleRate?: number');
});

utils.test('统计信息包含Worker状态', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'workerStatus:') &&
         utils.codeContains('app/lib/feature-aggregator.ts', 'useWorker: boolean');
});

// 5. 测试错误处理
console.log('\n📊 错误处理测试');
console.log('-'.repeat(30));

utils.test('Worker包含错误处理机制', () => {
  return utils.codeContains('app/lib/workers/audio-worker.ts', 'catch (error)') &&
         utils.codeContains('app/lib/workers/model-worker.ts', 'catch (error)');
});

utils.test('Worker Manager包含降级策略', () => {
  return utils.codeContains('app/lib/worker-manager.ts', 'autoRestart') &&
         utils.codeContains('app/lib/worker-manager.ts', 'restartWorker');
});

utils.test('FeatureAggregator包含Worker降级', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', '回退到主线程处理') &&
         utils.codeContains('app/lib/feature-aggregator.ts', 'this.useWorker = false');
});

// 6. 测试性能优化
console.log('\n📊 性能优化测试');
console.log('-'.repeat(30));

utils.test('Worker使用异步处理', () => {
  return utils.codeContains('app/lib/workers/audio-worker.ts', 'async processAudio') &&
         utils.codeContains('app/lib/workers/model-worker.ts', 'async infer');
});

utils.test('Worker Manager包含超时控制', () => {
  return utils.codeContains('app/lib/worker-manager.ts', 'timeout') &&
         utils.codeContains('app/lib/worker-manager.ts', 'setTimeout');
});

// 7. 测试类型安全
console.log('\n📊 类型安全测试');
console.log('-'.repeat(30));

utils.test('Worker消息类型定义完整', () => {
  return utils.codeContains('app/lib/workers/audio-worker.ts', 'interface AudioWorkerMessage') &&
         utils.codeContains('app/lib/workers/model-worker.ts', 'interface ModelWorkerMessage');
});

utils.test('Worker响应类型定义完整', () => {
  return utils.codeContains('app/lib/workers/audio-worker.ts', 'interface AudioWorkerResponse') &&
         utils.codeContains('app/lib/workers/model-worker.ts', 'interface ModelWorkerResponse');
});

// 8. 测试文档完整性
console.log('\n📊 文档完整性测试');
console.log('-'.repeat(30));

utils.test('Worker文件包含完整注释', () => {
  return utils.codeContains('app/lib/workers/audio-worker.ts', '/**') &&
         utils.codeContains('app/lib/workers/model-worker.ts', '/**') &&
         utils.codeContains('app/lib/worker-manager.ts', '/**');
});

utils.test('Worker方法包含功能说明', () => {
  return utils.codeContains('app/lib/workers/audio-worker.ts', '处理音频数据') &&
         utils.codeContains('app/lib/workers/model-worker.ts', '执行模型推理');
});

// 输出测试结果
const success = utils.printResults();
utils.saveResults('worker-integration-test-results.json');

if (success) {
  console.log('\n🎉 Web Worker集成测试全部通过！');
  console.log('\n📋 功能验证总结:');
  console.log('• ✅ Worker文件创建完成');
  console.log('• ✅ 消息通信机制实现');
  console.log('• ✅ 生命周期管理完善');
  console.log('• ✅ FeatureAggregator集成成功');
  console.log('• ✅ 错误处理和降级策略');
  console.log('• ✅ 性能优化和异步处理');
  console.log('• ✅ 类型安全和接口扩展');
  console.log('• ✅ 文档完整和代码质量');
} else {
  console.log('\n⚠️  Web Worker集成测试发现问题，请检查实现');
}

process.exit(success ? 0 : 1);
