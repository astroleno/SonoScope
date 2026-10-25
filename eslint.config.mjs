import nextVitals from 'eslint-config-next/core-web-vitals';

export default [
  { ignores: ['**/node_modules/**', '**/.next/**', '**/dist/**', '**/*.d.ts', '**/src/**/*.js', '**/src/**/*.js.map', 'test/artifacts/**', 'app/public/vendor/**', 'app/public/sonoscope-sw.js'] },
  ...nextVitals,
  {
    settings: { react: { version: '19.3' } },
    rules: { 'react-hooks/exhaustive-deps': 'warn' }
  },
  {
    // Legacy permission/fallback panels enumerate browser capabilities after hydration.
    files: ['app/components/audio-fallback.tsx', 'app/components/mobile-audio-permission.tsx'],
    rules: { 'react-hooks/set-state-in-effect': 'off' }
  }
];
