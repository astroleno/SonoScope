export const runtime = 'edge';

type AnalyzeRequest = {
  window_ms?: number;
  features?: Record<string, unknown>;
  need_comments?: number;
  locale?: string;
  persona?: Record<string, unknown> | string;
  style?: string;
  confidence?: number;
  talking_points?: string[];
  no_cache?: boolean;
};

function encode(line: string) {
  return new TextEncoder().encode(line);
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 构建 Core JSON（仅包含存在的字段）
function buildCoreJson(features: Record<string, unknown>) {
  const core: Record<string, unknown> = {};

  // style 与 instruments 可能来自上游，但此处仅当存在时带入（不做推断）
  if (typeof features['style_label'] === 'string' || typeof features['style'] === 'string') {
    core.style = {
      label: (features['style_label'] as string) || (features['style'] as string),
      confidence: Number(features['style_confidence'] ?? features['instrumentConfidence'] ?? 0) || undefined,
    };
  }

  // instruments（主/次与概率）
  const primary = features['dominantInstrument'];
  const histogram = features['instrumentHistogram'] as Record<string, number> | undefined;
  const confidence = features['instrumentConfidence'];
  if (typeof primary === 'string' || histogram || typeof confidence === 'number') {
    core.instruments = {
      primary: typeof primary === 'string' ? primary : undefined,
      probabilities: histogram,
      confidence: typeof confidence === 'number' ? Number(confidence) : undefined,
    };
  }

  // tempo
  if (features['tempo_bpm'] != null || features['beat_strength'] != null) {
    core.tempo = {
      bpm: Number(features['tempo_bpm'] ?? '' ) || undefined,
      beatStrength: Number(features['beat_strength'] ?? '' ) || undefined,
    };
  }

  // voice
  if (features['voiceProb_mean'] != null) {
    core.voice = { probability: Number(features['voiceProb_mean']) };
  }

  // hpss
  if (features['percussiveRatio_mean'] != null || features['harmonicRatio_mean'] != null) {
    core.hpss = {
      percussiveRatio: Number(features['percussiveRatio_mean'] ?? '' ) || undefined,
      harmonicRatio: Number(features['harmonicRatio_mean'] ?? '' ) || undefined,
    };
  }

  // timbre（若存在增强统计）
  if (
    features['timbreStats.avgWarmth'] != null ||
    features['timbreStats.avgBrightness'] != null ||
    features['timbreStats.avgRoughness'] != null
  ) {
    core.timbre = {
      warmth: Number(features['timbreStats.avgWarmth'] ?? '' ) || undefined,
      brightness: Number(features['timbreStats.avgBrightness'] ?? '' ) || undefined,
      roughness: Number(features['timbreStats.avgRoughness'] ?? '' ) || undefined,
    };
  }

  // 能量/响度（通俗指标）
  if (features['loudness_lkfs'] != null || features['dynamic_range'] != null) {
    core.energy = {
      loudnessLKFS: Number(features['loudness_lkfs'] ?? '' ) || undefined,
      dynamicRange: Number(features['dynamic_range'] ?? '' ) || undefined,
    };
  }

  return core;
}

function buildSummaryTokens(core: Record<string, unknown>): string {
  const tokens: string[] = [];
  const style = (core.style as any) || {};
  const instruments = (core.instruments as any) || {};
  const tempo = (core.tempo as any) || {};
  const voice = (core.voice as any) || {};
  const hpss = (core.hpss as any) || {};

  if (style.label) tokens.push(`style=${style.label}`);
  if (instruments.primary) tokens.push(`instrument=${instruments.primary}`);
  if (typeof tempo.bpm === 'number') tokens.push(`bpm=${Math.round(tempo.bpm)}`);
  if (typeof voice.probability === 'number') tokens.push(`voiceProb=${Number(voice.probability).toFixed(2)}`);
  if (typeof hpss.percussiveRatio === 'number') tokens.push(`percRatio=${Number(hpss.percussiveRatio).toFixed(2)}`);

  return tokens.join('; ');
}

// 简单的内存缓存（Edge Runtime中可用）
const cache = new Map<
  string,
  {
    style: string;
    confidence: number;
    talking_points: string[];
    comments: string[];
  }
>();

// 智谱AI配置
const ZHIPU_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY || '';
const ENABLE_COMMENT_FALLBACK = process.env.ENABLE_COMMENT_FALLBACK === 'true';
const PROMPT_VERSION = 'v2-humanlike';

// 调试：检查API密钥是否加载
console.log(
  '🎵 ZHIPU_API_KEY 状态:',
  ZHIPU_API_KEY ? '已配置' : '未配置',
  ZHIPU_API_KEY ? `(${ZHIPU_API_KEY.substring(0, 10)}...)` : ''
);

// LLM生成评论函数
async function generateCommentsWithLLM(
  style: string,
  talkingPoints: string[],
  features: Record<string, unknown>,
  need: number,
  locale: string
): Promise<string[]> {
  if (!ZHIPU_API_KEY) {
    if (!ENABLE_COMMENT_FALLBACK) {
      console.warn('智谱AI API密钥未配置，且已禁用默认评论，返回空结果');
      return [];
    }
    console.warn('智谱AI API密钥未配置，使用规则引擎fallback');
    return generateCommentsByStyle(style, talkingPoints, need, locale);
  }

  try {
    console.log('🎵 开始调用智谱AI API:', {
      style,
      talkingPoints,
      need,
      locale,
    });

    // 构建 Core JSON 与 Summary tokens（仅包含存在的字段）
    const coreJson = buildCoreJson(features);
    const summaryTokens = buildSummaryTokens(coreJson);

    const prompt = `你是资深乐迷主播，基于下列信息生成${need}条“更像真人说话”的弹幕：

风格: ${style}
要点: ${talkingPoints.join(', ')}
语言: ${locale === 'zh-CN' ? '中文' : 'English'}

核心数据（只读，务必依据这些事实）：
${JSON.stringify(coreJson)}

摘要（英文token，便于对齐事实）：
${summaryTokens}

写作准则（严格遵守）：
1) 口语化+现场感：允许轻微口头禅/拟声词（如“哇”“嘿”“嗖的一下”），每条至多1个轻表情（如😉/😮/🔥）。
2) 长短句交错：每条随机在12–40字之间，避免整齐划一。
3) 具体听感钩子：用“踩镲/落点/和声堆叠/上行线/泛音/低频抬升/切分”等具体词，而非空泛形容。
4) 互动感：大约1/4的句子可以带轻微提问或呼应（如“这段你也喜欢吗？”），但不要每条都问。
5) 去模板化：避免重复用语（如“轻盈/舒适/层次分明/行云流水”等老词），不要复述上面要点原词。
6) 禁止输出解释或额外文字，仅输出JSON数组。

只输出JSON数组：[{...}]，示例：
["低频今天格外厚，耳机里像有人在身后推你一把😮", "踩镲一扫就把节奏拎起来了，脚跟止不住点点点", "这段solo有戏！你也听到那个小泛音了吗？好上头～"]`;

    console.log('🎵 发送API请求到智谱AI...');
    const response = await fetch(ZHIPU_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ZHIPU_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'glm-4.5-air',
        messages: [
          {
            role: 'system',
            content:
              '你是一名资深乐迷主播，语气自然不做作，敢用口语与具体听感词；你擅长在技术暗示与情绪表达之间找到平衡，让弹幕像“人”说的话。严禁输出除JSON外的任何解释。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.95, // 提高创造性
        max_tokens: 2000,
        thinking: {
          type: 'disabled',
        },
        stream: false,
      }),
      signal: AbortSignal.timeout(4000), // 4秒超时
    });

    console.log('🎵 API响应状态:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('🎵 API请求失败:', response.status, errorText);
      throw new Error(`API请求失败: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('🎵 API返回数据:', data);

    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error('🎵 API返回内容为空:', data);
      throw new Error('API返回内容为空');
    }

    console.log('🎵 解析API返回内容:', content);

    // 解析JSON数组
    const comments = JSON.parse(content);
    if (!Array.isArray(comments)) {
      console.error('🎵 API返回格式不正确:', comments);
      throw new Error('API返回格式不正确');
    }

    console.log('🎵 成功生成评论:', comments);
    return comments.slice(0, need);
  } catch (error) {
    if (!ENABLE_COMMENT_FALLBACK) {
      console.warn('LLM生成失败，且已禁用默认评论，返回空结果:', error);
      return [];
    }
    console.warn('LLM生成失败，使用规则引擎fallback:', error);
    return generateCommentsByStyle(style, talkingPoints, need, locale);
  }
}

// 生成特征hash用于缓存
function generateFeatureHash(features: Record<string, unknown>): string {
  const key = [
    Math.round(Number(features.tempo_bpm) || 120),
    Math.round((Number(features.spectralFlatness_mean) || 0.5) * 100),
    Math.round((Number(features.spectralCentroid_mean) || 2000) / 100),
    Math.round((Number(features.rms_mean) || 0.1) * 1000),
  ].join('-');
  return key;
}

// 快速规则引擎 - 基于文档中的策略
function fastHeuristic(features: Record<string, unknown>) {
  const tempo = Number(features.tempo_bpm) || 120;
  const flatness = Number(features.spectralFlatness_mean) || 0.5;
  const contrast = Array.isArray(features.spectralContrast_mean)
    ? (features.spectralContrast_mean as number[])[0] || 0.5
    : 0.5;
  const centroid = Number(features.spectralCentroid_mean) || 2000;
  const rms = Number(features.rms_mean) || 0.1;
  const zcr = Number(features.zcr_mean) || 0.1;
  const voice = Number(features.voiceProb_mean) || 0;
  const percussive = Number(features.percussiveRatio_mean) || 0;
  const harmonic = Number(features.harmonicRatio_mean) || 0;

  if (voice > 0.55 && tempo >= 90 && tempo <= 140) {
    return {
      style: 'pop_vocal',
      confidence: 0.86,
      talking_points: ['主唱突出', '旋律性强', '节奏明快', '适合现场合唱'],
    };
  } else if (percussive > 0.6 && tempo >= 118 && tempo <= 136) {
    return {
      style: 'techno_percussive',
      confidence: 0.83,
      talking_points: ['强烈四拍', '机械质感', '低频冲击', '适合舞池'],
    };
  } else if (voice < 0.2 && harmonic > 0.55 && tempo < 110 && flatness > 0.5) {
    return {
      style: 'ambient_harmonic',
      confidence: 0.8,
      talking_points: ['氛围铺陈', '和声堆叠', '慢速沉浸', '空间感强'],
    };
  } else if (tempo >= 130 && tempo <= 142 && centroid > 3000 && voice < 0.4) {
    return {
      style: 'trance_instrumental',
      confidence: 0.8,
      talking_points: ['渐进铺垫', '合成器上升线', '空间延展', '迷离氛围'],
    };
  } else if (tempo >= 100 && tempo <= 135 && zcr > 0.3 && voice > 0.35) {
    return {
      style: 'rock_vocal',
      confidence: 0.82,
      talking_points: ['吉他驱动', '鼓组推进', '人声张力', '舞台能量'],
    };
  } else if (tempo >= 80 && tempo <= 110 && percussive > 0.45 && voice > 0.5) {
    return {
      style: 'hiphop_vocal',
      confidence: 0.78,
      talking_points: ['低频律动', '人声说唱', '节奏切分', '街头氛围'],
    };
  } else if (tempo >= 120 && tempo <= 140 && flatness < 0.45 && voice < 0.4) {
    return {
      style: 'edm_instrumental',
      confidence: 0.78,
      talking_points: ['四踩节奏', '合成器堆叠', '低频力量', '舞池友好'],
    };
  } else if (tempo < 90 && flatness > 0.6 && harmonic > 0.5) {
    return {
      style: 'ambient_harmonic',
      confidence: 0.76,
      talking_points: ['氛围音乐', '空灵感', '缓慢节奏', '冥想感'],
    };
  } else if (tempo >= 80 && tempo <= 160 && contrast > 0.7) {
    return {
      style: 'jazz_ensemble',
      confidence: 0.74,
      talking_points: ['即兴演奏', '复杂和声', '自由节奏', '爵士味道'],
    };
  } else if (voice <= 0.3 && rms > 0.25 && percussive > 0.4) {
    return {
      style: 'electronic_instrumental',
      confidence: 0.72,
      talking_points: ['电子律动', '合成器主导', '节奏推进', '现代感'],
    };
  } else if (centroid > 4000 && rms > 0.2 && voice < 0.3) {
    return {
      style: 'electronic_club',
      confidence: 0.65,
      talking_points: ['高频明亮', '俱乐部氛围', '电子节拍', '能量充沛'],
    };
  } else if (tempo < 80 && flatness > 0.7 && voice < 0.1) {
    return {
      style: 'drone_ambient',
      confidence: 0.63,
      talking_points: ['持续低音', '冥想氛围', '时间拉伸', '极简主义'],
    };
  } else if (voice > 0.7 && tempo < 100 && harmonic > 0.7) {
    return {
      style: 'singer_songwriter',
      confidence: 0.67,
      talking_points: ['情感表达', '原声乐器', '歌词突出', '私人化'],
    };
  } else if (percussive > 0.8 && tempo > 140) {
    return {
      style: 'breakbeat_hardcore',
      confidence: 0.64,
      talking_points: ['复杂切分', '高速冲击', '碎片化节奏', '高强度'],
    };
  } else if (harmonic > 0.8 && voice < 0.15 && tempo > 110) {
    return {
      style: 'classical_electronic',
      confidence: 0.62,
      talking_points: ['复杂和声', '电子模拟', '结构严谨', '艺术性'],
    };
  } else {
    // 随机选择一个默认风格，避免总是pop_instrumental
    const defaultStyles = [
      { style: 'indie_experimental', talking_points: ['独立制作', '实验元素', '非常规结构', '个性化'] },
      { style: 'minimal_techno', talking_points: ['简约重复', '微观变化', '空间感', ' hypnotic'] },
      { style: 'fusion_rock', talking_points: ['风格融合', '技巧展示', '即兴演奏', '跨界'] },
      { style: 'dream_pop', talking_points: ['梦幻质感', '音墙效果', '氛围营造', '朦胧美感'] },
    ];
    const randomChoice = defaultStyles[Math.floor(Math.random() * defaultStyles.length)];
    return {
      style: randomChoice.style,
      confidence: 0.6,
      talking_points: randomChoice.talking_points,
    };
  }
}

// 基于风格生成个性化评论 - 已禁用模板备用方案，强制使用LLM
function generateCommentsByStyle(
  style: string,
  talkingPoints: string[],
  need: number,
  locale: string
): string[] {
  // 强制返回空数组，让调用者使用LLM生成
  return [];
}

export async function POST(req: Request) {
  let input: AnalyzeRequest = {};
  try {
    input = await req.json();
  } catch {}

  const need = Math.max(1, Math.min(8, Number(input.need_comments ?? 4)));
  const locale = (input.locale as string) || 'zh-CN';
  const features = input.features || {};
  const no_cache = Boolean(input.no_cache);

  // 检查缓存
  const featureHash = generateFeatureHash(features);
  const cacheKey = `${PROMPT_VERSION}-${featureHash}-${locale}-${need}`;

  let style: string,
    confidence: number,
    talking_points: string[],
    comments: string[];

  if (!no_cache && cache.has(cacheKey)) {
    // 缓存命中，立即返回
    const cached = cache.get(cacheKey)!;
    style = cached.style;
    confidence = cached.confidence;
    talking_points = cached.talking_points;
    comments = cached.comments.slice(0, need);
  } else {
    // 缓存未命中，使用快速规则引擎进行风格检测（<5ms响应）
    const result = fastHeuristic(features);
    style = result.style;
    confidence = result.confidence;
    talking_points = result.talking_points;

    // 使用LLM生成个性化评论（带fallback）
    comments = await generateCommentsWithLLM(
      style,
      talking_points,
      features,
      need,
      locale
    );

    // 缓存结果（限制缓存大小）
    if (!no_cache && cache.size < 100) {
      cache.set(cacheKey, { style, confidence, talking_points, comments });
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // 立即返回风格检测结果（<5ms响应）
      controller.enqueue(
        encode(
          JSON.stringify({
            type: 'style',
            style: style,
            confidence: confidence,
          }) + '\n'
        )
      );

      // 流式返回评论（模拟LLM生成过程）
      for (let i = 0; i < comments.length; i++) {
        // 模拟生成延迟：首条快速，后续稍慢
        const delay = i === 0 ? 100 : 200 + Math.floor(Math.random() * 200);
        await sleep(delay);

        controller.enqueue(
          encode(
            JSON.stringify({ type: 'comment', idx: i, text: comments[i] }) +
              '\n'
          )
        );
      }

      controller.enqueue(encode(JSON.stringify({ type: 'done' }) + '\n'));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-store',
    },
  });
}