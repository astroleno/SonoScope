/**
 * 风格检测器 - 基于音频特征的快速风格判定
 */

import { FeatureWindow } from './feature-aggregator';

export interface StyleResult {
  style: string;
  confidence: number;
  talking_points: string[];
  subgenres?: string[];
}

type StyleRule = {
  tempo_range: [number, number];
  flatness_threshold: number;
  contrast_threshold: number;
  centroid_range: [number, number];
  rms_range: [number, number];
  zcr_range: [number, number];
  keywords: string[];
  voiceMin?: number;
  voiceMax?: number;
  percussiveMin?: number;
  percussiveMax?: number;
  harmonicMin?: number;
  harmonicMax?: number;
};

export class StyleDetector {
  private readonly styleRules: Record<string, StyleRule> = {
    // EDM/House
    edm: {
      tempo_range: [120, 140] as [number, number],
      flatness_threshold: 0.3,
      contrast_threshold: 0.4,
      centroid_range: [2000, 6000] as [number, number],
      rms_range: [0.1, 0.8] as [number, number],
      zcr_range: [0.1, 0.4] as [number, number],
      keywords: ['电子', '舞曲', '节拍', '合成器'],
      voiceMax: 0.45,
      percussiveMin: 0.35,
    },

    // Techno
    techno: {
      tempo_range: [120, 135] as [number, number],
      flatness_threshold: 0.4,
      contrast_threshold: 0.5,
      centroid_range: [1500, 4000] as [number, number],
      rms_range: [0.2, 0.9] as [number, number],
      zcr_range: [0.05, 0.3] as [number, number],
      keywords: ['工业', '机械', '重复', '律动'],
      voiceMax: 0.35,
      percussiveMin: 0.5,
    },

    // Trance
    trance: {
      tempo_range: [130, 140] as [number, number],
      flatness_threshold: 0.25,
      contrast_threshold: 0.3,
      centroid_range: [3000, 7000] as [number, number],
      rms_range: [0.15, 0.7] as [number, number],
      zcr_range: [0.1, 0.35] as [number, number],
      keywords: ['梦幻', '旋律', '上升', '氛围'],
      voiceMax: 0.55,
      harmonicMin: 0.4,
    },

    // Dubstep
    dubstep: {
      tempo_range: [140, 150] as [number, number],
      flatness_threshold: 0.6,
      contrast_threshold: 0.7,
      centroid_range: [1000, 3000] as [number, number],
      rms_range: [0.3, 1.0] as [number, number],
      zcr_range: [0.2, 0.5] as [number, number],
      keywords: ['重低音', '扭曲', '下降', '冲击'],
      voiceMax: 0.4,
      percussiveMin: 0.45,
    },

    // Ambient
    ambient: {
      tempo_range: [60, 100] as [number, number],
      flatness_threshold: 0.8,
      contrast_threshold: 0.2,
      centroid_range: [500, 2000] as [number, number],
      rms_range: [0.05, 0.4] as [number, number],
      zcr_range: [0.02, 0.2] as [number, number],
      keywords: ['氛围', '空灵', '缓慢', '冥想'],
      voiceMax: 0.25,
      percussiveMax: 0.35,
      harmonicMin: 0.4,
    },

    // Rock
    rock: {
      tempo_range: [100, 140] as [number, number],
      flatness_threshold: 0.2,
      contrast_threshold: 0.6,
      centroid_range: [2000, 5000] as [number, number],
      rms_range: [0.2, 0.9] as [number, number],
      zcr_range: [0.15, 0.6] as [number, number],
      keywords: ['摇滚', '吉他', '鼓点', '力量'],
      voiceMin: 0.35,
      percussiveMin: 0.4,
      harmonicMin: 0.35,
    },

    // Pop
    pop: {
      tempo_range: [100, 130] as [number, number],
      flatness_threshold: 0.3,
      contrast_threshold: 0.4,
      centroid_range: [2000, 4000] as [number, number],
      rms_range: [0.1, 0.6] as [number, number],
      zcr_range: [0.1, 0.4] as [number, number],
      keywords: ['流行', '旋律', '人声', '节奏'],
      voiceMin: 0.5,
      percussiveMax: 0.55,
    },

    // Jazz
    jazz: {
      tempo_range: [80, 160] as [number, number],
      flatness_threshold: 0.1,
      contrast_threshold: 0.8,
      centroid_range: [1500, 4000] as [number, number],
      rms_range: [0.1, 0.7] as [number, number],
      zcr_range: [0.2, 0.8] as [number, number],
      keywords: ['爵士', '即兴', '复杂', '和谐'],
      voiceMin: 0.2,
      harmonicMin: 0.45,
      percussiveMax: 0.55,
    },

    // Classical
    classical: {
      tempo_range: [60, 180] as [number, number],
      flatness_threshold: 0.1,
      contrast_threshold: 0.9,
      centroid_range: [1000, 5000] as [number, number],
      rms_range: [0.05, 0.8] as [number, number],
      zcr_range: [0.05, 0.4] as [number, number],
      keywords: ['古典', '交响', '优雅', '层次'],
      voiceMax: 0.2,
      harmonicMin: 0.5,
    },

    // Hip-Hop
    hiphop: {
      tempo_range: [80, 120] as [number, number],
      flatness_threshold: 0.4,
      contrast_threshold: 0.5,
      centroid_range: [1000, 3000] as [number, number],
      rms_range: [0.2, 0.8] as [number, number],
      zcr_range: [0.1, 0.5] as [number, number],
      keywords: ['说唱', '节拍', '低音', '律动'],
      voiceMin: 0.3,
      percussiveMin: 0.45,
    },

    // Metal
    metal: {
      tempo_range: [120, 200] as [number, number],
      flatness_threshold: 0.15,
      contrast_threshold: 0.8,
      centroid_range: [2000, 6000] as [number, number],
      rms_range: [0.3, 1.0] as [number, number],
      zcr_range: [0.2, 0.7] as [number, number],
      keywords: ['金属', '重击', '失真', '力量'],
      voiceMin: 0.3,
      percussiveMin: 0.5,
    },
  };

