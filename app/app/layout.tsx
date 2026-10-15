import type { Metadata, Viewport } from 'next';
import { AccessibilityProvider } from '../components/accessibility-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'SonoScope - 声象',
  description: '基于浏览器的实时音乐可视化与弹幕引擎',
  keywords: ['音频可视化', '音乐可视化', '实时渲染', 'Web Audio'],
  authors: [{ name: 'SonoScope Team' }],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0A0A0F',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <head>
        {/* 移动端优化 */}
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
      </head>
      <body>
        {/* 无障碍支持 */}
        <div
          id="a11y-announcements"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        />
        <AccessibilityProvider>{children}</AccessibilityProvider>
      </body>
    </html>
  );
}
