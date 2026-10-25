import type { MetadataRoute } from 'next';
import { appPath, BASE_PATH } from '../lib/paths';
export default function manifest(): MetadataRoute.Manifest {
  return { name: 'SonoScope · 声象', short_name: 'SonoScope', description: '让声音有个形状', start_url: BASE_PATH || '/', scope: BASE_PATH || '/', id: BASE_PATH || '/', display: 'standalone', background_color: '#0a0a0f', theme_color: '#0a0a0f', icons: [{ src: appPath('/icon.png'), sizes: '85x85', type: 'image/png' }] };
}
