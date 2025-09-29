standalone-client:1  GET http://localhost:3000/fonts/inter.woff2 net::ERR_ABORTED 404 (Not Found)
main-app.js?v=1759155558087:1836 Download the React DevTools for a better development experience: https://reactjs.org/link/react-devtools
useDanmuPipeline.ts:236 🎵 Hook返回值: {isActive: false, currentStyle: null, pendingRequests: 0, danmuCount: 0, dominantInstrument: null, …}
danmu-engine.ts:58 弹幕引擎初始化成功
page.tsx:1900 🛑 音频处理已完全停止
page.tsx:1901 📊 状态重置 - isRunning: false audioLevel: 0 features: null
danmu-engine.ts:58 弹幕引擎初始化成功
worker-manager.ts:108 Audio Worker初始化成功
console-tamer.ts:80 [INFO][danmu.init] 弹幕管线初始化完成
worker-manager.ts:108 Audio Worker初始化成功
model-worker.ts:58 Loading YAMNet model...
model-worker.ts:58 Loading YAMNet model...
model-worker.ts:64 YAMNet model loaded successfully
model-worker.ts:64 YAMNet model loaded successfully
worker-manager.ts:143 Model Worker初始化成功
worker-manager.ts:76 所有Worker初始化完成
feature-aggregator.ts:148 FeatureAggregator: Worker初始化成功
worker-manager.ts:143 Model Worker初始化成功
worker-manager.ts:76 所有Worker初始化完成
feature-aggregator.ts:148 FeatureAggregator: Worker初始化成功
visualizer.tsx:316 Visualizer - 模式: wave 音频级别: 0.000 特征: null
visualizer.tsx:316 Visualizer - 模式: wave 音频级别: 0.000 特征: null
visualizer.tsx:316 Visualizer - 模式: wave 音频级别: 0.000 特征: null
danmu-engine.ts:66 🎵 弹幕引擎: start() 被调用, isInitialized: true isActive: false
danmu-engine.ts:124 🎵 弹幕引擎: 启动动画循环
danmu-engine.ts:80 🎵 弹幕引擎: 启动成功, isActive: true
danmu-pipeline-enhanced.ts:98 增强版弹幕管线启动，isActive: true
page.tsx:1046 🎵 LLM弹幕管线已启动
page.tsx:1100 🎵 弹幕管线初始化完成，自动启动...
danmu-engine.ts:66 🎵 弹幕引擎: start() 被调用, isInitialized: true isActive: true
danmu-engine.ts:74 🎵 弹幕引擎: 已经激活，跳过启动
danmu-pipeline-enhanced.ts:98 增强版弹幕管线启动，isActive: true
page.tsx:1191 请求麦克风权限...
page.tsx:1103 🎵 弹幕管线已经启动，无需重复启动
page.tsx:1214 创建音频上下文...
page.tsx:1247 音频节点连接状态: {sourceConnected: 'running', analyserConnected: 'running', analyserFftSize: 2048, analyserFrequencyBinCount: 1024}
page.tsx:1260 AudioContext 状态: running
page.tsx:1261 AudioContext 采样率: 48000
page.tsx:1269 音轨状态: {enabled: true, muted: false, readyState: 'live', label: '麦克风 (USB MIC    ) (4c4a:4155)'}
page.tsx:1287 开始音频分析...
page.tsx:1291 初始化LLM弹幕管线...
page.tsx:1297 LLM弹幕管线已准备（等待启动）
page.tsx:1318 跳过内联 YAMNet 加载（由 Worker 负责分类，或未启用）。
page.tsx:1337 🎵 检查 Meyda 初始化条件: {spectrumEnabled: true, hasMeyda: true, isBrowser: undefined, meydaVersion: undefined}
page.tsx:1344 🎵 检查 Meyda 初始化条件: {spectrumEnabled: true, hasMeyda: true, isBrowser: undefined, meydaVersion: undefined}
page.tsx:1352 🎵 初始化 Meyda 特征提取...
page.tsx:1353 🎵 Meyda 版本: undefined
page.tsx:1354 🎵 支持的特征: (22) ['amplitudeSpectrum', 'buffer', 'chroma', 'complexSpectrum', 'energy', 'loudness', 'melBands', 'mfcc', 'perceptualSharpness', 'perceptualSpread', 'powerSpectrum', 'rms', 'spectralCentroid', 'spectralCrest', 'spectralFlatness', 'spectralFlux', 'spectralKurtosis', 'spectralRolloff', 'spectralSkewness', 'spectralSlope', 'spectralSpread', 'zcr']
page.tsx:1355 [Deprecation] The ScriptProcessorNode is deprecated. Use AudioWorkletNode instead. (https://bit.ly/audio-worklet)
r @ meyda.min.js:1
createMeydaAnalyzer @ meyda.min.js:1
eval @ page.tsx:1355
await in eval
tryResume @ page.tsx:2045
page.tsx:1754 Meyda 特征提取已启动
page.tsx:1786 音频处理已启动
page.tsx:2046 首次用户手势触发麦克风启动
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0000', hasFeatures: true}
danmu-pipeline-enhanced.ts:124 弹幕管线: RMS过低 0.0000 < 0.01
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0000', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0041', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0508', hasFeatures: true}
feature-aggregator.ts:265 特征聚合器: 计算窗口特征，有效帧数: 1
feature-aggregator.ts:589 特征聚合器: 稳定性检测 - 质心:true, Chroma:true, 节拍:true, 整体:false
danmu-pipeline-enhanced.ts:192 弹幕管线: 稳定性检测结果 - 整体稳定:false, 置信度:0.90
danmu-pipeline-enhanced.ts:214 🎵 弹幕管线: 稳定度不足，跳过触发 {centroid_stable: true, chroma_stable: true, tempo_stable: true, tempo_change: 0, base_stable: true, …}
standalone-client:1 The resource http://localhost:3000/fonts/inter.woff2 was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0388', hasFeatures: true}
page.tsx:1771 启动音频分析循环...
page.tsx:1772 isRunning状态: false
page.tsx:1773 analyserRef.current: true
page.tsx:1780 测试音频数据前10个值: (10) [-0.07735307514667511, -0.08335702121257782, -0.0868864506483078, -0.08821802586317062, -0.08030098676681519, -0.05816364288330078, -0.03914205729961395, -0.032695505768060684, -0.02433495968580246, -0.011379487812519073]
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0362', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0356', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0401', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0346', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0311', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0329', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0318', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0269', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0237', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0188', hasFeatures: true}
useDanmuPipeline.ts:236 🎵 Hook返回值: {isActive: true, currentStyle: null, pendingRequests: 0, danmuCount: 0, dominantInstrument: null, …}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0392', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0424', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0424', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0361', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0424', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0095', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0098', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0082', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0098', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0082', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0098', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.009846825660922761, style: null, danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0082', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0098', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0082', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0068', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0072', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0098', hasFeatures: true}
visualizer.tsx:316 Visualizer - 模式: wave 音频级别: 0.013 特征: {rms: 0.00981042394460309, spectralCentroid: 72.41275218482488, zcr: 50, mfcc: Array(13), spectralFlatness: 0.14370033714952446, …}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0120', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0081', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0062', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0068', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0127', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0238', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0180', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.017954141378106928, style: null, danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0191', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0153', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0083', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0151', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0256', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0198', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0202', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0213', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.021286496617458697, style: null, danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0377', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0356', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0145', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0105', hasFeatures: true}
feature-aggregator.ts:589 特征聚合器: 稳定性检测 - 质心:true, Chroma:true, 节拍:true, 整体:false
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0096', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.00962859093619451, style: null, danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0086', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0097', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0118', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0089', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0049', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0067', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0056', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.005587349992220579, style: null, danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0108', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0154', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0133', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0094', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0149', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0123', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0109', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0110', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0086', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0085', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0061', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0048', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0045', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0051', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0144', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0195', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0197', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0170', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0140', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0103', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0105', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0104', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0105', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.010457153688672508, style: null, danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0149', hasFeatures: true}
feature-aggregator.ts:208 特征聚合器: 添加帧 50, RMS: 0.0149
danmu-pipeline-enhanced.ts:170 🎵 特征聚合进度: 50帧, RMS: 0.0149
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.014891277435507777, style: null, danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0150', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.015031622112092542, style: null, danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0163', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0156', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0144', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0126', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0138', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0091', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0103', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0072', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0051', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0048', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0040', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0030', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0048', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0034', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0026', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0027', hasFeatures: true}
visualizer.tsx:316 Visualizer - 模式: wave 音频级别: 0.005 特征: {rms: 0.0027387463682959543, spectralCentroid: 40.82249309950987, zcr: 30, mfcc: Array(13), spectralFlatness: 0.08782321920668534, …}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0027', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0022', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0027', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.0027439037220519545, style: null, danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0023', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0023', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0032', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.003173025781965102, style: null, danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0037', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0038', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0031', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.003145685339296882, style: null, danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0029', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0025', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0033', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0162', hasFeatures: true}
feature-aggregator.ts:265 特征聚合器: 计算窗口特征，有效帧数: 44
feature-aggregator.ts:589 特征聚合器: 稳定性检测 - 质心:true, Chroma:true, 节拍:true, 整体:true
danmu-pipeline-enhanced.ts:242 🎵 弹幕管线: 动态进入稳定前收集阶段 {phase: 'idle', activity: '0.048'}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0146', hasFeatures: true}
danmu-pipeline-enhanced.ts:507 弹幕管线: 活动度达到触发阈值，进入 ready 状态
danmu-pipeline-enhanced.ts:296 🎵 弹幕管线: 触发弹幕生成 {rms: '0.0146', drive: '0.034', interval: 5451.049478816644, concurrency: 1}
danmu-pipeline-enhanced.ts:323 增强弹幕管线: 调用API生成弹幕，当前并发: 1
danmu-pipeline-enhanced.ts:342 风格检测: pop_vocal (置信度: 0.6107142857142857)
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.01459439430066342, style: null, danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0063', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0048', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0044', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.004350945835312879, style: null, danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0045', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0049', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.004884348316615524, style: null, danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0045', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0044', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0033', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0047', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0038', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0037', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0038', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0037', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0038', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0037', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0038', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0037', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0038', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0029', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0034', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0031', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0023', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0022', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0029', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0025', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.0025408068877837654, style: 'pop_vocal', danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0022', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0024', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0019', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0024', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0028', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0044', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0056', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0040', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0038', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0032', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0031', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0027', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0030', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0024', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0020', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0018', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0024', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0022', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0020', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0022', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0023', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0038', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0070', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0032', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0031', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0026', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.0025609785039249476, style: 'pop_vocal', danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0026', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0028', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0030', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.0030225503469070145, style: 'pop_vocal', danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0029', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0030', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0023', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0018', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0023', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0023', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0023', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0025', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0084', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0341', hasFeatures: true}
feature-aggregator.ts:589 特征聚合器: 稳定性检测 - 质心:true, Chroma:true, 节拍:true, 整体:true
danmu-pipeline-enhanced.ts:192 弹幕管线: 稳定性检测结果 - 整体稳定:true, 置信度:0.90
danmu-pipeline-enhanced.ts:270 🎵 弹幕管线: 间隔未到 1370ms < 3836.293423719588ms
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0161', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0118', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.011828246320988563, style: 'pop_vocal', danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0088', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.008827180726792004, style: 'pop_vocal', danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0058', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.005798123432872422, style: 'pop_vocal', danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0064', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0115', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0120', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0095', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0047', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.004652255404232271, style: 'pop_vocal', danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0049', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0061', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0065', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.006500180713720185, style: 'pop_vocal', danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0056', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0029', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0030', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0037', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0039', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0046', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0037', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0028', hasFeatures: true}
visualizer.tsx:316 Visualizer - 模式: wave 音频级别: 0.005 特征: {rms: 0.0028255654682411984, spectralCentroid: 79.1551757256245, zcr: 82, mfcc: Array(13), spectralFlatness: 0.1670509258340467, …}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0019', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0026', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0026', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0042', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0050', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0060', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0059', hasFeatures: true}
inspector.js:7  POST http://localhost:3000/api/llm-danmu 502 (Bad Gateway)
window.fetch @ inspector.js:7
generateBatchDanmu @ danmu-pipeline-enhanced.ts:373
triggerDanmuGeneration @ danmu-pipeline-enhanced.ts:347
handleAudioFeatures @ danmu-pipeline-enhanced.ts:303
handleAudioFeatures @ useDanmuPipeline.ts:153
callback @ page.tsx:1688
eval @ meyda.min.js:1
_m.spn.onaudioprocess @ meyda.min.js:1
danmu-pipeline-enhanced.ts:427 批量弹幕生成请求失败: Error: HTTP 502: {"success":false,"error":"LLM error: 429 {\"error\":{\"code\":\"1113\",\"message\":\"Insufficient balance or no resource package. Please recharge.\"}}"}
    at DanmuPipelineEnhanced.generateBatchDanmu (danmu-pipeline-enhanced.ts:394:15)
    at async DanmuPipelineEnhanced.triggerDanmuGeneration (danmu-pipeline-enhanced.ts:347:7)
