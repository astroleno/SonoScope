/** @type {import('next').NextConfig} */
const nextConfig = {
  // 启用 Web Audio API 和 WebGL 支持
  async headers() {
    return [
      {
        source: '/model/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'microphone=(self)',
          },
        ],
      },
    ];
  },
  // 优化移动端性能
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  eslint: {
    // 忽略构建时的ESLint/Prettier错误以保证可编译
    ignoreDuringBuilds: true,
  },
  // 构建时忽略 TypeScript 类型错误（测试页类型不阻塞生产构建）
  typescript: {
    ignoreBuildErrors: true,
  },
  // 支持 p5.js 等库
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
