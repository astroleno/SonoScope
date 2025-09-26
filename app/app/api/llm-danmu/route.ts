import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

type LlmDanmu = {
  text: string;
  style: 'beat' | 'voice' | 'complexity' | 'random' | 'manual';
  color?: string;
  size?: number;
  speed?: number;
  cooldownMs?: number;
};

function readConfig() {
  const envKey = process.env.NEXT_PUBLIC_GLM_API_KEY;
  const envUrl = process.env.NEXT_PUBLIC_GLM_URL;
  let apiKey = envKey;
  let url = envUrl;
  if (!apiKey || !url) {
    const candidates = [
      path.resolve(process.cwd(), 'env.local.json'),
      path.resolve(process.cwd(), '../env.local.json'),
      path.resolve(process.cwd(), '../../env.local.json'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        try {
          const raw = fs.readFileSync(p, 'utf8');
          const j = JSON.parse(raw);
          apiKey = apiKey || j.NEXT_PUBLIC_GLM_API_KEY;
          url = url || j.NEXT_PUBLIC_GLM_URL;
          break;
        } catch {}
      }
    }
  }
  return { apiKey, url };
}

export async function POST(req: Request) {
  try {
    const { apiKey, url } = readConfig();
    if (!apiKey || !url) {
      return NextResponse.json({ success: false, error: 'Missing GLM config' }, { status: 500 });
    }
    const body = await req.json().catch(() => ({} as any));
    const features = body?.features || {};

    // Phase 1 参数解析（带默认值，兼容旧调用）
    const needDanmu = Math.max(1, Math.floor(body?.needDanmu ?? 3));
    const encouragementExtraMin = Math.max(0, Math.floor(body?.encouragementExtraMin ?? 0));
    const encouragementExtraMax = Math.max(encouragementExtraMin, Math.floor(body?.encouragementExtraMax ?? encouragementExtraMin));
    const personaId: string = String(body?.personaId ?? 'auto');
    const personaMix: string[] = Array.isArray(body?.personaMix) ? body.personaMix.filter((x: any)=> typeof x === 'string') : [];
    const existingDanmu: string[] = Array.isArray(body?.existingDanmu) ? body.existingDanmu.slice(-50) : [];
    const maxLength = Math.min(60, Math.max(30, Math.floor(body?.maxLength ?? 42)));
    const enableDedup = body?.enableDedup !== false;
    const dedupNgram = Math.max(2, Math.min(5, Math.floor(body?.dedupNgram ?? 3)));
    const dedupAgainstHistory = body?.dedupAgainstHistory !== false;
    const dedupAgainstBatch = body?.dedupAgainstBatch !== false;
    const enableEmojiControl = body?.enableEmojiControl !== false;
    // 禁止 Emoji：默认 0 个/项，整体 0%
    const maxEmojiPerItem = Math.max(0, Math.floor(body?.maxEmojiPerItem ?? 0));
    const maxEmojiRatio = Math.max(0, Math.min(1, Number(body?.maxEmojiRatio ?? 0)));
    // Phase 2 采样参数（可选）
    const optTemperature = Number.isFinite(Number(body?.temperature)) ? Number(body?.temperature) : undefined;
    const optTopP = Number.isFinite(Number(body?.top_p)) ? Number(body?.top_p) : undefined;
    const optFreqPenalty = Number.isFinite(Number(body?.frequency_penalty)) ? Number(body?.frequency_penalty) : undefined;
    const optPresencePenalty = Number.isFinite(Number(body?.presence_penalty)) ? Number(body?.presence_penalty) : undefined;
    // Phase 2 多样性与 AB 分桶
    const personaDiversity = Math.max(0, Math.min(1, Number(body?.personaDiversity ?? 0)));
    const abBucket = body?.abBucket != null ? String(body.abBucket) : undefined;

    // PERSONAS 表 & 选择
    const PERSONAS: { id: string; styleHint: string }[] = [
      { id: 'quiet',      styleHint: '安静细腻，轻声细语，口语偏向日常' },
      { id: 'cheer',      styleHint: '开朗热情，但不过度夸张，适度感叹号' },
      { id: 'steady',     styleHint: '稳重可靠，短句有力量，给予安心感' },
      { id: 'playful',    styleHint: '活泼有趣，偶尔自我调侃，轻松自然' },
      { id: 'critic',     styleHint: '专业乐评人视角，关注节奏型/织体/配器/混音空间/音色层次，用词克制、具体' },
      { id: 'enthusiast', styleHint: '音乐爱好者视角，真实个人感受+简单术语，如“前段人声贴面”“鼓点很干净”' },
    ];
    const pickSomeLocal = (arr: string[], n: number) => {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a.slice(0, Math.max(1, n));
    };
    const pickPersona = (id: string): { id: string; styleHint: string } => {
      if (id && id !== 'auto') {
        const found = PERSONAS.find(p => p.id === id);
        if (found) return found;
      }
      // auto：随机选择一个
      return PERSONAS[Math.floor(Math.random() * PERSONAS.length)];
    };
    const persona = pickPersona(personaId);
    const personaMixFinal = personaMix.length
      ? personaMix.filter(id => PERSONAS.some(p => p.id === id)).slice(0, 3)
      : pickSomeLocal(PERSONAS.map(p=>p.id), 2);
    const personaMixHint = personaMixFinal.map(id => {
      const p = PERSONAS.find(x=>x.id===id);
      return p ? `${p.id}:${p.styleHint}` : id;
    }).join(' / ');

    const encouragementRange = encouragementExtraMax > 0 ? `，并额外生成${encouragementExtraMin}-${encouragementExtraMax}条“鼓励/陪伴型”弹幕` : '';

    // Prompt 升级：系统 + 用户
    const systemPrompt = `仅输出 JSON 数组，无解释/无 Markdown/无注释；每项包含字段 text/style/color/size/speed/cooldownMs；\n`+
      `style 仅限 beat|voice|complexity|random|manual；文本不得含换行与首尾空白；以中文为主；禁止使用 Emoji。`;

    // 轻量音乐锚点词库（避免模板化，仅作为提示，不做替换）
    const MUSIC_ANCHOR_TERMS = [
      '节奏', '拍子', '律动', '速度', '切分',
      '旋律', '走向', '旋律线',
      '和声', '转调', '和弦',
      '音色', '亮度', '温暖', '厚度', '清晰', '颗粒感',
      '鼓点', '低音', '高音', '贝斯', '人声', '空间感', '混响', '延迟', '失真'
    ];
    const pickSome = (arr: string[], n: number) => {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a.slice(0, Math.max(1, n));
    };
    const anchorHints = pickSome(MUSIC_ANCHOR_TERMS, 8).join(' / ');

    // 基于 personaDiversity 的轻微抖动提示
    const jitterHint = personaDiversity > 0 ? `（本批微调：${personaDiversity < 0.34 ? '更安静' : personaDiversity < 0.67 ? '更稳' : '更活泼'}）` : '';

    const userPrompt = `角色：${persona.id}（风格：${persona.styleHint}）${jitterHint}\n`+
      `历史弹幕：${existingDanmu.length ? existingDanmu.join(' / ') : '无'}\n`+
      `请生成 ${needDanmu} 条常规弹幕${encouragementRange}，仅以严格 JSON 数组返回（不要任何解释、前后缀）。\n`+
      `写作规范：\n`+
      `0) 本批请混合多角色视角：从以下中自然混合2-3种风格（不标注身份，仅体现在语言上）：${personaMixHint}。\n`+
      `1) 可以使用第一/第二人称，但不强求；避免口号式同情与拉同伴感（如“我们一起/一起…/我在这里陪你”）。句长 6–20 字。\n`+
      `2) 口语化，允许少量停顿词（嗯/呀/哈/…），每条最多 1 个；Emoji 禁止（每条 0 个、总体 0%）。\n`+
      `3) 每条需包含至少一个与当前音乐相关的“锚点”词（如：节奏/旋律/音色/鼓点/高音/低音/和声/速度/拍/律动/高频/低频/亮/厚/清/浑等），避免空泛安慰。\n`+
      `   鼓励用更口语、更日常的表达，尽量避免书面套话。\n`+
      `4) 与“历史弹幕”避免 3-gram 以上重叠；同批尽量不重复。\n`+
      `4) 鼓励/陪伴型可使用 style=manual 与柔和配色。\n`+
      `5) 减少“过度煽情”的表达（如：不孤单/一切都会好/拥抱你/别难过/你值得/治愈/温暖的陪伴/加油）；可温和、节制。\n`+
      `6) 多样化句式：有的以动词开头（比如“跟着…/换个…听听”），有的以观察开头（“这段…/这里…”），长度上短句与中等句混合。\n`+
      `7) 结合音频特征线索做隐喻/比拟，尽量用具体的画面和具象的感官词，可以是细致入微的描写，也可以是场景的类比，避免宏大的人生化抒情。\n`+
      `可参考锚点：${anchorHints}\n`+
      `线索：${JSON.stringify(features).slice(0, 800)}`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'glm-4.5-air',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        // 采样参数：若传入则覆盖默认
        temperature: typeof optTemperature === 'number' ? optTemperature : 1,
        top_p: typeof optTopP === 'number' ? optTopP : undefined,
        frequency_penalty: typeof optFreqPenalty === 'number' ? optFreqPenalty : undefined,
        presence_penalty: typeof optPresencePenalty === 'number' ? optPresencePenalty : undefined,
        thinking: { type: 'disabled' },  // 禁用思考模式
      }),
      signal: AbortSignal.timeout(20000),  // 增加到20秒，避免模型响应超时
    });

    if (!resp.ok) {
      const t = await resp.text();
      return NextResponse.json({ success: false, error: `LLM error: ${resp.status} ${t}` }, { status: 502 });
    }
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content;

    // 容错解析：允许字符串/对象包裹
    const tryExtractArray = (raw: any): any[] | null => {
      try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Array.isArray(parsed)) return parsed;
        if (parsed && Array.isArray(parsed.data)) return parsed.data;
        if (parsed && Array.isArray(parsed.items)) return parsed.items;
      } catch {}
      return null;
    };

    let danmuList: LlmDanmu[] = [];
    const arr = tryExtractArray(content);
    if (arr) {
      danmuList = arr.filter((item: any) => item && typeof item.text === 'string');
    }

    if (!danmuList.length) {
      return NextResponse.json({ success: false, error: 'No valid danmu generated' }, { status: 500 });
    }

    // 归一化、字素簇、长度、emoji/标点控制、模板黑名单过滤、去重
    // 使用代理对检测 emoji（兼容 ES5 目标），不依赖 Unicode 属性类
    const emojiRegex = /[\uD800-\uDBFF][\uDC00-\uDFFF]/;
    const emojiGlobal = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;
    const ellipsisRegex = /\.{3,}/g; // ... 压缩为 …
    const multiExclaim = /!{2,}/g;
    const multiQuestion = /\?{2,}/g;
    const multiDots = /。{2,}/g;

    // 句式模板黑名单（Phase 2）：命中则过滤或降权（此处直接过滤）
    const TEMPLATE_BLACKLIST: RegExp[] = [
      // 模板化夸赞
      /太棒了/, /好听/, /不错/, /喜欢这个/, /继续播放/, /很有感觉/,
      /节奏感很强/, /音色很美/, /很棒的音乐/, /节奏不错/, /音质很好/, /很有创意/,
      // 过度煽情话术（鼓励但脱离音乐锚点）
      /不孤单/, /一切都会好/, /拥抱你/, /别难过/, /你值得/, /治愈/, /温暖的陪伴/, /加油(?!鼓点)/,
      // 模板化比喻/人生化表达
      /像.*一样/, /人生/, /让我(们)?/,
      // 口号式/拉同伴表达（降低“出戏感”）
      /我们一起/, /^一起[，,。！]?/, /我在这里陪你/
    ];

    const toHalfWidth = (input: string): string => {
      return input.replace(/[\uFF01-\uFF5E]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)).replace(/\u3000/g, ' ');
    };
    const normalizeText = (input: string): string => {
      try {
        let t = String(input || '').trim();
        t = toHalfWidth(t);
        t = t.replace(/\s+/g, ' ');
        t = t.replace(ellipsisRegex, '…');
        t = t.replace(multiExclaim, '!');
        t = t.replace(multiQuestion, '?');
        t = t.replace(multiDots, '。');
        return t;
      } catch { return String(input || ''); }
    };
    const splitGraphemes = (str: string): string[] => {
      try {
        const seg = (Intl as any)?.Segmenter ? new (Intl as any).Segmenter(undefined, { granularity: 'grapheme' }) : null;
        if (seg) return Array.from(seg.segment(str), (s: any) => s.segment);
      } catch {}
      return Array.from(str);
    };
    const graphemeLength = (str: string): number => splitGraphemes(str).length;
    const truncateByGrapheme = (str: string, max: number): string => {
      const g = splitGraphemes(str);
      if (g.length <= max) return str;
      return g.slice(0, max).join('');
    };
    const extractNGram = (str: string, n = 3): string[] => {
      const g = splitGraphemes(normalizeText(str));
      const out: string[] = [];
      for (let i = 0; i <= g.length - n; i++) out.push(g.slice(i, i + n).join(''));
      return out;
    };

    const historyNgrams = new Set<string>(
      (dedupAgainstHistory ? existingDanmu : []).flatMap(t => extractNGram(t, dedupNgram))
    );
    const batchNgrams = new Set<string>();

    let filteredCount = 0;
    let dedupedCount = 0;
    let blacklistFilteredCount = 0;

    const processed: LlmDanmu[] = [];
    for (const raw of danmuList) {
      try {
        const originalText = String(raw.text || '');
        let text = normalizeText(originalText);

        // 长度控制（按字素计）
        if (graphemeLength(text) > maxLength) {
          text = truncateByGrapheme(text, maxLength);
          filteredCount++;
        }

        // Emoji 控制
        if (enableEmojiControl) {
          const emojis = (text.match(emojiGlobal) || []).length;
          if (emojis > maxEmojiPerItem) {
            // 简单去掉多余 emoji
            let count = 0;
            text = splitGraphemes(text).filter(g => {
              if (emojiRegex.test(g)) {
                if (count < maxEmojiPerItem) { count++; return true; }
                return false;
              }
              return true;
            }).join('');
            filteredCount++;
          }
        }

        // 模板黑名单过滤
        try {
          const hitTpl = TEMPLATE_BLACKLIST.some(r => r.test(text));
          if (hitTpl) {
            blacklistFilteredCount++;
            continue;
          }
        } catch {}

        // 去重（history + batch）
        if (enableDedup) {
          const grams = extractNGram(text, dedupNgram);
          const hitHistory = dedupAgainstHistory && grams.some(g => historyNgrams.has(g));
          const hitBatch = dedupAgainstBatch && grams.some(g => batchNgrams.has(g));
          if (hitHistory || hitBatch) {
            dedupedCount++;
            continue;
          }
          grams.forEach(g => batchNgrams.add(g));
        }

        // 字段兜底
        const item: LlmDanmu = {
          text,
          style: (raw.style as any) || 'manual',
          color: raw.color || '#A8FF60',
          size: Math.max(10, Math.min(36, Number(raw.size ?? 16))),
          speed: Math.max(0.5, Math.min(3, Number(raw.speed ?? 1.2))),
          cooldownMs: Math.max(500, Math.min(5000, Number(raw.cooldownMs ?? (1000 + Math.floor(Math.random()*800)))))
        };

        // personaDiversity 触发的轻微参数抖动（不影响文本）
        if (personaDiversity > 0) {
          try {
            const jitterScale = 1 + (Math.random() - 0.5) * 0.2 * personaDiversity; // ±10% * diversity
            item.size = Math.max(10, Math.min(36, Math.round(item.size * jitterScale)));
            item.speed = Math.max(0.5, Math.min(3, Number((item.speed * jitterScale).toFixed(2))));
          } catch {}
        }

        processed.push(item);
      } catch { /* 单条容错忽略 */ }
    }

    if (!processed.length) {
      return NextResponse.json({ success: false, error: 'All items filtered by quality/dedup' }, { status: 500 });
    }

    // 回退与补单：若过滤后数量不足目标 80%（这里以 needDanmu+encouragementExtraMin 作为下限）
    let reRequest = false;
    const targetMin = Math.max(needDanmu + encouragementExtraMin, needDanmu); // 简化下限
    if (processed.length < targetMin) {
      try {
        reRequest = true;
        // 追加用户提示，要求避开已产生文本
        const avoidList = processed.map(i => i.text).slice(-20);
        const userPrompt2 = userPrompt + `\n避免与以下文本重合：${avoidList.join(' / ')}`;
        const resp2 = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'glm-4.5-air',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt2 },
            ],
            response_format: { type: 'json_object' },
            temperature: typeof optTemperature === 'number' ? optTemperature : 1,
            top_p: typeof optTopP === 'number' ? optTopP : undefined,
            frequency_penalty: typeof optFreqPenalty === 'number' ? optFreqPenalty : undefined,
            presence_penalty: typeof optPresencePenalty === 'number' ? optPresencePenalty : undefined,
            thinking: { type: 'disabled' },
          }),
          signal: AbortSignal.timeout(20000),
        });
        if (resp2.ok) {
          const data2 = await resp2.json();
          const content2 = data2?.choices?.[0]?.message?.content;
          const arr2 = tryExtractArray(content2) || [];
          for (const raw of arr2) {
            try {
              const originalText = String(raw?.text || '');
              let text = normalizeText(originalText);
              if (graphemeLength(text) > maxLength) {
                text = truncateByGrapheme(text, maxLength);
              }
              if (enableEmojiControl) {
                const emojis = (text.match(emojiGlobal) || []).length;
                if (emojis > maxEmojiPerItem) {
                  let count = 0;
                  text = splitGraphemes(text).filter(g => {
                    if (emojiRegex.test(g)) {
                      if (count < maxEmojiPerItem) { count++; return true; }
                      return false;
                    }
                    return true;
                  }).join('');
                }
              }
              const hitTpl = TEMPLATE_BLACKLIST.some(r => r.test(text));
              if (hitTpl) { blacklistFilteredCount++; continue; }
              if (enableDedup) {
                const grams = extractNGram(text, dedupNgram);
                const hitHistory = dedupAgainstHistory && grams.some(g => historyNgrams.has(g));
                const hitBatch = dedupAgainstBatch && grams.some(g => batchNgrams.has(g));
                if (hitHistory || hitBatch) { dedupedCount++; continue; }
                grams.forEach(g => batchNgrams.add(g));
              }
              const item: LlmDanmu = {
                text,
                style: (raw?.style as any) || 'manual',
                color: raw?.color || '#A8FF60',
                size: Math.max(10, Math.min(36, Number(raw?.size ?? 16))),
                speed: Math.max(0.5, Math.min(3, Number(raw?.speed ?? 1.2))),
                cooldownMs: Math.max(500, Math.min(5000, Number(raw?.cooldownMs ?? (1000 + Math.floor(Math.random()*800)))))
              };
              if (personaDiversity > 0) {
                try {
                  const jitterScale = 1 + (Math.random() - 0.5) * 0.2 * personaDiversity;
                  item.size = Math.max(10, Math.min(36, Math.round(item.size * jitterScale)));
                  item.speed = Math.max(0.5, Math.min(3, Number((item.speed * jitterScale).toFixed(2))));
                } catch {}
              }
              processed.push(item);
              if (processed.length >= targetMin) break;
            } catch {}
          }
        }
      } catch {}
    }

    // Phase 2：基础评分排序（人称/陪伴词加分，过度标点扣分）
    const PRONOUN_RE = /(我|你|我们)/g;
    const COMPANION_RE = /(我在|一起|慢慢来|陪你|别急|放松)/g;
    // 音乐锚点：要求陪伴类句子也应落在声音/节奏/音色等线索上
    const MUSIC_ANCHOR_RE = /(节奏|旋律|音色|鼓点|高音|低音|和声|速度|拍|律动|高频|低频|亮|厚|清|浑)/g;
    // 感官/画面词，鼓励更有画面感（光/风/水/空间/触感）
    const SENSORY_RE = /(光|亮光|星光|风|清风|微风|雨|雾|水|波|浪|泉|溪|流|影|影子|距离|贴面|空间|回声|回荡|触感|颗粒|晶莹|清透|温热|凉|柔软)/g;
    const PUNCT_OVER_RE = /[!?]{2,}/g;
    const OUT_OF_TONE_RE = /(我们一起|^一起|我在这里陪你)/g;
    const scoreItem = (t: string): number => {
      let s = 0;
      try {
        const txt = String(t || '');
        s += Math.min(2, (txt.match(PRONOUN_RE) || []).length);
        s += Math.min(2, (txt.match(COMPANION_RE) || []).length) * 1.5;
        if (PUNCT_OVER_RE.test(txt)) s -= 1.5;
        // 缺少音乐锚点的陪伴句扣分
        if ((txt.match(COMPANION_RE) || []).length > 0 && !(MUSIC_ANCHOR_RE.test(txt))) {
          s -= 1.0;
        }
        // 书面/模板化比喻降权
        if (/像.*一样/.test(txt) || /人生/.test(txt)) s -= 0.7;
        // 具象感官词加分（小幅，避免过拟合）
        if ((txt.match(SENSORY_RE) || []).length > 0) s += 0.4;
        // 口号式/出戏表达降权
        if ((txt.match(OUT_OF_TONE_RE) || []).length > 0) s -= 1.2;
        // 句式多样化激励：短句(6-9)、中句(10-16)、长句(17-20)分层给微弱加分，避免全部中句
        const len = graphemeLength(txt);
        if (len >= 6 && len <= 20) {
          if (len <= 9) s += 0.4; else if (len <= 16) s += 0.3; else s += 0.4;
        } else s -= 0.5;
      } catch {}
      return s;
    };
    const withScores = processed.map(p => ({ item: p, score: scoreItem(p.text) }));
    // 降权重复开头：相同前2字/字素的开头出现过多时，后续同开头项减分
    const startCount: Record<string, number> = {};
    for (const w of withScores) {
      const start = (w.item.text || '').slice(0, 2);
      startCount[start] = (startCount[start] || 0) + 1;
      if (startCount[start] > 1) {
        w.score -= Math.min(0.5, 0.2 * (startCount[start] - 1));
      }
    }
    withScores.sort((a, b) => (b.score - a.score));
    const sorted = withScores.map(x => x.item);
    const avgScore = withScores.reduce((acc, x) => acc + x.score, 0) / Math.max(1, withScores.length);

    return NextResponse.json({
      success: true,
      danmuList: sorted,
      count: sorted.length,
      personaId: persona.id,
      filteredCount,
      dedupedCount,
      blacklistFilteredCount,
      avgScore: Number(avgScore.toFixed(2)),
      abBucket,
      reRequest
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Unknown error' }, { status: 500 });
  }
}


