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

    const prompt = `请生成一条弹幕 JSON（严格JSON对象，不要解释）：
字段：{ "text":string(<=60), "style": one of beat|voice|complexity|random|manual, "color": CSS hex, "size": 10..36, "speed": 0.5..3, "cooldownMs": 500..5000 }
线索：${JSON.stringify(features).slice(0, 800)}
要求：风格贴合线索；仅输出JSON对象。`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'glm-4-plus',
        messages: [
          {
            role: 'system',
            content:
              '严格按JSON对象输出，不要解释。字段：text/style/color/size/speed/cooldownMs；style 只能是 beat|voice|complexity|random|manual。',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (!resp.ok) {
      const t = await resp.text();
      return NextResponse.json({ success: false, error: `LLM error: ${resp.status} ${t}` }, { status: 502 });
    }
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content;
    let obj: LlmDanmu | null = null;
    try {
      obj = typeof content === 'string' ? (JSON.parse(content) as LlmDanmu) : (content as LlmDanmu);
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON content' }, { status: 500 });
    }
    if (!obj || typeof obj.text !== 'string') {
      return NextResponse.json({ success: false, error: 'Invalid danmu fields' }, { status: 500 });
    }
    return NextResponse.json({ success: true, danmu: obj });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Unknown error' }, { status: 500 });
  }
}


