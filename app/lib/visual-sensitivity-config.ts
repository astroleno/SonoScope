/**
 * 可视化器灵敏度统一配置
 * 根据报告建议，提供统一的感度调节配置
 */

export interface VisualSensitivityConfig {
  // 全局灵敏度
  globalSensitivity: number;
  
  // 各可视化器特定配置
  wave: {
    amplitudeSensitivity: number;    // 振幅敏感度
    frequencySensitivity: number;    // 频率敏感度
    glowSensitivity: number;         // 光晕敏感度
  };
  
  accretion: {
    brightnessSensitivity: number;   // 亮度敏感度
    pulseSensitivity: number;       // 脉冲敏感度
    overallBoostSensitivity: number; // 整体增强敏感度
  };
  
  spiral: {
    colorSensitivity: number;        // 颜色敏感度
    paletteSensitivity: number;     // 调色板敏感度
    jumpSensitivity: number;       // 色域跳变敏感度
  };
  
  mosaic: {
    spectrumSensitivity: number;    // 频谱敏感度
    spawnSensitivity: number;       // 生成敏感度
    sizeSensitivity: number;         // 大小敏感度
  };
}

// 默认配置
export const DEFAULT_SENSITIVITY_CONFIG: VisualSensitivityConfig = {
  globalSensitivity: 1.0,
  
  wave: {
    amplitudeSensitivity: 1.0,
    frequencySensitivity: 1.0,
    glowSensitivity: 1.0,
  },
  
  accretion: {
    brightnessSensitivity: 1.0,
    pulseSensitivity: 1.0,
    overallBoostSensitivity: 1.0,
  },
  
  spiral: {
    colorSensitivity: 1.0,
    paletteSensitivity: 1.0,
    jumpSensitivity: 1.0,
  },
  
  mosaic: {
    spectrumSensitivity: 1.0,
    spawnSensitivity: 1.0,
    sizeSensitivity: 1.0,
  },
};

// 预设配置
export const SENSITIVITY_PRESETS = {
  // 低敏感度：适合安静环境
  low: {
    ...DEFAULT_SENSITIVITY_CONFIG,
    globalSensitivity: 0.6,
    wave: { amplitudeSensitivity: 0.7, frequencySensitivity: 0.8, glowSensitivity: 0.6 },
    accretion: { brightnessSensitivity: 0.5, pulseSensitivity: 0.6, overallBoostSensitivity: 0.7 },
    spiral: { colorSensitivity: 0.8, paletteSensitivity: 0.7, jumpSensitivity: 0.6 },
    mosaic: { spectrumSensitivity: 0.7, spawnSensitivity: 0.6, sizeSensitivity: 0.8 },
  },
  
  // 中等敏感度：平衡设置
  medium: DEFAULT_SENSITIVITY_CONFIG,
  
  // 高敏感度：适合强烈音乐
  high: {
    ...DEFAULT_SENSITIVITY_CONFIG,
    globalSensitivity: 1.5,
    wave: { amplitudeSensitivity: 1.3, frequencySensitivity: 1.2, glowSensitivity: 1.4 },
    accretion: { brightnessSensitivity: 1.3, pulseSensitivity: 1.4, overallBoostSensitivity: 1.2 },
    spiral: { colorSensitivity: 1.3, paletteSensitivity: 1.2, jumpSensitivity: 1.4 },
    mosaic: { spectrumSensitivity: 1.4, spawnSensitivity: 1.3, sizeSensitivity: 1.2 },
  },
  
  // 极光模式：适合环境音乐
  aurora: {
    ...DEFAULT_SENSITIVITY_CONFIG,
    globalSensitivity: 0.8,
    wave: { amplitudeSensitivity: 0.6, frequencySensitivity: 0.9, glowSensitivity: 1.2 },
    accretion: { brightnessSensitivity: 0.7, pulseSensitivity: 0.8, overallBoostSensitivity: 0.9 },
    spiral: { colorSensitivity: 1.1, paletteSensitivity: 1.0, jumpSensitivity: 0.8 },
    mosaic: { spectrumSensitivity: 0.9, spawnSensitivity: 0.8, sizeSensitivity: 1.0 },
  },
} as const;

/**
 * 应用灵敏度配置到可视化器
 */
export function applySensitivityConfig(
  config: VisualSensitivityConfig,
  visualizer: 'wave' | 'accretion' | 'spiral' | 'mosaic',
  baseSensitivity: number
): number {
  const globalMultiplier = config.globalSensitivity;
  const visualizerConfig = config[visualizer];
  
  // 计算可视化器特定的敏感度
  let visualizerSensitivity = 1.0;
  
  switch (visualizer) {
    case 'wave':
      visualizerSensitivity = (
        visualizerConfig.amplitudeSensitivity +
        visualizerConfig.frequencySensitivity +
        visualizerConfig.glowSensitivity
      ) / 3;
      break;
      
    case 'accretion':
      visualizerSensitivity = (
        visualizerConfig.brightnessSensitivity +
        visualizerConfig.pulseSensitivity +
        visualizerConfig.overallBoostSensitivity
      ) / 3;
      break;
      
    case 'spiral':
      visualizerSensitivity = (
        visualizerConfig.colorSensitivity +
        visualizerConfig.paletteSensitivity +
        visualizerConfig.jumpSensitivity
      ) / 3;
      break;
      
    case 'mosaic':
      visualizerSensitivity = (
        visualizerConfig.spectrumSensitivity +
        visualizerConfig.spawnSensitivity +
        visualizerConfig.sizeSensitivity
      ) / 3;
      break;
  }
  
  return baseSensitivity * globalMultiplier * visualizerSensitivity;
}

/**
 * 根据音频特征自动调整敏感度
 */
export function autoAdjustSensitivity(
  config: VisualSensitivityConfig,
  audioFeatures: {
    level: number;
    flux: number;
    percussiveRatio: number;
    voiceProb: number;
  }
): VisualSensitivityConfig {
  const { level, flux, percussiveRatio, voiceProb } = audioFeatures;
  
  // 根据音频强度调整全局敏感度
  const levelAdjustment = Math.max(0.5, Math.min(2.0, 1.0 + level * 0.5));
  
  // 根据音频变化率调整
  const fluxAdjustment = Math.max(0.7, Math.min(1.5, 1.0 + flux * 0.3));
  
  // 根据打击乐比例调整
  const percussiveAdjustment = Math.max(0.8, Math.min(1.4, 1.0 + percussiveRatio * 0.2));
  
  // 根据人声比例调整
  const voiceAdjustment = Math.max(0.9, Math.min(1.3, 1.0 + voiceProb * 0.1));
  
  const globalMultiplier = levelAdjustment * fluxAdjustment * percussiveAdjustment * voiceAdjustment;
  
  return {
    ...config,
    globalSensitivity: config.globalSensitivity * globalMultiplier,
  };
}

/**
 * 获取预设配置
 */
export function getSensitivityPreset(preset: keyof typeof SENSITIVITY_PRESETS): VisualSensitivityConfig {
  return SENSITIVITY_PRESETS[preset];
}

/**
 * 创建自定义配置
 */
export function createCustomSensitivityConfig(
  overrides: Partial<VisualSensitivityConfig>
): VisualSensitivityConfig {
  return {
    ...DEFAULT_SENSITIVITY_CONFIG,
    ...overrides,
  };
}
