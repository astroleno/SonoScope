import { NextResponse } from 'next/server';
// 文件回退已禁用：仅使用环境变量；如需恢复可重新引入 fs/path

type PublicConfig = {
  glmApiKey?: string;
  glmUrl?: string;
};

function readEnvPublic(): PublicConfig {
  const glmApiKey = process.env.NEXT_PUBLIC_GLM_API_KEY;
  const glmUrl = process.env.NEXT_PUBLIC_GLM_URL;
  const cfg: PublicConfig = {};
  if (glmApiKey) cfg.glmApiKey = glmApiKey;
  if (glmUrl) cfg.glmUrl = glmUrl;
  return cfg;
}

function readEnvLocalJson(): PublicConfig { return {}; }

export async function GET() {
  const fromEnv = readEnvPublic();
  const hasEnv = !!(fromEnv.glmApiKey || fromEnv.glmUrl);
  const merged: PublicConfig = { ...fromEnv };
  return NextResponse.json({ success: true, config: merged });
}


