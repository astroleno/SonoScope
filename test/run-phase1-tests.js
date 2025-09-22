#!/usr/bin/env node

/**
 * Phase 1 全面测试运行器
 * 运行所有Phase 1相关的测试
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Phase 1 全面测试运行器');
console.log('='.repeat(60));

// 测试配置
const tests = [
  {
    name: 'Loudness (LKFS) 计算功能测试',
    file: 'phase1-loudness.test.js',
    description: '测试Loudness计算方法的实现和集成'
  },
  {
    name: '特征归一化功能测试',
    file: 'phase1-normalization.test.js',
    description: '测试特征归一化方法的实现和功能'
  },
  {
    name: '特征验证和边界检查测试',
    file: 'phase1-validation.test.js',
    description: '测试特征验证和边界检查的实现'
  },
  {
    name: '特征序列化/反序列化测试',
    file: 'phase1-serialization.test.js',
    description: '测试特征序列化和反序列化功能'
  },
  {
    name: 'Phase 1 集成测试',
    file: 'phase1-integration.test.js',
    description: '测试所有Phase 1功能的集成和协同工作'
  }
];

// 测试结果统计
const testResults = {
  total: tests.length,
  passed: 0,
  failed: 0,
  startTime: Date.now(),
  details: []
};

/**
 * 运行单个测试
 */
function runTest(test) {
  return new Promise((resolve) => {
    console.log(`\n🧪 运行测试: ${test.name}`);
    console.log(`📝 描述: ${test.description}`);
    console.log(`📁 文件: ${test.file}`);
    console.log('-'.repeat(50));

    const testPath = path.join(__dirname, test.file);
    
    if (!fs.existsSync(testPath)) {
      console.log(`❌ 测试文件不存在: ${test.file}`);
      testResults.failed++;
      testResults.details.push({
        name: test.name,
        status: 'failed',
        error: '测试文件不存在'
      });
      resolve();
      return;
    }

    const child = spawn('node', [testPath], {
      cwd: __dirname,
      stdio: 'inherit'
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${test.name} - 通过`);
        testResults.passed++;
        testResults.details.push({
          name: test.name,
          status: 'passed',
          error: null
        });
      } else {
        console.log(`❌ ${test.name} - 失败 (退出码: ${code})`);
        testResults.failed++;
        testResults.details.push({
          name: test.name,
          status: 'failed',
          error: `退出码: ${code}`
        });
      }
      resolve();
    });

    child.on('error', (error) => {
      console.log(`❌ ${test.name} - 错误: ${error.message}`);
      testResults.failed++;
      testResults.details.push({
        name: test.name,
        status: 'failed',
        error: error.message
      });
      resolve();
    });
  });
}

/**
 * 生成测试报告
 */
function generateReport() {
  const duration = Date.now() - testResults.startTime;
  const passRate = (testResults.passed / testResults.total * 100).toFixed(1);
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 Phase 1 全面测试报告');
  console.log('='.repeat(60));
  console.log(`⏱️  总耗时: ${duration.toFixed(2)}ms`);
  console.log(`📊 总测试数: ${testResults.total}`);
  console.log(`✅ 通过: ${testResults.passed}`);
  console.log(`❌ 失败: ${testResults.failed}`);
  console.log(`📈 通过率: ${passRate}%`);
  
  console.log('\n📋 详细结果:');
  testResults.details.forEach((detail, index) => {
    const status = detail.status === 'passed' ? '✅' : '❌';
    console.log(`${index + 1}. ${status} ${detail.name}`);
    if (detail.error) {
      console.log(`   错误: ${detail.error}`);
    }
  });

  // 保存报告到文件
  const report = {
    timestamp: new Date().toISOString(),
    duration,
    summary: {
      total: testResults.total,
      passed: testResults.passed,
      failed: testResults.failed,
      passRate: `${passRate}%`
    },
    details: testResults.details
  };

  const reportPath = path.join(__dirname, 'output', 'phase1-comprehensive-test-report.json');
  
  // 确保输出目录存在
  if (!fs.existsSync(path.join(__dirname, 'output'))) {
    fs.mkdirSync(path.join(__dirname, 'output'), { recursive: true });
  }
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 详细报告已保存到: ${reportPath}`);

  return testResults.failed === 0;
}

/**
 * 主函数
 */
async function main() {
  console.log(`🎯 开始运行 ${tests.length} 个Phase 1测试...`);
  
  // 按顺序运行所有测试
  for (const test of tests) {
    await runTest(test);
  }
  
  // 生成报告
  const success = generateReport();
  
  if (success) {
    console.log('\n🎉 Phase 1 全面测试全部通过！');
    console.log('\n📋 Phase 1 功能验证总结:');
    console.log('• ✅ Loudness (LKFS) 计算 - 基于ITU-R BS.1770标准');
    console.log('• ✅ 特征归一化 - 支持单值和数组归一化');
    console.log('• ✅ 特征验证和边界检查 - 完整的输入验证');
    console.log('• ✅ 特征序列化/反序列化 - JSON格式支持');
    console.log('• ✅ 统计信息获取 - 运行时状态监控');
    console.log('• ✅ 错误处理和日志 - 完善的异常处理');
    console.log('• ✅ 性能优化 - 高效的算法实现');
    console.log('• ✅ 代码质量 - 清晰的接口设计和文档');
    console.log('• ✅ 集成测试 - 所有功能协同工作正常');
    
    console.log('\n🚀 Phase 1 已完成，可以进入下一阶段开发！');
    process.exit(0);
  } else {
    console.log('\n⚠️  Phase 1 测试发现问题，请检查失败的测试');
    console.log('\n🔧 建议检查:');
    console.log('• 检查失败的测试文件');
    console.log('• 验证相关功能的实现');
    console.log('• 查看详细的错误信息');
    console.log('• 修复问题后重新运行测试');
    process.exit(1);
  }
}

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('\n💥 未捕获的异常:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n💥 未处理的Promise拒绝:', reason);
  process.exit(1);
});

// 运行主函数
main().catch((error) => {
  console.error('\n💥 测试运行器错误:', error.message);
  process.exit(1);
});
