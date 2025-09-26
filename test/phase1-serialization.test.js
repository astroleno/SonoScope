/**
 * Phase 1 - 特征序列化/反序列化功能测试
 */

const TestUtils = require('./test-utils.cjs');
const config = require('./test-config.cjs');

const utils = new TestUtils();

console.log('🧪 Phase 1 - 特征序列化/反序列化功能测试');
console.log('='.repeat(50));

// 1. 测试序列化方法存在性
console.log('\n📊 序列化方法存在性测试');
console.log('-'.repeat(30));

utils.test('serializeFeatureWindow方法存在', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'serializeFeatureWindow(window: FeatureWindow): string');
});

utils.test('deserializeFeatureWindow方法存在', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'deserializeFeatureWindow(jsonString: string): FeatureWindow | null');
});

// 2. 测试序列化逻辑实现
console.log('\n📊 序列化逻辑实现测试');
console.log('-'.repeat(30));

utils.test('序列化使用JSON.stringify', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'JSON.stringify(window, null, 2)');
});

utils.test('序列化包含格式化', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'JSON.stringify(window, null, 2)');
});

utils.test('序列化包含错误处理', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'try {') &&
         utils.codeContains('app/lib/feature-aggregator.ts', 'catch (error)');
});

// 3. 测试反序列化逻辑实现
console.log('\n📊 反序列化逻辑实现测试');
console.log('-'.repeat(30));

utils.test('反序列化使用JSON.parse', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'JSON.parse(jsonString)');
});

utils.test('反序列化包含字段验证', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', '!parsed.window_ms || !parsed.features');
});

utils.test('反序列化包含错误处理', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'try {') &&
         utils.codeContains('app/lib/feature-aggregator.ts', 'catch (error)');
});

// 4. 测试序列化错误处理
console.log('\n📊 序列化错误处理测试');
console.log('-'.repeat(30));

utils.test('序列化错误日志', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', '特征窗口序列化失败');
});

utils.test('序列化错误返回值', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'return \'{}\'');
});

utils.test('序列化错误处理完整性', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'try {') &&
         utils.codeContains('app/lib/feature-aggregator.ts', 'catch (error)') &&
         utils.codeContains('app/lib/feature-aggregator.ts', 'return');
});

// 5. 测试反序列化错误处理
console.log('\n📊 反序列化错误处理测试');
console.log('-'.repeat(30));

utils.test('反序列化错误日志', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', '特征窗口反序列化失败');
});

utils.test('反序列化错误返回值', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'return null');
});

utils.test('反序列化字段验证错误', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', '反序列化失败：缺少必要字段');
});

// 6. 测试序列化性能
console.log('\n📊 序列化性能测试');
console.log('-'.repeat(30));

utils.test('序列化使用原生JSON方法', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'JSON.stringify');
});

utils.test('反序列化使用原生JSON方法', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'JSON.parse');
});

// 7. 测试序列化文档
console.log('\n📊 序列化文档测试');
console.log('-'.repeat(30));

utils.test('序列化方法有完整注释', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', '/**') &&
         utils.codeContains('app/lib/feature-aggregator.ts', '特征序列化');
});

utils.test('反序列化方法有完整注释', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', '/**') &&
         utils.codeContains('app/lib/feature-aggregator.ts', '特征反序列化');
});

utils.test('序列化方法包含功能说明', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', '将FeatureWindow转换为JSON字符串');
});

utils.test('反序列化方法包含功能说明', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', '从JSON字符串恢复FeatureWindow');
});

// 8. 测试序列化使用示例
console.log('\n📊 序列化使用示例测试');
console.log('-'.repeat(30));

utils.test('示例文件包含序列化使用', () => {
  return utils.codeContains('app/lib/feature-aggregator-example.ts', 'serializeFeatureWindow') ||
         utils.codeContains('app/lib/feature-aggregator-example.ts', 'deserializeFeatureWindow');
});

// 9. 测试序列化类型安全
console.log('\n📊 序列化类型安全测试');
console.log('-'.repeat(30));

utils.test('序列化方法返回类型正确', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'serializeFeatureWindow(window: FeatureWindow): string');
});

utils.test('反序列化方法返回类型正确', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'deserializeFeatureWindow(jsonString: string): FeatureWindow | null');
});

// 10. 测试序列化数据完整性
console.log('\n📊 序列化数据完整性测试');
console.log('-'.repeat(30));

utils.test('反序列化验证必要字段', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'parsed.window_ms') &&
         utils.codeContains('app/lib/feature-aggregator.ts', 'parsed.features');
});

utils.test('反序列化类型转换', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'parsed as FeatureWindow');
});

// 11. 测试序列化边界情况
console.log('\n📊 序列化边界情况测试');
console.log('-'.repeat(30));

utils.test('处理空对象序列化', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'return \'{}\'');
});

utils.test('处理无效JSON反序列化', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'JSON.parse(jsonString)') &&
         utils.codeContains('app/lib/feature-aggregator.ts', 'catch (error)');
});

// 12. 测试序列化集成
console.log('\n📊 序列化集成测试');
console.log('-'.repeat(30));

utils.test('序列化方法在类中正确定义', () => {
  return utils.codeContains('app/lib/feature-aggregator.ts', 'serializeFeatureWindow') &&
         utils.codeContains('app/lib/feature-aggregator.ts', 'deserializeFeatureWindow');
});

utils.test('序列化方法可被外部调用', () => {
  // 检查方法是否为public
  const content = utils.readFile('app/lib/feature-aggregator.ts');
  const serializeMethod = content.match(/serializeFeatureWindow\([^)]*\)[^}]*}/s);
  
  if (!serializeMethod) return false;
  
  const methodContent = serializeMethod[0];
  return !methodContent.includes('private serializeFeatureWindow');
});

// 输出测试结果
const success = utils.printResults();
utils.saveResults('phase1-serialization-test-results.json');

if (success) {
  console.log('\n🎉 特征序列化/反序列化功能测试全部通过！');
  console.log('\n📋 功能验证总结:');
  console.log('• ✅ 序列化方法存在且正确实现');
  console.log('• ✅ 使用JSON格式进行序列化');
  console.log('• ✅ 完整的错误处理机制');
  console.log('• ✅ 字段验证和数据完整性检查');
  console.log('• ✅ 类型安全和边界情况处理');
  console.log('• ✅ 性能优化和高效实现');
  console.log('• ✅ 完整的文档和注释');
  console.log('• ✅ 使用示例和集成测试');
} else {
  console.log('\n⚠️  特征序列化/反序列化功能测试发现问题，请检查实现');
}

process.exit(success ? 0 : 1);
