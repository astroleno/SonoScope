/** @type {import('next').NextConfig} */
const nextConfig = {
  // 启用 Web Audio API 和 WebGL 支持
  async headers() {
    return [
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
        ],
      },
    ];
  },
  // 优化移动端性能
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
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
