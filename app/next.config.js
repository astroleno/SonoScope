const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/SonoScope';
if (basePath && !/^\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(basePath)) throw new Error('Invalid NEXT_PUBLIC_BASE_PATH');
/** @type {import('next').NextConfig} */
module.exports = {
  basePath, env: { NEXT_PUBLIC_BASE_PATH: basePath }, output: 'standalone',
  outputFileTracingRoot: require('node:path').join(__dirname, '..'),
  devIndicators: false,
  experimental: { cpus: 2 },
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'Permissions-Policy', value: 'microphone=(self)' },
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
      { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }
    ] }, { source: '/sonoscope-sw.js', headers: [
      { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
      { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
      { key: 'Service-Worker-Allowed', value: basePath || '/' },
      { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" }
    ] }, { source: '/vendor/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] }, { source: '/model/yamnet-1.tflite', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] }];
  }
};
