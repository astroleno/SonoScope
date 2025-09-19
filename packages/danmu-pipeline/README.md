# 弹幕管线 (Danmu Pipeline)

基于音频特征的智能弹幕生成系统，支持自动触发、流式生成、自适应调度。

## 📁 文件结构

```
packages/danmu-pipeline/
├── README.md                 # 本文档
├── danmu-engine.ts          # 弹幕渲染引擎
├── danmu-pipeline.ts        # 弹幕管线核心逻辑
├── danmu-scheduler.ts       # 智能调度器
├── stream-client.ts         # NDJSON 流式客户端
├── event-bus.ts            # 事件总线
├── useDanmuPipeline.ts     # React Hook
└── api-route.ts            # Edge API 路由示例
```

## 🚀 核心功能

### 1. 弹幕引擎 (`danmu-engine.ts`)
- **水平轨道系统**: 8条固定轨道，弹幕不上下飘移
- **速度变化**: 基于音频强度调制，每条弹幕速度不同
- **完整穿屏**: 弹幕完全走出屏幕后才消失
- **外部注入**: 支持 `ingestText(text)` 方法

### 2. 智能调度器 (`danmu-scheduler.ts`)
- **驱动计算**: `drive = 0.5*loud + 0.3*tempo + 0.2*beat`
- **自适应间隔**: 3-10秒基础抖动，根据驱动值调整
- **并发控制**: 1-3条同时生成，高驱动时并发增加
- **迟滞机制**: 避免频繁切换，升档400ms，降档800ms

### 3. 弹幕管线 (`danmu-pipeline.ts`)
- **自动触发**: 基于RMS阈值自动生成弹幕
- **流式处理**: 调用Edge API获取多条评论
- **状态管理**: 跟踪风格、并发数、生成状态
- **错误处理**: 网络失败时优雅降级

### 4. 流式客户端 (`stream-client.ts`)
- **NDJSON解析**: 实时解析服务端流式响应
- **事件回调**: `onStyle`、`onComment`、`onDone`、`onError`
- **错误恢复**: 网络中断时自动重试

### 5. React Hook (`useDanmuPipeline.ts`)
- **生命周期管理**: 自动初始化和清理
- **状态暴露**: 活跃状态、当前风格、弹幕数量
- **控制接口**: `start()`、`stop()`、`trigger()`、`handleAudioFeatures()`

## 🔧 使用方法

### 基础集成

```tsx
import { useDanmuPipeline } from './useDanmuPipeline';

function App() {
  const danmuPipeline = useDanmuPipeline({
    enabled: true,
    autoStart: false,
    needComments: 4,
    locale: 'zh-CN',
    rmsThreshold: 0.05,
    maxConcurrency: 2,
  });

  // 启动
  const handleStart = () => {
    danmuPipeline.start();
  };

  // 处理音频特征
  const handleAudioFeatures = (rms: number, features?: Record<string, unknown>) => {
    danmuPipeline.handleAudioFeatures(rms, features);
  };

  return (
    <div>
      <button onClick={handleStart}>开始弹幕</button>
      <div>状态: {danmuPipeline.isActive ? '活跃' : '停止'}</div>
      <div>风格: {danmuPipeline.currentStyle}</div>
      <div>弹幕数: {danmuPipeline.danmuCount}</div>
    </div>
  );
}
```

### 服务端API

将 `api-route.ts` 部署到 Next.js App Router:

```typescript
// app/api/analyze/route.ts
export const runtime = 'edge';

export async function POST(req: Request) {
  // 返回NDJSON流式响应
  // {"type":"style","style":"Electronic","confidence":0.82}
  // {"type":"comment","idx":0,"text":"鼓点稳，低频推进得很舒服。"}
  // {"type":"done"}
}
```

## ⚙️ 配置选项

### PipelineConfig
```typescript
interface PipelineConfig {
  apiPath?: string;           // API路径，默认 '/api/analyze'
  needComments?: number;      // 每次生成评论数，默认 4
  locale?: string;           // 语言，默认 'zh-CN'
  minIntervalMs?: number;    // 最小间隔，默认 2000ms
  maxConcurrency?: number;   // 最大并发，默认 2
  rmsThreshold?: number;     // RMS阈值，默认 0.05
}
```

### SchedulerConfig
```typescript
interface SchedulerConfig {
  minIntervalSec?: number;   // 绝对最小间隔，默认 0.8s
  baseMinSec?: number;       // 抖动最小值，默认 3.0s
  baseMaxSec?: number;       // 抖动最大值，默认 10.0s
  maxConcurrency?: number;   // 最大并发，默认 3
  upThreshold?: number;      // 升档阈值，默认 0.6
  downThreshold?: number;    // 降档阈值，默认 0.45
}
```

## 🎯 工作流程

1. **音频采集**: 通过Web Audio API获取音频流
2. **特征提取**: 使用Meyda提取RMS、频谱等特征
3. **驱动计算**: 基于RMS计算驱动值
4. **调度决策**: 根据驱动值和历史状态决定是否触发
5. **API调用**: 向Edge API发送特征数据
6. **流式解析**: 实时解析NDJSON响应
7. **弹幕渲染**: 将评论注入弹幕引擎显示

## 🔄 状态机

```
collecting → style_locked → streaming_comments → done
     ↓              ↓              ↓
   弱网超时      首包到达      评论流完成
     ↓              ↓              ↓
  占位态+模板    显示风格      等待下次触发
```

## 📊 性能优化

- **轨道管理**: 固定8条轨道，避免频繁DOM操作
- **批量更新**: 使用requestAnimationFrame合并渲染
- **并发控制**: 限制同时请求数量，避免过载
- **错误恢复**: 网络失败时使用本地模板兜底

## 🛠️ 扩展开发

### 添加新特征
1. 在Meyda配置中添加特征提取器
2. 更新FeatureTick接口
3. 在调度器中添加特征权重

### 自定义弹幕样式
1. 修改`danmu-engine.ts`中的样式设置
2. 添加基于特征的动态样式
3. 支持用户自定义主题

### 多语言支持
1. 在API路由中添加语言检测
2. 扩展模板库支持多语言
3. 添加语言切换接口

## 🐛 故障排除

### 弹幕不显示
- 检查`#danmu-container`元素是否存在
- 确认弹幕引擎已初始化并启动
- 查看控制台是否有错误信息

### 自动触发不工作
- 检查RMS阈值设置是否过高
- 确认音频特征数据正常传递
- 查看调度器状态和驱动值

### 网络请求失败
- 检查API路由是否正确部署
- 确认CORS设置允许跨域请求
- 查看网络面板的请求详情

## 📝 更新日志

### v1.0.0
- ✅ 基础弹幕引擎实现
- ✅ 智能调度器集成
- ✅ 流式API客户端
- ✅ React Hook封装
- ✅ 移动端适配
- ✅ 自动触发机制

## 🤝 贡献指南

1. Fork项目
2. 创建功能分支
3. 提交更改
4. 发起Pull Request

## 📄 许可证

MIT License
