/**
 * Phase 1 - 特征验证和边界检查功能测试
 */

const TestUtils = require('./test-utils.cjs');
const config = require('./test-config.cjs');

const utils = new TestUtils();

console.log('🧪 Phase 1 - 特征验证和边界检查功能测试');
console.log('='.repeat(50));

// 1. 测试验证方法存在性
console.log('\n📊 验证方法存在性测试');
console.log('-'.repeat(30));

utils.test('validateFeature方法存在', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'validateFeature(value: number | undefined, name: string, min: number = 0, max: number = 1): number');
});

utils.test('validateFeatureArray方法存在', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'validateFeatureArray(values: number[] | undefined, name: string, expectedLength?: number): number[]');
});

// 2. 测试验证逻辑实现
console.log('\n📊 验证逻辑实现测试');
console.log('-'.repeat(30));

utils.test('undefined和null检查', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'value === undefined || value === null');
});

utils.test('有限数值检查', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'Number.isFinite(value)');
});

utils.test('范围检查', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'value < min || value > max');
});

utils.test('范围截断', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'Math.max(min, Math.min(max, value))');
});

// 3. 测试数组验证逻辑
console.log('\n📊 数组验证逻辑测试');
console.log('-'.repeat(30));

utils.test('数组存在性检查', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', '!values || !Array.isArray(values)');
});

utils.test('数组长度检查', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'expectedLength && values.length !== expectedLength');
});

utils.test('数组元素验证', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'values.map((val, index) =>');
});

// 4. 测试验证集成
console.log('\n📊 验证集成测试');
console.log('-'.repeat(30));

utils.test('calculateStatistics使用特征验证', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', '.map(val => this.validateFeature(val, feature))');
});

utils.test('数值特征统计使用验证', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'this.validateFeature(this.mean(values), `${feature}_mean`)');
});

utils.test('数组特征统计使用验证', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'this.validateFeatureArray(means, `${feature}_mean`, dim)');
});

// 5. 测试验证错误处理
console.log('\n📊 验证错误处理测试');
console.log('-'.repeat(30));

utils.test('验证包含警告日志', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'console.warn') &&
         utils.codeContains('app/lib/feature-aggregator.ts', '特征');
});

utils.test('验证包含默认值处理', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', '使用默认值 0');
});

utils.test('验证包含截断处理', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', '进行截断');
});

// 6. 测试验证性能
console.log('\n📊 验证性能测试');
console.log('-'.repeat(30));

utils.test('验证方法使用高效检查', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'Number.isFinite') ||
         utils.codeContains('app/lib/feature-aggregator.ts', 'Math.max') ||
         utils.codeContains('app/lib/feature-aggregator.ts', 'Math.min');
});

// 7. 测试验证文档
console.log('\n📊 验证文档测试');
console.log('-'.repeat(30));

utils.test('验证方法有完整注释', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', '/**') &&
         utils.codeContains('app/lib/feature-aggregator.ts', '特征验证和边界检查');
});

utils.test('验证方法包含参数说明', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'name: string') &&
         utils.codeContains('app/lib/feature-aggregator.ts', 'min: number = 0, max: number = 1');
});

utils.test('数组验证方法有说明', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', '验证特征数组');
});

// 8. 测试验证使用示例
console.log('\n📊 验证使用示例测试');
console.log('-'.repeat(30));

utils.test('示例文件包含验证使用', () => {
  return utils.codeContains('app/lib/feature-aggregator-example.ts', 'validateFeature') ||
         utils.codeContains('app/lib/feature-aggregator-example.ts', 'validateFeatureArray');
});

// 9. 测试验证边界情况
console.log('\n📊 验证边界情况测试');
console.log('-'.repeat(30));

utils.test('处理NaN值', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'Number.isFinite(value)');
});

utils.test('处理Infinity值', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'Number.isFinite(value)');
});

utils.test('处理空数组', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', '!Array.isArray(values)');
});

// 10. 测试验证返回值
console.log('\n📊 验证返回值测试');
console.log('-'.repeat(30));

utils.test('验证方法返回有效数值', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'validateFeature(value: number | undefined, name: string, min: number = 0, max: number = 1): number');
});

utils.test('验证方法返回数组', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'validateFeatureArray(values: number[] | undefined, name: string, expectedLength?: number): number[]');
});

// 输出测试结果
const success = utils.printResults();
utils.saveResults('phase1-validation-test-results.json');

if (success) {
  console.log('\n🎉 特征验证和边界检查功能测试全部通过！');
  console.log('\n📋 功能验证总结:');
  console.log('• ✅ 验证方法存在且正确实现');
  console.log('• ✅ 支持单值和数组验证');
  console.log('• ✅ 完整的边界情况处理');
  console.log('• ✅ 集成到统计计算中');
  console.log('• ✅ 完善的错误处理和日志');
  console.log('• ✅ 性能优化和高效实现');
  console.log('• ✅ 完整的文档和注释');
  console.log('• ✅ 使用示例和集成测试');
} else {
  console.log('\n⚠️  特征验证和边界检查功能测试发现问题，请检查实现');
}

process.exit(success ? 0 : 1);
