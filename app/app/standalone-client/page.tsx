"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import Visualizer from '../../components/visualizer';
import Meyda from 'meyda'; // Import Meyda for real audio feature extraction
// 动态按需加载 TFJS，避免进入首包
let tfNs: any = null;
import { DanmuEngine } from '../../lib/danmu-engine'; // Import DanmuEngine
import { useDanmuPipeline } from '../../hooks/useDanmuPipeline'; // Import LLM Danmu Pipeline

// 派生特征计算函数
function calculateVoiceProbability(f: any): number {
  const flat = typeof f?.spectralFlatness === 'number' ? f.spectralFlatness : 0;
  const centroid = typeof f?.spectralCentroid === 'number' ? f.spectralCentroid : 0;
  
  const flatFactor = Math.max(0, Math.min(1, 1 - flat));
  const centroidNorm = Math.max(0, Math.min(1, (centroid - 1500) / 2500));
  
  return Math.max(0, Math.min(1, 0.35 + 0.4 * flatFactor + 0.25 * centroidNorm));
}

  function calculatePercussiveRatio(f: any): number {
    const flat = typeof f?.spectralFlatness === 'number' ? f.spectralFlatness : 0;
    const flux = 0; // spectralFlux 已移除，使用默认值
  
  const fluxNorm = Math.max(0, Math.min(1, flux * 1.4));
  const flatNorm = Math.max(0, Math.min(1, flat));
  
  return Math.max(0, Math.min(1, 0.45 * fluxNorm + 0.4 * flatNorm));
}

function calculateHarmonicRatio(f: any): number {
  const percussiveRatio = calculatePercussiveRatio(f);
  const voiceProb = calculateVoiceProbability(f);
  
  const base = 1 - percussiveRatio * 0.7;
  const voiceBoost = 0.2 * voiceProb;
  
  return Math.max(0, Math.min(1, base + voiceBoost));
}

// YAMNet 相关函数
async function loadYAMNetModel(): Promise<any | null> {
  const TIMEOUT_MS = 2500;
  const withTimeout = <T,>(p: Promise<T>): Promise<T> => new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('加载超时')), TIMEOUT_MS);
    p.then(v => { clearTimeout(t); resolve(v); }).catch(e => { clearTimeout(t); reject(e); });
  });

  // 动态加载 TFJS 核心（TFLite/GraphModel 都需要）
  try {
    if (!tfNs && typeof window !== 'undefined') {
      tfNs = await withTimeout(import('@tensorflow/tfjs'));
      if (tfNs?.ready) { await tfNs.ready(); }
      console.log('TFJS 已按需加载');
    }
  } catch (e) {
    console.warn('TFJS 加载失败（将依赖启发式/跳过分类）:', e);
  }

  // 1) 优先尝试 TFLite（移动端更稳）
  try {
    console.log('尝试加载 YAMNet (TFLite)...');
    const tfliteNs = await withTimeout(import('@tensorflow/tfjs-tflite'));
    // 关键：为 tfjs-tflite 指定 wasm 资源目录，避免 404/_malloc 报错
    try {
      const setWasmPaths = (tfliteNs as any)?.setWasmPaths;
      const CDN = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-tflite/dist/';
      if (typeof setWasmPaths === 'function') {
        setWasmPaths(CDN);
        console.log('tfjs-tflite wasm 路径已设置为 CDN (module)');
      } else if ((globalThis as any)?.tfjsTflite?.setWasmPaths) {
        (globalThis as any).tfjsTflite.setWasmPaths(CDN);
        console.log('tfjs-tflite wasm 路径已设置为 CDN (global)');
      } else {
        console.warn('tfjs-tflite 未暴露 setWasmPaths，将回退到本地 /tflite/');
        (tfliteNs as any)?.setWasmPaths?.('/tflite/');
      }
    } catch (e) {
      console.warn('设置 tfjs-tflite wasm 路径失败（可忽略）:', e);
    }
    const tfliteModel = await withTimeout((tfliteNs as any).loadTFLiteModel('/model/yamnet_tflite/yamnet.tflite'));
    console.log('YAMNet (TFLite) 加载成功');
    return tfliteModel; // 作为 any 返回，后续以 predict 调用
  } catch (e) {
    console.warn('YAMNet (TFLite) 加载失败，将尝试 TFJS:', e);
  }

  // 2) 回退尝试 TFJS GraphModel（若后续我们提供了 /model/yamnet/model.json）
  try {
    console.log('尝试加载 YAMNet (TFJS GraphModel)...');
    if (!tfNs?.loadGraphModel) throw new Error('TFJS 未就绪');
    const graph = await withTimeout(tfNs.loadGraphModel('/model/yamnet/model.json'));
    console.log('YAMNet (GraphModel) 加载成功');
    return graph;
  } catch (e) {
    console.warn('YAMNet (GraphModel) 加载失败:', e);
  }

  // 3) 最后兼容旧错误路径（大概率失败）
  try {
    console.log('尝试加载 旧路径（不推荐）/model/yamnet.task');
    if (!tfNs?.loadLayersModel) throw new Error('TFJS 未就绪');
    const legacy = await withTimeout(tfNs.loadLayersModel('/model/yamnet.task'));
    console.log('YAMNet 旧路径加载成功（不推荐）');
    return legacy;
  } catch (e) {
    console.warn('旧路径加载失败（预期）:', e);
  }

  console.warn('YAMNet 不可用，继续使用启发式特征（功能不阻塞）。');
  return null;
}

function classifyWithYAMNet(model: any, audioBuffer: Float32Array): any {
  try {
    // YAMNet 需要 16kHz 采样率，0.975 秒的音频 (15600 样本)
    const targetLength = 15600;
    const resampledBuffer = new Float32Array(targetLength);
    
    // 简单的线性插值重采样
    const ratio = audioBuffer.length / targetLength;
    for (let i = 0; i < targetLength; i++) {
      const srcIndex = i * ratio;
      const index = Math.floor(srcIndex);
      const fraction = srcIndex - index;
      
      if (index + 1 < audioBuffer.length) {
        resampledBuffer[i] = audioBuffer[index] * (1 - fraction) + audioBuffer[index + 1] * fraction;
      } else {
        resampledBuffer[i] = audioBuffer[index] || 0;
      }
    }
    
    // 创建输入张量 [1, 15600]
    if (!tfNs?.tensor2d) throw new Error('TFJS 张量 API 不可用');
    const input = tfNs.tensor2d([Array.from(resampledBuffer)], [1, targetLength]);
    
    // 运行推理
    const predictions = model.predict(input);
    const results = predictions.dataSync ? predictions.dataSync() : [];
    
    // 清理张量
    try { input.dispose?.(); } catch(_) {}
    try { predictions.dispose?.(); } catch(_) {}
    
    // 提取前5个最可能的类别
    const topClasses = [] as Array<{ index: number; confidence: number; label: string }>;
    const resultsArray: number[] = Array.from(results as number[]);
    for (let i = 0; i < Math.min(5, resultsArray.length); i++) {
      const maxIndex = resultsArray.indexOf(Math.max(...resultsArray));
      topClasses.push({
        index: maxIndex,
        confidence: resultsArray[maxIndex],
        label: getYAMNetLabel(maxIndex)
      });
      resultsArray[maxIndex] = -1; // 标记为已处理
    }
    
    return {
      topClasses,
      instruments: extractInstruments(topClasses),
      events: extractEvents(topClasses)
    };
  } catch (error) {
    console.error('YAMNet 分类失败:', error);
    return null;
  }
}

