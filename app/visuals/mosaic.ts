// Mosaic (2693579) - Direct port from p5.js 2D cellular automata
// Based on ref_p5/Mosaic_2693579, keeping the original 2D rendering approach

export type MosaicCell = {
  alive: boolean;
  age: number;
  shape: 'circle' | 'triangle' | 'rect';
  // 残影系统
  ghostAge?: number; // 残影年龄
  ghostSize?: number; // 残影大小
  ghostColor?: any; // 残影颜色
};

export type MosaicGrid = MosaicCell[][];

export type MosaicColorScheme = {
  name: string;
  colors: string[];
  bgColor: string;
};

export const MOSAIC_COLOR_SCHEMES: MosaicColorScheme[] = [
  {
    name: "black white",
    colors: ["#000000", "#ffffff"],
    bgColor: "#202020"
  },
  {
    name: "pink gerber",
    colors: ["#F21313", "#F24B4B", "#F29191", "#F2BBBB", "#F2F2F2"],
    bgColor: "#021526"
  },
  {
    name: "blue flower",
    colors: ["#5267D9", "#809DF2", "#A7C0F2", "#A0A603", "#F2F2F2"],
    bgColor: "#0C0C0C"
  },
  {
    name: "sunset",
    colors: ["#6B240C", "#994D1C", "#E48F45", "#F5CCA0", "#6B240C"],
    bgColor: "#070F2B"
  },
  {
    name: "purple flower",
    colors: ["#E2BDF2", "#8A39BF", "#B47ED9", "#6D1BBF", "#F2F2F2"],
    bgColor: "#202020"
  },
  {
    name: "monet",
    colors: ["#B5C99A", "#862B0D", "#FFF9C9", "#FFC95F", "#B5C99A"],
    bgColor: "#021526"
  },
  {
    name: "kandinsky",
    colors: ["#8D95A6", "#0A7360", "#F28705", "#D98825", "#F2F2F2"],
    bgColor: "#0C0C0C"
  },
  {
    name: "summer",
    colors: ["#80BFAD", "#B6D96C", "#E3F2C2", "#F2DB66", "#F2AF88"],
    bgColor: "#070F2B"
  },
  {
    name: "sakura",
    colors: ["#FF9494", "#FFD1D1", "#FFE3E1", "#FFF5E4", "#001B79"],
    bgColor: "#202020"
  },
  {
    name: "passion",
    colors: ["#F27983", "#F28705", "#F27405", "#F2786D", "#F2F2F2"],
    bgColor: "#021526"
  },
  {
    name: "hydrangea",
    colors: ["#EEF1FF", "#D2DAFF", "#AAC4FF", "#B1B2FF", "#363062"],
    bgColor: "#0C0C0C"
  },
  {
    name: "tulips",
    colors: ["#E38B29", "#F1A661", "#FFD8A9", "#FDEEDC", "#22092C"],
    bgColor: "#070F2B"
  },
  {
    name: "sea",
    colors: ["#146C94", "#19A7CE", "#B0DAFF", "#FEFF86", "#146C94"],
    bgColor: "#202020"
  },
  {
    name: "bright",
    colors: ["#E8F3D6", "#FCF9BE", "#FFDCA9", "#FAAB78", "#7D6E83"],
    bgColor: "#021526"
  },
  {
    name: "forest",
    colors: ["#4B5940", "#7A8C68", "#99A686", "#BFB7A8", "#F2F2F2"],
    bgColor: "#0C0C0C"
  },
  {
    name: "rainbow",
    colors: ["#001219", "#005f73", "#0a9396", "#94d2bd", "#e9d8a6"],
    bgColor: "#070F2B"
  },
  // 新增颜色方案
  {
    name: "neon cyber",
    colors: ["#00FFFF", "#FF00FF", "#FFFF00", "#00FF00", "#FF0080"],
    bgColor: "#0A0A0A"
  },
  {
    name: "aurora",
    colors: ["#00C9FF", "#92FE9D", "#00F5FF", "#A8EDEA", "#FED6E3"],
    bgColor: "#0B1426"
  },
  {
    name: "fire",
    colors: ["#FF4500", "#FF6347", "#FF7F50", "#FFA500", "#FFD700"],
    bgColor: "#1C0A00"
  },
  {
    name: "ice",
    colors: ["#B0E0E6", "#87CEEB", "#4682B4", "#191970", "#000080"],
    bgColor: "#0A0F1A"
  },
  {
    name: "autumn",
    colors: ["#8B4513", "#CD853F", "#DEB887", "#F4A460", "#D2691E"],
    bgColor: "#2F1B14"
  },
  {
    name: "spring",
    colors: ["#98FB98", "#90EE90", "#32CD32", "#228B22", "#006400"],
    bgColor: "#0F1A0F"
  },
  {
    name: "cosmic",
    colors: ["#4B0082", "#8A2BE2", "#9370DB", "#BA55D3", "#DA70D6"],
    bgColor: "#0A0A0F"
  },
  {
    name: "minimal",
    colors: ["#FFFFFF", "#F0F0F0", "#D3D3D3", "#A9A9A9", "#696969"],
    bgColor: "#1A1A1A"
  }
];

