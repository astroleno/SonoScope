import fs from 'fs';

async function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

async function main() {
  // Load env.local.json if exists
  let env = {};
  try {
    const raw = fs.readFileSync('./env.local.json', 'utf8');
    env = JSON.parse(raw);
  } catch {}

  const url = process.env.ZHIPU_API_URL || env.NEXT_PUBLIC_GLM_URL || 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
  const apiKey = process.env.ZHIPU_API_KEY || env.NEXT_PUBLIC_GLM_API_KEY || '';
  if (!apiKey) {
    console.error('Missing ZHIPU_API_KEY or NEXT_PUBLIC_GLM_API_KEY');
    process.exit(1);
  }

  // Minimal features
  const need = Number(process.argv[2] || 3);
  const locale = 'zh-CN';
  const style = 'techno_percussive';
  const talkingPoints = ['强烈四拍', '低频冲击', '机械质感'];
  const features = {
    tempo_bpm: 128,
    beat_strength: 0.78,
    voiceProb_mean: 0.12,
    percussiveRatio_mean: 0.42,
    harmonicRatio_mean: 0.58,
    dominantInstrument: 'drums',
    instrumentHistogram: { drums: 0.8, piano: 0.1, guitar: 0.05 },
    instrumentConfidence: 0.8,
  };

  const coreJson = {
    style: { label: style, confidence: 0.83 },
    instruments: {
      primary: 'drums',
      probabilities: features.instrumentHistogram,
      confidence: 0.8,
    },
    tempo: { bpm: features.tempo_bpm, beatStrength: features.beat_strength },
    voice: { probability: features.voiceProb_mean },
    hpss: {
      percussiveRatio: features.percussiveRatio_mean,
      harmonicRatio: features.harmonicRatio_mean,
    },
  };

  const tokens = [
    `style=${coreJson.style.label}`,
    `instrument=${coreJson.instruments.primary}`,
    `bpm=${coreJson.tempo.bpm}`,
    `voiceProb=${coreJson.voice.probability}`,
    `percRatio=${coreJson.hpss.percussiveRatio}`,
  ].join('; ');

  const prompt = `你是资深乐迷主播，基于下列信息生成${need}条“更像真人说话”的弹幕：\n\n风格: ${style}\n要点: ${talkingPoints.join(', ')}\n语言: ${locale === 'zh-CN' ? '中文' : 'English'}\n\n核心数据（只读，务必依据这些事实）：\n${JSON.stringify(coreJson)}\n\n摘要（英文token，便于对齐事实）：\n${tokens}\n\n写作准则（严格遵守）：\n1) 口语化+现场感：允许轻微口头禅/拟声词（如“哇”“嘿”“嗖的一下”），每条至多1个轻表情（如😉/😮/🔥）。\n2) 长短句交错：每条随机在12–40字之间，避免整齐划一。\n3) 具体听感钩子：用“踩镲/落点/和声堆叠/上行线/泛音/低频抬升/切分”等具体词，而非空泛形容。\n4) 互动感：大约1/4的句子可以带轻微提问或呼应（如“这段你也喜欢吗？”），但不要每条都问。\n5) 去模板化：避免重复用语（如“轻盈/舒适/层次分明/行云流水”等老词），不要复述上面要点原词。\n6) 禁止输出解释或额外文字，仅输出JSON数组。\n\n只输出JSON数组：[{...}]，示例：\n["低频今天格外厚，耳机里像有人在身后推你一把😮", "踩镲一扫就把节奏拎起来了，脚跟止不住点点点", "这段solo有戏！你也听到那个小泛音了吗？好上头～"]`;

  const body = {
    model: 'glm-4.5-air',
    messages: [
      {
        role: 'system',
        content:
          '你是一名资深乐迷主播，语气自然不做作，敢用口语与具体听感词；你擅长在技术暗示与情绪表达之间找到平衡，让弹幕像“人”说的话。严禁输出除JSON外的任何解释。',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.95,
    max_tokens: 600,
    thinking: { type: 'disabled' },
    stream: false,
  };

  console.log('Calling GLM with url:', url.replace(/(https?:\/\/).+/, '$1***'), 'key len:', apiKey.length);

  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 30000); // 30s timeout
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(t);

      console.log('HTTP status:', res.status);
      const data = await res.json().catch(() => ({}));
      const content = data?.choices?.[0]?.message?.content || '';

      let arr = [];
      try {
        arr = JSON.parse(content);
      } catch {
        console.log('Raw content:', content);
      }

      if (Array.isArray(arr)) {
        console.log('Sample comments:', arr.slice(0, need));
      } else {
        console.log('Unexpected format:', data);
      }
      return;
    } catch (e) {
      lastErr = e;
      console.warn(`Attempt ${attempt + 1} failed:`, e?.code || e?.message || e);
      if (attempt < 2) await sleep(1000 * Math.pow(2, attempt));
    }
  }
  console.error('Smoke error after retries:', lastErr);
  process.exit(1);
}

main().catch((e) => {
  console.error('Smoke error:', e);
  process.exit(1);
});
