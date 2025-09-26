/**
 * 简单的SonoScope功能测试脚本
 * 使用Node.js的fetch API测试独立客户端
 */

const https = require('https');
const http = require('http');

// 禁用SSL证书验证（仅用于测试）
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

async function testStandaloneClient() {
    console.log('🚀 开始测试SonoScope独立客户端...');
    
    const baseUrl = 'http://localhost:3005';
    
    try {
        // 1. 测试页面访问
        console.log('📱 测试页面访问...');
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
            
            if (html.includes('Wave') || html.includes('Accretion')) {
                console.log('✅ 预设选择器存在');
            } else {
                console.log('❌ 预设选择器未找到');
            }
        } else {
            console.log(`❌ 页面访问失败: ${pageResponse.status}`);
            return;
        }
        
        // 2. 测试YAMNet模型文件访问
        console.log('🧠 测试YAMNet模型文件访问...');
        const modelResponse = await fetch(`${baseUrl}/model/yamnet_tflite/yamnet.tflite`);
        
        if (modelResponse.ok) {
            const contentLength = modelResponse.headers.get('content-length');
            console.log(`✅ YAMNet模型文件可访问，大小: ${contentLength} bytes`);
        } else {
            console.log(`❌ YAMNet模型文件访问失败: ${modelResponse.status}`);
        }
        
        // 3. 测试其他静态资源
        console.log('📦 测试静态资源访问...');
        const manifestResponse = await fetch(`${baseUrl}/manifest.json`);
        if (manifestResponse.ok) {
            console.log('✅ manifest.json 可访问');
        } else {
            console.log('❌ manifest.json 访问失败');
        }
        
        // 4. 测试模型分类映射文件
        console.log('🗂️ 测试分类映射文件...');
        const classMapResponse = await fetch(`${baseUrl}/model/yamnet_tflite/yamnet_class_map.csv`);
        if (classMapResponse.ok) {
            const csvContent = await classMapResponse.text();
            const lines = csvContent.split('\n').filter(line => line.trim());
            console.log(`✅ 分类映射文件可访问，包含 ${lines.length} 个类别`);
        } else {
            console.log('❌ 分类映射文件访问失败');
        }
        
        console.log('🎉 基础测试完成！');
        console.log('💡 请在浏览器中访问 http://localhost:3005/standalone-client 进行完整功能测试');
        console.log('🔧 测试建议:');
        console.log('  1. 点击预设按钮启动音频处理');
        console.log('  2. 授权麦克风权限');
        console.log('  3. 观察控制台输出');
        console.log('  4. 检查弹幕是否正常显示');
        console.log('  5. 测试键盘快捷键 (D键切换弹幕, S键切换频谱优先)');
        
    } catch (error) {
        console.error('❌ 测试过程中发生错误:', error.message);
    }
}

// 运行测试
testStandaloneClient().catch(console.error);
