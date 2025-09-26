#!/usr/bin/env node

/**
 * GLM-4.5-Air 模型测试脚本
 * 测试智谱AI GLM-4.5-Air 模型的弹幕生成功能
 */

import http from 'http';

const BASE_URL = 'http://localhost:3000';

console.log('🚀 开始测试 GLM-4.5-Air 模型...');

// 测试函数
async function testEndpoint(endpoint, data, description) {
  return new Promise((resolve) => {
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 10000 // 10秒超时
    };

    console.log(`📡 测试 ${description}...`);
    
    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        console.log(`✅ ${description} 响应状态: ${res.statusCode}`);
        
        if (res.statusCode === 200) {
          try {
            const result = JSON.parse(responseData);
            console.log(`📊 响应数据:`, result);
            resolve({ success: true, data: result, status: res.statusCode });
          } catch (e) {
            console.log(`📝 响应内容: ${responseData.substring(0, 200)}...`);
            resolve({ success: true, data: responseData, status: res.statusCode });
          }
        } else {
          console.log(`❌ ${description} 失败: ${res.statusCode}`);
          console.log(`📝 错误内容: ${responseData}`);
          resolve({ success: false, error: responseData, status: res.statusCode });
        }
      });
    });

    req.on('error', (err) => {
      console.log(`❌ ${description} 请求错误:`, err.message);
      resolve({ success: false, error: err.message });
    });

    req.on('timeout', () => {
      console.log(`⏰ ${description} 请求超时`);
      req.destroy();
      resolve({ success: false, error: 'Request timeout' });
    });

    req.write(postData);
    req.end();
  });
}

// 主测试函数
async function runTests() {
  console.log('📱 测试独立客户端页面访问...');
  
  // 测试页面访问
  try {
    const response = await fetch(`${BASE_URL}/standalone-client`);
    if (response.ok) {
      console.log('✅ 独立客户端页面访问成功');
    } else {
      console.log('❌ 独立客户端页面访问失败:', response.status);
    }
  } catch (error) {
    console.log('❌ 独立客户端页面访问错误:', error.message);
  }

  // 测试 /api/analyze 端点
  const analyzeResult = await testEndpoint('/api/analyze', {
    window_ms: 2000,
    features: {
      rms_mean: 0.3,
      spectralCentroid_mean: 2000,
      spectralFlatness_mean: 0.4,
      tempo_bpm: 120,
      dynamic_range: 0.6
    },
    need_comments: 3,
    locale: 'zh-CN',
    style: 'Electronic',
    confidence: 0.8,
    talking_points: ['节拍稳定', '音色清晰']
  }, '风格检测API');

  // 测试 /api/llm-danmu 端点
  const danmuResult = await testEndpoint('/api/llm-danmu', {
    features: {
      rms: 0.3,
      spectralCentroid: 2000,
      spectralFlatness: 0.4,
      tempo: 120
    }
  }, 'LLM弹幕生成API');

  // 测试结果总结
  console.log('\n🎉 GLM-4.5-Air 模型测试完成！');
  console.log('\n📊 测试结果总结:');
  console.log(`风格检测API: ${analyzeResult.success ? '✅ 成功' : '❌ 失败'}`);
  console.log(`LLM弹幕API: ${danmuResult.success ? '✅ 成功' : '❌ 失败'}`);

  if (analyzeResult.success) {
    console.log('🎵 风格检测功能正常，GLM-4.5-Air模型可以正常工作');
  }

  if (danmuResult.success) {
    console.log('🎵 LLM弹幕生成功能正常，GLM-4.5-Air模型可以正常工作');
  } else {
    console.log('⚠️ LLM弹幕生成功能异常，可能的原因:');
    console.log('  1. 智谱AI API余额不足');
    console.log('  2. 网络连接问题');
    console.log('  3. API密钥配置问题');
    console.log('  4. GLM-4.5-Air模型调用超时');
  }

  console.log('\n💡 测试建议:');
  console.log('1. 访问 http://localhost:3000/standalone-client 进行完整功能测试');
  console.log('2. 点击预设按钮启动音频处理');
  console.log('3. 授权麦克风权限');
  console.log('4. 观察控制台输出 - 应该看到GLM-4.5-Air模型调用日志');
  console.log('5. 发出声音测试LLM弹幕生成');
  console.log('6. 检查调试面板中的LLM弹幕状态');

  console.log('\n📊 预期行为:');
  console.log('- 控制台应显示 "LLM弹幕管线已启动"');
  console.log('- 控制台应显示 "LLM弹幕管线处理特征" 日志');
  console.log('- 调试面板应显示 pipeline: true, style: [风格名]');
  console.log('- 弹幕应基于GLM-4.5-Air模型生成，内容更丰富多样');
}

// 运行测试
runTests().catch(console.error);