function getYAMNetLabel(index: number): string {
  // 简化的 YAMNet 标签映射（实际应该有完整的 521 个标签）
  const labels: { [key: number]: string } = {
    0: 'Speech',
    1: 'Child speech, kid speaking',
    2: 'Conversation',
    3: 'Narration, monologue',
    4: 'Babbling',
    5: 'Speech synthesizer',
    6: 'Shout',
    7: 'Bellow',
    8: 'Whoop',
    9: 'Yell',
    10: 'Children shouting',
    11: 'Screaming',
    12: 'Whispering',
    13: 'Laughter',
    14: 'Baby laughter',
    15: 'Giggle',
    16: 'Snicker',
    17: 'Belly laugh',
    18: 'Chuckle, chortle',
    19: 'Crying, sobbing',
    20: 'Baby cry, infant cry',
    21: 'Whimper',
    22: 'Wail, moan',
    23: 'Sigh',
    24: 'Singing',
    25: 'Choir',
    26: 'Yodeling',
    27: 'Chant',
    28: 'Mantra',
    29: 'Child singing',
    30: 'Synthetic singing',
    31: 'Rapping',
    32: 'Humming',
    33: 'Groan',
    34: 'Grunt',
    35: 'Whistling',
    36: 'Breathing',
    37: 'Wheeze',
    38: 'Snoring',
    39: 'Gasp',
    40: 'Pant',
    41: 'Snort',
    42: 'Cough',
    43: 'Throat clearing',
    44: 'Sneeze',
    45: 'Sniff',
    46: 'Run, footsteps',
    47: 'Shuffle',
    48: 'Walk, footsteps',
    49: 'Chewing, mastication',
    50: 'Biting',
    51: 'Gargling',
    52: 'Stomach rumble',
    53: 'Burping, eructation',
    54: 'Hiccup',
    55: 'Fart',
    56: 'Hands',
    57: 'Finger snapping',
    58: 'Clapping',
    59: 'Heart sounds, heartbeat',
    60: 'Heart murmur',
    61: 'Cheering',
    62: 'Applause',
    63: 'Chatter',
    64: 'Crowd',
    65: 'Hubbub, speech noise, speech babble',
    66: 'Children playing',
    67: 'Animal',
    68: 'Domestic animals, pets',
    69: 'Dog',
    70: 'Bark',
    71: 'Yip',
    72: 'Howl',
    73: 'Bow-wow',
    74: 'Growling',
    75: 'Whimper (dog)',
    76: 'Cat',
    77: 'Meow',
    78: 'Purr',
    79: 'Feline growl',
    80: 'Hiss',
    81: 'Caterwaul',
    82: 'Livestock, farm animals, working animals',
    83: 'Horse',
    84: 'Clip-clop',
    85: 'Neigh, whinny',
    86: 'Cattle, bovinae',
    87: 'Moo',
    88: 'Pig',
    89: 'Oink',
    90: 'Goat',
    91: 'Bleat',
    92: 'Sheep',
    93: 'Fowl',
    94: 'Chicken, rooster',
    95: 'Cluck',
    96: 'Crowing, cock-a-doodle-doo',
    97: 'Turkey',
    98: 'Gobble',
    99: 'Duck',
    100: 'Quack',
    101: 'Goose',
    102: 'Honk',
    103: 'Rooster crowing',
    104: 'Pigeon, dove',
    105: 'Coo',
    106: 'Crow',
    107: 'Caw',
    108: 'Owl',
    109: 'Hoot',
    110: 'Bird',
    111: 'Squawk',
    112: 'Parrot',
    113: 'Chirp, tweet',
    114: 'Singing bird',
    115: 'Chirping bird',
    116: 'Squawk',
    117: 'Pigeon, dove',
    118: 'Crow',
    119: 'Owl',
    120: 'Wild animals',
    121: 'Cicada, chirp',
    122: 'Cricket',
    123: 'Grasshopper',
    124: 'Bee, wasp, etc.',
    125: 'Mosquito',
    126: 'Fly, housefly',
    127: 'Buzz',
    128: 'Frog',
    129: 'Croak',
    130: 'Snake',
    131: 'Rattle',
    132: 'Whale',
    133: 'Dolphin',
    134: 'Seal',
    135: 'Dog',
    136: 'Cat',
    137: 'Horse',
    138: 'Cattle, bovinae',
    139: 'Pig',
    140: 'Goat',
    141: 'Sheep',
    142: 'Chicken, rooster',
    143: 'Turkey',
    144: 'Duck',
    145: 'Goose',
    146: 'Pigeon, dove',
    147: 'Crow',
    148: 'Owl',
    149: 'Bird',
    150: 'Parrot',
    151: 'Cicada, chirp',
    152: 'Cricket',
    153: 'Grasshopper',
    154: 'Bee, wasp, etc.',
    155: 'Mosquito',
    156: 'Fly, housefly',
    157: 'Frog',
    158: 'Snake',
    159: 'Whale',
    160: 'Dolphin',
    161: 'Seal',
    162: 'Music',
    163: 'Musical instrument',
    164: 'Plucked string instrument',
    165: 'Guitar',
    166: 'Electric guitar',
    167: 'Bass guitar',
    168: 'Acoustic guitar',
    169: 'Steel guitar, slide guitar',
    170: 'Tapping (guitar technique)',
    171: 'Strum',
    172: 'Banjo',
    173: 'Sitar',
    174: 'Mandolin',
    175: 'Zither',
    176: 'Ukulele',
    177: 'Keyboard (musical)',
    178: 'Piano',
    179: 'Electric piano',
    180: 'Organ',
    181: 'Electronic organ',
    182: 'Hammond organ',
    183: 'Synthesizer',
    184: 'Sampler',
    185: 'Harpsichord',
    186: 'Percussion',
    187: 'Drum kit',
    188: 'Drum machine',
    189: 'Drum',
    190: 'Snare drum',
    191: 'Rimshot',
    192: 'Drum roll',
    193: 'Bass drum',
    194: 'Timpani',
    195: 'Tabla',
    196: 'Cymbal',
    197: 'Hi-hat',
    198: 'Crash cymbal',
    199: 'Ride cymbal',
    200: 'Splash cymbal',
    201: 'China cymbal',
    202: 'Bell',
    203: 'Jingle bell',
    204: 'Tuning fork',
    205: 'Chime',
    206: 'Wind chime',
    207: 'Change ringing (campanology)',
    208: 'Harmonica',
    209: 'Accordion',
    210: 'Bagpipes',
    211: 'Recorder',
    212: 'Oboe',
    213: 'Clarinet',
    214: 'Saxophone',
    215: 'Bassoon',
    216: 'French horn',
    217: 'Trumpet',
    218: 'Trombone',
    219: 'Tuba',
    220: 'Violin, fiddle',
    221: 'Viola',
    222: 'Cello',
    223: 'Double bass',
    224: 'Contrabassoon',
    225: 'Vibraphone',
    226: 'Xylophone',
    227: 'Marimba',
    228: 'Glockenspiel',
    229: 'Vibraphone',
    230: 'Steelpan',
    231: 'Tambourine',
    232: 'Castanets',
    233: 'Wood block',
    234: 'Claves',
    235: 'Whip',
    236: 'Music box',
    237: 'Kalimba',
    238: 'Bagpipes',
    239: 'Recorder',
    240: 'Oboe',
    241: 'Clarinet',
    242: 'Saxophone',
    243: 'Bassoon',
    244: 'French horn',
    245: 'Trumpet',
    246: 'Trombone',
    247: 'Tuba',
    248: 'Violin, fiddle',
    249: 'Viola',
    250: 'Cello',
    251: 'Double bass',
    252: 'Contrabassoon',
    253: 'Vibraphone',
    254: 'Xylophone',
    255: 'Marimba',
    256: 'Glockenspiel',
    257: 'Vibraphone',
    258: 'Steelpan',
    259: 'Tambourine',
    260: 'Castanets',
    261: 'Wood block',
    262: 'Claves',
    263: 'Whip',
    264: 'Music box',
    265: 'Kalimba',
    266: 'Bagpipes',
    267: 'Recorder',
    268: 'Oboe',
    269: 'Clarinet',
    270: 'Saxophone',
    271: 'Bassoon',
    272: 'French horn',
    273: 'Trumpet',
    274: 'Trombone',
    275: 'Tuba',
    276: 'Violin, fiddle',
    277: 'Viola',
    278: 'Cello',
    279: 'Double bass',
    280: 'Contrabassoon',
    281: 'Vibraphone',
    282: 'Xylophone',
    283: 'Marimba',
    284: 'Glockenspiel',
    285: 'Vibraphone',
    286: 'Steelpan',
    287: 'Tambourine',
    288: 'Castanets',
    289: 'Wood block',
    290: 'Claves',
    291: 'Whip',
    292: 'Music box',
    293: 'Kalimba',
    294: 'Bagpipes',
    295: 'Recorder',
    296: 'Oboe',
    297: 'Clarinet',
    298: 'Saxophone',
    299: 'Bassoon',
    300: 'French horn',
    301: 'Trumpet',
    302: 'Trombone',
    303: 'Tuba',
    304: 'Violin, fiddle',
    305: 'Viola',
    306: 'Cello',
    307: 'Double bass',
    308: 'Contrabassoon',
    309: 'Vibraphone',
    310: 'Xylophone',
    311: 'Marimba',
    312: 'Glockenspiel',
    313: 'Vibraphone',
    314: 'Steelpan',
    315: 'Tambourine',
    316: 'Castanets',
    317: 'Wood block',
    318: 'Claves',
    319: 'Whip',
    320: 'Music box',
    321: 'Kalimba',
    322: 'Bagpipes',
    323: 'Recorder',
    324: 'Oboe',
    325: 'Clarinet',
    326: 'Saxophone',
    327: 'Bassoon',
    328: 'French horn',
    329: 'Trumpet',
    330: 'Trombone',
    331: 'Tuba',
    332: 'Violin, fiddle',
    333: 'Viola',
    334: 'Cello',
    335: 'Double bass',
    336: 'Contrabassoon',
    337: 'Vibraphone',
    338: 'Xylophone',
    339: 'Marimba',
    340: 'Glockenspiel',
    341: 'Vibraphone',
    342: 'Steelpan',
    343: 'Tambourine',
    344: 'Castanets',
    345: 'Wood block',
    346: 'Claves',
    347: 'Whip',
    348: 'Music box',
    349: 'Kalimba',
    350: 'Bagpipes',
    351: 'Recorder',
    352: 'Oboe',
    353: 'Clarinet',
    354: 'Saxophone',
    355: 'Bassoon',
    356: 'French horn',
    357: 'Trumpet',
    358: 'Trombone',
    359: 'Tuba',
    360: 'Violin, fiddle',
    361: 'Viola',
    362: 'Cello',
    363: 'Double bass',
    364: 'Contrabassoon',
    365: 'Vibraphone',
    366: 'Xylophone',
    367: 'Marimba',
    368: 'Glockenspiel',
    369: 'Vibraphone',
    370: 'Steelpan',
    371: 'Tambourine',
    372: 'Castanets',
    373: 'Wood block',
    374: 'Claves',
    375: 'Whip',
    376: 'Music box',
    377: 'Kalimba',
    378: 'Bagpipes',
    379: 'Recorder',
    380: 'Oboe',
    381: 'Clarinet',
    382: 'Saxophone',
    383: 'Bassoon',
    384: 'French horn',
    385: 'Trumpet',
    386: 'Trombone',
    387: 'Tuba',
    388: 'Violin, fiddle',
    389: 'Viola',
    390: 'Cello',
    391: 'Double bass',
    392: 'Contrabassoon',
    393: 'Vibraphone',
    394: 'Xylophone',
    395: 'Marimba',
    396: 'Glockenspiel',
    397: 'Vibraphone',
    398: 'Steelpan',
    399: 'Tambourine',
    400: 'Castanets',
    401: 'Wood block',
    402: 'Claves',
    403: 'Whip',
    404: 'Music box',
    405: 'Kalimba',
    406: 'Recorder',
    407: 'Oboe',
    408: 'Clarinet',
    409: 'Saxophone',
    410: 'Bassoon',
    411: 'French horn',
    412: 'Trumpet',
    413: 'Trombone',
    414: 'Tuba',
    415: 'Violin, fiddle',
    416: 'Viola',
    417: 'Cello',
    418: 'Double bass',
    419: 'Contrabassoon',
    420: 'Vibraphone',
    421: 'Xylophone',
    422: 'Marimba',
    423: 'Glockenspiel',
    424: 'Vibraphone',
    425: 'Steelpan',
    426: 'Tambourine',
    427: 'Castanets',
    428: 'Wood block',
    429: 'Claves',
    430: 'Whip',
    431: 'Music box',
    432: 'Kalimba',
    433: 'Bagpipes',
    434: 'Recorder',
    435: 'Oboe',
    436: 'Clarinet',
    437: 'Saxophone',
    438: 'Bassoon',
    439: 'French horn',
    440: 'Trumpet',
    441: 'Trombone',
    442: 'Tuba',
    443: 'Violin, fiddle',
    444: 'Viola',
    445: 'Cello',
    446: 'Double bass',
    447: 'Contrabassoon',
    448: 'Vibraphone',
    449: 'Xylophone',
    450: 'Marimba',
    451: 'Glockenspiel',
    452: 'Vibraphone',
    453: 'Steelpan',
    454: 'Tambourine',
    455: 'Castanets',
    456: 'Wood block',
    457: 'Claves',
    458: 'Whip',
    459: 'Music box',
    460: 'Kalimba',
    461: 'Bagpipes',
    462: 'Recorder',
    463: 'Oboe',
    464: 'Clarinet',
    465: 'Saxophone',
    466: 'Bassoon',
    467: 'French horn',
    468: 'Trumpet',
    469: 'Trombone',
    470: 'Tuba',
    471: 'Violin, fiddle',
    472: 'Viola',
    473: 'Cello',
    474: 'Double bass',
    475: 'Contrabassoon',
    476: 'Vibraphone',
    477: 'Xylophone',
    478: 'Marimba',
    479: 'Glockenspiel',
    480: 'Vibraphone',
    481: 'Steelpan',
    482: 'Tambourine',
    483: 'Castanets',
    484: 'Wood block',
    485: 'Claves',
    486: 'Whip',
    487: 'Music box',
    488: 'Kalimba',
    489: 'Bagpipes',
    490: 'Recorder',
    491: 'Oboe',
    492: 'Clarinet',
    493: 'Saxophone',
    494: 'Bassoon',
    495: 'French horn',
    496: 'Trumpet',
    497: 'Trombone',
    498: 'Tuba',
    499: 'Violin, fiddle',
    500: 'Viola',
    501: 'Cello',
    502: 'Double bass',
    503: 'Contrabassoon',
    504: 'Vibraphone',
    505: 'Xylophone',
    506: 'Marimba',
    507: 'Glockenspiel',
    508: 'Vibraphone',
    509: 'Steelpan',
    510: 'Tambourine',
    511: 'Castanets',
    512: 'Wood block',
    513: 'Claves',
    514: 'Whip',
    515: 'Music box',
    516: 'Kalimba',
    517: 'Bagpipes',
    518: 'Recorder',
    519: 'Oboe',
    520: 'Clarinet',
    521: 'Saxophone'
  };
  
  return labels[index] || `Unknown (${index})`;
}

