/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--bg-dark)',
        surface: 'var(--bg-medium)',
        foreground: 'var(--text-primary)',
        muted: 'var(--text-secondary)',
        border: 'var(--border-color)',
        accent: 'var(--accent-color)',
        primary: 'var(--accent-color)',
      },
      fontFamily: {
        sans: ['Arial', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
      },
    },
  },
  plugins: [],
};