export type MosaicAudioUniforms = {
  level: number;
  flux: number;
  centroid: number;
  flatness: number;
  zcr: number;
  mfcc: [number, number, number, number];
  pulse: number;
  bandLow?: number;
  bandMid?: number;
  bandHigh?: number;
};

export type MosaicControls = {
  cellSize: number;
  maxAge: number;
  growthRate: number;
  spawnRate: number;
  colorScheme: number;
  colorFlowSpeed: number;
  alpha: number;
  ghostDuration?: number; // 残影持续时间
  // 频谱增强参数
  frequencyBands?: number; // 频段数量
  pitchSensitivity?: number; // 音高敏感度
  intensitySensitivity?: number; // 强度敏感度
  spectrumMode?: boolean; // 是否启用频谱模式
  // 极光效果参数
  auroraMode?: boolean; // 是否启用极光模式
  auroraIntensity?: number; // 极光强度
  auroraSpeed?: number; // 极光变化速度
  // 频谱条叠加参数（可选）
  showSpectrumBars?: boolean; // 是否显示频谱条
  spectrumBarOpacity?: number; // 频谱条整体不透明度 0..1
  spectrumBarWidthScale?: number; // 单列条形宽度相对缩放（0.5..1.5）
  spectrumBarGap?: number; // 条形间隙像素（>=0）
  spectrumPeakHold?: boolean; // 是否显示峰值保持指示
  spectrumPeakDecay?: number; // 峰值下降速度（0.001..0.05）
};

type MosaicExtras = {
  bandColumns?: number[];
};

export class MosaicVisual {
  private grid: MosaicGrid = [];
  private cols: number = 0;
  private rows: number = 0;
  private colors: string[] = [];
  private bgColor: string = '';
  private frameCount: number = 0;
  // 频谱增强
  private frequencyBands: number = 8;
  private bandWidth: number = 0;
  private bandCooling?: number[]; // 频段冷却机制
  // 频谱条内部状态（平滑与峰值保持）
  private spectrumColumnsSmoothed?: number[];
  private spectrumPeaks?: number[];
  private spectrumLastLen: number = 0;
  
  constructor(
    private p: any,
    private controls: MosaicControls,
    private audio: MosaicAudioUniforms,
    private extras?: MosaicExtras
  ) {
    this.frequencyBands = this.controls.frequencyBands || 8;
    this.initializeGrid();
  }

  private initializeGrid() {
    const colorScheme = MOSAIC_COLOR_SCHEMES[this.controls.colorScheme];
    this.colors = colorScheme.colors;
    this.bgColor = colorScheme.bgColor;
    
    // 使用 ceil 保证铺满屏幕，避免右/下出现空带
    this.cols = Math.max(1, Math.ceil(this.p.width / this.controls.cellSize));
    this.rows = Math.max(1, Math.ceil(this.p.height / this.controls.cellSize));
    
    // 🎵 修复频段分区问题：使用更小的频段数量，避免分区过于明显
    this.frequencyBands = 4; // 减少频段数量
    this.bandWidth = this.cols / this.frequencyBands;
    
    // Initialize grid with random cells
    this.grid = Array.from({ length: this.cols }, () =>
      Array.from({ length: this.rows }, () => ({
        alive: this.p.random() < this.controls.spawnRate,
        age: 0,
        shape: this.p.random(['circle', 'triangle', 'rect']),
      }))
    );
  }

  public syncState(
    controls: MosaicControls,
    audio: MosaicAudioUniforms,
    extras?: MosaicExtras
  ) {
    const colorSchemeChanged = controls.colorScheme !== this.controls.colorScheme;
    const cellSizeChanged = controls.cellSize !== this.controls.cellSize;
    this.controls = controls;
    this.audio = audio;
    this.extras = extras;
    // 当 bandColumns 尺寸变化时重置平滑与峰值缓存
    const len = extras?.bandColumns?.length || 0;
    if (len > 0 && len !== this.spectrumLastLen) {
      this.spectrumColumnsSmoothed = new Array(len).fill(0);
      this.spectrumPeaks = new Array(len).fill(0);
      this.spectrumLastLen = len;
    }
    if (colorSchemeChanged) {
      this.updateColorScheme(controls.colorScheme);
    } else if (cellSizeChanged) {
      this.initializeGrid();
    }
  }

  // Public method to update color scheme
  public updateColorScheme(colorSchemeIndex: number) {
    if (colorSchemeIndex >= 0 && colorSchemeIndex < MOSAIC_COLOR_SCHEMES.length) {
      console.log('🎨 更新颜色方案:', colorSchemeIndex, MOSAIC_COLOR_SCHEMES[colorSchemeIndex].name);
      this.controls.colorScheme = colorSchemeIndex;
      this.initializeGrid();
    }
  }

