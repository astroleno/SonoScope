/**
 * 测试工具函数
 * 提供通用的测试辅助功能
 */

const fs = require('fs');
const path = require('path');
const config = require('./test-config.cjs');

class TestUtils {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      startTime: Date.now()
    };
  }

  /**
   * 运行单个测试
   */
  test(name, testFn) {
    this.testResults.total++;
    try {
      const result = testFn();
      if (result === true || result === undefined) {
        console.log(`✅ ${name}`);
        this.testResults.passed++;
        return true;
      } else {
        console.log(`❌ ${name}`);
        this.testResults.failed++;
        return false;
      }
    } catch (error) {
      console.log(`❌ ${name} - Error: ${error.message}`);
      this.testResults.failed++;
      return false;
    }
  }

  /**
   * 跳过测试
   */
  skip(name, reason) {
    this.testResults.skipped++;
    console.log(`⏭️  ${name} - ${reason}`);
  }

  /**
   * 断言相等
   */
  assertEqual(actual, expected, message = '') {
    if (actual !== expected) {
      throw new Error(`${message} - Expected: ${expected}, Actual: ${actual}`);
    }
    return true;
  }

  /**
   * 断言近似相等（用于浮点数比较）
   */
  assertApproxEqual(actual, expected, tolerance = 0.001, message = '') {
    if (Math.abs(actual - expected) > tolerance) {
      throw new Error(`${message} - Expected: ${expected} ± ${tolerance}, Actual: ${actual}`);
    }
    return true;
  }

  /**
   * 断言在范围内
   */
  assertInRange(value, min, max, message = '') {
    if (value < min || value > max) {
      throw new Error(`${message} - Value ${value} not in range [${min}, ${max}]`);
    }
    return true;
  }

  /**
   * 断言为真
   */
  assertTrue(condition, message = '') {
    if (!condition) {
      throw new Error(`${message} - Expected true, got false`);
    }
    return true;
  }

  /**
   * 断言为假
   */
  assertFalse(condition, message = '') {
    if (condition) {
      throw new Error(`${message} - Expected false, got true`);
    }
    return true;
  }

  /**
   * 断言数组长度
   */
  assertArrayLength(array, expectedLength, message = '') {
    if (!Array.isArray(array)) {
      throw new Error(`${message} - Expected array, got ${typeof array}`);
    }
    if (array.length !== expectedLength) {
      throw new Error(`${message} - Expected length ${expectedLength}, got ${array.length}`);
    }
    return true;
  }

  /**
   * 断言对象包含属性
   */
  assertHasProperty(obj, property, message = '') {
    if (!(property in obj)) {
      throw new Error(`${message} - Object missing property: ${property}`);
    }
    return true;
  }

  /**
   * 生成随机测试数据
   */
  generateRandomFeatureFrame(overrides = {}) {
    const base = { ...config.sampleData.mockFeatureFrame };
    return {
      ...base,
      timestamp: Date.now() + Math.random() * 1000,
      rms: Math.random(),
      spectralCentroid: Math.random() * 5000,
      zcr: Math.random(),
      spectralFlatness: Math.random(),
      spectralFlux: Math.random() * 5,
      loudness: -70 + Math.random() * 60,
      voiceProb: Math.random(),
      percussiveRatio: Math.random(),
      harmonicRatio: Math.random(),
      ...overrides
    };
  }

  /**
   * 生成多个随机特征帧
   */
  generateRandomFeatureFrames(count, overrides = {}) {
    return Array.from({ length: count }, () => 
      this.generateRandomFeatureFrame(overrides)
    );
  }

  /**
   * 测量执行时间
   */
  measureTime(fn) {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    return {
      result,
      duration: end - start
    };
  }

  /**
   * 创建测试报告
   */
  generateReport() {
    const duration = Date.now() - this.testResults.startTime;
    const passRate = (this.testResults.passed / this.testResults.total * 100).toFixed(1);
    
    return {
      ...this.testResults,
      duration,
      passRate: `${passRate}%`
    };
  }

  /**
   * 打印测试结果
   */
  printResults() {
    const report = this.generateReport();
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 测试结果汇总');
    console.log('='.repeat(50));
    console.log(`✅ 通过: ${report.passed}`);
    console.log(`❌ 失败: ${report.failed}`);
    console.log(`⏭️  跳过: ${report.skipped}`);
    console.log(`📊 总计: ${report.total}`);
    console.log(`📈 通过率: ${report.passRate}`);
    console.log(`⏱️  耗时: ${report.duration.toFixed(2)}ms`);
    
    if (report.failed > 0) {
      console.log('\n⚠️  发现失败的测试，请检查相关实现');
      return false;
    } else {
      console.log('\n🎉 所有测试通过！');
      return true;
    }
  }

  /**
   * 保存测试结果到文件
   */
  saveResults(filename = 'test-results.json') {
    const report = this.generateReport();
    const outputPath = path.join(config.testOutputDir, filename);
    
    // 确保输出目录存在
    if (!fs.existsSync(config.testOutputDir)) {
      fs.mkdirSync(config.testOutputDir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`📄 测试结果已保存到: ${outputPath}`);
  }

  /**
   * 检查文件是否存在
   */
  fileExists(filePath) {
    return fs.existsSync(path.resolve(config.projectRoot, filePath));
  }

  /**
   * 读取文件内容
   */
  readFile(filePath) {
    const fullPath = path.resolve(config.projectRoot, filePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    return fs.readFileSync(fullPath, 'utf8');
  }

  /**
   * 检查代码中是否包含特定内容
   */
  codeContains(filePath, searchString) {
    try {
      const content = this.readFile(filePath);
      return content.includes(searchString);
    } catch (error) {
      return false;
    }
  }
}

module.exports = TestUtils;