window.console.error @ app-index.js:33
console.error @ hydration-error-info.js:63
generateBatchDanmu @ danmu-pipeline-enhanced.ts:427
await in generateBatchDanmu
triggerDanmuGeneration @ danmu-pipeline-enhanced.ts:347
handleAudioFeatures @ danmu-pipeline-enhanced.ts:303
handleAudioFeatures @ useDanmuPipeline.ts:153
callback @ page.tsx:1688
eval @ meyda.min.js:1
_m.spn.onaudioprocess @ meyda.min.js:1
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0048', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.004833491605522497, style: 'pop_vocal', danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0047', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0046', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0039', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0042', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0054', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0049', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0055', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0035', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0035', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0036', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.0035810477167823587, style: 'pop_vocal', danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0051', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.0051007154646999005, style: 'pop_vocal', danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0065', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0043', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0048', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0062', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0040', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0031', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.0031013452315580507, style: 'pop_vocal', danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0028', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0028', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0038', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0027', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0024', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.0023661126642604384, style: 'pop_vocal', danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0023', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0020', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0018', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0017', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0020', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0021', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0073', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0074', hasFeatures: true}
danmu-pipeline-enhanced.ts:124 弹幕管线: RMS过低 0.0074 < 0.01
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0065', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0082', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0078', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0067', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0060', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0181', hasFeatures: true}
feature-aggregator.ts:265 特征聚合器: 计算窗口特征，有效帧数: 6
feature-aggregator.ts:589 特征聚合器: 稳定性检测 - 质心:true, Chroma:true, 节拍:true, 整体:true
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0338', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0379', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0422', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.04217729814400631, style: 'pop_vocal', danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0371', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0285', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0224', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0124', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0103', hasFeatures: true}
useDanmuPipeline.ts:236 🎵 Hook返回值: {isActive: true, currentStyle: 'pop_vocal', pendingRequests: 1, danmuCount: 0, dominantInstrument: null, …}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0281', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0248', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.024835279010537833, style: 'pop_vocal', danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0237', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0374', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0096', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0078', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0095', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0101', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0082', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0435', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0295', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0274', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0332', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0349', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0319', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0339', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0348', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0346', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0332', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0328', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0327', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.03274547978768394, style: 'pop_vocal', danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0325', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0343', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0360', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0283', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0302', hasFeatures: true}
danmu-pipeline-enhanced.ts:296 🎵 弹幕管线: 触发弹幕生成 {rms: '0.0302', drive: '0.061', interval: 3041.8380261988, concurrency: 1}
danmu-pipeline-enhanced.ts:323 增强弹幕管线: 调用API生成弹幕，当前并发: 1
danmu-pipeline-enhanced.ts:342 风格检测: pop_vocal (置信度: 0.6107142857142857)
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0272', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0304', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0263', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0235', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0263', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0389', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0329', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0120', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0067', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0069', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0068', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0064', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.006417321096462732, style: 'pop_vocal', danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0068', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0237', hasFeatures: true}
feature-aggregator.ts:589 特征聚合器: 稳定性检测 - 质心:true, Chroma:true, 节拍:true, 整体:true
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0651', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.06508581515094673, style: 'pop_vocal', danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0372', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0234', hasFeatures: true}
feature-aggregator.ts:208 特征聚合器: 添加帧 50, RMS: 0.0234
danmu-pipeline-enhanced.ts:170 🎵 特征聚合进度: 50帧, RMS: 0.0234
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0239', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0263', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.026296841697606165, style: 'pop_vocal', danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0170', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.0169583906375959, style: 'pop_vocal', danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0212', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0206', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0222', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0159', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0234', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.02343583878453455, style: 'pop_vocal', danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0204', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.020402009236195662, style: 'pop_vocal', danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0378', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0401', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0410', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.04095072334413844, style: 'pop_vocal', danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0372', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0578', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0580', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0473', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0384', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0343', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0312', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0208', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0172', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0225', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0316', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0290', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0277', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0209', hasFeatures: true}
danmu-pipeline-enhanced.ts:270 🎵 弹幕管线: 间隔未到 918ms < 4167.207754125286ms
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0159', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0140', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0131', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0172', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0167', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0162', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0176', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.017575036471276836, style: 'pop_vocal', danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0136', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0130', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0138', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0124', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0107', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0077', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0066', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0074', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0070', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0047', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0039', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0030', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0060', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0124', hasFeatures: true}
feature-aggregator.ts:265 特征聚合器: 计算窗口特征，有效帧数: 77
feature-aggregator.ts:589 特征聚合器: 稳定性检测 - 质心:true, Chroma:true, 节拍:true, 整体:true
danmu-pipeline-enhanced.ts:192 弹幕管线: 稳定性检测结果 - 整体稳定:true, 置信度:0.90
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0124', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0160', hasFeatures: true}
inspector.js:7  POST http://localhost:3000/api/llm-danmu 502 (Bad Gateway)
window.fetch @ inspector.js:7
generateBatchDanmu @ danmu-pipeline-enhanced.ts:373
triggerDanmuGeneration @ danmu-pipeline-enhanced.ts:347
handleAudioFeatures @ danmu-pipeline-enhanced.ts:303
handleAudioFeatures @ useDanmuPipeline.ts:153
callback @ page.tsx:1688
eval @ meyda.min.js:1
_m.spn.onaudioprocess @ meyda.min.js:1
danmu-pipeline-enhanced.ts:427 批量弹幕生成请求失败: Error: HTTP 502: {"success":false,"error":"LLM error: 429 {\"error\":{\"code\":\"1113\",\"message\":\"Insufficient balance or no resource package. Please recharge.\"}}"}
    at DanmuPipelineEnhanced.generateBatchDanmu (danmu-pipeline-enhanced.ts:394:15)
    at async DanmuPipelineEnhanced.triggerDanmuGeneration (danmu-pipeline-enhanced.ts:347:7)