  private countAliveNeighbors(x: number, y: number): number {
    let count = 0;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nx = (x + dx + this.cols) % this.cols;
        const ny = (y + dy + this.rows) % this.rows;
        if (this.grid[nx][ny].alive) count++;
      }
    }
    return count;
  }

  // 频谱增强：获取频段活跃度（强制使用频谱数据）
  private getBandActivity(bandIndex: number): number {
    // 🎵 强制启用频谱模式，即使 controls.spectrumMode 为 false
    const forceSpectrumMode = true;
    
    // 🎵 使用真实的 bandColumns 数据，如果没有则使用音频特征
    const columns = this.extras?.bandColumns;
    if (columns && columns.length > bandIndex) {
      const energy = columns[bandIndex] || 0;
      const normalized = Math.pow(Math.max(0, Math.min(1, energy)), 0.6);
      
      // 频段冷却机制：防止持续爆表
      if (!this.bandCooling) this.bandCooling = new Array(this.frequencyBands).fill(0);
      const coolingFactor = 0.95; // 0.5s 移动平均
      this.bandCooling[bandIndex] = this.bandCooling[bandIndex] * coolingFactor + normalized * (1 - coolingFactor);
      
      // 最大值限制，让能量真正集中在显著频段
      const maxEnergy = Math.max(this.bandCooling[bandIndex], normalized);
      return Math.max(0.1, Math.min(1.0, maxEnergy));
    }
    
    // 🎵 如果没有 bandColumns，使用音频特征创建频谱关联
    const audioSpectrum = this.createAudioSpectrum(bandIndex);
    return audioSpectrum;
    
    // 极光模式：更连续的活动度
    if (this.controls.auroraMode) {
      const baseActivity = this.p.noise(bandIndex * 0.05 + this.frameCount * 0.008) * 0.3 + 0.4;
      const timeVariation = this.p.sin(bandIndex * 0.3 + this.frameCount * 0.015) * 0.2 + 0.8;
      return this.p.constrain(baseActivity * timeVariation, 0.3, 1.0);
    }
    
    // 回退到噪声基线（当没有真实频谱数据时）
    const baseActivity = this.p.noise(bandIndex * 0.1 + this.frameCount * 0.01) * 0.4 + 0.3;
    const timeVariation = this.p.sin(bandIndex * 0.5 + this.frameCount * 0.02) * 0.3 + 0.7;
    const bandVariation = this.p.sin(bandIndex * 0.8 + this.frameCount * 0.015) * 0.2 + 0.8;
    
    // 频段特定的基础活动度
    let bandBaseActivity = 0.2;
    if (bandIndex < 2) {
      bandBaseActivity = 0.4; // 低频更活跃
    } else if (bandIndex < 5) {
      bandBaseActivity = 0.3; // 中频中等
    } else {
      bandBaseActivity = 0.25; // 高频较少
    }
    
    const finalActivity = (baseActivity * timeVariation * bandVariation + bandBaseActivity) / 2;
    return this.p.constrain(finalActivity, 0, 1);
  }

  // 🎵 创建音频频谱：使用音频特征模拟频谱数据
  private createAudioSpectrum(bandIndex: number): number {
    const totalBands = this.frequencyBands;
    const bandRatio = bandIndex / (totalBands - 1); // 0 到 1
    
    // 根据频段位置使用不同的音频特征
    let spectrumValue = 0;
    
    if (bandIndex < totalBands * 0.3) {
      // 低频：使用 bandLow 和 level
      spectrumValue = this.audio.bandLow * 0.8 + this.audio.level * 0.2;
    } else if (bandIndex < totalBands * 0.7) {
      // 中频：使用 bandMid 和 centroid
      spectrumValue = this.audio.bandMid * 0.6 + this.audio.centroid * 0.4;
    } else {
      // 高频：使用 bandHigh 和 flux
      spectrumValue = this.audio.bandHigh * 0.7 + this.audio.flux * 0.3;
    }
    
    // 添加频段特定的变化
    const bandVariation = this.p.sin(bandIndex * 0.5 + this.frameCount * 0.02) * 0.3 + 0.7;
    const timeVariation = this.p.sin(this.frameCount * 0.01 + bandIndex * 0.1) * 0.2 + 0.8;
    
    const finalValue = spectrumValue * bandVariation * timeVariation;
    return this.p.constrain(finalValue, 0.1, 1.0);
  }

  // 形状选择：流动频谱影响
  private chooseShapeFromPitch(x: number): 'circle' | 'triangle' | 'rect' {
    if (!this.controls.spectrumMode) {
      return this.chooseShapeFromMFCC();
    }
    
    // 流动的频谱影响 - 不是固定分区
    const px = x / this.cols;
    const t = this.frameCount * 0.01;
    
    // 频谱流动波
    const spectrumWave = this.p.sin(px * 3 + t * 0.5) * 0.3;
    const audioInfluence = this.audio.centroid * 0.4 + this.audio.level * 0.2;
    
    // 组合频谱和音频影响
    const totalInfluence = spectrumWave + audioInfluence;
    
    // 根据流动影响选择形状，但保持随机性
    const randomValue = this.p.random();
    const influenceFactor = (totalInfluence + 1) / 2; // 归一化到 0-1
    
    if (randomValue < 0.33 + influenceFactor * 0.1) {
      return 'circle';
    } else if (randomValue < 0.66 + influenceFactor * 0.1) {
      return 'triangle';
    } else {
      return 'rect';
    }
  }

  // 频谱增强：流动频谱影响大小
  private getBandAdjustedSize(baseSize: number, x: number): number {
    if (!this.controls.spectrumMode) return baseSize;
    
    const px = x / this.cols;
    const t = this.frameCount * 0.01;
    
    // 流动的频谱影响大小
    const spectrumWave = this.p.sin(px * 2.5 + t * 0.3) * 0.2;
    const audioInfluence = this.audio.level * 0.3 + this.audio.flux * 0.2;
    
    // 组合影响
    const totalInfluence = spectrumWave + audioInfluence;
    
    // 大小变化 - 流动而不是分区
    const sizeVariation = 0.8 + totalInfluence * 0.4 + this.p.noise(x * 0.1 + t) * 0.2;
    
    return baseSize * this.p.constrain(sizeVariation, 0.6, 1.4);
  }

  // 频谱增强：频段竞争机制
  private getBandCompetition(bandIndex: number): number {
    if (!this.controls.spectrumMode) return 1.0;
    
    let competitionFactor = 1.0;
    
    // 检查相邻频段的活跃度
    for (let i = 0; i < this.frequencyBands; i++) {
      if (i !== bandIndex) {
        const distance = Math.abs(i - bandIndex);
        const otherActivity = this.getBandActivity(i);
        
        // 相邻频段会抑制当前频段
        if (distance === 1) {
          competitionFactor *= (1.0 - otherActivity * 0.3);
        } else if (distance === 2) {
          competitionFactor *= (1.0 - otherActivity * 0.1);
        }
      }
    }
    
    return this.p.constrain(competitionFactor, 0.1, 1.0);
  }

  // 频谱增强：频段排斥机制
  private getBandExclusion(bandIndex: number): number {
    if (!this.controls.spectrumMode) return 1.0;
    
    let exclusionFactor = 1.0;
    
    // 检查其他频段的活跃度，活跃的频段会排斥其他频段
    for (let i = 0; i < this.frequencyBands; i++) {
      if (i !== bandIndex) {
        const distance = Math.abs(i - bandIndex);
        const otherActivity = this.getBandActivity(i);
        
        // 活跃频段会抑制其他频段
        if (otherActivity > 0.5) {
          const exclusionStrength = otherActivity * (1.0 - distance / this.frequencyBands);
          exclusionFactor *= (1.0 - exclusionStrength * 0.4);
        }
      }
    }
    
    return this.p.constrain(exclusionFactor, 0.2, 1.0);
  }

  
  private getFlowingColor(i: number, j: number, age: number): any {
    const px = i / this.cols;
    const py = j / this.rows;
    
    // 极光模式：使用蓝绿色系
    if (this.controls.auroraMode) {
      return this.getAuroraColor(i, j, age);
    }
    
    const levelInfluence = this.p.constrain(this.audio.level, 0, 1);
    const pitchInfluence = this.audio.centroid * 0.35;
    const flowSpeed = this.controls.colorFlowSpeed * (0.25 + 0.55 * levelInfluence);
    const t = this.frameCount * flowSpeed * (1 + pitchInfluence);
    
    // Add pitch-based phase shift to create horizontal color waves
    const pitchPhase = px * this.audio.centroid * 3.0; // Horizontal wave based on pitch
    const n = this.p.sin(px * 2 + py * 2 + t + pitchPhase) * 0.5 + 0.5;
    
    const ageFactor = this.p.constrain(age / this.controls.maxAge, 0, 1);
    
    // Pitch affects color blending - higher pitch shifts colors more (reduced weight)
    const pitchColorShift = this.audio.centroid * 0.2; // reduced from 0.3
    const blend = (ageFactor + n + pitchColorShift) / 2;
    
    const indexA = Math.floor(blend * (this.colors.length - 1));
    const indexB = (indexA + 1) % this.colors.length;
    const mix = (blend * (this.colors.length - 1)) % 1;
    
    const c = this.p.lerpColor(
      this.p.color(this.colors[indexA]),
      this.p.color(this.colors[indexB]),
      mix
    );
    
    // Pitch also affects alpha - higher pitch = more vibrant
    const pitchAlpha = 1 + this.audio.centroid * 0.2;
    const alpha = this.p.constrain(this.controls.alpha * pitchAlpha * 0.8, 0, 1);
    c.setAlpha(alpha * 255);
    return c;
  }

  // 极光颜色生成 - 流动频谱结合
  private getAuroraColor(i: number, j: number, age: number): any {
    const px = i / this.cols;
    const py = j / this.rows;
    
    const auroraIntensity = this.controls.auroraIntensity || 1.0;
    const auroraSpeed = this.controls.auroraSpeed || 0.02;
    
    // 时间变化
    const t = this.frameCount * auroraSpeed;
    
    // 流动的频谱影响 - 不是固定分区
    const spectrumFlow = this.p.sin(px * 1.5 + t * 0.4) * 0.3;
    const spectrumShift = this.p.sin(py * 0.8 + t * 0.2) * 0.2;
    
    // 音频影响频谱流动
    const audioFlow = this.audio.centroid * 0.4 + this.audio.level * 0.3;
    const totalSpectrumFlow = spectrumFlow + spectrumShift + audioFlow;
    
    // 极光基础颜色 - 根据流动频谱变化
    const baseHue = (0.5 + totalSpectrumFlow * 0.3) % 1; // 蓝到绿的变化
    const baseSat = 0.7 + this.audio.flux * 0.3;
    const baseBright = 0.6 + this.audio.level * 0.4;
    
    // 极光波动 - 多层波浪效果
    const wave1 = this.p.sin(px * 2 + py * 1.5 + t) * 0.3;
    const wave2 = this.p.sin(px * 1.2 + py * 2.5 + t * 0.8) * 0.2;
    const wave3 = this.p.sin(px * 3.5 + py * 0.8 + t * 1.2) * 0.15;
    const wave4 = this.p.sin(px * 0.5 + py * 4 + t * 0.5) * 0.1;
    
    // 音频驱动的极光流动
    const audioWave = this.p.sin(px * 2.5 + py * 1.8 + t * (1 + this.audio.flux)) * this.audio.level * 0.4;
    
    // 组合所有波动
    const totalWave = wave1 + wave2 + wave3 + wave4 + audioWave;
    
    // 最终颜色 - 频谱流动 + 极光波动
    const hue = (baseHue + totalWave * 0.2) % 1;
    const sat = this.p.constrain(baseSat + totalWave * 0.2, 0.5, 1.0);
    const bright = this.p.constrain(baseBright + totalWave * 0.3, 0.3, 1.0);
    
    // 年龄影响透明度
    const ageFactor = this.p.constrain(age / this.controls.maxAge, 0, 1);
    const alpha = this.p.constrain(
      this.controls.alpha * (0.6 + ageFactor * 0.4) * auroraIntensity,
      0.4, 1.0
    );
    
    this.p.colorMode(this.p.HSB, 1);
    const c = this.p.color(hue, sat, bright, alpha);
    this.p.colorMode(this.p.RGB, 255);
    
    return c;
  }


  
  private makeRainbowColor(columnIndex: number, energy: number) {
    const hue = (columnIndex / Math.max(1, this.cols - 1) + this.frameCount * this.controls.colorFlowSpeed * 0.4) % 1;
    const sat = this.p.constrain(0.55 + 0.25 * energy, 0, 1);
    const bright = this.p.constrain(0.32 + 0.42 * energy, 0, 1);
    this.p.colorMode(this.p.HSB, 1);
    const c = this.p.color(hue, sat, bright, 1);
    this.p.colorMode(this.p.RGB, 255);
    return c;
  }

  // Choose cell shape based on MFCC distribution using probability sampling for balance
  private chooseShapeFromMFCC(): 'circle' | 'triangle' | 'rect' {
    const m = this.audio.mfcc;
    if (!m || m.length < 4) {
      return this.p.random(['circle', 'triangle', 'rect']);
    }

    // 输入来自可视层已归一到 0..1，映射回 -1..1 区间
    const m0 = this.p.constrain(m[0], 0, 1) * 2 - 1;
    const m1 = this.p.constrain(m[1], 0, 1) * 2 - 1;
    const m2 = this.p.constrain(m[2], 0, 1) * 2 - 1;
    const m3 = this.p.constrain(m[3], 0, 1) * 2 - 1;

    // 加权组合
    const weighted = m0 * 0.4 + m1 * 0.3 + m2 * 0.2 + m3 * 0.1; // 约 -1..1
    const normalized = this.p.constrain((weighted + 1) / 2, 0, 1); // 0..1

    // 使用软概率分配而非硬阈值，确保三类形状长期占比均衡
    // 基础概率各占1/3，然后根据MFCC值微调
    let circleProb = 0.33;
    let triangleProb = 0.33;
    let rectProb = 0.34;

    // 根据normalized值动态调整概率，但仍保持一定的随机性
    if (normalized < 0.33) {
      // 偏向圆形，但仍给其他形状机会
      circleProb = 0.5 + 0.2 * (1 - normalized / 0.33);
      triangleProb = 0.25 + 0.1 * (normalized / 0.33);
      rectProb = 0.25 + 0.1 * (normalized / 0.33);
    } else if (normalized < 0.67) {
      // 偏向三角形，但仍给其他形状机会
      circleProb = 0.25 + 0.1 * ((normalized - 0.33) / 0.34);
      triangleProb = 0.5 + 0.2 * (1 - Math.abs(normalized - 0.5) / 0.17);
      rectProb = 0.25 + 0.1 * ((0.67 - normalized) / 0.34);
    } else {
      // 偏向矩形，但仍给其他形状机会
      circleProb = 0.25 + 0.1 * ((1 - normalized) / 0.33);
      triangleProb = 0.25 + 0.1 * ((1 - normalized) / 0.33);
      rectProb = 0.5 + 0.2 * ((normalized - 0.67) / 0.33);
    }

    // 归一化概率
    const totalProb = circleProb + triangleProb + rectProb;
    const normalizedCircleProb = circleProb / totalProb;
    const normalizedTriangleProb = triangleProb / totalProb;

    // 添加时间变化的轻微扰动，增加动态性
    const timeOffset = this.frameCount * 0.001;
    const spatialNoise = this.p.noise(weighted * 3.7 + timeOffset);
    const randomValue = (this.p.random() + spatialNoise * 0.1) % 1;

    if (randomValue < normalizedCircleProb) {
      return 'circle';
    } else if (randomValue < normalizedCircleProb + normalizedTriangleProb) {
      return 'triangle';
    } else {
      return 'rect';
    }
  }

  private drawShape(shape: string, size: number) {
    switch (shape) {
      case 'circle':
        this.p.ellipse(0, 0, size, size);
        break;
      case 'triangle':
        const h = size * Math.sqrt(3) / 2;
        this.p.triangle(
          0, -h / 2,
          -size / 2, h / 2,
          size / 2, h / 2
        );
        break;
      case 'rect':
        this.p.rectMode(this.p.CENTER);
        this.p.rect(0, 0, size, size);
        break;
    }
  }

  public draw() {
    // 轻微的背景残影，让过渡更自然
    this.p.push();
    this.p.noStroke();
    this.p.rectMode(this.p.CORNER);
    const fade = this.p.color(this.bgColor + "08"); // 很淡的背景残影
    this.p.fill(fade);
    this.p.rect(0, 0, this.p.width, this.p.height);
    this.p.pop();

    // 优先绘制频谱条，让整体更像“频谱”
    try {
      this.drawSpectrumBars();
    } catch (e) {
      console.warn('⚠️ 绘制频谱条失败:', e);
    }

    for (let i = 0; i < this.cols; i++) {
      for (let j = 0; j < this.rows; j++) {
        const cell = this.grid[i][j];
        const x = i * this.controls.cellSize + this.controls.cellSize / 2;
        const y = j * this.controls.cellSize + this.controls.cellSize / 2;

        if (cell.alive) {
          cell.age++;

          // 🎵 动态调整元胞大小最大值：根据音频特征调整 maxAge
          const dynamicMaxAge = this.controls.maxAge * (0.5 + this.audio.level * 1.0 + this.audio.flux * 0.8);
          let size = this.p.map(cell.age, 0, dynamicMaxAge, 1, this.controls.cellSize);
          
          // 频谱增强：根据频段调整大小
          size = this.getBandAdjustedSize(size, i);
          
          // 加强音频响应：音频直接影响元胞大小
          if (this.controls.spectrumMode) {
            const bandIndex = Math.floor(i / this.bandWidth);
            const bandActivity = this.getBandActivity(bandIndex);
            
          // 🎵 音频强度直接影响元胞大小（使用真实频谱数据）
          const audioSizeMultiplier = 0.5 + bandActivity * 0.8; // 增加变化范围
          size *= audioSizeMultiplier;
          
          // 使用 bandColumns 数据进一步调整大小
          const columns = this.extras?.bandColumns;
          if (columns && columns.length > bandIndex) {
            const bandEnergy = columns[bandIndex] || 0;
            const normalizedEnergy = Math.pow(Math.max(0, Math.min(1, bandEnergy)), 0.6);
            const energySizeMultiplier = 0.7 + normalizedEnergy * 0.6; // 增加变化范围
            size *= energySizeMultiplier;
          }
          
          // 🎵 限制大小不超过格子大小
          size = this.p.constrain(size, 0.5, this.controls.cellSize * 0.8); // 限制最大大小为格子的 80%
            
            // 音频变化率影响元胞脉动
            const pulse = this.p.sin(this.frameCount * 0.1 + i * 0.1) * this.audio.flux * 0.2 + 1.0;
            size *= pulse;
          }

          // 使用原始的颜色流动，没有频谱分区
          const baseColor = this.getFlowingColor(i, j, cell.age);
          // 降低细胞层不透明度，让频谱条更主导
          const cellAlphaBase = 140; // 约 55%
          baseColor.setAlpha(cellAlphaBase);

          // 音频增强的alpha
          const audioAlpha = this.p.constrain(
            this.controls.alpha * 0.85 * (0.65 + this.audio.level * 0.25),
            0.2, 0.9
          );
          baseColor.setAlpha(Math.min(255, audioAlpha * 255));

          this.p.fill(baseColor);
          this.p.noStroke();

          this.p.push();
          this.p.translate(x, y);
          this.drawShape(cell.shape, size);
          this.p.pop();

          // 原始的age out逻辑，但创建残影
          if (cell.age > this.controls.maxAge) {
            // 创建残影
            cell.ghostAge = 0;
            cell.ghostSize = size;
            cell.ghostColor = this.p.color(baseColor);
            cell.alive = false;
          }
        }
        
        // 🎵 绘制残影：极短留存时间
        if (cell.ghostAge !== undefined && cell.ghostAge < 3) { // 极短时间：3 帧
          cell.ghostAge++;
          
          // 残影快速变淡
          const ghostAlpha = this.p.map(cell.ghostAge, 0, 3, 0.1, 0); // 极低透明度
          if (ghostAlpha > 0 && cell.ghostColor) {
            // 🎵 修复颜色错误：检查颜色对象是否存在
            const ghostColor = cell.ghostColor;
            ghostColor.setAlpha(ghostAlpha * 255);
            
            this.p.fill(ghostColor);
            this.p.noStroke();
            
            this.p.push();
            this.p.translate(x, y);
            this.drawShape(cell.shape, cell.ghostSize || 0);
            this.p.pop();
          }
        } else if (cell.ghostAge !== undefined) {
          // 🎵 残影超时，立即清理
          cell.ghostAge = undefined;
          cell.ghostSize = undefined;
          cell.ghostColor = undefined;
        }
      }
    }

    // 简单的生长间隔，基于整体音频活动
    const growthChance = this.p.constrain(
      this.controls.growthRate * (1.0 + this.audio.level * 1.5),
      0.01, 0.15
    );

    if (this.frameCount % 2 === 0 || this.p.random() < growthChance) {
      this.updateGrowth();
    }
    this.frameCount++;
  }

  // 绘制频谱条：从底部向上绘制列状条形，并带峰值保持指示
  private drawSpectrumBars() {
    const columns = this.extras?.bandColumns;
    const hasColumns = Array.isArray(columns) && (columns as number[]).length > 0;
    const enabled = this.controls.showSpectrumBars ?? this.controls.spectrumMode ?? true;
    if (!enabled || !hasColumns) return;

    try {
      const arr = columns as number[];
      const n = arr.length;
      // 初始化平滑与峰值缓存
      if (!this.spectrumColumnsSmoothed || this.spectrumColumnsSmoothed.length !== n) {
        this.spectrumColumnsSmoothed = new Array(n).fill(0);
      }
      if (!this.spectrumPeaks || this.spectrumPeaks.length !== n) {
        this.spectrumPeaks = new Array(n).fill(0);
      }

      // 平滑参数：上升快（attack），下降慢（release），减少闪烁
      const attack = 0.45; // 0..1 越大上升越快
      const release = 0.12; // 0..1 越小下降越慢
      const op = Math.max(0, Math.min(1, this.controls.spectrumBarOpacity ?? 0.9));
      const widthScale = Math.max(0.4, Math.min(1.6, this.controls.spectrumBarWidthScale ?? 0.85));
      const gap = Math.max(0, Math.min(12, this.controls.spectrumBarGap ?? 1));
      const peakHold = this.controls.spectrumPeakHold ?? true;
      const peakDecay = Math.max(0.002, Math.min(0.08, this.controls.spectrumPeakDecay ?? 0.02));

      // 计算每列条形的屏幕宽度
      const totalWidth = this.p.width;
      const barFullW = totalWidth / n; // 每列分配宽度
      const barW = Math.max(1, barFullW * widthScale - gap);
      const leftOffset = (barFullW - barW) / 2;

      // 垂直范围
      const bottomY = this.p.height;
      const topY = 0;
      const maxH = bottomY - topY;

      // 按列更新平滑与峰值
      for (let i = 0; i < n; i++) {
        const x0 = i * barFullW + leftOffset;
        // 非线性映射（软压缩），兼容 0..1 之外的输入
        const raw = Math.max(0, Math.min(1, arr[i] ?? 0));
        const energy = Math.pow(raw, 0.6); // 增强弱信号

        // 平滑：上升用 attack，下落用 release
        const prev = this.spectrumColumnsSmoothed[i];
        const coef = energy > prev ? attack : release;
        const smooth = prev + coef * (energy - prev);
        this.spectrumColumnsSmoothed[i] = smooth;

        // 峰值保持：缓慢衰减到平滑值之上
        const peakPrev = this.spectrumPeaks[i];
        const peakNext = Math.max(smooth, peakPrev - peakDecay);
        this.spectrumPeaks[i] = peakNext;

        // 颜色：使用彩虹或当前主题颜色过渡
        const barColor = this.makeRainbowColor(i, smooth);
        barColor.setAlpha(Math.min(255, op * 255));

        // 绘制条形（从底向上）
        const h = Math.max(1, smooth * maxH);
        this.p.noStroke();
        this.p.fill(barColor);
        this.p.rectMode(this.p.CORNER);
        this.p.rect(x0, bottomY - h, barW, h);

        // 峰值指示（小横条）
        if (peakHold) {
          const peakH = Math.max(1, peakNext * maxH);
          const peakY = bottomY - peakH;
          // 峰值使用更亮的同色并减小透明度
          const peakC = this.makeRainbowColor(i, Math.min(1, peakNext + 0.15));
          peakC.setAlpha(Math.min(255, op * 0.9 * 255));
          this.p.fill(peakC);
          this.p.rect(x0, Math.max(topY, peakY - 2), barW, 3);
        }
      }
    } catch (err) {
      console.warn('⚠️ 频谱条更新失败:', err);
    }
  }

  // 频谱增强的生长逻辑
  private updateGrowth() {
    const next: MosaicGrid = [];

    for (let i = 0; i < this.cols; i++) {
      next[i] = [];
      for (let j = 0; j < this.rows; j++) {
        const cell = this.grid[i][j];
        const neighbors = this.countAliveNeighbors(i, j);

        const newCell = { ...cell };

        if (!cell.alive) {
          // 频谱增强：根据频段活跃度调整生成概率
          const bandIndex = Math.floor(i / this.bandWidth);
          const bandActivity = this.getBandActivity(bandIndex);
          
          // 🎵 真正的随机性：使用噪声和完全随机，避免规律性模式
          const noiseOffset = this.p.noise(i * 0.1, j * 0.1, this.frameCount * 0.01) * 0.2; // 噪声偏移
          const pureRandom = this.p.random() * 0.15; // 完全随机
          let spawnChance = 0.1 + noiseOffset + pureRandom;
          
          if (this.controls.spectrumMode) {
            // 🎵 频谱模式：使用真实频谱数据影响生成概率，添加异步性
            spawnChance = 0.02 + bandActivity * 0.2 + noiseOffset + pureRandom;
            
            // 直接音频响应：音频强度直接影响生成
            const directAudioResponse = this.audio.level * 0.3 + this.audio.flux * 0.2;
            spawnChance += directAudioResponse;
            
            // 频段特定的音频特征响应
            if (bandIndex < 2) {
              // 低频：响应低音频特征
              spawnChance += this.audio.bandLow * 0.4;
            } else if (bandIndex < 5) {
              // 中频：响应中音频特征
              spawnChance += this.audio.bandMid * 0.4;
            } else {
              // 高频：响应高音频特征
              spawnChance += this.audio.bandHigh * 0.4;
            }
            
            // 使用 bandColumns 数据增强生成概率
            const columns = this.extras?.bandColumns;
            if (columns && columns.length > bandIndex) {
              const bandEnergy = columns[bandIndex] || 0;
              const normalizedEnergy = Math.pow(Math.max(0, Math.min(1, bandEnergy)), 0.6);
              spawnChance += normalizedEnergy * 0.3; // 频谱能量直接影响生成
            }
            
            // 增加频段竞争：相邻频段会抑制当前频段
            const competitionFactor = this.getBandCompetition(bandIndex);
            spawnChance *= competitionFactor;
            
            // 增加时间变化：频段有"呼吸"节奏
            const breathing = this.p.sin(bandIndex * 0.8 + this.frameCount * 0.03) * 0.3 + 0.7;
            spawnChance *= breathing;
          }
          
          // 邻居影响
          if (neighbors >= 2) {
            spawnChance *= 2.0;
          }
          
          if (this.p.random() < spawnChance) {
            newCell.alive = true;
            newCell.age = 0;
            // 频谱增强：根据音高选择形状
            newCell.shape = this.chooseShapeFromPitch(i);
            // 新元胞出现时清除残影
            newCell.ghostAge = undefined;
            newCell.ghostSize = undefined;
            newCell.ghostColor = undefined;
          }
        } else if (cell.alive) {
          // 🎵 真正的随机死亡：使用噪声和完全随机，避免规律性
          const randomDeath = this.p.random() * 0.08; // 随机死亡概率
          const ageDeath = cell.age > (this.controls.maxAge || 120) ? 0.4 : 0; // 年龄死亡
          const neighborDeath = neighbors < 1 ? 0.3 : 0; // 孤立死亡
          const noiseDeath = this.p.noise(i * 0.15, j * 0.15, this.frameCount * 0.02) * 0.1; // 噪声死亡
          
          const totalDeathChance = randomDeath + ageDeath + neighborDeath + noiseDeath;
          
          if (this.p.random() < totalDeathChance) {
            newCell.alive = false;
            newCell.ghostAge = 0; // 开始残影
          } else {
            newCell.alive = true;
          }
        }

        next[i][j] = newCell;
      }
    }

    this.grid = next;
  }

  
  public resize() {
    this.initializeGrid();
  }
}

