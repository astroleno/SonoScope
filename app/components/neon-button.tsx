'use client';

import React from 'react';

type NeonButtonProps = {
  variant?: 'cyan' | 'purple' | 'pink' | 'green';
  size?: 'sm' | 'md' | 'lg';
  glowing?: boolean;
  pulse?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
};

export function NeonButton({
  variant = 'cyan',
  size = 'md',
  glowing = true,
  pulse = false,
  disabled = false,
  onClick,
  children,
}: NeonButtonProps) {
  const colorMap: Record<string, string> = {
    cyan: 'var(--neon-blue)',
    purple: 'var(--neon-purple)',
    pink: 'var(--neon-pink)',
    green: 'var(--neon-green)',
  };
  const padding = size === 'lg' ? 'px-8 py-4' : size === 'sm' ? 'px-4 py-2' : 'px-6 py-3';
  const font = 'font-semibold tracking-wide';
  const radius = 'rounded-lg';
  const base = 'relative overflow-hidden transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed';
  const pulseClass = pulse ? 'animate-pulse' : '';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${padding} ${font} ${radius} ${pulseClass}`}
      style={{
        color: colorMap[variant],
        border: `2px solid ${colorMap[variant]}`,
        background: 'transparent',
        boxShadow: glowing ? `0 0 18px ${colorMap[variant]}55, inset 0 0 12px #ffffff1a` : 'none',
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 50%, transparent 100%)',
          transform: 'translateX(-100%)',
        }}
      />
      <span className="relative z-10">{children}</span>
    </button>
  );
}

export default NeonButton;


