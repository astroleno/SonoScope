/**
 * LLM弹幕集成测试脚本
 * 验证独立客户端的LLM弹幕功能
 */

const https = require('https');
const http = require('http');

// 禁用SSL证书验证（仅用于测试）
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

async function testLLMDanmuIntegration() {
    console.log('🚀 开始测试LLM弹幕集成...');
    
    const baseUrl = 'http://localhost:3005';
    
    try {
        // 1. 测试页面访问
        console.log('📱 测试独立客户端页面访问...');
        const pageResponse = await fetch(`${baseUrl}/standalone-client`);
        
        if (pageResponse.ok) {
            console.log('✅ 独立客户端页面访问成功');
            const html = await pageResponse.text();
            
            // 检查关键元素
            if (html.includes('danmu-container')) {
                console.log('✅ 弹幕容器存在');
            } else {
                console.log('❌ 弹幕容器未找到');
            }
            
            if (html.includes('useDanmuPipeline')) {
                console.log('✅ LLM弹幕管线已集成');
            } else {
                console.log('⚠️ LLM弹幕管线可能未正确集成');
            }
        } else {
            console.log(`❌ 页面访问失败: ${pageResponse.status}`);
            return;
        }
        
        // 2. 测试LLM API端点
        console.log('🧠 测试LLM API端点...');
        
        // 测试 /api/analyze 端点
        try {
            const analyzeResponse = await fetch(`${baseUrl}/api/analyze`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    window_ms: 2000,
                    features: {
                        rms_mean: 0.3,
                        spectralCentroid_mean: 2000,
                        spectralFlatness_mean: 0.4,
                        tempo_bpm: 120,
                        dynamic_range: 0.6,
                        dominantInstrument: 'guitar',
                        instrumentHistogram: { guitar: 0.8, piano: 0.2 }
                    },
                    need_comments: 3,
                    locale: 'zh-CN',
                    style: 'Electronic',
                    confidence: 0.8,
                    talking_points: ['节拍稳定', '音色清晰']
                })
            });
            
            if (analyzeResponse.ok) {
                console.log('✅ /api/analyze 端点可访问');
                const analyzeData = await analyzeResponse.text();
                console.log('📊 分析响应长度:', analyzeData.length, '字符');
            } else {
                console.log(`❌ /api/analyze 端点访问失败: ${analyzeResponse.status}`);
            }
        } catch (e) {
            console.log('❌ /api/analyze 端点测试失败:', e.message);
        }
        
        // 测试 /api/llm-danmu 端点
        try {
            const llmDanmuResponse = await fetch(`${baseUrl}/api/llm-danmu`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    features: {
                        rms: 0.3,
                        spectralCentroid: 2000,
                        spectralFlatness: 0.4,
                        tempo: 120
                    }
                })
            });
            
            if (llmDanmuResponse.ok) {
                console.log('✅ /api/llm-danmu 端点可访问');
                const llmData = await llmDanmuResponse.json();
                console.log('📊 LLM弹幕响应:', llmData);
            } else {
                console.log(`❌ /api/llm-danmu 端点访问失败: ${llmDanmuResponse.status}`);
            }
        } catch (e) {
            console.log('❌ /api/llm-danmu 端点测试失败:', e.message);
        }
        
        // 3. 检查环境配置
        console.log('🔧 检查环境配置...');
        
        // 检查是否有智谱AI配置
        try {
            const envResponse = await fetch(`${baseUrl}/api/analyze`, {
                method: 'OPTIONS'
            });
            console.log('📋 API选项响应:', envResponse.status);
        } catch (e) {
            console.log('⚠️ 无法检查API配置:', e.message);
        }
        
        console.log('🎉 LLM弹幕集成测试完成！');
        console.log('💡 请在浏览器中访问 http://localhost:3005/standalone-client 进行完整功能测试');
        console.log('🔧 测试建议:');
        console.log('  1. 点击预设按钮启动音频处理');
        console.log('  2. 授权麦克风权限');
        console.log('  3. 观察控制台输出 - 应该看到LLM弹幕管线日志');
        console.log('  4. 发出声音测试LLM弹幕生成');
        console.log('  5. 检查调试面板中的LLM弹幕状态');
        console.log('  6. 按D键切换弹幕开关');
        
        console.log('\n📊 预期行为:');
        console.log('  - 控制台应显示 "LLM弹幕管线已启动"');
        console.log('  - 控制台应显示 "LLM弹幕管线处理特征" 日志');
        console.log('  - 调试面板应显示 pipeline: true, style: [风格名]');
        console.log('  - 弹幕应基于LLM生成，内容更丰富多样');
        
    } catch (error) {
        console.error('❌ 测试过程中发生错误:', error.message);
    }
}

// 运行测试
testLLMDanmuIntegration().catch(console.error);