// Export functions for compatibility with existing visualizer
export function drawMosaic(p: any, mosaicVisual: MosaicVisual) {
  mosaicVisual.draw();
}

export function applyMosaicUniforms(
  p: any,
  mosaicVisual: MosaicVisual,
  audio: MosaicAudioUniforms,
  sensitivity: number,
  cellSize: number = 20,
  maxAge: number = 200,
  growthRate: number = 0.05,
  spawnRate: number = 0.02,
  colorScheme: number = 0,
  colorFlowSpeed: number = 0.01,
  alpha: number = 0.7,
  ghostDuration: number = 30,
  frequencyBands: number = 8,
  pitchSensitivity: number = 1.0,
  intensitySensitivity: number = 1.0,
  spectrumMode: boolean = true,
  auroraMode: boolean = true,
  auroraIntensity: number = 1.0,
  auroraSpeed: number = 0.02,
  bandColumns?: number[]
) {
  // Update the visual's controls and audio data
  const newControls = {
    cellSize,
    maxAge,
    growthRate,
    spawnRate,
    colorScheme,
    colorFlowSpeed,
    alpha,
    ghostDuration,
    frequencyBands,
    pitchSensitivity,
    intensitySensitivity,
    spectrumMode,
    auroraMode,
    auroraIntensity,
    auroraSpeed
  };
  
  mosaicVisual.syncState(newControls, audio, { bandColumns });
}
