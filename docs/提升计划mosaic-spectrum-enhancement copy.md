# Mosaic 频谱增强方案

## 概述
将现有的 Mosaic 元胞自动机改造为频谱可视化，实现从左到右的音高映射和基于音频强度的元胞更新。

## 设计目标
- **空间映射**：X轴映射音高（低频→高频）
- **强度映射**：音频强度控制元胞生成/死亡速度
- **视觉反馈**：保持元胞自动机的美感，增加频谱特性

## 技术方案

### 1. 频段分区策略
```typescript
// 将屏幕分成8个频段
const frequencyBands = 8;
const bandWidth = this.cols / frequencyBands;

// 音频特征映射到频段
const activeBands = this.mapAudioToBands(audio);
```

### 2. 音频特征映射
- **centroid** → X轴位置（音高）
- **level** → 生成速度（强度）
- **flux** → 元胞活跃度（变化率）
- **mfcc** → 元胞形状（音色）

### 3. 元胞行为设计
```typescript
// 频段特定的生成逻辑
const bandActivity = this.getBandActivity(bandIndex, audio);
const spawnChance = bandActivity * this.controls.spawnRate;

// 音高影响生成位置
const pitchX = this.p.map(audio.centroid, 0, 1, 0, this.cols);
```

### 4. 视觉效果设计
- **低频区域**：左侧，大尺寸元胞，圆形为主
- **高频区域**：右侧，小尺寸元胞，三角形为主
- **中频区域**：中间，混合形状，矩形为主
- **强度反馈**：元胞密度和更新速度

## 实现步骤

### Phase 1: 基础频段映射
1. 实现频段分区逻辑
2. 音频特征到频段的映射
3. 频段特定的元胞生成

### Phase 2: 视觉优化
1. 频段特定的元胞大小
2. 音高到形状的映射
3. 强度到密度的映射

### Phase 3: 交互增强
1. 实时频段活跃度显示
2. 音频特征可视化
3. 参数调节界面

## 技术细节

### 频段计算
```typescript
private getBandActivity(bandIndex: number, audio: MosaicAudioUniforms): number {
  // 根据频段索引计算活跃度
  const bandWeight = this.calculateBandWeight(bandIndex, audio);
  return this.p.constrain(bandWeight, 0, 1);
}
```

### 音高映射
```typescript
private mapPitchToPosition(centroid: number): number {
  // 对数映射，更符合人耳感知
  return this.p.map(Math.log(centroid + 1), 0, Math.log(2), 0, this.cols);
}
```

### 强度控制
```typescript
private getIntensityMultiplier(audio: MosaicAudioUniforms): number {
  return this.p.constrain(
    audio.level * 2 + audio.flux * 0.5,
    0.1, 3.0
  );
}
```

## 预期效果
- **频谱可视化**：清晰的音高分布
- **动态响应**：实时音频反馈
- **视觉美感**：保持元胞自动机的艺术性
- **性能优化**：高效的频段计算

## 配置参数
```typescript
interface MosaicSpectrumControls {
  frequencyBands: number;        // 频段数量
  pitchSensitivity: number;          // 音高敏感度
  intensitySensitivity: number;    // 强度敏感度
  shapeMapping: boolean;         // 是否启用形状映射
  sizeMapping: boolean;           // 是否启用大小映射
}
```

## 测试计划
1. **基础功能测试**：频段映射准确性
2. **性能测试**：大量元胞的渲染性能
3. **音频测试**：不同音频特征的响应
4. **视觉测试**：频谱效果的直观性

## 后续优化
- 频段间的平滑过渡
- 音频历史记录和预测
- 更复杂的音色映射
- 用户自定义频段权重
