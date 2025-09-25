"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import Visualizer from '../../components/visualizer';
import Meyda from 'meyda'; // Import Meyda for real audio feature extraction
import * as tf from '@tensorflow/tfjs'; // Import TensorFlow.js for YAMNet
import { DanmuEngine } from '../../lib/danmu-engine'; // Import DanmuEngine

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
  const flux = typeof f?.spectralFlux === 'number' ? f.spectralFlux : 0;
  
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
async function loadYAMNetModel(): Promise<tf.LayersModel | null> {
  try {
    console.log('加载 YAMNet 模型...');
    const model = await tf.loadLayersModel('/model/yamnet.task');
    console.log('YAMNet 模型加载成功');
    return model;
  } catch (error) {
    console.error('YAMNet 模型加载失败:', error);
    return null;
  }
}

function classifyWithYAMNet(model: tf.LayersModel, audioBuffer: Float32Array): any {
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
    const input = tf.tensor2d([Array.from(resampledBuffer)], [1, targetLength]);
    
    // 运行推理
    const predictions = model.predict(input) as tf.Tensor;
    const results = predictions.dataSync();
    
    // 清理张量
    input.dispose();
    predictions.dispose();
    
    // 提取前5个最可能的类别
    const topClasses = [];
    const resultsArray = Array.from(results);
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
  const [danmuEnabled, setDanmuEnabled] = useState(true); // Danmu toggle state
  // 调试面板显示：避免 SSR/CSR 初始不一致，挂载后再决定
  const [debugVisible, setDebugVisible] = useState<boolean>(false);
  const [debugInfo, setDebugInfo] = useState<{ ctxState: string; sampleRate: number; hasStream: boolean; hasAnalyser: boolean; rms: number; maxAbs: number; zeroCount: number; lastSamples: number[]; isSecure: boolean; hasMedia: boolean; micPermission: string; lastError?: string }>({
    ctxState: 'unknown', sampleRate: 0, hasStream: false, hasAnalyser: false, rms: 0, maxAbs: 0, zeroCount: 0, lastSamples: [],
    isSecure: typeof window !== 'undefined' ? !!(window as any).isSecureContext : false,
    hasMedia: typeof navigator !== 'undefined' ? !!navigator.mediaDevices : false,
    micPermission: 'unknown'
  });
  
  // 音频处理引用
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const meydaAnalyzerRef = useRef<any | null>(null); // Meyda analyzer reference
  const yamnetModelRef = useRef<tf.LayersModel | null>(null); // YAMNet model reference
  const yamnetBufferRef = useRef<Float32Array | null>(null); // Audio buffer for YAMNet
  const danmuEngineRef = useRef<DanmuEngine | null>(null); // DanmuEngine reference
  // 轻量 BPM 状态：基于 onset 间隔的滑窗估计
  const bpmStateRef = useRef<{ lastOnsetSec: number; intervals: number[]; bpm: number; confidence: number }>({
    lastOnsetSec: 0,
    intervals: [],
    bpm: 0,
    confidence: 0,
  });
  // 频谱列平滑缓存
  const bandColumnsRef = useRef<number[] | null>(null);

  // 切换弹幕开关
  const toggleDanmu = useCallback((next?: boolean) => {
    try {
      const enable = typeof next === 'boolean' ? next : !danmuEnabled;
      setDanmuEnabled(enable);

      const engine = danmuEngineRef.current;
      const container = document.getElementById('danmu-container');
      if (engine) {
        if (enable) {
          engine.start();
        } else {
          engine.stop();
          // 清理屏幕上已有弹幕元素
          if (container) {
            try {
              container.innerHTML = '';
            } catch (_) {}
          }
        }
      } else if (!enable && container) {
        // 没有引擎实例时也清一次容器
        try { container.innerHTML = ''; } catch (_) {}
      }
    } catch (err) {
      console.warn('切换弹幕失败:', err);
    }
  }, [danmuEnabled]);

  // 检测用户偏好
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) {
      setAnimationMode('reduced');
    }
    
    const handleChange = (e: MediaQueryListEvent) => {
      setAnimationMode(e.matches ? 'reduced' : 'auto');
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
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
      const AudioContextCtor = (window as any).AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextCtor({ latencyHint: 'interactive' });
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream!);

      // 配置分析器 - 使用与主页面相同的配置
      analyser.fftSize = 2048; // 与主页面一致
      analyser.smoothingTimeConstant = 0.5; // 与主页面一致

      // 连接音频节点
      source.connect(analyser);
      
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

      // 初始化弹幕引擎
      try {
        if (!danmuEngineRef.current) {
          console.log('初始化弹幕引擎...');
          // 创建一个简单的事件总线
          const eventBus = {
            emit: (event: string, data: any) => {
              console.log('EventBus emit:', event, data);
            },
            on: (event: string, callback: (data: any) => void) => {
              console.log('EventBus on:', event);
            }
          };
          
          danmuEngineRef.current = new DanmuEngine(eventBus as any);
          await danmuEngineRef.current.initialize();
          if (danmuEnabled) {
            danmuEngineRef.current.start();
            console.log('弹幕引擎已启动');
          } else {
            danmuEngineRef.current.stop();
            console.log('弹幕引擎已准备（默认关闭）');
          }
        }
      } catch (e) {
        console.warn('弹幕引擎初始化失败:', e);
      }

      // 初始化 YAMNet 模型
      try {
        if (!yamnetModelRef.current) {
          console.log('加载 YAMNet 模型...');
          yamnetModelRef.current = await loadYAMNetModel();
          if (yamnetModelRef.current) {
            console.log('YAMNet 模型加载成功');
            // 初始化音频缓冲区
            yamnetBufferRef.current = new Float32Array(15600); // YAMNet 需要的缓冲区大小
          }
        }
      } catch (e) {
        console.warn('YAMNet 模型加载失败:', e);
      }

      // 初始化 Meyda 特征提取
      try {
        if (Meyda && (Meyda as any).isBrowser) {
          console.log('初始化 Meyda 特征提取...');
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
              'spectralFlux',
              'chroma',
              'spectralBandwidth',
              'spectralRolloff',
              'spectralContrast',
              'spectralSpread',
              'spectralSkewness',
              'spectralKurtosis',
              'loudness',
              'perceptualSpread',
              'perceptualSharpness',
            ],
            callback: (f: any) => {
              try {
                // 处理 Meyda 特征数据
                const processedFeatures = {
                  rms: typeof f.rms === 'number' ? f.rms : 0,
                  spectralCentroid: typeof f.spectralCentroid === 'number' ? f.spectralCentroid : 0,
                  zcr: typeof f.zcr === 'number' ? f.zcr : 0,
                  mfcc: Array.isArray(f.mfcc) ? f.mfcc : [],
                  spectralFlatness: typeof f.spectralFlatness === 'number' ? f.spectralFlatness : 0,
                  spectralFlux: typeof f.spectralFlux === 'number' ? f.spectralFlux : 0,
                  chroma: Array.isArray(f.chroma) ? f.chroma : [],
                  spectralBandwidth: typeof f.spectralBandwidth === 'number' ? f.spectralBandwidth : 0,
                  spectralRolloff: typeof f.spectralRolloff === 'number' ? f.spectralRolloff : 0,
                  spectralContrast: Array.isArray(f.spectralContrast) ? f.spectralContrast : [],
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
                    const binCount = analyser.frequencyBinCount;
                    const binData = new Uint8Array(binCount);
                    analyser.getByteFrequencyData(binData); // 0..255 能量

                    const sampleRate = audioCtx.sampleRate;
                    const fftSize = analyser.fftSize;
                    const binHz = sampleRate / fftSize;

                    const ranges = [
                      { min: 20, max: 250 },
                      { min: 250, max: 2000 },
                      { min: 2000, max: 8000 },
                    ];
                    const sums = [0, 0, 0];
                    const counts = [0, 0, 0];

                    for (let i = 0; i < binCount; i++) {
                      const freq = i * binHz;
                      if (freq < 20) continue; // 忽略直流/次声
                      const v = binData[i];
                      if (freq < ranges[0].max) { sums[0] += v; counts[0]++; continue; }
                      if (freq < ranges[1].max) { sums[1] += v; counts[1]++; continue; }
                      if (freq < ranges[2].max) { sums[2] += v; counts[2]++; continue; }
                    }

                    const norm = (sum: number, cnt: number) => {
                      if (!cnt) return 0;
                      const avg = sum / (cnt * 255);
                      return Math.sqrt(Math.max(0, Math.min(1, avg)));
                    };

                    (processedFeatures as any).bandLow = norm(sums[0], counts[0]);
                    (processedFeatures as any).bandMid = norm(sums[1], counts[1]);
                    (processedFeatures as any).bandHigh = norm(sums[2], counts[2]);

                    // 生成固定长度的列向量（低→高频响度），用于 Mosaic 左→右映射
                    try {
                      const COLS = 48; // 轻量列数，移动端友好
                      const minHz = 20, maxHz = 8000;
                      const hzPerBin = binHz;
                      const binsPerCol = Math.max(1, Math.floor(((maxHz - minHz) / COLS) / hzPerBin));
                      const cols: number[] = new Array(COLS).fill(0);
                      for (let c = 0; c < COLS; c++) {
                        const startHz = minHz + ((maxHz - minHz) * c) / COLS;
                        const endHz = minHz + ((maxHz - minHz) * (c + 1)) / COLS;
                        const startIdx = Math.max(0, Math.floor(startHz / hzPerBin));
                        const endIdx = Math.min(binCount - 1, Math.ceil(endHz / hzPerBin));
                        let sumV = 0, cntV = 0;
                        for (let k = startIdx; k <= endIdx; k++) { sumV += binData[k]; cntV++; }
                        const avg = cntV ? sumV / (cntV * 255) : 0;
                        cols[c] = Math.sqrt(Math.max(0, Math.min(1, avg)));
                      }
                      (processedFeatures as any).bandColumns = cols;
                      // 帧间指数平滑，避免列抖动（α 越大越跟随历史）
                      const prev = bandColumnsRef.current;
                      const alpha = 0.6; // 移动端友好
                      if (Array.isArray(prev) && prev.length === COLS) {
                        const smoothedCols = cols.map((v, i) => alpha * prev[i] + (1 - alpha) * v);
                        (processedFeatures as any).bandColumns = smoothedCols;
                        bandColumnsRef.current = smoothedCols;
                      } else {
                        bandColumnsRef.current = cols;
                      }
                    } catch (colErr) {
                      console.warn('构建频谱列向量失败:', colErr);
                    }
                  }
                } catch (bandErr) {
                  console.warn('计算频段能量失败:', bandErr);
                }

                // 轻量 BPM 估计：使用 spectralFlux 峰值的间隔（滑窗中位数）
                try {
                  const flux = typeof f.spectralFlux === 'number' ? Math.max(0, f.spectralFlux) : 0;
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
                      (processedFeatures as any).tempo = { bpm: Math.round(state.bpm), confidence: state.confidence };
                    }
                  }
                } catch (bpmErr) {
                  console.warn('BPM 估计失败:', bpmErr);
                }
                
                setFeatures(processedFeatures);
                
                // 生成弹幕（每60帧执行一次，减少频率）
                if (danmuEngineRef.current && Math.random() < 0.017) {
                  try {
                    const danmuMessage = generateDanmuMessage(processedFeatures, yamnetResults);
                    if (danmuMessage) {
                      // 使用ingestText方法注入弹幕
                      danmuEngineRef.current.ingestText(danmuMessage);
                      
                      // 调试日志
          if (Math.random() < 0.1) {
                        console.log('🎵 生成弹幕:', danmuMessage);
                      }
                    }
                  } catch (e) {
                    console.warn('弹幕生成错误:', e);
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

    // 清理弹幕引擎
    if (danmuEngineRef.current) {
      try {
        danmuEngineRef.current.stop();
        danmuEngineRef.current = null;
        console.log('弹幕引擎已清理');
      } catch (e) {
        console.warn('清理弹幕引擎时出错:', e);
      }
    }

    // 断开音频连接
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // 停止媒体流
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    analyserRef.current = null;
    dataArrayRef.current = null;
    setIsRunning(false);
    setAudioLevel(0);
    setFeatures(null);
    setYamnetResults(null);

    console.log('音频处理已停止');
  }, []);

  // 处理预设选择
  const handlePresetChange = useCallback((presetId: string) => {
    setCurrentPreset(presetId);
    
    // 如果还没开始，自动开始音频处理
    if (!isRunning) {
      startAudioProcessing();
    }
    
    console.log('预设已切换至:', presetId);
  }, [isRunning, startAudioProcessing]);

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

      // 隐藏热键：按下 D 切换 Danmu 开关
      if (e.code === 'KeyD') {
        e.preventDefault();
        toggleDanmu();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePresetChange, toggleDanmu]);

  // 移动端/浏览器解锁：在首次触摸/点击时尝试 resume AudioContext
  useEffect(() => {
    // 挂载后再检查是否为移动端，从而决定是否默认显示调试面板（避免 hydration 差异）
    try {
      const ua = navigator.userAgent || '';
      if (/Mobile|Android|iPhone|iPad|iPod/i.test(ua)) {
        setDebugVisible(true);
      }
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
    } catch (_) {}

    const tryResume = async () => {
      try {
        const ctx = audioContextRef.current;
        if (ctx && ctx.state !== 'running') {
          await ctx.resume();
          console.log('在用户手势下恢复 AudioContext:', ctx.state);
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
        <div className="flex gap-4 sm:gap-8 flex-wrap portrait:flex-nowrap justify-center items-center w-full px-2">
          {[...PRESET_OPTIONS, { id: 'danmu', label: 'Danmu', abbrMobile: 'DA' }].map((option, index) => {
            const graphemes = segmentGraphemes(option.label);
            const centerIndex = (graphemes.length - 1) / 2;
            const isSelected = option.id === 'danmu' ? danmuEnabled : (currentPreset === option.id);

            return (
            <button
              key={option.id}
                onClick={(e) => {
                  if (option.id === 'danmu') {
                    toggleDanmu();
                  } else {
                    handlePresetChange(option.id);
                  }
                  try { (e.currentTarget as any)?.blur?.(); } catch (_) {}
                }}
                    className={`
                      group relative block overflow-visible sm:overflow-hidden whitespace-nowrap
                      text-3xl sm:text-6xl md:text-8xl
                      text-center sm:text-left
                      font-black uppercase
                      mx-auto portrait:px-3
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
                  aria-pressed={option.id === 'danmu' ? danmuEnabled : currentPreset === option.id}
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
