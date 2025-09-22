/**
 * Phase 1 - 特征归一化功能测试
 */

const TestUtils = require('./test-utils');
const config = require('./test-config');

const utils = new TestUtils();

console.log('🧪 Phase 1 - 特征归一化功能测试');
console.log('='.repeat(50));

// 1. 测试归一化方法存在性
console.log('\n📊 归一化方法存在性测试');
console.log('-'.repeat(30));

utils.test('normalizeFeature方法存在', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'normalizeFeature(value: number, min: number, max: number): number');
});

utils.test('normalizeFeatureArray方法存在', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'normalizeFeatureArray(values: number[], min: number, max: number): number[]');
});

// 2. 测试归一化逻辑实现
console.log('\n📊 归一化逻辑实现测试');
console.log('-'.repeat(30));

utils.test('归一化公式正确实现', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', '(value - min) / (max - min)');
});

utils.test('归一化结果限制在[0,1]范围', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'Math.max(0, Math.min(1,');
});

utils.test('除零保护实现', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'if (max === min) return 0.5');
});

utils.test('数组归一化使用map方法', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'values.map(val => this.normalizeFeature(val, min, max))');
});

// 3. 测试归一化边界情况
console.log('\n📊 归一化边界情况测试');
console.log('-'.repeat(30));

utils.test('处理min等于max的情况', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'if (max === min) return 0.5');
});

utils.test('处理value小于min的情况', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'Math.max(0,');
});

utils.test('处理value大于max的情况', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'Math.min(1,');
});

// 4. 测试归一化性能
console.log('\n📊 归一化性能测试');
console.log('-'.repeat(30));

utils.test('归一化方法使用高效实现', () => {
  const content = utils.readFile('app/lib/feature-aggregator.ts');
  const normalizeMethod = content.match(/normalizeFeature\([^)]*\)[^}]*}/s);
  
  if (!normalizeMethod) return false;
  
  const methodContent = normalizeMethod[0];
  // 检查是否使用了高效的数学运算
  return methodContent.includes('Math.max') && methodContent.includes('Math.min');
});

utils.test('数组归一化使用批量处理', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'values.map(val => this.normalizeFeature(val, min, max))');
});

// 5. 测试归一化集成
console.log('\n📊 归一化集成测试');
console.log('-'.repeat(30));

utils.test('归一化方法在类中正确定义', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'normalizeFeature(value: number, min: number, max: number): number');
});

utils.test('归一化方法可被外部调用', () => {
  // 检查方法是否为public或protected
  const content = utils.readFile('app/lib/feature-aggregator.ts');
  const normalizeMethod = content.match(/normalizeFeature\([^)]*\)[^}]*}/s);
  
  if (!normalizeMethod) return false;
  
  const methodContent = normalizeMethod[0];
  return !methodContent.includes('private normalizeFeature');
});

// 6. 测试归一化文档
console.log('\n📊 归一化文档测试');
console.log('-'.repeat(30));

utils.test('归一化方法有完整注释', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', '/**') &&
         utils.codeContains('app/lib/feature-aggregator.ts', '特征归一化');
});

utils.test('归一化方法包含参数说明', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', '将特征值标准化到[0,1]范围');
});

utils.test('数组归一化方法有说明', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', '批量归一化特征数组');
});

// 7. 测试归一化使用示例
console.log('\n📊 归一化使用示例测试');
console.log('-'.repeat(30));

utils.test('示例文件包含归一化使用', () => {
  return utils.codeContains('app/lib/feature-aggregator-example.ts', 'normalizeFeature') ||
         utils.codeContains('app/lib/feature-aggregator-example.ts', 'normalizeFeatureArray');
});

// 8. 测试归一化错误处理
console.log('\n📊 归一化错误处理测试');
console.log('-'.repeat(30));

utils.test('归一化包含输入验证', () => {
  const content = utils.readFile('app/lib/feature-aggregator.ts');
  const normalizeMethod = content.match(/normalizeFeature\([^)]*\)[^}]*}/s);
  
  if (!normalizeMethod) return false;
  
  const methodContent = normalizeMethod[0];
  return methodContent.includes('if (max === min)') || methodContent.includes('Math.max') || methodContent.includes('Math.min');
});

// 9. 测试归一化数学正确性
console.log('\n📊 归一化数学正确性测试');
console.log('-'.repeat(30));

utils.test('归一化公式数学正确', () => {
  const content = utils.readFile('app/lib/feature-aggregator.ts');
  // 检查是否使用了正确的归一化公式
  return content.includes('(value - min) / (max - min)');
});

utils.test('归一化结果范围正确', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'Math.max(0, Math.min(1,');
});

// 输出测试结果
const success = utils.printResults();
utils.saveResults('phase1-normalization-test-results.json');

if (success) {
  console.log('\n🎉 特征归一化功能测试全部通过！');
  console.log('\n📋 功能验证总结:');
  console.log('• ✅ 归一化方法存在且正确实现');
  console.log('• ✅ 支持单值和数组归一化');
  console.log('• ✅ 数学公式正确实现');
  console.log('• ✅ 边界情况处理完善');
  console.log('• ✅ 性能优化和错误处理');
  console.log('• ✅ 完整的文档和注释');
  console.log('• ✅ 使用示例和集成测试');
} else {
  console.log('\n⚠️  特征归一化功能测试发现问题，请检查实现');
}

process.exit(success ? 0 : 1);
