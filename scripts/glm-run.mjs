import fs from 'fs';

async function readJsonFromArgOrStdin(argPath) {
  if (argPath && argPath !== '-') {
    const raw = fs.readFileSync(argPath, 'utf8');
    return JSON.parse(raw);
  }
  // read from stdin
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return JSON.parse(raw || '{}');
}

function buildCoreJson(features) {
  const core = {};
  // style
  if (typeof features.style_label === 'string' || typeof features.style === 'string') {
    core.style = {
      label: features.style_label || features.style,
      confidence: Number(features.style_confidence ?? features.instrumentConfidence ?? '') || undefined,
    };
  }
  // instruments
  if (typeof features.dominantInstrument === 'string' || features.instrumentHistogram || typeof features.instrumentConfidence === 'number') {
    core.instruments = {
      primary: features.dominantInstrument || undefined,
      probabilities: features.instrumentHistogram || undefined,
      confidence: typeof features.instrumentConfidence === 'number' ? features.instrumentConfidence : undefined,
    };
  }
  // tempo
  if (features.tempo_bpm != null || features.beat_strength != null) {
    core.tempo = {
      bpm: Number(features.tempo_bpm ?? '' ) || undefined,
      beatStrength: Number(features.beat_strength ?? '' ) || undefined,
    };
  }
  // voice
  if (features.voiceProb_mean != null) {
    core.voice = { probability: Number(features.voiceProb_mean) };
  }
  // hpss
  if (features.percussiveRatio_mean != null || features.harmonicRatio_mean != null) {
    core.hpss = {
      percussiveRatio: Number(features.percussiveRatio_mean ?? '' ) || undefined,
      harmonicRatio: Number(features.harmonicRatio_mean ?? '' ) || undefined,
    };
  }
  // timbre
  if (features['timbreStats.avgWarmth'] != null || features['timbreStats.avgBrightness'] != null || features['timbreStats.avgRoughness'] != null) {
    core.timbre = {
      warmth: Number(features['timbreStats.avgWarmth'] ?? '' ) || undefined,
      brightness: Number(features['timbreStats.avgBrightness'] ?? '' ) || undefined,
      roughness: Number(features['timbreStats.avgRoughness'] ?? '' ) || undefined,
    };
  }
  // energy
  if (features.loudness_lkfs != null || features.dynamic_range != null) {
    core.energy = {
      loudnessLKFS: Number(features.loudness_lkfs ?? '' ) || undefined,
      dynamicRange: Number(features.dynamic_range ?? '' ) || undefined,
    };
  }
  return core;
}

function buildTokens(core) {
  const tokens = [];
  const style = core.style || {};
  const instruments = core.instruments || {};
  const tempo = core.tempo || {};
  const voice = core.voice || {};
  const hpss = core.hpss || {};
  if (style.label) tokens.push(`style=${style.label}`);
  if (instruments.primary) tokens.push(`instrument=${instruments.primary}`);
  if (typeof tempo.bpm === 'number') tokens.push(`bpm=${Math.round(tempo.bpm)}`);
  if (typeof voice.probability === 'number') tokens.push(`voiceProb=${Number(voice.probability).toFixed(2)}`);
  if (typeof hpss.percussiveRatio === 'number') tokens.push(`percRatio=${Number(hpss.percussiveRatio).toFixed(2)}`);
  return tokens.join('; ');
}

async function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

async function main() {
  // args: node scripts/glm-run.mjs <features.json|-> <need=3> <locale=zh-CN>
  const argPath = process.argv[2] || '-';
  const need = Number(process.argv[3] || 3);
  const locale = process.argv[4] || 'zh-CN';

  const features = await readJsonFromArgOrStdin(argPath);
  const core = buildCoreJson(features);
  const tokens = buildTokens(core);

  const styleLabel = (core.style && core.style.label) || 'electronic';
  const talkingPoints = [];
  // minimal points derived from presence of features
  if (core.tempo?.bpm) talkingPoints.push(`${Math.round(core.tempo.bpm)}BPM`);
  if (core.instruments?.primary) talkingPoints.push(String(core.instruments.primary));
  if (core.hpss?.percussiveRatio != null) talkingPoints.push('节奏推进');

  // env
  let env = {};
  try {
    env = JSON.parse(fs.readFileSync('./env.local.json', 'utf8'));
  } catch {}
  const url = process.env.ZHIPU_API_URL || env.NEXT_PUBLIC_GLM_URL || 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
  const apiKey = process.env.ZHIPU_API_KEY || env.NEXT_PUBLIC_GLM_API_KEY || '';
  if (!apiKey) {
    console.error('Missing ZHIPU_API_KEY or NEXT_PUBLIC_GLM_API_KEY');
    process.exit(1);
  }

  const prompt = `你是资深乐迷主播，基于下列信息生成${need}条“更像真人说话”的弹幕：\n\n风格: ${styleLabel}\n要点: ${talkingPoints.join(', ')}\n语言: ${locale === 'zh-CN' ? '中文' : 'English'}\n\n核心数据（只读，务必依据这些事实）：\n${JSON.stringify(core)}\n\n摘要（英文token，便于对齐事实）：\n${tokens}\n\n写作准则（严格遵守）：\n1) 口语化+现场感：允许轻微口头禅/拟声词（如“哇”“嘿”“嗖的一下”），每条至多1个轻表情（如😉/😮/🔥）。\n2) 长短句交错：每条随机在12–40字之间，避免整齐划一。\n3) 具体听感钩子：用“踩镲/落点/和声堆叠/上行线/泛音/低频抬升/切分”等具体词，而非空泛形容。\n4) 互动感：大约1/4的句子可以带轻微提问或呼应（如“这段你也喜欢吗？”），但不要每条都问。\n5) 去模板化：避免重复用语（如“轻盈/舒适/层次分明/行云流水”等老词），不要复述上面要点原词。\n6) 禁止输出解释或额外文字，仅输出JSON数组。\n\n只输出JSON数组：[{...}]`;

  const body = {
    model: 'glm-4.5-air',
    messages: [
      { role: 'system', content: '你是一名资深乐迷主播，语气自然不做作，敢用口语与具体听感词；严禁输出除JSON外的任何解释。' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.95,
    max_tokens: 600,
    thinking: { type: 'disabled' },
    stream: false,
  };

  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 30000);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(t);

      const status = res.status;
      const data = await res.json().catch(()=>({}));
      const content = data?.choices?.[0]?.message?.content || '';
      let arr = [];
      try { arr = JSON.parse(content); } catch {}
      console.log('HTTP', status);
      if (Array.isArray(arr)) {
        console.log(JSON.stringify(arr.slice(0, need), null, 2));
      } else {
        console.log('Raw', content);
      }
      return;
    } catch (e) {
      lastErr = e;
      if (attempt < 2) await sleep(1000 * Math.pow(2, attempt));
    }
  }
  console.error('Failed after retries:', lastErr?.code || lastErr?.message || lastErr);
  process.exit(1);
}

main().catch(e=>{console.error('Fatal',e);process.exit(1);});