  /**
   * 快速风格检测（<5ms）
   */
  detectStyle(features: FeatureWindow['features']): StyleResult {
    const scores = this.calculateStyleScores(features);
    const bestMatch = this.findBestMatch(scores, features);
    const baseStyle = bestMatch.baseStyle;

    return {
      style: bestMatch.style,
      confidence: bestMatch.confidence,
      talking_points: this.generateTalkingPoints(baseStyle, features, bestMatch.style),
      subgenres: this.detectSubgenres(baseStyle, features),
    };
  }

  /**
   * 计算各风格得分
   */
  private calculateStyleScores(
    features: FeatureWindow['features']
  ): Record<string, number> {
    const scores: Record<string, number> = {};

    for (const [styleName, rules] of Object.entries(this.styleRules)) {
      let score = 0;
      let factors = 0;

      // 节拍匹配 (权重: 0.25)
      if (features.tempo_bpm !== undefined && this.isInRange(features.tempo_bpm, rules.tempo_range)) {
        score += 0.25;
      }
      factors += 0.25;

      // RMS 响度匹配 (权重: 0.2)
      if (this.isInRange(features.rms_mean, rules.rms_range)) {
        score += 0.2;
      }
      factors += 0.2;

      // 频谱质心匹配 (权重: 0.2)
      if (this.isInRange(features.spectralCentroid_mean, rules.centroid_range)) {
        score += 0.2;
      }
      factors += 0.2;

      // 过零率匹配 (权重: 0.15)
      if (this.isInRange(features.zcr_mean, rules.zcr_range)) {
        score += 0.15;
      }
      factors += 0.15;

      // 频谱平坦度 (权重: 0.1)
      if (features.spectralFlatness_mean < rules.flatness_threshold) {
        score += 0.1;
      }
      factors += 0.1;

      // 频谱对比度 (权重: 0.08)
      if (features.spectralContrast_mean && features.spectralContrast_mean[0] > rules.contrast_threshold) {
        score += 0.08;
      }
      factors += 0.08;

      const voice = features.voiceProb_mean ?? 0;
      const percussive = features.percussiveRatio_mean ?? 0;
      const harmonic = features.harmonicRatio_mean ?? 0;

      // 人声存在感 (权重: 0.07)
      if (rules.voiceMin !== undefined || rules.voiceMax !== undefined) {
        let voiceMatch = true;
        if (rules.voiceMin !== undefined && voice < rules.voiceMin) voiceMatch = false;
        if (rules.voiceMax !== undefined && voice > rules.voiceMax) voiceMatch = false;
        if (voiceMatch) {
          score += 0.07;
        }
        factors += 0.07;
      }

      // 打击乐占比 (权重: 0.07)
      if (rules.percussiveMin !== undefined || rules.percussiveMax !== undefined) {
        let percussionMatch = true;
        if (rules.percussiveMin !== undefined && percussive < rules.percussiveMin) percussionMatch = false;
        if (rules.percussiveMax !== undefined && percussive > rules.percussiveMax) percussionMatch = false;
        if (percussionMatch) {
          score += 0.07;
        }
        factors += 0.07;
      }

      // 谐波占比 (权重: 0.07)
      if (rules.harmonicMin !== undefined || rules.harmonicMax !== undefined) {
        let harmonicMatch = true;
        if (rules.harmonicMin !== undefined && harmonic < rules.harmonicMin) harmonicMatch = false;
        if (rules.harmonicMax !== undefined && harmonic > rules.harmonicMax) harmonicMatch = false;
        if (harmonicMatch) {
          score += 0.07;
        }
        factors += 0.07;
      }

      scores[styleName] = factors > 0 ? score / factors : 0;
    }

    return scores;
  }

