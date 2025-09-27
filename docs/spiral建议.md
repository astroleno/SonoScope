## 🎨 **Spiral 控制方案讨论**

### 1️⃣ **分离亮度和缩放控制**

要让 Spiral 的放大缩小不受音频控制，只有亮度受控制，需要：

**当前问题：**
- `swirls()` 函数中的 `bend` 和 `fold` 参数受音频影响，导致旋涡形状变化
- `anim()` 函数中的音频参数影响整体变换

**解决方案：**
```glsl
// 在 swirls() 函数中固定形状参数
float bend = 0.7; // 固定值，不受音频影响
float fold = 0.02; // 固定值，不受音频影响

// 在 anim() 函数中移除音频变换
void anim(inout vec3 p) {
  // 移除所有音频相关的变换
  // 只保留基础的时间变换
}
```

### 2️⃣ **色相控制方案**

要改变 Spiral 的色相，有几种方案：

**方案 A：基础色相偏移**
```glsl
// 在 march() 函数中
float baseHueShift = iTime * 0.1; // 基础时间色相变化
float audioHueShift = uCentroid * 2.0 + uPulse * 1.0; // 音频色相响应
float totalHueShift = baseHueShift + audioHueShift;
```

**方案 B：色相范围控制**
```glsl
// 控制色相变化范围
float hueRange = 0.5 + uLevel * 0.5; // 音频控制色相范围
float hueShift = sin(iTime * 0.2) * hueRange + uCentroid * 1.0;
```

**方案 C：色相跳跃**
```glsl
// 根据音频强度跳跃色相
float hueJump = floor(uFlux * 6.0) * 0.5; // 6个色相区间
float hueShift = iTime * 0.1 + hueJump;
```

### 3️⃣ **亮度控制方案**

**当前亮度控制：**
```glsl
float gain = .008*(1. + uFlux*.5 + uFlatness*.3 + uLevel*.4);
```

**增强亮度控制：**
```glsl
// 更明显的亮度变化
float baseGain = 0.005;
float audioBrightness = uLevel * 0.8 + uFlux * 0.6 + uPulse * 0.4;
float gain = baseGain * (1.0 + audioBrightness * 2.0);
```

### 4️⃣ **实现建议**

**步骤 1：固定形状**
- 移除 `swirls()` 中的音频响应
- 移除 `anim()` 中的音频变换

**步骤 2：增强色相控制**
- 添加时间基础的色相变化
- 添加音频响应的色相偏移
- 可以添加色相跳跃效果

**步骤 3：优化亮度控制**
- 增加亮度变化范围
- 添加更明显的音频响应

**步骤 4：添加色相预设**
- 可以添加不同的色相主题
- 根据音频特征切换色相模式

### 5️⃣ **色相变化效果**

**平滑色相变化：**
```glsl
float hueShift = iTime * 0.3 + uCentroid * 1.5 + uPulse * 0.8;
```

**跳跃色相变化：**
```glsl
float hueJump = floor(uFlux * 4.0) * 0.25; // 4个色相区间
float hueShift = iTime * 0.2 + hueJump;
```

**色相范围控制：**
```glsl
float hueRange = 0.3 + uLevel * 0.7; // 音频控制色相范围
float hueShift = sin(iTime * 0.15) * hueRange;
```

这样 Spiral 就会保持固定的旋涡形状，只有亮度和色相受到音频控制，创造出更稳定的视觉效果！🎵✨