import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

interface TestResult {
  phase: string;
  passed: number;
  failed: number;
  duration: number;
  tests: any[];
  success: boolean;
}

async function runTests() {
  console.log('🧪 Running SonoScope Phase 1-2.6 Tests...\n');

  const results: TestResult[] = [];
  const reportDir = join(__dirname, 'reports');

  if (!existsSync(reportDir)) {
    mkdirSync(reportDir, { recursive: true });
  }

  // Test each phase
  const phases = [
    { name: 'Phase 1', path: 'phase1/*', description: 'Feature Extraction Enhancement' },
    { name: 'Phase 2', path: 'phase2/*', description: 'Stability Detector' },
    { name: 'Phase 2.5', path: 'phase2-5/*', description: 'Lightweight Genre/Instrument Classification' },
    { name: 'Phase 2.6', path: 'phase2-6/*', description: 'Pretrained Model Integration' }
  ];

  for (const phase of phases) {
    console.log(`🎯 Testing ${phase.name}: ${phase.description}`);
    console.log('='.repeat(50));

    try {
      const startTime = Date.now();

      // Run tests for this phase
      const testCommand = `npx vitest run test/${phase.path} --reporter=verbose --no-coverage`;
      const output = execSync(testCommand, {
        encoding: 'utf-8',
        cwd: join(__dirname, '..')
      });

      const duration = Date.now() - startTime;

      // Parse results (simplified parsing)
      const lines = output.split('\n');
      const testLines = lines.filter(line => line.includes('✅') || line.includes('❌'));

      const passed = testLines.filter(line => line.includes('✅')).length;
      const failed = testLines.filter(line => line.includes('❌')).length;
      const success = failed === 0;

      const result: TestResult = {
        phase: phase.name,
        passed,
        failed,
        duration,
        tests: testLines,
        success
      };

      results.push(result);

      console.log(`\n✅ ${phase.name} Results:`);
      console.log(`   Passed: ${passed}`);
      console.log(`   Failed: ${failed}`);
      console.log(`   Duration: ${duration}ms`);
      console.log(`   Status: ${success ? 'SUCCESS' : 'FAILED'}\n`);

    } catch (error) {
      console.error(`❌ ${phase.name} failed to run:`, error);

      results.push({
        phase: phase.name,
        passed: 0,
        failed: 1,
        duration: 0,
        tests: [],
        success: false
      });
    }
  }

  // Generate comprehensive report
  generateReport(results);

  // Summary
  const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  const overallSuccess = results.every(r => r.success);

  console.log('🎯 Test Summary');
  console.log('='.repeat(50));
  console.log(`Total Tests: ${totalPassed + totalFailed}`);
  console.log(`Passed: ${totalPassed}`);
  console.log(`Failed: ${totalFailed}`);
  console.log(`Duration: ${totalDuration}ms`);
  console.log(`Status: ${overallSuccess ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);

  if (!overallSuccess) {
    console.log('\n❌ Failed phases:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.phase}: ${r.failed} failed tests`);
    });
    process.exit(1);
  }

  console.log('\n🎉 All tests completed successfully!');
}

function generateReport(results: TestResult[]) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalPhases: results.length,
      totalPassed: results.reduce((sum, r) => sum + r.passed, 0),
      totalFailed: results.reduce((sum, r) => sum + r.failed, 0),
      totalDuration: results.reduce((sum, r) => sum + r.duration, 0),
      overallSuccess: results.every(r => r.success)
    },
    phases: results.map(r => ({
      phase: r.phase,
      passed: r.passed,
      failed: r.failed,
      duration: r.duration,
      success: r.success,
      failureRate: r.passed + r.failed > 0 ? (r.failed / (r.passed + r.failed)) * 100 : 0
    })),
    recommendations: generateRecommendations(results)
  };

  const reportPath = join(__dirname, 'reports', 'test-summary.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📊 Test report generated: ${reportPath}`);

  // Generate markdown report
  const markdownReport = generateMarkdownReport(report);
  const markdownPath = join(__dirname, 'reports', 'test-summary.md');
  writeFileSync(markdownPath, markdownReport);
  console.log(`📄 Markdown report generated: ${markdownPath}`);
}

function generateRecommendations(results: TestResult[]): string[] {
  const recommendations: string[] = [];

  results.forEach(result => {
    if (!result.success) {
      recommendations.push(`Fix failing tests in ${result.phase}`);
    }

    if (result.duration > 5000) {
      recommendations.push(`Optimize test performance in ${result.phase} (took ${result.duration}ms)`);
    }
  });

  if (results.every(r => r.success)) {
    recommendations.push('Consider adding integration tests for end-to-end workflows');
    recommendations.push('Add performance benchmarks for production monitoring');
  }

  return recommendations;
}

function generateMarkdownReport(report: any): string {
  return `# SonoScope Test Report

**Generated**: ${new Date(report.timestamp).toLocaleString()}
**Overall Status**: ${report.summary.overallSuccess ? '✅ PASSED' : '❌ FAILED'}

## Summary

- **Total Phases**: ${report.summary.totalPhases}
- **Total Tests**: ${report.summary.totalPassed + report.summary.totalFailed}
- **Passed**: ${report.summary.totalPassed}
- **Failed**: ${report.summary.totalFailed}
- **Duration**: ${report.summary.totalDuration}ms
- **Success Rate**: ${((report.summary.totalPassed / (report.summary.totalPassed + report.summary.totalFailed)) * 100).toFixed(1)}%

## Phase Results

${report.phases.map((phase: any) => `
### ${phase.phase}

- **Status**: ${phase.success ? '✅ PASSED' : '❌ FAILED'}
- **Passed**: ${phase.passed}
- **Failed**: ${phase.failed}
- **Duration**: ${phase.duration}ms
- **Failure Rate**: ${phase.failureRate.toFixed(1)}%
`).join('\n')}

## Recommendations

${report.recommendations.map((rec: string) => `- ${rec}`).join('\n')}

---

*This report was automatically generated by the SonoScope test suite.*
`;
}

if (require.main === module) {
  runTests().catch(console.error);
}

export { runTests };