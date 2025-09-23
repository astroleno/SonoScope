import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

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

function readEnvLocalJson(): PublicConfig {
  try {
    const candidates = [
      path.resolve(process.cwd(), 'env.local.json'),
      path.resolve(process.cwd(), '../env.local.json'),
      path.resolve(process.cwd(), '../../env.local.json'),
    ];
    let j: any = null;
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf8');
        j = JSON.parse(raw);
        break;
      }
    }
    if (!j) return {};
    const cfg: PublicConfig = {};
    if (typeof j.NEXT_PUBLIC_GLM_API_KEY === 'string') cfg.glmApiKey = j.NEXT_PUBLIC_GLM_API_KEY;
    if (typeof j.NEXT_PUBLIC_GLM_URL === 'string') cfg.glmUrl = j.NEXT_PUBLIC_GLM_URL;
    return cfg;
  } catch {
    return {};
  }
}

export async function GET() {
  const fromEnv = readEnvPublic();
  const hasEnv = !!(fromEnv.glmApiKey || fromEnv.glmUrl);
  const fromFile = hasEnv ? {} : readEnvLocalJson();
  const merged: PublicConfig = { ...fromFile, ...fromEnv };
  return NextResponse.json({ success: true, config: merged });
}


