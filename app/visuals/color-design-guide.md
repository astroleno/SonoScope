# Mosaic 颜色设计指南

## 🎨 颜色方案结构

每个颜色方案包含：
- `name`: 方案名称
- `colors`: 颜色数组 (2-5个颜色)
- `bgColor`: 背景颜色

## 🎯 设计原则

### 1. **颜色数量**
- **最少**: 2个颜色 (如黑白)
- **推荐**: 3-5个颜色
- **最多**: 5个颜色 (避免过于复杂)

### 2. **颜色选择策略**

#### A. **渐变系列** (推荐)
```typescript
{
  name: "ocean",
  colors: ["#001f3f", "#0074D9", "#7FDBFF", "#B3E5FC", "#E6F7FF"],
  bgColor: "#000814"
}
```

#### B. **对比色系**
```typescript
{
  name: "sunset",
  colors: ["#FF6B35", "#F7931E", "#FFD23F", "#06FFA5", "#3A86FF"],
  bgColor: "#1A1A2E"
}
```

#### C. **单色系变化**
```typescript
{
  name: "forest",
  colors: ["#2D5016", "#4A7C59", "#7BA05B", "#9ACD32", "#ADFF2F"],
  bgColor: "#0F1419"
}
```

### 3. **背景颜色选择**
- 通常比主色调更深
- 与主色调形成对比
- 避免过于明亮 (影响视觉效果)

## 🛠️ 颜色工具推荐

### 在线工具：
1. **Coolors.co** - 配色生成器
2. **Adobe Color** - 专业配色工具
3. **Paletton** - 调色板生成器
4. **Material Design Colors** - Google设计规范

### 设计灵感：
1. **自然色彩**: 日出、日落、海洋、森林
2. **艺术风格**: 印象派、抽象派、极简主义
3. **情绪色彩**: 温暖、冷静、活力、神秘

## 📝 添加新颜色方案

在 `mosaic.ts` 中的 `MOSAIC_COLOR_SCHEMES` 数组末尾添加：

```typescript
{
  name: "your-scheme-name",
  colors: ["#color1", "#color2", "#color3", "#color4", "#color5"],
  bgColor: "#background-color"
}
```

## 🎵 音频响应考虑

颜色会响应音频特征：
- **音高**: 影响颜色流动和混合
- **音量**: 影响颜色亮度
- **频谱**: 影响颜色变化速度

选择颜色时考虑这些动态效果。
