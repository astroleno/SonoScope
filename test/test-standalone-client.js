/**
 * SonoScope 独立客户端测试脚本
 * 用于测试YAMNet和弹幕功能
 */

const puppeteer = require('puppeteer');
const path = require('path');

async function testStandaloneClient() {
    console.log('🚀 开始测试SonoScope独立客户端...');
    
    const browser = await puppeteer.launch({
        headless: false, // 显示浏览器窗口以便观察
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: { width: 1280, height: 720 }
    });
    
    const page = await browser.newPage();
    
    // 设置控制台日志监听
    page.on('console', msg => {
        const type = msg.type();
        const text = msg.text();
        const timestamp = new Date().toLocaleTimeString();
        
        if (type === 'error') {
            console.error(`[${timestamp}] ❌ ${text}`);
        } else if (type === 'warn') {
            console.warn(`[${timestamp}] ⚠️ ${text}`);
        } else {
            console.log(`[${timestamp}] 📝 ${text}`);
        }
    });
    
    // 监听页面错误
    page.on('pageerror', error => {
        console.error('❌ 页面错误:', error.message);
    });
    
    try {
        // 访问独立客户端页面
        console.log('📱 访问独立客户端页面...');
        await page.goto('http://localhost:3005/app/standalone-client', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });
        
        console.log('✅ 页面加载完成');
        
        // 等待页面完全加载
        await page.waitForTimeout(2000);
        
        // 检查关键元素是否存在
        console.log('🔍 检查页面元素...');
        
        // 检查可视化组件
        const visualizer = await page.$('[data-testid="visualizer"]');
        if (visualizer) {
            console.log('✅ 可视化组件存在');
        } else {
            console.log('⚠️ 可视化组件未找到');
        }
        
        // 检查弹幕容器
        const danmuContainer = await page.$('#danmu-container');
        if (danmuContainer) {
            console.log('✅ 弹幕容器存在');
        } else {
            console.log('❌ 弹幕容器未找到');
        }
        
        // 检查预设选择器
        const presetButtons = await page.$$('button[aria-pressed]');
        console.log(`✅ 找到 ${presetButtons.length} 个预设按钮`);
        
        // 测试模型文件访问
        console.log('🧠 测试YAMNet模型文件访问...');
        const modelResponse = await page.evaluate(async () => {
            try {
                const response = await fetch('/model/yamnet_tflite/yamnet.tflite');
                return {
                    success: response.ok,
                    status: response.status,
                    size: response.headers.get('content-length')
                };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });
        
        if (modelResponse.success) {
            console.log(`✅ YAMNet模型文件可访问，大小: ${modelResponse.size} bytes`);
        } else {
            console.log(`❌ YAMNet模型文件访问失败: ${modelResponse.error || modelResponse.status}`);
        }
        
        // 测试音频权限请求
        console.log('🎤 测试音频权限请求...');
        
        // 点击第一个预设按钮来触发音频处理
        if (presetButtons.length > 0) {
            console.log('🖱️ 点击第一个预设按钮...');
            await presetButtons[0].click();
            await page.waitForTimeout(1000);
        }
        
        // 检查是否有权限请求对话框
        const permissionDialog = await page.evaluate(() => {
            return new Promise((resolve) => {
                const checkPermission = () => {
                    if (navigator.permissions) {
                        navigator.permissions.query({ name: 'microphone' }).then(result => {
                            resolve({ state: result.state, supported: true });
                        }).catch(() => {
                            resolve({ supported: false });
                        });
                    } else {
                        resolve({ supported: false });
                    }
                };
                setTimeout(checkPermission, 1000);
            });
        });
        
        if (permissionDialog.supported) {
            console.log(`📊 麦克风权限状态: ${permissionDialog.state}`);
        } else {
            console.log('⚠️ 浏览器不支持权限查询API');
        }
        
        // 等待一段时间观察控制台输出
        console.log('⏳ 等待5秒观察控制台输出...');
        await page.waitForTimeout(5000);
        
        // 检查是否有弹幕生成
        console.log('💬 检查弹幕功能...');
        const danmuElements = await page.$$('#danmu-container > div');
        console.log(`📊 当前弹幕数量: ${danmuElements.length}`);
        
        // 测试弹幕开关
        console.log('🔄 测试弹幕开关...');
        const danmuButton = await page.$('button[aria-pressed="true"], button[aria-pressed="false"]');
        if (danmuButton) {
            const isPressed = await danmuButton.getAttribute('aria-pressed');
            console.log(`📊 弹幕按钮状态: ${isPressed}`);
            
            // 点击弹幕按钮
            await danmuButton.click();
            await page.waitForTimeout(1000);
            
            const newState = await danmuButton.getAttribute('aria-pressed');
            console.log(`📊 弹幕按钮新状态: ${newState}`);
        }
        
        // 测试键盘快捷键
        console.log('⌨️ 测试键盘快捷键...');
        await page.keyboard.press('KeyD'); // 切换弹幕
        await page.waitForTimeout(500);
        await page.keyboard.press('KeyS'); // 切换频谱优先
        await page.waitForTimeout(500);
        
        // 测试预设切换
        console.log('🎨 测试预设切换...');
        const presetOptions = ['wave', 'accretion', 'spiral', 'mosaic'];
        for (const preset of presetOptions) {
            const button = await page.$(`button[aria-label*="${preset}"], button:contains("${preset}")`);
            if (button) {
                console.log(`🖱️ 点击预设: ${preset}`);
                await button.click();
                await page.waitForTimeout(1000);
            }
        }
        
        // 最终状态检查
        console.log('📊 最终状态检查...');
        const finalDanmuCount = await page.$$('#danmu-container > div');
        console.log(`📊 最终弹幕数量: ${finalDanmuCount.length}`);
        
        // 检查控制台错误
        const consoleErrors = await page.evaluate(() => {
            return window.consoleErrors || [];
        });
        
        if (consoleErrors.length > 0) {
            console.log('❌ 发现控制台错误:');
            consoleErrors.forEach(error => console.log(`  - ${error}`));
        } else {
            console.log('✅ 未发现控制台错误');
        }
        
        console.log('🎉 测试完成！');
        
    } catch (error) {
        console.error('❌ 测试过程中发生错误:', error);
    } finally {
        // 保持浏览器打开一段时间以便观察
        console.log('⏳ 保持浏览器打开10秒以便观察...');
        await page.waitForTimeout(10000);
        await browser.close();
    }
}

// 运行测试
if (require.main === module) {
    testStandaloneClient().catch(console.error);
}

module.exports = { testStandaloneClient };