function extractInstruments(topClasses: any[]): string[] {
  const instrumentKeywords = [
    'guitar', 'piano', 'violin', 'drum', 'bass', 'saxophone', 'trumpet', 'flute',
    'clarinet', 'oboe', 'bassoon', 'trombone', 'tuba', 'organ', 'synthesizer',
    'harmonica', 'accordion', 'bagpipes', 'recorder', 'cello', 'viola', 'double bass',
    'vibraphone', 'xylophone', 'marimba', 'glockenspiel', 'steelpan', 'tambourine',
    'castanets', 'wood block', 'claves', 'whip', 'music box', 'kalimba'
  ];
  
  return topClasses
    .filter(cls => instrumentKeywords.some(keyword => 
      cls.label.toLowerCase().includes(keyword)
    ))
    .map(cls => cls.label);
}

function extractEvents(topClasses: any[]): string[] {
  const eventKeywords = [
    'speech', 'singing', 'laughter', 'crying', 'applause', 'cheering', 'clapping',
    'footsteps', 'breathing', 'coughing', 'sneezing', 'snoring', 'whistling',
    'animal', 'bird', 'dog', 'cat', 'horse', 'cow', 'pig', 'chicken', 'duck'
  ];
  
  return topClasses
    .filter(cls => eventKeywords.some(keyword => 
      cls.label.toLowerCase().includes(keyword)
    ))
    .map(cls => cls.label);
}

// 弹幕生成函数
function generateDanmuMessage(features: any, yamnetResults: any): string {
  const messages = [];
  
  // 基于音频特征生成弹幕
  if (features) {
    const { rms, spectralCentroid, zcr, voiceProb, percussiveRatio, harmonicRatio } = features;
    
    // 音量相关
    if (rms > 0.7) {
      messages.push('音量很大！', '很有力量！', '震撼！');
    } else if (rms > 0.4) {
      messages.push('音量适中', '听起来不错', '很好听');
    } else if (rms > 0.1) {
      messages.push('音量较小', '很轻柔', '安静的感觉');
    }
    
    // 音色相关
    if (spectralCentroid > 2000) {
      messages.push('音色很亮', '高音很清晰', '很清脆');
    } else if (spectralCentroid < 800) {
      messages.push('音色很暖', '低音很丰富', '很温暖');
    }
    
    // 人声相关
    if (voiceProb > 0.7) {
      messages.push('人声很清晰', '唱得很好', '声音很棒');
    } else if (voiceProb < 0.3) {
      messages.push('纯音乐', '没有歌词', '器乐演奏');
    }
    
    // 节奏相关
    if (percussiveRatio > 0.6) {
      messages.push('节奏感很强', '很有节拍', '很动感');
    } else if (harmonicRatio > 0.6) {
      messages.push('和声很美', '很和谐', '旋律优美');
    }
  }
  
  // 基于YAMNet分类生成弹幕
  if (yamnetResults && yamnetResults.instruments.length > 0) {
    const instruments = yamnetResults.instruments;
    if (instruments.some((inst: string) => inst.toLowerCase().includes('guitar'))) {
      messages.push('吉他很好听', '吉他演奏很棒', '喜欢这个吉他');
    }
    if (instruments.some((inst: string) => inst.toLowerCase().includes('piano'))) {
      messages.push('钢琴很优美', '钢琴演奏很棒', '喜欢这个钢琴');
    }
    if (instruments.some((inst: string) => inst.toLowerCase().includes('drum'))) {
      messages.push('鼓点很棒', '节奏很好', '很有节拍感');
    }
    if (instruments.some((inst: string) => inst.toLowerCase().includes('violin'))) {
      messages.push('小提琴很优美', '弦乐很棒', '很优雅');
    }
  }
  
  // 基于事件生成弹幕
  if (yamnetResults && yamnetResults.events.length > 0) {
    const events = yamnetResults.events;
    if (events.some((event: string) => event.toLowerCase().includes('singing'))) {
      messages.push('唱得很好', '歌声很美', '很有感情');
    }
    if (events.some((event: string) => event.toLowerCase().includes('applause'))) {
      messages.push('掌声！', '太棒了！', '精彩！');
    }
  }
  
  // 默认弹幕
  if (messages.length === 0) {
    messages.push('很好听', '不错', '很棒', '喜欢这个', '继续播放');
  }
  
  // 随机选择一个消息
  return messages[Math.floor(Math.random() * messages.length)];
}

// 字素簇拆分函数 - 支持中文、emoji等复杂字符
function segmentGraphemes(input: string): string[] {
  try {
    if ((Intl as any)?.Segmenter) {
      const seg = new (Intl as any).Segmenter(undefined, { granularity: 'grapheme' });
      return Array.from(seg.segment(input), (s: any) => s.segment);
    }
  } catch (_) {
    // 降级方案：简单字符拆分
  }
  return Array.from(input);
}

// FlipOption 组件
interface FlipOptionProps {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  density?: 'compact' | 'normal' | 'spacious';
  animation?: 'auto' | 'reduced' | 'off';
  className?: string;
}

const FlipOption: React.FC<FlipOptionProps> = ({
  label,
  selected = false,
  disabled = false,
  onSelect,
  density = 'normal',
  animation = 'auto',
  className = ''
}) => {
  const handleClick = useCallback(() => {
    if (!disabled && onSelect) {
      onSelect();
    }
  }, [disabled, onSelect]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }, [handleClick]);

  const sizeClasses = {
    compact: 'text-xl sm:text-2xl',
    normal: 'text-2xl sm:text-4xl md:text-6xl',
    spacious: 'text-4xl sm:text-6xl md:text-8xl'
  };

  const colorClasses = selected 
    ? 'text-cyan-400 group-hover:text-cyan-300' 
    : 'text-purple-400 group-hover:text-purple-300';

  const disabledClasses = disabled 
    ? 'opacity-50 cursor-not-allowed' 
    : 'cursor-pointer';

  const graphemes = segmentGraphemes(label);
  const centerIndex = (graphemes.length - 1) / 2;

  return (
    <button
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      className={`
        group relative block overflow-hidden whitespace-nowrap
        ${sizeClasses[density]}
        ${colorClasses}
        ${disabledClasses}
        font-black uppercase
        focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-black
        min-h-[44px] min-w-[44px]
        ${className}
      `}
      style={{
        lineHeight: 0.75,
      }}
      role="option"
      aria-selected={selected}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
    >
      {/* 上层文字 - 悬停时向上移动 */}
      <div className="flex">
        {graphemes.map((grapheme, i) => (
          <span
            key={`top-${i}`}
            className={`inline-block transition-transform duration-300 ease-in-out group-hover:-translate-y-[110%] ${selected ? '-translate-y-[180%] opacity-0' : ''}`}
            style={{
              transitionDelay: `${Math.abs(i - centerIndex) * 25}ms`,
            }}
          >
            {grapheme}
          </span>
        ))}
      </div>
      
      {/* 下层文字 - 悬停时从下方滑入 */}
      <div className="absolute inset-0 flex">
        {graphemes.map((grapheme, i) => (
          <span
            key={`bottom-${i}`}
            className={`inline-block transition-transform duration-300 ease-in-out translate-y-[180%] group-hover:translate-y-0 opacity-0 group-hover:opacity-100 ${selected ? 'translate-y-0 opacity-100' : 'pointer-events-none'}`}
            style={{
              transitionDelay: `${Math.abs(i - centerIndex) * 25}ms`,
            }}
          >
            {grapheme}
          </span>
        ))}
      </div>

      {/* 选中状态指示器 */}
      {selected && (
        <div className="absolute -bottom-1 left-0 right-0 h-1 bg-cyan-400 rounded-full" />
      )}
    </button>
  );
};

// 预设选项配置（移动端使用两字母缩写展示）
const PRESET_OPTIONS = [
  { id: 'wave', label: 'Wave', abbrMobile: 'WA' },
  { id: 'accretion', label: 'Accretion', abbrMobile: 'AC' },
  { id: 'spiral', label: 'Spiral', abbrMobile: 'SP' },
  { id: 'mosaic', label: 'Mosaic', abbrMobile: 'MO' }
];

