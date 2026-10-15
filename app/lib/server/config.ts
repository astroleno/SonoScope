export interface LlmConfig {
  enabled: boolean; key: string; endpoint: string; model: string;
  dailyCalls: number; dailyTokens: number; concurrency: number;
  maxOutputTokens: number; maxInputChars: number; deadlineMs: number; quotaPath: string;
}
const integer = (value: string | undefined, fallback: number, max: number) => {
  const n = Number(value); return Number.isInteger(n) && n > 0 && n <= max ? n : fallback;
};
export function readLlmConfig(env: NodeJS.ProcessEnv = process.env): LlmConfig {
  const key = env.GLM_API_KEY?.trim() ?? '';
  const dailyCalls = integer(env.AI_DAILY_CALLS, 0, 100000);
  const dailyTokens = integer(env.AI_DAILY_TOKENS, 0, 100000000);
  const concurrency = integer(env.AI_MAX_CONCURRENCY, 0, 32);
  const endpoint = env.GLM_API_URL || 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
  let validEndpoint = false;
  try { const url = new URL(endpoint); validEndpoint = url.protocol === 'https:' && !url.username && !url.password; } catch { /* fail closed */ }
  return {
    enabled: env.AI_ENABLED === '1' && !!key && !!dailyCalls && !!dailyTokens && !!concurrency && validEndpoint,
    key, endpoint, model: env.GLM_MODEL || 'glm-4.5-air', dailyCalls, dailyTokens, concurrency,
    maxOutputTokens: integer(env.AI_MAX_OUTPUT_TOKENS, 512, 768), maxInputChars: 6000,
    deadlineMs: 8000, quotaPath: env.AI_QUOTA_PATH || '.runtime/ai-quota.json',
  };
}