  /**
   * 找到最佳匹配
   */
  private findBestMatch(
    scores: Record<string, number>,
    features: FeatureWindow['features']
  ): {
    style: string;
    baseStyle: string;
    confidence: number;
  } {
    let bestStyle = 'unknown';
    let bestScore = 0;

    for (const [style, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        bestStyle = style;
      }
    }

    const voice = features.voiceProb_mean ?? 0;
    const percussive = features.percussiveRatio_mean ?? 0;
    const harmonic = features.harmonicRatio_mean ?? 0;

    let resolvedStyle = bestStyle;

    if (bestStyle !== 'unknown') {
      if (voice > 0.6) {
        resolvedStyle = `${bestStyle}_vocal`;
      } else if (voice < 0.2 && (bestStyle === 'pop' || bestStyle === 'edm' || bestStyle === 'trance')) {
        resolvedStyle = `${bestStyle}_instrumental`;
      } else if (percussive > 0.6) {
        resolvedStyle = `${bestStyle}_percussive`;
      } else if (harmonic > 0.6 && (bestStyle === 'ambient' || bestStyle === 'classical')) {
        resolvedStyle = `${bestStyle}_harmonic`;
      }
    }

    return {
      style: resolvedStyle,
      baseStyle: bestStyle,
      confidence: Math.min(1, bestScore * 1.2),
    };
  }

  /**
   * 生成讨论要点
   */
  private generateTalkingPoints(
    style: string,
    features: FeatureWindow['features'],
    resolvedStyle?: string
  ): string[] {
    const points: string[] = [];
    const baseKey = style as keyof typeof this.styleRules;
    const rules = this.styleRules[baseKey];

    if (!rules) return ['风格特征不明显'];

    // 基于节拍
    if (features.tempo_bpm && features.tempo_bpm > 130) {
      points.push('节拍较快，适合舞曲');
    } else if (features.tempo_bpm && features.tempo_bpm < 80) {
      points.push('节拍较慢，氛围感强');
    } else {
      points.push('节拍适中，平衡感好');
    }

    // 基于频谱特征
    if (features.spectralFlatness_mean > 0.5) {
      points.push('频谱平坦，音色稳定');
    } else {
      points.push('频谱变化丰富，层次感强');
    }

    // 基于质心
    if (features.spectralCentroid_mean > 4000) {
      points.push('高频丰富，音色明亮');
    } else if (features.spectralCentroid_mean < 1500) {
      points.push('低频突出，音色厚重');
    } else {
      points.push('频段平衡，音色自然');
    }

    // 基于RMS响度
    if (features.rms_mean > 0.5) {
      points.push('响度较高，能量充沛');
    } else {
      points.push('响度适中，层次清晰');
    }

    // 基于人声/乐器占比
    const voice = features.voiceProb_mean ?? 0;
    if (voice > 0.6) {
      points.push('人声占据主导，情绪表达鲜明');
    } else if (voice < 0.2) {
      points.push('几乎无主唱，更偏向器乐氛围');
    } else {
      points.push('人声与器乐平衡配合');
    }

    const percussive = features.percussiveRatio_mean ?? 0;
    if (percussive > 0.6) {
      points.push('打击乐显著，节奏驱动强烈');
    } else if (percussive < 0.3) {
      points.push('打击乐较弱，更注重铺垫音色');
    }

    // 添加风格特定要点
    points.push(...rules.keywords.slice(0, 2));

    if (resolvedStyle?.includes('_vocal')) {
      points.unshift('突出的人声表现力');
    } else if (resolvedStyle?.includes('_percussive')) {
      points.unshift('节奏骨架强烈，适合舞动');
    } else if (resolvedStyle?.includes('_instrumental')) {
      points.unshift('纯器乐铺陈，氛围延展');
    } else if (resolvedStyle?.includes('_harmonic')) {
      points.unshift('和声堆叠突出，音色饱满');
    }

    return points.slice(0, 4); // 最多4个要点
  }

