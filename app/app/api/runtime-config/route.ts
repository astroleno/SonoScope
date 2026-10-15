import { readLlmConfig } from '../../../lib/server/config';
export const dynamic = 'force-dynamic';
export function GET() {
  return Response.json({ version: '2', aiEnabled: readLlmConfig().enabled, mode: 'hybrid' }, { headers: { 'Cache-Control': 'no-store' } });
}
