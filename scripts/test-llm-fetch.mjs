#!/usr/bin/env node
/**
 * 最简单的 GLM 接口连通性测试脚本
 * - 直接请求 GLM Chat Completions（不走本地 /api/llm-danmu）
 * - 读取 env.local.json（仓库根）或进程环境变量
 * - 打印 HTTP 状态码与返回体，便于排查 502/429/超时/余额不足等
 */

import fs from 'fs';
import path from 'path';

// 读取配置：优先进程环境变量，其次根目录 env.local.json
function readConfig() {
  let apiKey = process.env.NEXT_PUBLIC_GLM_API_KEY;
  let url = process.env.NEXT_PUBLIC_GLM_URL;
  try {
    if (!apiKey || !url) {
      const p = path.resolve(process.cwd(), 'env.local.json');
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf8');
        const j = JSON.parse(raw);
        apiKey = apiKey || j.NEXT_PUBLIC_GLM_API_KEY;
        url = url || j.NEXT_PUBLIC_GLM_URL;
      }
    }
  } catch (e) {
    console.warn('读取 env.local.json 失败（忽略）:', e?.message);
  }
  return { apiKey, url };
}

async function main() {
  const { apiKey, url } = readConfig();
  if (!apiKey || !url) {
    console.error('[ERROR] 缺少 GLM 配置：请设置 NEXT_PUBLIC_GLM_API_KEY 与 NEXT_PUBLIC_GLM_URL');
    process.exit(2);
  }

  // 构造最小请求，要求 JSON 对象返回
  const body = {
    model: 'glm-4.5-air',
    messages: [
      { role: 'system', content: '只用 JSON 对象形式回答，不要解释。' },
      { role: 'user', content: '输出 {"ok":true}' },
    ],
    response_format: { type: 'json_object' },
    thinking: { type: 'disabled' },
  };

  // 简单重试：遇到网络错误/429/502/503/504 再试 2 次
  const maxRetry = 2;
  let lastErr;
  for (let attempt = 0; attempt <= maxRetry; attempt++) {
    const timeoutMs = Math.min(20000, Math.round(12000 * Math.pow(1.6, attempt)));
    try {
      console.log(`[INFO] 第${attempt + 1}次请求 → ${url}，超时 ${timeoutMs}ms`);
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const text = await resp.text();
      console.log(`[RESULT] HTTP ${resp.status}`);
      console.log(text);
      // 对 429/502/503/504 进行重试
      if ([429, 502, 503, 504].includes(resp.status) && attempt < maxRetry) {
        const wait = 400 * Math.pow(2, attempt);
        console.log(`[WARN] 易波动状态码 ${resp.status}，${wait}ms 后重试…`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      process.exit(resp.ok ? 0 : 1);
    } catch (e) {
      lastErr = e;
      console.warn(`[WARN] 请求异常: ${e?.message || e}`);
      if (attempt < maxRetry) {
        const wait = 400 * Math.pow(2, attempt);
        console.log(`[INFO] ${wait}ms 后重试…`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      break;
    }
  }
  console.error('[ERROR] 最终失败:', lastErr?.message || lastErr);
  process.exit(1);
}

main().catch(e => {
  console.error('[FATAL] 未捕获错误:', e?.message || e);
  process.exit(1);
});