  /**
   * 检测子风格
   */
  private detectSubgenres(
    style: string,
    features: FeatureWindow['features']
  ): string[] {
    const subgenres: string[] = [];

    switch (style) {
      case 'edm':
        if ((features.voiceProb_mean ?? 0) > 0.55) {
          subgenres.push('Vocal House');
        } else if (features.tempo_bpm > 135) {
          subgenres.push('Progressive House');
        } else {
          subgenres.push('Deep House');
        }
        break;

      case 'techno':
        if ((features.percussiveRatio_mean ?? 0) > 0.65) {
          subgenres.push('Percussive Techno');
        } else if (features.spectralFlatness_mean > 0.5) {
          subgenres.push('Minimal Techno');
        } else {
          subgenres.push('Industrial Techno');
        }
        break;

      case 'rock':
        if ((features.harmonicRatio_mean ?? 0) > 0.55) {
          subgenres.push('Symphonic Rock');
        } else if (features.tempo_bpm && features.tempo_bpm > 120) {
          subgenres.push('Hard Rock');
        } else {
          subgenres.push('Alternative Rock');
        }
        break;

      case 'jazz':
        if ((features.voiceProb_mean ?? 0) > 0.5) {
          subgenres.push('Vocal Jazz');
        } else if (features.spectralContrast_mean && features.spectralContrast_mean.some(c => c > 0.8)) {
          subgenres.push('Free Jazz');
        } else {
          subgenres.push('Smooth Jazz');
        }
        break;

      case 'classical':
        if ((features.voiceProb_mean ?? 0) > 0.3) {
          subgenres.push('Choral Works');
        } else {
          subgenres.push('Symphonic');
        }
        break;

      case 'hiphop':
        if ((features.voiceProb_mean ?? 0) > 0.6) {
          subgenres.push('Rap Vocal');
        } else if (features.tempo_bpm > 100) {
          subgenres.push('Trap');
        } else {
          subgenres.push('Boom Bap');
        }
        break;
    }

    return subgenres;
  }

  /**
   * 检查值是否在范围内
   */
  private isInRange(value: number, range: [number, number]): boolean {
    return value >= range[0] && value <= range[1];
  }

  /**
   * 计算数组均值
   */
  private mean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * 获取所有支持的风格
   */
  getSupportedStyles(): string[] {
    return Object.keys(this.styleRules);
  }

  /**
   * 获取风格描述
   */
  getStyleDescription(style: string): string {
    const base = style.includes('_') ? style.split('_')[0] : style;
    const descriptions: Record<string, string> = {
      edm: '电子舞曲，以合成器和节拍为特色',
      techno: '科技舞曲，工业感和机械律动',
      trance: '迷幻舞曲，梦幻旋律和上升感',
      dubstep: '重低音电子音乐，扭曲和冲击感',
      ambient: '氛围音乐，空灵和冥想感',
      rock: '摇滚音乐，吉他和鼓点的力量感',
      pop: '流行音乐，旋律优美和节奏感',
      jazz: '爵士音乐，即兴和复杂和声',
      classical: '古典音乐，交响和优雅层次',
      hiphop: '嘻哈音乐，低音节奏与说唱表现',
      metal: '金属乐，高能失真与强烈节奏',
    };

    if (style.endsWith('_vocal')) {
      return `${descriptions[base] ?? '未知风格'}（人声主导版）`;
    }
    if (style.endsWith('_instrumental')) {
      return `${descriptions[base] ?? '未知风格'}（器乐版）`;
    }
    if (style.endsWith('_percussive')) {
      return `${descriptions[base] ?? '未知风格'}（打击乐强化）`;
    }
    if (style.endsWith('_harmonic')) {
      return `${descriptions[base] ?? '未知风格'}（和声铺陈）`;
    }

    return descriptions[base] || '未知风格';
  }
}
