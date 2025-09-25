// Mosaic (2693579) - Direct port from p5.js 2D cellular automata
// Based on ref_p5/Mosaic_2693579, keeping the original 2D rendering approach

export type MosaicCell = {
  alive: boolean;
  age: number;
  shape: 'circle' | 'triangle' | 'rect';
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
};

export type MosaicControls = {
  cellSize: number;
  maxAge: number;
  growthRate: number;
  spawnRate: number;
  colorScheme: number;
  colorFlowSpeed: number;
  alpha: number;
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
  
  constructor(
    private p: any,
    private controls: MosaicControls,
    private audio: MosaicAudioUniforms,
    private extras?: MosaicExtras
  ) {
    this.initializeGrid();
  }

  private initializeGrid() {
    const colorScheme = MOSAIC_COLOR_SCHEMES[this.controls.colorScheme];
    this.colors = colorScheme.colors;
    this.bgColor = colorScheme.bgColor;
    
    this.cols = Math.floor(this.p.width / this.controls.cellSize);
    this.rows = Math.floor(this.p.height / this.controls.cellSize);
    
    // Initialize grid with random cells
    this.grid = Array.from({ length: this.cols }, () =>
      Array.from({ length: this.rows }, () => ({
        alive: this.p.random() < this.controls.spawnRate,
        age: 0,
        shape: this.p.random(['circle', 'triangle', 'rect']),
      }))
    );
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

  private updateGrowth() {
    const next: MosaicGrid = [];
    
    // Audio-modulated growth rate
    // Include flatness to modulate pattern complexity and spawning tendency
    const audioGrowthRate = this.controls.growthRate * (
      1 + this.audio.flux * 0.5 + this.audio.zcr * 0.3 + this.audio.flatness * 0.2
    );
    
    const colsArr = Array.isArray(this.extras?.bandColumns) ? this.extras!.bandColumns! : [];
    const colCount = colsArr.length;

    for (let i = 0; i < this.cols; i++) {
      next[i] = [];
      for (let j = 0; j < this.rows; j++) {
        const cell = this.grid[i][j];
        const neighbors = this.countAliveNeighbors(i, j);
        
        const newCell = { ...cell };
        
        // 列响度（左→右=低→高），缺省则取 1
        const loudCol = colCount ? this.p.constrain(colsArr[Math.floor(i / Math.max(1, Math.floor(this.cols / Math.max(1, colCount))))] || 0, 0, 1) : 1;

        // Growth rule: spawn if 2+ neighbors and random chance（受列响度调制）
        if (!cell.alive && neighbors >= 2 && this.p.random() < audioGrowthRate * (0.6 + 0.8 * loudCol)) {
          newCell.alive = true;
          newCell.age = 0;
          newCell.shape = this.chooseShapeFromMFCC();
        }
        
        next[i][j] = newCell;
      }
    }
    
    // Audio-driven new cell spawning based on pitch (spectral centroid)
    // Map spectral centroid (0-1) to horizontal position (0 to cols-1)
    if (this.audio.level > 0.01) { // Only spawn when there's audio
      const pitchPosition = Math.floor(this.audio.centroid * (this.cols - 1));
      const spawnRow = Math.floor(this.p.random(this.rows));
      
      // Check if the pitch-based position is available for spawning
      if (pitchPosition >= 0 && pitchPosition < this.cols && 
          !next[pitchPosition][spawnRow].alive && 
          this.p.random() < this.audio.level * 0.1) {
        next[pitchPosition][spawnRow] = {
          alive: true,
          age: 0,
          shape: this.chooseShapeFromMFCC(),
        };
      }
    }
    
    this.grid = next;
  }

  private getFlowingColor(i: number, j: number, age: number): any {
    const px = i / this.cols;
    const py = j / this.rows;
    
    // Enhanced pitch influence on color flow (rebalanced lower weight)
    const pitchInfluence = this.audio.centroid * 0.6; // reduced from 0.8
    const t = this.frameCount * this.controls.colorFlowSpeed * (1 + pitchInfluence);
    
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
    c.setAlpha(this.controls.alpha * pitchAlpha * 255);
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
    // Background with trail effect (like original)
    this.p.background(this.p.color(this.bgColor + '0F'));
    
    // Audio-modulated spawn rate for new cells
    const audioSpawnRate = this.controls.spawnRate * (1 + this.audio.level * 0.5 + this.audio.pulse * 0.3);
    const colsArr = Array.isArray(this.extras?.bandColumns) ? this.extras!.bandColumns! : [];
    const colCount = colsArr.length;
    
    for (let i = 0; i < this.cols; i++) {
      for (let j = 0; j < this.rows; j++) {
        const cell = this.grid[i][j];
        if (cell.alive) {
          cell.age++;
          
          const x = i * this.controls.cellSize + this.controls.cellSize / 2;
          const y = j * this.controls.cellSize + this.controls.cellSize / 2;
          
          // Audio-modulated size with pitch influence
          const audioSizeMultiplier = 1 + this.audio.level * 0.3 + this.audio.flux * 0.2;
          const pitchSizeMultiplier = 1 + this.audio.centroid * 0.4; // Higher pitch = larger cells
          const loudCol = colCount ? this.p.constrain(colsArr[Math.floor(i / Math.max(1, Math.floor(this.cols / Math.max(1, colCount))))] || 0, 0, 1) : 1;
          const baseSize = this.p.map(cell.age, 0, this.controls.maxAge, 1, this.controls.cellSize) * audioSizeMultiplier * pitchSizeMultiplier * (0.8 + 0.6 * loudCol);
          // 限制最大尺寸，不超过单元格大小的 92%，避免溢出
          const maxSize = this.controls.cellSize * 0.92;
          const size = Math.min(baseSize, maxSize);
          
          // Get flowing color
          const c = this.getFlowingColor(i, j, cell.age);
          const alphaScale = 0.8 + 0.6 * (colCount ? loudCol : 1);
          c.setAlpha(this.controls.alpha * 255 * this.p.constrain(alphaScale, 0.3, 1.6));
          this.p.fill(c);
          this.p.noStroke();
          
          this.p.push();
          this.p.translate(x, y);
          this.drawShape(cell.shape, size);
          this.p.pop();
          
          // Age out cells
          if (cell.age > this.controls.maxAge) {
            cell.alive = false;
          }
        }
      }
    }
    
    this.updateGrowth();
    this.frameCount++;
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
  maxAge: number = 80,
  growthRate: number = 0.05,
  spawnRate: number = 0.02,
  colorScheme: number = 0,
  colorFlowSpeed: number = 0.01,
  alpha: number = 0.7,
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
    alpha
  };
  
  // Check if color scheme changed and reinitialize if needed
  if (mosaicVisual['controls'].colorScheme !== colorScheme) {
    console.log('🎨 颜色方案变化:', mosaicVisual['controls'].colorScheme, '->', colorScheme);
    mosaicVisual['controls'] = newControls;
    mosaicVisual['audio'] = audio;
    mosaicVisual['extras'] = { bandColumns } as any;
    // Update color scheme using the public method
    mosaicVisual.updateColorScheme(colorScheme);
  } else {
    mosaicVisual['controls'] = newControls;
    mosaicVisual['audio'] = audio;
    mosaicVisual['extras'] = { bandColumns } as any;
  }
}