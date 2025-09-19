export const runtime = 'edge';

type AnalyzeRequest = {
  window_ms?: number;
  features?: Record<string, unknown>;
  need_comments?: number;
  locale?: string;
  persona?: Record<string, unknown> | string;
};

function encode(line: string) {
  return new TextEncoder().encode(line);
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function POST(req: Request) {
  let input: AnalyzeRequest = {};
  try {
    input = await req.json();
  } catch {}

  const need = Math.max(1, Math.min(8, Number(input.need_comments ?? 4)));
  const locale = (input.locale as string) || 'zh-CN';

  const fakeStyle = 'Electronic';
  const fakeConfidence = 0.82;
  const fakeComments: Record<string, string[]> = {
    'zh-CN': [
      '鼓点稳，低频推进得很舒服。',
      '高频质感干净，旋律有记忆点。',
      '律动贴合，空间感不错。',
      '能量分配均衡，耐听。',
      '桥段转折自然，合成器层次清晰。',
      '动感起来了，想跟着点头。',
      '低频有弹性，鼓组协调。',
      '尾音处理细腻，收放自如。',
    ],
    en: [
      'Solid groove with a pleasant low-end push.',
      'Clean highs and a catchy lead.',
      'Tight rhythm and decent space.',
      'Balanced energy, easy to listen to.',
      'Smooth transitions, layered synths.',
      'It moves—head-nod certified.',
      'Punchy bass, cohesive drums.',
      'Tidy tails, controlled dynamics.',
    ],
  };

  const pool = fakeComments[locale] ?? fakeComments['zh-CN'];
  const selected = pool.slice(0, need);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // style first
      controller.enqueue(
        encode(
          JSON.stringify({
            type: 'style',
            style: fakeStyle,
            confidence: fakeConfidence,
          }) + '\n'
        )
      );

      // then comments with small delays to simulate streaming
      for (let i = 0; i < selected.length; i++) {
        await sleep(250 + Math.floor(Math.random() * 300));
        controller.enqueue(
          encode(
            JSON.stringify({ type: 'comment', idx: i, text: selected[i] }) +
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