window.console.error @ app-index.js:33
console.error @ hydration-error-info.js:63
generateBatchDanmu @ danmu-pipeline-enhanced.ts:427
await in generateBatchDanmu
triggerDanmuGeneration @ danmu-pipeline-enhanced.ts:347
handleAudioFeatures @ danmu-pipeline-enhanced.ts:303
handleAudioFeatures @ useDanmuPipeline.ts:153
callback @ page.tsx:1688
eval @ meyda.min.js:1
_m.spn.onaudioprocess @ meyda.min.js:1
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0198', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0213', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0241', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0239', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0227', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0260', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0313', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0328', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0345', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0317', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0293', hasFeatures: true}
feature-aggregator.ts:208 特征聚合器: 添加帧 100, RMS: 0.0293
danmu-pipeline-enhanced.ts:170 🎵 特征聚合进度: 100帧, RMS: 0.0293
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.029271917028043166, style: 'pop_vocal', danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0285', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0255', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0221', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0161', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0165', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0196', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.019589014249636764, style: 'pop_vocal', danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0230', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0246', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0240', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0250', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0249', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0219', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0204', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.02039715965905936, style: 'pop_vocal', danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0156', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0149', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.014910624099580619, style: 'pop_vocal', danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0168', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.016842906510974733, style: 'pop_vocal', danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0196', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0201', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0311', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0288', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0235', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.02345369238230079, style: 'pop_vocal', danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0199', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0209', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0198', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0203', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0211', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0208', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0178', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0154', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0127', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0154', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0147', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0130', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0132', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0196', hasFeatures: true}
feature-aggregator.ts:589 特征聚合器: 稳定性检测 - 质心:true, Chroma:true, 节拍:true, 整体:true
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.019641133092547534, style: 'pop_vocal', danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0176', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0209', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0253', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0276', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0303', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0285', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0273', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.027251741476971177, style: 'pop_vocal', danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0260', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0248', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.024848977417333766, style: 'pop_vocal', danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0239', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0204', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0204', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0224', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0222', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0133', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0109', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0117', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0097', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0110', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0082', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0098', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0139', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0095', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0107', hasFeatures: true}
feature-aggregator.ts:208 特征聚合器: 添加帧 150, RMS: 0.0107
danmu-pipeline-enhanced.ts:170 🎵 特征聚合进度: 150帧, RMS: 0.0107
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0141', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0160', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0141', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.014099489174896094, style: 'pop_vocal', danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0160', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0182', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0160', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0171', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0160', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0171', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0116', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0111', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.011149004523040655, style: 'pop_vocal', danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0119', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0113', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0117', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0140', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0127', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0141', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0135', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0148', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0136', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0129', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0146', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0114', hasFeatures: true}
feature-aggregator.ts:265 特征聚合器: 计算窗口特征，有效帧数: 90
feature-aggregator.ts:589 特征聚合器: 稳定性检测 - 质心:true, Chroma:true, 节拍:true, 整体:true
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0177', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0333', hasFeatures: true}
danmu-pipeline-enhanced.ts:296 🎵 弹幕管线: 触发弹幕生成 {rms: '0.0333', drive: '0.066', interval: 3406.388615103574, concurrency: 1}
danmu-pipeline-enhanced.ts:323 增强弹幕管线: 调用API生成弹幕，当前并发: 1
danmu-pipeline-enhanced.ts:342 风格检测: pop_vocal (置信度: 0.6107142857142857)
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0172', hasFeatures: true}
visualizer.tsx:316 Visualizer - 模式: wave 音频级别: 0.048 特征: {rms: 0.017170502493854108, spectralCentroid: 89.91958996707855, zcr: 104, mfcc: Array(13), spectralFlatness: 0.15780989261895376, …}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0092', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.009241887275089948, style: 'pop_vocal', danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0079', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0096', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0094', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.009447255754462086, style: 'pop_vocal', danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0099', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.009897522658063408, style: 'pop_vocal', danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0083', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0087', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0065', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0063', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0064', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.006434775555666856, style: 'pop_vocal', danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0080', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0068', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0079', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0113', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0096', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0079', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0067', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0067', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0071', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0101', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0082', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0072', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0067', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0053', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0052', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0075', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0067', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0075', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0098', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0081', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0160', hasFeatures: true}
danmu-pipeline-enhanced.ts:270 🎵 弹幕管线: 间隔未到 679ms < 3401.3303646609083ms
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0102', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.010220650909185018, style: 'pop_vocal', danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0102', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0126', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0137', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0136', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0140', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0131', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0136', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0099', hasFeatures: true}
danmu-pipeline-enhanced.ts:124 弹幕管线: RMS过低 0.0099 < 0.01
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0119', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0121', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0107', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0123', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0107', hasFeatures: true}
feature-aggregator.ts:589 特征聚合器: 稳定性检测 - 质心:true, Chroma:true, 节拍:true, 整体:true
danmu-pipeline-enhanced.ts:192 弹幕管线: 稳定性检测结果 - 整体稳定:true, 置信度:0.90
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0098', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.009833718454776395, style: 'pop_vocal', danmuCount: 0, dominantInstrument: null}
useDanmuPipeline.ts:236 🎵 Hook返回值: {isActive: true, currentStyle: 'pop_vocal', pendingRequests: 1, danmuCount: 0, dominantInstrument: null, …}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0118', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0072', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.007154366906163175, style: 'pop_vocal', danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0066', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.00655097760560232, style: 'pop_vocal', danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0074', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0071', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0081', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0091', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0094', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0112', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0114', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0117', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.011701464686073264, style: 'pop_vocal', danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0108', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0103', hasFeatures: true}
page.tsx:1692 🎵 LLM弹幕管线处理特征: {rms: 0.010311848676842124, style: 'pop_vocal', danmuCount: 0, dominantInstrument: null}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0094', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0082', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0092', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0173', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0173', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0123', hasFeatures: true}
inspector.js:7  POST http://localhost:3000/api/llm-danmu 502 (Bad Gateway)
window.fetch @ inspector.js:7
generateBatchDanmu @ danmu-pipeline-enhanced.ts:373
triggerDanmuGeneration @ danmu-pipeline-enhanced.ts:347
handleAudioFeatures @ danmu-pipeline-enhanced.ts:303
handleAudioFeatures @ useDanmuPipeline.ts:153
callback @ page.tsx:1688
eval @ meyda.min.js:1
_m.spn.onaudioprocess @ meyda.min.js:1
danmu-pipeline-enhanced.ts:427 批量弹幕生成请求失败: Error: HTTP 502: {"success":false,"error":"LLM error: 429 {\"error\":{\"code\":\"1113\",\"message\":\"Insufficient balance or no resource package. Please recharge.\"}}"}
    at DanmuPipelineEnhanced.generateBatchDanmu (danmu-pipeline-enhanced.ts:394:15)
    at async DanmuPipelineEnhanced.triggerDanmuGeneration (danmu-pipeline-enhanced.ts:347:7)
window.console.error @ app-index.js:33
console.error @ hydration-error-info.js:63
generateBatchDanmu @ danmu-pipeline-enhanced.ts:427
await in generateBatchDanmu
triggerDanmuGeneration @ danmu-pipeline-enhanced.ts:347
handleAudioFeatures @ danmu-pipeline-enhanced.ts:303
handleAudioFeatures @ useDanmuPipeline.ts:153
callback @ page.tsx:1688
eval @ meyda.min.js:1
_m.spn.onaudioprocess @ meyda.min.js:1
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0079', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0061', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0073', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0081', hasFeatures: true}
danmu-pipeline-enhanced.ts:110 🎵 弹幕管线: 接收音频特征 {rms: '0.0085', hasFeatures: true}
 🎵 弹幕管线: 接收音频特征 {rms: '0.0076', hasFeatures: true}
 🎵 弹幕管线: 接收音频特征 {rms: '0.0055', hasFeatures: true}