export default function StandaloneClient() {
  // 状态管理
  const [currentPreset, setCurrentPreset] = useState<string>('wave');
  const [animationMode, setAnimationMode] = useState<'auto' | 'reduced' | 'off'>('auto');
  const [isRunning, setIsRunning] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [features, setFeatures] = useState(null);
  const [sensitivity, setSensitivity] = useState(1.5);
  const [yamnetResults, setYamnetResults] = useState(null); // YAMNet classification results
  const [danmuEnabled, setDanmuEnabled] = useState(false); // Danmu toggle state
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false); // Microphone toggle state
  const [spectrumPriority, setSpectrumPriority] = useState(() => {
    try {
      const env = (process as any)?.env || (window as any)?.process?.env || {};
      const v = env.NEXT_PUBLIC_SPECTRUM_PRIORITY;
      return String(v ?? 'true') !== 'false';
    } catch (_) { return true; }
  }); // 频谱优先模式（env 可覆盖）
  
  // LLM弹幕管线集成
  const danmuPipeline = useDanmuPipeline({
    autoStart: false, // 手动控制启动
    useSimple: false, // 使用增强版管线（完整LLM功能）
    // 调整为每次生成5条基础弹幕（鼓励/陪伴型额外在管线内追加1-2条）
    needComments: 5, // 每次生成5条弹幕
    locale: 'zh-CN',
    minIntervalMs: 3000, // 最小间隔3秒
    maxConcurrency: 1, // 最大并发1个请求
    rmsThreshold: 0.01, // RMS阈值
    requireStability: true, // 需要稳定性检测
    stabilityWindowMs: 2000, // 稳定性窗口2秒
    stabilityConfidence: 0.4, // 稳定性置信度
  });
  
  // 使用 useRef 来确保异步回调能够访问到最新的弹幕管线状态
  const danmuPipelineRef = useRef(danmuPipeline);
  danmuPipelineRef.current = danmuPipeline;
  
  // 调试面板显示：避免 SSR/CSR 初始不一致，挂载后再决定
  const [debugVisible, setDebugVisible] = useState<boolean>(false);
  const [debugInfo, setDebugInfo] = useState<{ ctxState: string; sampleRate: number; hasStream: boolean; hasAnalyser: boolean; rms: number; maxAbs: number; zeroCount: number; lastSamples: number[]; isSecure: boolean; hasMedia: boolean; micPermission: string; lastError?: string }>({
    ctxState: 'unknown', sampleRate: 0, hasStream: false, hasAnalyser: false, rms: 0, maxAbs: 0, zeroCount: 0, lastSamples: [],
    isSecure: typeof window !== 'undefined' ? !!(window as any).isSecureContext : false,
    hasMedia: typeof navigator !== 'undefined' ? !!navigator.mediaDevices : false,
    micPermission: 'unknown'
  });
  // 调试面板长按触发引用
  const longPressTimerRef = useRef<number | null>(null);
  const longPressStartRef = useRef<number>(0);
  const [embedInfo, setEmbedInfo] = useState<{ inIframe: boolean; policyMicrophone?: string; policyCamera?: string }>({ inIframe: false });
  // 一次性启动标记，避免重复触发
  const micStartedRef = useRef<boolean>(false);
  
  // 音频处理引用
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const meydaAnalyzerRef = useRef<any | null>(null); // Meyda analyzer reference
  const yamnetModelRef = useRef<any | null>(null); // YAMNet model reference（动态加载 TFJS 后统一 any）
  const yamnetBufferRef = useRef<Float32Array | null>(null); // Audio buffer for YAMNet
  // 轻量 BPM 状态：基于 onset 间隔的滑窗估计
  const bpmStateRef = useRef<{ lastOnsetSec: number; intervals: number[]; bpm: number; confidence: number }>({
    lastOnsetSec: 0,
    intervals: [],
    bpm: 0,
    confidence: 0,
  });
  // 频谱列平滑缓存
  const bandColumnsRef = useRef<number[] | null>(null);
  // MEL 频谱配置与历史
  const melConfigRef = useRef<{ binMap: number[]; cols: number; minHz: number; maxHz: number } | null>(null);
  const spectrumHistoryRef = useRef<Array<{
    level: { instant: number; slow: number };
    bands: { low: { instant: number; slow: number }; mid: { instant: number; slow: number }; high: { instant: number; slow: number } };
    columns: Float32Array;
    columnsSmooth: Float32Array;
  }>>([]);
  const spectrumStateRef = useRef<{
    levelSlow: number;
    lowSlow: number; midSlow: number; highSlow: number;
    columnsSlow?: Float32Array;
  }>({ levelSlow: 0, lowSlow: 0, midSlow: 0, highSlow: 0 });
  // FPS 自适应
  const fpsStateRef = useRef<{ lastTs: number; frames: number; fps: number }>({ lastTs: (typeof performance !== 'undefined' ? performance.now() : Date.now()), frames: 0, fps: 60 });
  const melDesiredColsRef = useRef<number | null>(null);
  const spectrumUpdateDividerRef = useRef<number>(1);
  // 节拍相位同步
  const tempoPhaseRef = useRef<{ phase: number; lastTime: number }>({ phase: 0, lastTime: 0 });
  // 轻量音高与起音检测状态
  const pitchStateRef = useRef<{ lastHz: number; smoothHz: number; confidence: number; frame: number }>({ lastHz: 0, smoothHz: 0, confidence: 0, frame: 0 });
  const onsetStateRef = useRef<{ armed: boolean; lastOnsetSec: number }>({ armed: true, lastOnsetSec: 0 });

  // 切换弹幕开关
  const toggleDanmu = useCallback((next?: boolean) => {
    try {
      const enable = typeof next === 'boolean' ? next : !danmuEnabled;
      setDanmuEnabled(enable);

      const currentPipeline = danmuPipelineRef.current;
      if (currentPipeline.isReady) {
        if (enable) {
          currentPipeline.start();
          console.log('🎵 LLM弹幕管线已启动');
        } else {
          currentPipeline.stop();
          console.log('🎵 LLM弹幕管线已停止');
          // 清理屏幕上已有弹幕元素
          const container = document.getElementById('danmu-container');
          if (container) {
            try {
              container.innerHTML = '';
            } catch (_) {}
          }
        }
      } else {
        console.log('🎵 LLM弹幕管线未就绪，等待初始化完成...');
        // 等待弹幕管线初始化完成
        let attempts = 0;
        const maxAttempts = 50; // 最多等待5秒
        const checkReady = () => {
          attempts++;
          // 使用 ref 获取最新状态
          const currentPipeline = danmuPipelineRef.current;
          console.log(`🎵 检查弹幕管线状态 (${attempts}/${maxAttempts}):`, {
            isReady: currentPipeline.isReady,
            isActive: currentPipeline.isActive,
            danmuCount: currentPipeline.danmuCount
          });
          
          if (currentPipeline.isReady || currentPipeline.isActive) {
            if (enable && !currentPipeline.isActive) {
              currentPipeline.start();
              console.log('🎵 LLM弹幕管线已启动（延迟启动）');
            } else if (currentPipeline.isActive) {
              console.log('🎵 LLM弹幕管线已经启动，无需重复启动');
            }
            // 找到状态，退出检查
            return;
          } else if (attempts < maxAttempts) {
            // 继续等待
            setTimeout(checkReady, 100);
          } else {
            console.warn('🎵 弹幕管线初始化超时，无法启动');
          }
        };
        setTimeout(checkReady, 100);
      }
    } catch (err) {
      console.warn('切换LLM弹幕失败:', err);
    }
  }, [danmuEnabled, danmuPipeline]);

  // 当弹幕管线初始化完成且弹幕开关开启时，自动启动
  useEffect(() => {
    const currentPipeline = danmuPipelineRef.current;
    if (currentPipeline.isReady && danmuEnabled && !currentPipeline.isActive) {
      console.log('🎵 弹幕管线初始化完成，自动启动...');
      currentPipeline.start();
    } else if (currentPipeline.isActive) {
      console.log('🎵 弹幕管线已经启动，无需重复启动');
    }
  }, [danmuPipeline.isReady, danmuEnabled, danmuPipeline.isActive]);

  // 检测用户偏好
  useEffect(() => {
    const mediaQuery = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    if (mediaQuery && mediaQuery.matches) {
      setAnimationMode('reduced');
    }
    
    if (mediaQuery) {
      const handleChange = (e: MediaQueryListEvent) => {
        setAnimationMode(e.matches ? 'reduced' : 'auto');
      };
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, []);

  // 音频分析循环 - 使用Meyda进行真实特征提取
  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.fftSize;
    const timeDomainData = new Float32Array(bufferLength);

    // 使用时域数据计算 RMS 与峰值
    analyser.getFloatTimeDomainData(timeDomainData);

    let sumSquares = 0;
    let maxAbs = 0;
    let minVal = 1;
    let maxVal = -1;
    let zeroCount = 0;

    for (let i = 0; i < bufferLength; i++) {
      const sample = timeDomainData[i]; // [-1, 1]
      if (sample === 0) zeroCount++;
      sumSquares += sample * sample;
      if (sample > maxVal) maxVal = sample;
      if (sample < minVal) minVal = sample;
      const abs = Math.abs(sample);
      if (abs > maxAbs) maxAbs = abs;
    }

    const rms = Math.sqrt(sumSquares / bufferLength); // [0, 1]
    let normalizedLevel = Math.min(Math.max(rms, 0), 1);

    // 调试信息：检查是否所有值都是0
    if (zeroCount === bufferLength) {
      console.warn('⚠️ 音频数据全为零 - 可能音频流未正确连接');
      const sampleValues = Array.from(timeDomainData.slice(0, 10));
      console.log('前10个音频样本值:', sampleValues);
    }

    setAudioLevel(normalizedLevel);
    // 低频率更新调试面板，避免高频 setState 造成性能问题
    try {
      if (Math.random() < 0.1) {
        setDebugInfo(prev => ({
          ...prev,
          ctxState: audioContextRef.current?.state || 'unknown',
          sampleRate: audioContextRef.current?.sampleRate || 0,
          hasStream: !!streamRef.current,
          hasAnalyser: !!analyserRef.current,
          rms,
          maxAbs,
          zeroCount,
          lastSamples: Array.from(timeDomainData.slice(0, 8))
        }));
      }
    } catch (e) {
      console.warn('更新调试信息失败:', e);
    }
    
    // 调试日志 - 每100帧输出一次
    if (Math.random() < 0.01) {
      console.log('音频级别:', normalizedLevel.toFixed(3), 'RMS:', rms.toFixed(3), 'MaxAbs:', maxAbs.toFixed(3), 'ZeroCount:', zeroCount, 'BufferLength:', bufferLength);
    }
    
    // 继续循环
    animationFrameRef.current = requestAnimationFrame(analyzeAudio);
  }, []);

  // 启动音频处理 - 参考主页面的实现
  const startAudioProcessing = useCallback(async () => {
    try {
      console.log('请求麦克风权限...');

      // 获取麦克风权限
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          }
        });
      } catch (primaryErr) {
        console.warn('带约束的 getUserMedia 失败，退化为 audio: true', primaryErr);
        // 某些移动端浏览器不支持上述约束，回退为最简约束
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (fallbackErr) {
          try { setDebugInfo(prev => ({ ...prev, lastError: String(fallbackErr) })); } catch (_) {}
          throw fallbackErr;
        }
      }

      console.log('创建音频上下文...');

      // 创建音频上下文
      // 在 iOS/Safari 上，AudioContext 需要在用户手势后 resume
      const AudioContextCtor = typeof window !== 'undefined' ? ((window as any).AudioContext || (window as any).webkitAudioContext) : null;
      if (!AudioContextCtor) {
        throw new Error('AudioContext not supported');
      }
      const audioContext = new AudioContextCtor({ latencyHint: 'interactive' });
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream!);
      sourceRef.current = source;

      // 配置分析器 - 使用与主页面相同的配置
      analyser.fftSize = 2048; // 与主页面一致
      analyser.smoothingTimeConstant = 0.5; // 与主页面一致

      // 连接音频节点
      source.connect(analyser);
      // 为避免 Safari 在未连向输出时优化掉音频图（导致数据全 0），
      // 我们将 analyser 通过 0 增益的 GainNode 接到 destination，
      // 不产生回放但保持音频图活跃。
      try {
        const silentGain = audioContext.createGain();
        silentGain.gain.value = 0;
        analyser.connect(silentGain);
        silentGain.connect(audioContext.destination);
        gainRef.current = silentGain;
      } catch (chainErr) {
        console.warn('连接静音增益节点失败（可忽略）:', chainErr);
      }
      
      // 调试：检查连接状态
      console.log('音频节点连接状态:', {
        sourceConnected: source.context.state,
        analyserConnected: analyser.context.state,
        analyserFftSize: analyser.fftSize,
        analyserFrequencyBinCount: analyser.frequencyBinCount
      });

      // 确保音频上下文运行
      try {
        if (audioContext.state !== 'running') {
          await audioContext.resume();
          console.log('AudioContext 已恢复:', audioContext.state);
        }
        console.log('AudioContext 状态:', audioContext.state);
        console.log('AudioContext 采样率:', audioContext.sampleRate);
      } catch (resumeErr) {
        console.warn('AudioContext 恢复失败（可能需要用户手势）:', resumeErr);
      }

      // 启用音轨
      try {
        stream.getAudioTracks().forEach(track => {
          console.log('音轨状态:', {
            enabled: track.enabled,
            muted: track.muted,
            readyState: track.readyState,
            label: track.label
          });
          if (!track.enabled) track.enabled = true;
        });
      } catch (e) {
        console.warn('无法设置音轨启用状态:', e);
      }

      // 保存引用
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
      streamRef.current = stream!;

      console.log('开始音频分析...');

      // 初始化LLM弹幕管线
      try {
        console.log('初始化LLM弹幕管线...');
        if (danmuEnabled) {
          // 如果弹幕启用，直接启动，让管线内部处理初始化
          danmuPipelineRef.current.start();
          console.log('LLM弹幕管线启动命令已发送');
        } else {
          console.log('LLM弹幕管线已准备（等待启动）');
        }
      } catch (e) {
        console.warn('LLM弹幕管线初始化失败:', e);
      }

      // 初始化 YAMNet 模型（仅在显式开启内联加载时）
      try {
        const env = (process as any)?.env || (window as any)?.process?.env || {};
        const inlineYamnet = String(env.NEXT_PUBLIC_INLINE_YAMNET ?? 'false') === 'true';
        if (inlineYamnet) {
          if (!yamnetModelRef.current) {
            console.log('加载 YAMNet 模型...');
            yamnetModelRef.current = await loadYAMNetModel();
            if (yamnetModelRef.current) {
              console.log('YAMNet 模型加载成功');
              // 初始化音频缓冲区
              yamnetBufferRef.current = new Float32Array(15600); // YAMNet 需要的缓冲区大小
            }
          }
        } else {
          console.log('跳过内联 YAMNet 加载（由 Worker 负责分类，或未启用）。');
        }
      } catch (e) {
        console.warn('YAMNet 模型加载失败:', e);
      }

      // 初始化 Meyda 特征提取
      try {
        // 环境开关：禁用新频谱管线时，跳过 Meyda/Mel 频谱（回退老方案）
        const spectrumEnabled = (() => {
          try {
            const env = (process as any)?.env || (window as any)?.process?.env || {};
            const e = env.NEXT_PUBLIC_SPECTRUM_ENABLED;
            const f = env.NEXT_PUBLIC_SPECTRUM_FALLBACK;
            if (String(f ?? 'false') === 'true') return false;
            return String(e ?? 'true') !== 'false';
          } catch (_) { return true; }
        })();

        console.log('🎵 检查 Meyda 初始化条件:', {
          spectrumEnabled,
          hasMeyda: !!Meyda,
          isBrowser: (Meyda as any)?.isBrowser,
          meydaVersion: (Meyda as any)?.version
        });

        console.log('🎵 检查 Meyda 初始化条件:', {
          spectrumEnabled,
          hasMeyda: !!Meyda,
          isBrowser: (Meyda as any)?.isBrowser,
          meydaVersion: (Meyda as any)?.version
        });

        if (spectrumEnabled && Meyda && typeof window !== 'undefined') {
          console.log('🎵 初始化 Meyda 特征提取...');
          console.log('🎵 Meyda 版本:', (Meyda as any).version);
          console.log('🎵 支持的特征:', Object.keys(Meyda.featureExtractors));
          meydaAnalyzerRef.current = Meyda.createMeydaAnalyzer({
            audioContext,
            source,
            bufferSize: 1024,
            featureExtractors: [
              'rms',
              'spectralCentroid',
              'zcr',
              'mfcc',
              'spectralFlatness',
              'chroma',
              'spectralRolloff',
              'spectralSpread',
              'spectralSkewness',
              'spectralKurtosis',
              'loudness',
              'perceptualSpread',
              'perceptualSharpness',
            ],
            callback: (f: any) => {
              console.log('🎵 Meyda 回调被调用:', f);
              try {
                // 健壮性检查：确保 Meyda 返回了有效数据
                if (!f || typeof f !== 'object') {
                  console.warn('🎵 Meyda 回调: 无效的特征数据', f);
                  return;
                }
                
                // 处理 Meyda 特征数据
                const processedFeatures = {
                  rms: typeof f.rms === 'number' ? f.rms : 0,
                  spectralCentroid: typeof f.spectralCentroid === 'number' ? f.spectralCentroid : 0,
                  zcr: typeof f.zcr === 'number' ? f.zcr : 0,
                  mfcc: Array.isArray(f.mfcc) ? f.mfcc : [],
                  spectralFlatness: typeof f.spectralFlatness === 'number' ? f.spectralFlatness : 0,
                  chroma: Array.isArray(f.chroma) ? f.chroma : [],
                  // Mock spectralContrast 实现
                  spectralContrast: Array.isArray(f.chroma) ? f.chroma.slice(0, 12).map((c: number) => Math.max(0, Math.min(1, c))) : new Array(12).fill(0),
                  // Mock spectralBandwidth 实现
                  spectralBandwidth: typeof f.spectralSpread === 'number' ? Math.max(0, Math.min(1, f.spectralSpread / 1000)) : 0,
                  spectralRolloff: typeof f.spectralRolloff === 'number' ? f.spectralRolloff : 0,
                  spectralSpread: typeof f.spectralSpread === 'number' ? f.spectralSpread : 0,
                  spectralSkewness: typeof f.spectralSkewness === 'number' ? f.spectralSkewness : 0,
                  spectralKurtosis: typeof f.spectralKurtosis === 'number' ? f.spectralKurtosis : 0,
                  loudness: typeof f.loudness === 'number' ? f.loudness : 0,
                  perceptualSpread: typeof f.perceptualSpread === 'number' ? f.perceptualSpread : 0,
                  perceptualSharpness: typeof f.perceptualSharpness === 'number' ? f.perceptualSharpness : 0,
                  // 计算派生特征
                  voiceProb: calculateVoiceProbability(f),
                  percussiveRatio: calculatePercussiveRatio(f),
                  harmonicRatio: calculateHarmonicRatio(f)
                } as any;

                // 频谱三段能量（低/中/高）用于频谱优先映射
                try {
                  const analyser = analyserRef.current;
                  const audioCtx = audioContextRef.current;
                  if (analyser && audioCtx) {
                    // FPS 统计
                    try {
                      fpsStateRef.current.frames += 1;
                      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
                      if (now - fpsStateRef.current.lastTs >= 1000) {
                        fpsStateRef.current.fps = fpsStateRef.current.frames * 1000 / Math.max(1, now - fpsStateRef.current.lastTs);
                        fpsStateRef.current.frames = 0;
                        fpsStateRef.current.lastTs = now;
                        // 自适应降档（移动端），低于45fps降列数与更新频率
                        const isMobileUA = /Mobile|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
                        if (isMobileUA && fpsStateRef.current.fps < 45) {
                          melDesiredColsRef.current = 32;
                          spectrumUpdateDividerRef.current = 2; // 每2帧更新一次频谱
                          // 强制下次重建映射
                          melConfigRef.current = null;
                        } else if (isMobileUA && fpsStateRef.current.fps >= 55) {
                          melDesiredColsRef.current = 48;
                          spectrumUpdateDividerRef.current = 1;
                          melConfigRef.current = null;
                        }
                      }
                    } catch (_) {}

                    // 跳帧更新：降低频谱计算频率以保帧
                    if (spectrumUpdateDividerRef.current > 1) {
                      const skip = Math.floor((Math.random() * spectrumUpdateDividerRef.current));
                      if (skip > 0) {
                        // 仍然回填上一次 slow 值，维持可用
                        (processedFeatures as any).bandLow = spectrumStateRef.current.lowSlow;
                        (processedFeatures as any).bandMid = spectrumStateRef.current.midSlow;
                        (processedFeatures as any).bandHigh = spectrumStateRef.current.highSlow;
                        (processedFeatures as any).bandColumns = Array.from(spectrumStateRef.current.columnsSlow || []);
                        throw 'skip_update';
                      }
                    }

                    const binCount = analyser.frequencyBinCount;
                    const floatData = new Float32Array(binCount);
                    analyser.getFloatFrequencyData(floatData); // dB, [-140, 0]

                    const sampleRate = audioCtx.sampleRate;
                    const fftSize = analyser.fftSize;
                    const binHz = sampleRate / fftSize;

                    // 初始化 MEL 断点映射（移动端列数减少）
                    if (!melConfigRef.current) {
                      const isMobileUA = /Mobile|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
                      const desired = melDesiredColsRef.current ?? (isMobileUA ? 48 : 64);
                      const MEL_COLS = Math.max(16, Math.min(128, desired));
                      const minHz = 20, maxHz = 8000;
                      // 简化的等比刻度近似 MEL（避免引入额外函数）：在 20-8000Hz 上对数分布
                      const toHz = (t: number) => minHz * Math.pow(maxHz / minHz, t);
                      const breakpointsHz: number[] = [];
                      for (let i = 0; i <= MEL_COLS; i++) breakpointsHz.push(toHz(i / MEL_COLS));
                      const binMap: number[] = breakpointsHz.map(hz => Math.max(0, Math.min(binCount - 1, Math.round(hz / binHz))));
                      melConfigRef.current = { binMap, cols: MEL_COLS, minHz, maxHz };
                    }

                    const { binMap, cols: MEL_COLS } = melConfigRef.current!;
                    const columns = new Float32Array(MEL_COLS);
                    // dB→幅度归一化（0..1）
                    const amp = (db: number) => {
                      const clamped = Math.max(-140, Math.min(0, db || -140));
                      return Math.pow(10, (clamped + 140) / 20);
                    };
                    for (let c = 0; c < MEL_COLS; c++) {
                      const start = binMap[c];
                      const end = binMap[c + 1];
                      if (end <= start) { columns[c] = 0; continue; }
                      let sum = 0;
                      for (let k = start; k < end; k++) sum += amp(floatData[k]);
                      columns[c] = sum / Math.max(1, end - start);
                    }

                    // 三段能量：按列范围聚合
                    const idxLowEnd = Math.floor(MEL_COLS * 0.22);
                    const idxMidEnd = Math.floor(MEL_COLS * 0.65);
                    const avgRange = (s: number, e: number) => {
                      let sum = 0; for (let i = s; i < e; i++) sum += columns[i];
                      return e > s ? sum / (e - s) : 0;
                    };
                    const lowInst = avgRange(0, idxLowEnd);
                    const midInst = avgRange(idxLowEnd, idxMidEnd);
                    const highInst = avgRange(idxMidEnd, MEL_COLS);

                    // 双时间常数（bi-smooth）
                    const bi = (cur: number, next: number, attack: number, release: number) => cur + (next > cur ? attack : release) * (next - cur);
                    const S = spectrumStateRef.current;
                    const levelInst = Math.max(0, Math.min(1, (processedFeatures as any).rms || 0));
                    // 推荐参数（可后续提升为可配）
                    S.levelSlow = bi(S.levelSlow, levelInst, 0.45, 0.12);
                    S.lowSlow = bi(S.lowSlow, lowInst, 0.25, 0.08);
                    S.midSlow = bi(S.midSlow, midInst, 0.35, 0.10);
                    S.highSlow = bi(S.highSlow, highInst, 0.60, 0.18);

                    // 列缓冲（instant→columnsSmooth）
                    if (!S.columnsSlow || S.columnsSlow.length !== MEL_COLS) {
                      S.columnsSlow = new Float32Array(MEL_COLS);
                      S.columnsSlow.set(columns);
                      } else {
                      for (let i = 0; i < MEL_COLS; i++) {
                        const next = columns[i];
                        const prev = S.columnsSlow[i];
                        // 高列用更平滑的释放，减少闪烁
                        const a = 0.5; const r = 0.2;
                        S.columnsSlow[i] = bi(prev, next, a, r);
                      }
                    }

                    // 写回 processedFeatures：使用 slow 值增强稳定性
                    (processedFeatures as any).bandLow = Math.max(0, Math.min(1, S.lowSlow));
                    (processedFeatures as any).bandMid = Math.max(0, Math.min(1, S.midSlow));
                    (processedFeatures as any).bandHigh = Math.max(0, Math.min(1, S.highSlow));
                    (processedFeatures as any).bandColumns = Array.from(S.columnsSlow);
                    bandColumnsRef.current = Array.from(S.columnsSlow);

                    // 历史帧（简要）
                    try {
                      const frame = {
                        level: { instant: levelInst, slow: S.levelSlow },
                        bands: {
                          low: { instant: lowInst, slow: S.lowSlow },
                          mid: { instant: midInst, slow: S.midSlow },
                          high: { instant: highInst, slow: S.highSlow },
                        },
                        columns,
                        columnsSmooth: new Float32Array(S.columnsSlow),
                      };
                      spectrumHistoryRef.current.push(frame);
                      if (spectrumHistoryRef.current.length > 32) spectrumHistoryRef.current.shift();
                    } catch (_) {}
                  }
                } catch (bandErr) {
                  if (bandErr === 'skip_update') { /* 降频跳过 */ } else {
                  console.warn('计算频段能量失败:', bandErr);
                  }
                }

                // 轻量 BPM 估计：使用 spectralFlux 峰值的间隔（滑窗中位数）
                try {
                  const flux = 0; // spectralFlux 已移除，使用默认值
                  const audioCtx = audioContextRef.current;
                  if (audioCtx) {
                    const nowSec = audioCtx.currentTime;
                    const state = bpmStateRef.current;
                    // 动态阈值（与近期 RMS/能量无关的简单线性）：
                    const fluxThresh = 0.12; // 经验阈值，移动端稳定
                    const minIoISec = 0.18;   // 最短 180ms ~ 333 BPM 上限
                    if (flux > fluxThresh && (nowSec - state.lastOnsetSec) > minIoISec) {
                      if (state.lastOnsetSec > 0) {
                        const interval = nowSec - state.lastOnsetSec;
                        // 合理区间过滤（60–180 BPM）
                        if (interval >= 0.333 && interval <= 1.0) {
                          state.intervals.push(interval);
                          if (state.intervals.length > 16) state.intervals.shift();
                          // 取中位数抗噪
                          const sorted = [...state.intervals].sort((a,b)=>a-b);
                          const mid = sorted.length ? sorted[Math.floor(sorted.length/2)] : interval;
                          const bpm = 60 / Math.max(1e-6, mid);
                          // 简单置信度：样本数与方差的函数
                          const mean = sorted.reduce((s,v)=>s+v,0) / Math.max(1, sorted.length);
                          const variance = sorted.reduce((s,v)=>s+(v-mean)*(v-mean),0) / Math.max(1, sorted.length);
                          const conf = Math.max(0, Math.min(1, (sorted.length/16) * (1.0 - Math.min(1, variance/0.1))));
                          state.bpm = bpm;
                          state.confidence = conf;
                        }
                      }
                      state.lastOnsetSec = nowSec;
                    }

                    // 发布条件：置信度足够且 BPM 在 60–180 范围
                    if (state.bpm > 0 && state.confidence >= 0.45 && state.bpm >= 60 && state.bpm <= 180) {
                      // 相位同步：基于 AudioContext 时间累积
                      const tp = tempoPhaseRef.current;
                      const dt = Math.max(0, nowSec - (tp.lastTime || nowSec));
                      tp.phase = (tp.phase + (state.bpm / 60) * dt) % 1;
                      tp.lastTime = nowSec;
                      (processedFeatures as any).tempo = { bpm: Math.round(state.bpm), confidence: state.confidence, phase: tp.phase } as any;
                    }
                  }
                } catch (bpmErr) {
                  console.warn('BPM 估计失败:', bpmErr);
                }

                // 轻量音高检测（条件触发：谐波/人声占优 + 帧率足够；每4帧计算一次）
                try {
                  const audioCtx = audioContextRef.current;
                  const isHarmonic = (((processedFeatures as any).harmonicRatio ?? 0) > 0.55) || (((processedFeatures as any).voiceProb ?? 0) > 0.55);
                  const fpsOk = (fpsStateRef.current?.fps ?? 60) >= 45;
                  const ps = pitchStateRef.current;
                  ps.frame = (ps.frame + 1) % 4;
                  if (audioCtx && isHarmonic && fpsOk && ps.frame === 0 && analyserRef.current) {
                    const N = analyserRef.current.fftSize;
                    const td = new Float32Array(N);
                    analyserRef.current.getFloatTimeDomainData(td);
                    // 简化版 YIN-ish：采用自相关近似（只求主峰），低计算量
                    const maxLag = Math.min(N >> 1, Math.floor(audioCtx.sampleRate / 80)); // 最低80Hz
                    const minLag = Math.max(2, Math.floor(audioCtx.sampleRate / 1000)); // 最高1000Hz
                    let bestLag = 0; let bestVal = 0;
                    for (let lag = minLag; lag <= maxLag; lag++) {
                      let sum = 0; let cnt = 0;
                      for (let i = 0; i + lag < N; i += 2) { // 步长2 降成本
                        sum += td[i] * td[i + lag];
                        cnt++;
                      }
                      const val = cnt ? sum / cnt : 0;
                      if (val > bestVal) { bestVal = val; bestLag = lag; }
                    }
                    const hz = bestLag > 0 ? audioCtx.sampleRate / bestLag : 0;
                    const conf = Math.max(0, Math.min(1, (bestVal + 1) / 2));
                    // 平滑输出
                    ps.smoothHz = ps.smoothHz ? (ps.smoothHz * 0.7 + hz * 0.3) : hz;
                    ps.lastHz = hz; ps.confidence = conf;
                    (processedFeatures as any).pitchHz = ps.smoothHz;
                    (processedFeatures as any).pitchConf = conf;
                    // 近似音名（A4=440Hz，12-TET）
                    const noteNum = 69 + 12 * Math.log2(Math.max(1e-6, ps.smoothHz / 440));
                    const noteIndex = Math.round(noteNum);
                    const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
                    const name = names[(noteIndex + 1200) % 12];
                    const octave = Math.floor(noteIndex / 12) - 1;
                    (processedFeatures as any).pitchName = `${name}${octave}`;
                  }
                } catch (pitchErr) {
                  // 忽略音高错误，保持主流程
                }

                // 起音/音符边界：在 spectralFlux 峰值基础上加入滞后与最短间隔
                try {
                  const audioCtx = audioContextRef.current;
                  if (audioCtx) {
                    const nowSec = audioCtx.currentTime;
                    const os = onsetStateRef.current;
                    const flux = 0; // spectralFlux 已移除，使用默认值
                    const rmsNow = (processedFeatures as any).rms ?? 0;
                    const minGap = 0.12; // 120ms 最短间隔
                    const fluxGate = 0.12; // 经验门限
                    const rmsGate = 0.02; // 低能量抑制
                    if (flux > fluxGate && rmsNow > rmsGate && (nowSec - os.lastOnsetSec) > minGap && os.armed) {
                      (processedFeatures as any).noteOn = true;
                      os.lastOnsetSec = nowSec;
                      os.armed = false;
                    } else {
                      (processedFeatures as any).noteOn = false;
                      // 滞后释放：在 80ms 后重新武装
                      if (!os.armed && (nowSec - os.lastOnsetSec) > 0.08) os.armed = true;
                    }
                  }
                } catch (onsetErr) {
                  // 忽略
                }
                
                setFeatures(processedFeatures);
                
                // 将音频特征传递给LLM弹幕管线 - 使用 ref 获取最新状态
                if (danmuPipelineRef.current.isActive && processedFeatures) {
                  try {
                    // 健壮性检查：确保 RMS 值有效
                    const rmsValue = processedFeatures.rms;
                    if (typeof rmsValue !== 'number' || isNaN(rmsValue) || !isFinite(rmsValue)) {
                      console.warn('🎵 弹幕管线: RMS 值无效，跳过弹幕生成', rmsValue);
                      return;
                    }
                    
                    // 构建完整的特征对象供LLM分析
                    const fullFeatures = {
                      ...processedFeatures,
                      yamnetResults,
                      timestamp: Date.now(),
                      preset: currentPreset,
                      sensitivity: sensitivity
                    };
                    
                    // 传递给LLM弹幕管线 - 使用 ref 获取最新状态
                    danmuPipelineRef.current.handleAudioFeatures(rmsValue, fullFeatures);
                      
                      // 调试日志
          if (Math.random() < 0.1) {
                      console.log('🎵 LLM弹幕管线处理特征:', {
                        rms: processedFeatures.rms,
                        style: danmuPipelineRef.current.currentStyle,
                        danmuCount: danmuPipelineRef.current.danmuCount,
                        dominantInstrument: danmuPipelineRef.current.dominantInstrument
                      });
                    }
                  } catch (e) {
                    console.warn('LLM弹幕管线处理错误:', e);
                  }
                }
                
                // YAMNet 分类（每30帧执行一次，减少计算负载）
                if (yamnetModelRef.current && yamnetBufferRef.current && Math.random() < 0.033) {
                  try {
                    // 获取当前音频缓冲区
                    const currentBuffer = new Float32Array(analyser.fftSize);
                    analyser.getFloatTimeDomainData(currentBuffer);
                    
                    // 更新 YAMNet 缓冲区（滑动窗口）
                    const bufferSize = yamnetBufferRef.current.length;
                    const newDataSize = Math.min(currentBuffer.length, bufferSize);
                    
                    // 移动旧数据
                    yamnetBufferRef.current.copyWithin(0, newDataSize);
                    // 添加新数据
                    yamnetBufferRef.current.set(currentBuffer.slice(0, newDataSize), bufferSize - newDataSize);
                    
                    // 执行 YAMNet 分类
                    const yamnetResults = classifyWithYAMNet(yamnetModelRef.current, yamnetBufferRef.current);
                    if (yamnetResults) {
                      setYamnetResults(yamnetResults);
                      
                      // 调试日志
                      if (Math.random() < 0.1) {
                        console.log('YAMNet 分类结果:', {
                          topClass: yamnetResults.topClasses[0]?.label,
                          confidence: yamnetResults.topClasses[0]?.confidence?.toFixed(3),
                          instruments: yamnetResults.instruments.slice(0, 3),
                          events: yamnetResults.events.slice(0, 3)
                        });
                      }
                    }
                  } catch (e) {
                    console.warn('YAMNet 分类错误:', e);
                  }
                }
                
                // 调试日志 - 每100帧输出一次
                if (Math.random() < 0.01) {
                  console.log('Meyda 特征:', {
                    rms: processedFeatures.rms.toFixed(3),
                    spectralCentroid: processedFeatures.spectralCentroid.toFixed(3),
                    zcr: processedFeatures.zcr.toFixed(3),
                    mfccLength: processedFeatures.mfcc.length,
                    chromaLength: processedFeatures.chroma.length
                  });
                }
              } catch (e) {
                console.warn('Meyda 特征处理错误:', e);
              }
            },
          });
          meydaAnalyzerRef.current.start();
          console.log('Meyda 特征提取已启动');
        } else {
          console.log('🎵 跳过 Meyda 特征提取:', {
            reason: !spectrumEnabled ? 'spectrumEnabled=false' : 
                   !Meyda ? 'Meyda未加载' : 
                   (!(Meyda as any).isBrowser && typeof window === 'undefined') ? '非浏览器环境' : 'Meyda.isBrowser检查失败'
          });
        }
      } catch (e) {
        console.warn('Meyda 初始化失败:', e);
      }

      // 先标记为运行，再启动循环
      setIsRunning(true);
      
      // 延迟启动分析循环，确保状态已更新
      setTimeout(() => {
        console.log('启动音频分析循环...');
        console.log('isRunning状态:', isRunning);
        console.log('analyserRef.current:', !!analyserRef.current);
        
        // 测试音频数据获取
        const testAnalyser = analyserRef.current;
        if (testAnalyser) {
          const testBuffer = new Float32Array(testAnalyser.fftSize);
          testAnalyser.getFloatTimeDomainData(testBuffer);
          console.log('测试音频数据前10个值:', Array.from(testBuffer.slice(0, 10)));
        }
        
        analyzeAudio();
      }, 100);
      
      console.log('音频处理已启动');
    } catch (error) {
      console.error('启动音频处理失败:', error);
      try { setDebugInfo(prev => ({ ...prev, lastError: String(error) })); } catch (_) {}
    }
  }, [analyzeAudio]);

  // 停止音频处理 - 参考主页面的实现
  const stopAudioProcessing = useCallback(() => {
    // 停止音频分析循环
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // 停止 Meyda 分析器
    if (meydaAnalyzerRef.current) {
      try {
        meydaAnalyzerRef.current.stop();
        meydaAnalyzerRef.current = null;
        console.log('Meyda 分析器已停止');
      } catch (e) {
        console.warn('停止 Meyda 分析器时出错:', e);
      }
    }

    // 清理 YAMNet 模型
    if (yamnetModelRef.current) {
      try {
        yamnetModelRef.current.dispose();
        yamnetModelRef.current = null;
        yamnetBufferRef.current = null;
        console.log('YAMNet 模型已清理');
      } catch (e) {
        console.warn('清理 YAMNet 模型时出错:', e);
      }
    }

    // 清理LLM弹幕管线
    try {
      if (danmuPipeline.isActive || danmuPipeline.isReady) {
        danmuPipeline.stop();
        console.log('LLM弹幕管线已停止');
      }
      } catch (e) {
      console.warn('清理LLM弹幕管线时出错:', e);
    }

    // 断开音频连接
    if (audioContextRef.current) {
      try {
        // 先断开所有音频节点
        if (audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close().then(() => {
            console.log('AudioContext 已关闭');
          }).catch(err => {
            console.warn('关闭 AudioContext 时出错:', err);
          });
        }
      } catch (e) {
        console.warn('断开音频连接时出错:', e);
      }
      audioContextRef.current = null;
    }

    // 停止媒体流
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        console.log('停止音轨:', track.kind, track.label, track.readyState);
        track.stop();
        console.log('音轨已停止:', track.kind, track.label);
      });
      streamRef.current = null;
      console.log('媒体流已停止');
    }

    // 清理所有音频节点
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
        sourceRef.current = null;
        console.log('音频源节点已断开');
      } catch (e) {
        console.warn('断开音频源节点时出错:', e);
      }
    }

    if (gainRef.current) {
      try {
        gainRef.current.disconnect();
        gainRef.current = null;
        console.log('增益节点已断开');
      } catch (e) {
        console.warn('断开增益节点时出错:', e);
      }
    }

    analyserRef.current = null;
    dataArrayRef.current = null;
    setIsRunning(false);
    setAudioLevel(0);
    setFeatures(null);
    setYamnetResults(null);

    // 强制重置所有频谱相关状态
    bandColumnsRef.current = null;
    spectrumHistoryRef.current = [];
    spectrumStateRef.current = { levelSlow: 0, lowSlow: 0, midSlow: 0, highSlow: 0 };
    fpsStateRef.current = { lastTs: (typeof performance !== 'undefined' ? performance.now() : Date.now()), frames: 0, fps: 60 };
    tempoPhaseRef.current = { phase: 0, lastTime: 0 };
    pitchStateRef.current = { lastHz: 0, smoothHz: 0, confidence: 0, frame: 0 };
    onsetStateRef.current = { armed: true, lastOnsetSec: 0 };
    bpmStateRef.current = { lastOnsetSec: 0, intervals: [], bpm: 0, confidence: 0 };

    console.log('🛑 音频处理已完全停止');
    console.log('📊 状态重置 - isRunning:', false, 'audioLevel:', 0, 'features:', null);
  }, []);

  // 切换麦克风开关
  const toggleMicrophone = useCallback((next?: boolean) => {
    try {
      const enable = typeof next === 'boolean' ? next : !microphoneEnabled;
      setMicrophoneEnabled(enable);

      if (enable) {
        // 如果启用麦克风且当前没有运行，则启动音频处理
        if (!isRunning) {
          startAudioProcessing();
        }
        console.log('🎤 麦克风已开启');
      } else {
        // 如果禁用麦克风且当前正在运行，则停止音频处理
        if (isRunning) {
          stopAudioProcessing();
        }
        console.log('🎤 麦克风已关闭');
      }
    } catch (err) {
      console.warn('切换麦克风失败:', err);
    }
  }, [microphoneEnabled, isRunning, startAudioProcessing, stopAudioProcessing]);

  // 处理预设选择
  const handlePresetChange = useCallback((presetId: string) => {
    if (presetId === 'spectrum') {
      // 频谱优先模式切换
      setSpectrumPriority(!spectrumPriority);
      console.log('频谱优先模式:', !spectrumPriority ? '开启' : '关闭');
      return;
    }

    // 检查是否点击的是当前已选中的预设
    if (presetId === currentPreset && isRunning) {
      // 点击同一预设且正在运行 -> 关闭麦克风
      console.log('🔄 停止音频处理 - 点击同一预设:', presetId);
      stopAudioProcessing();
      setMicrophoneEnabled(false);
      console.log('✅ 麦克风已关闭');
    } else {
      // 点击不同预设或当前未运行 -> 切换预设并开启麦克风
      console.log('🔄 切换预设 - 从', currentPreset, '到', presetId);
      setCurrentPreset(presetId);
      setMicrophoneEnabled(true);
      if (!isRunning) {
        startAudioProcessing();
      }
      console.log('✅ 预设已切换至:', presetId, '麦克风已开启');
    }
  }, [isRunning, startAudioProcessing, stopAudioProcessing, currentPreset, spectrumPriority]);

  
  // 清理函数
  useEffect(() => {
    return () => {
      stopAudioProcessing();
    };
  }, [stopAudioProcessing]);

  // 键盘快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 数字键切换预设
      const presetKeys = ['Digit1', 'Digit2', 'Digit3', 'Digit4'];
      const keyIndex = presetKeys.indexOf(e.code);
      if (keyIndex >= 0 && keyIndex < PRESET_OPTIONS.length) {
        e.preventDefault();
        handlePresetChange(PRESET_OPTIONS[keyIndex].id);
      }

      // 隐藏热键：按下 D 切换 Danmu 开关，按下 S 切换频谱优先模式
      if (e.code === 'KeyD') {
        e.preventDefault();
        toggleDanmu();
      }
      if (e.code === 'KeyS') {
        e.preventDefault();
        setSpectrumPriority(!spectrumPriority);
        console.log('频谱优先模式:', !spectrumPriority ? '开启' : '关闭');
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [handlePresetChange, toggleDanmu, spectrumPriority]);

  // 移动端/浏览器解锁：在首次触摸/点击时尝试 resume AudioContext；解析 ?debug=1
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('debug') === '1') setDebugVisible(true);
      // 采集一次权限与环境状态
      (async () => {
        try {
          const micPerm = (navigator as any).permissions?.query
            ? await (navigator as any).permissions.query({ name: 'microphone' as any })
            : null;
          setDebugInfo(prev => ({
            ...prev,
            isSecure: !!(window as any).isSecureContext,
            hasMedia: !!navigator.mediaDevices,
            micPermission: micPerm?.state || 'unknown'
          }));
        } catch (_) {
          setDebugInfo(prev => ({
            ...prev,
            isSecure: !!(window as any).isSecureContext,
            hasMedia: !!navigator.mediaDevices
          }));
        }
      })();

      // 检测是否在 iframe 中以及权限策略（若可用）
      try {
        const inIframe = window.top !== window.self;
        let policyMic: string | undefined;
        let policyCam: string | undefined;
        const anyDoc: any = document as any;
        const fp = anyDoc.permissionsPolicy || anyDoc.featurePolicy; // Chrome 有 featurePolicy，新的为 permissionsPolicy
        if (fp && typeof fp.allowsFeature === 'function') {
          try { policyMic = fp.allowsFeature('microphone') ? 'allowed' : 'blocked'; } catch (_) {}
          try { policyCam = fp.allowsFeature('camera') ? 'allowed' : 'blocked'; } catch (_) {}
        }
        setEmbedInfo({ inIframe, policyMicrophone: policyMic, policyCamera: policyCam });
      } catch (_) {}
    } catch (_) {}

    const tryResume = async () => {
      try {
        const ctx = audioContextRef.current;
        if (ctx && ctx.state !== 'running') {
          await ctx.resume();
          console.log('在用户手势下恢复 AudioContext:', ctx.state);
        }
        // 首次用户手势：若未运行则启动音频处理
        if (!micStartedRef.current && !isRunning) {
          micStartedRef.current = true;
          try {
            await startAudioProcessing();
            console.log('首次用户手势触发麦克风启动');
          } catch (e) {
            console.warn('首次手势启动麦克风失败:', e);
            micStartedRef.current = false; // 失败则允许再次尝试
          }
        }
      } catch (e) {
        console.warn('用户手势恢复 AudioContext 失败:', e);
      }
    };
    const events = ['touchend', 'touchstart', 'click'];
    events.forEach(ev => window.addEventListener(ev, tryResume, { passive: true } as any));
    return () => events.forEach(ev => window.removeEventListener(ev, tryResume as any));
  }, []);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col relative">
      {/* 全局样式 - 移除所有按钮的焦点样式 */}
      <style jsx global>{`
        button:focus {
          outline: none !important;
          box-shadow: none !important;
          border: none !important;
        }
        button:focus-visible {
          outline: none !important;
          box-shadow: none !important;
          border: none !important;
        }
        button:active {
          outline: none !important;
          box-shadow: none !important;
          border: none !important;
        }
      `}</style>
      {/* 可视化组件 - 全屏背景 */}
      <div className="absolute inset-0 z-0">
        <Visualizer
          audioLevel={audioLevel}
          running={isRunning}
          preset={currentPreset as 'pulse' | 'accretion' | 'spiral' | 'mosaic' | 'wave'}
            features={features}
          sensitivity={sensitivity}
          spectrumPriority={spectrumPriority}
          audioWeights={{
            level: 1.0,
            bandLow: 1.2,
            bandMid: 1.0,
            bandHigh: 1.4,
            fluxPulse: 1.6,
            tempo: 1.0,
          }}
        />

        {/* 弹幕容器 */}
        <div id="danmu-container" className="absolute inset-0 pointer-events-none z-20"></div>
        
      </div>
      
      {/* 调试面板（右上角） */}
      {debugVisible && (
        <div className="fixed top-2 right-2 z-30 bg-black/70 text-white/90 border border-white/10 rounded-md px-3 py-2 text-xs leading-relaxed max-w-[90vw]">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold">Mic Debug</span>
            <button
              onClick={() => setDebugVisible(false)}
              className="px-1 py-0.5 bg-white/10 hover:bg-white/20 rounded"
            >隐藏</button>
          </div>
          <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
            <div>ctx: {debugInfo.ctxState}</div>
            <div>rate: {debugInfo.sampleRate}</div>
            <div>stream: {String(debugInfo.hasStream)}</div>
            <div>analyser: {String(debugInfo.hasAnalyser)}</div>
            <div>rms: {debugInfo.rms.toFixed(3)}</div>
            <div>maxAbs: {debugInfo.maxAbs.toFixed(3)}</div>
            <div>zero: {debugInfo.zeroCount}</div>
            <div>running: {String(isRunning)}</div>
            <div>secure: {String(debugInfo.isSecure)}</div>
            <div>media: {String(debugInfo.hasMedia)}</div>
            <div>perm: {debugInfo.micPermission}</div>
            <div>iframe: {String(embedInfo.inIframe)}</div>
            <div>danmu: {String(danmuEnabled)}</div>
            <div>pipeline: {String(danmuPipeline.isActive)}</div>
            <div>style: {danmuPipeline.currentStyle || 'none'}</div>
            <div>danmuCount: {danmuPipeline.danmuCount}</div>
            <div>instrument: {danmuPipeline.dominantInstrument || 'none'}</div>
            {embedInfo.policyMicrophone && (<div>pol-mic: {embedInfo.policyMicrophone}</div>)}
            {embedInfo.policyCamera && (<div>pol-cam: {embedInfo.policyCamera}</div>)}
          </div>
          <div className="mt-1">samples: {debugInfo.lastSamples.map(v => v.toFixed(2)).join(', ')}</div>
          {debugInfo.lastError && (
            <div className="mt-1 text-red-400 break-all">error: {debugInfo.lastError}</div>
          )}
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => { try { startAudioProcessing(); } catch (_) {} }}
              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 rounded"
            >启动麦克风</button>
            <button
              onClick={() => { try { stopAudioProcessing(); } catch (_) {} }}
              className="px-2 py-1 bg-rose-600 hover:bg-rose-500 rounded"
            >停止</button>
            <button
              onClick={() => {
                // 启用Mosaic测试模式
                if (currentPreset === 'mosaic') {
                  console.log('🎵 启用Mosaic测试模式');
                  // 这里需要访问mosaicVisual实例，暂时用日志代替
                  console.log('请在控制台手动调用: mosaicVisual.enableTestMode()');
                }
              }}
              className="px-2 py-1 bg-purple-600 hover:bg-purple-500 rounded"
            >测试频谱</button>
            <button
              onClick={async () => {
                try {
                  if (!audioContextRef.current) return;
                  await audioContextRef.current.resume();
                  setDebugInfo(prev => ({ ...prev, ctxState: audioContextRef.current?.state || 'unknown' }));
                } catch (e) {
                  console.warn('手动恢复失败:', e);
                }
              }}
              className="px-2 py-1 bg-sky-700 hover:bg-sky-600 rounded"
            >手动恢复</button>
          </div>
        </div>
      )}

      {/* 预设选择器 - 放在顶部但不贴边 */}
      <div className="relative z-10 pt-16 portrait:pt-8 pb-8">
        <div className="flex gap-3 sm:gap-5 lg:gap-7 flex-nowrap justify-center items-center w-full px-2">
          {[...PRESET_OPTIONS, { id: 'danmu', label: 'Danmu', abbrMobile: 'DA' }].map((option, index) => {
            const graphemes = segmentGraphemes(option.label);
            const centerIndex = (graphemes.length - 1) / 2;
            const isSelected = option.id === 'danmu' ? danmuEnabled :
                              option.id === 'spectrum' ? spectrumPriority :
                              (currentPreset === option.id && isRunning);

            return (
            <button
              key={option.id}
                onClick={(e) => {
                  if (option.id === 'danmu') {
                    toggleDanmu();
                  } else if (option.id === 'spectrum') {
                    setSpectrumPriority(!spectrumPriority);
                    console.log('频谱优先模式:', !spectrumPriority ? '开启' : '关闭');
                  } else {
                    handlePresetChange(option.id);
                  }
                  try { (e.currentTarget as any)?.blur?.(); } catch (_) {}
                }}
                    className={`
                      group relative block overflow-visible sm:overflow-hidden whitespace-nowrap
                      text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl
                      text-center sm:text-left
                      font-black uppercase
                      mx-auto portrait:px-2
                  ${option.id === 'danmu'
                    ? (isSelected
                        ? 'text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.8)] !blur-none !filter-none'
                        : 'text-white/40 blur-sm')
                    : (isSelected
                        ? 'text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.8)] !blur-none !filter-none'
                      : 'text-white/40 blur-sm hover:text-white/60 hover:blur-none')
                  }
                      cursor-pointer
                      focus:outline-none focus:ring-0 focus:border-0
                      min-h-[44px] min-w-[44px]
                      px-4 py-2
                      transition-all duration-300 ease-in-out
                      // will-change-transform
                      // transform-gpu
                    `}
              style={{
                lineHeight: 1,
              }}
                  aria-pressed={option.id === 'danmu' ? danmuEnabled : option.id === 'spectrum' ? spectrumPriority : (currentPreset === option.id && isRunning)}
                  aria-label={option.label}
                >
              {/* 移动端：显示两字母缩写（隐藏复杂逐字动画） */}
              <span className="sm:hidden inline-block w-full text-center" aria-hidden>
                {option.abbrMobile || option.label.slice(0, 2).toUpperCase()}
              </span>

              {/* 桌面端：保留原有逐字动画效果 */}
              {/* 上层文字 - 悬停时向上移动 */}
              <div className="hidden sm:flex relative">
                {graphemes.map((grapheme, i) => (
                  <span
                    key={`top-${i}`}
                    className={`inline-block transition-transform duration-300 ease-in-out ${option.id !== 'danmu' ? 'group-hover:-translate-y-[120%]' : ''} ${isSelected ? '-translate-y-[180%] opacity-0' : ''} ${option.id === 'danmu' && !isSelected ? 'blur-sm' : ''}`}
                    style={{
                      transitionDelay: `${Math.abs(i - centerIndex) * 25}ms`,
                    }}
                  >
                     {graphemes[i]}
                  </span>
                ))}
          </div>

              {/* 下层文字 - 悬停时从下方滑入 */}
              <div className="hidden sm:flex absolute inset-0 justify-center items-center">
                {graphemes.map((grapheme, i) => (
                  <span
                    key={`bottom-${i}`}
                    className={`inline-block transition-transform duration-300 ease-in-out ${isSelected ? 'translate-y-0 opacity-100' : 'translate-y-[180%] opacity-0'} ${option.id !== 'danmu' ? 'group-hover:translate-y-0 group-hover:opacity-100' : ''}`}
                    style={{
                      transitionDelay: `${Math.abs(i - centerIndex) * 25}ms`,
                    }}
                  >
                     {graphemes[i]}
                  </span>
                ))}
              </div>

            </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
