"use client";

import React, { useState, useCallback } from 'react';

// 字素簇拆分函数 - 支持中文、emoji等复杂字符
function segmentGraphemes(input: string): string[] {
  try {
    if ((Intl as any)?.Segmenter) {
      const seg = new (Intl as any).Segmenter(undefined, { granularity: 'grapheme' });
      return Array.from(seg.segment(input), (s: any) => s.segment);
    }
  } catch (_) {
    // 降级方案：简单字符拆分
  }
  return Array.from(input);
}

interface FlipOptionProps {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  density?: 'compact' | 'normal' | 'spacious';
  animation?: 'auto' | 'reduced' | 'off';
  className?: string;
}

export const FlipOption: React.FC<FlipOptionProps> = ({
  label,
  selected = false,
  disabled = false,
  onSelect,
  density = 'normal',
  animation = 'auto',
  className = ''
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // 处理点击事件
  const handleClick = useCallback(() => {
    if (!disabled && onSelect) {
      onSelect();
    }
  }, [disabled, onSelect]);

  // 处理键盘事件
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }, [handleClick]);

  // 动态样式类
  const sizeClasses = {
    compact: 'text-xl sm:text-2xl',
    normal: 'text-2xl sm:text-4xl md:text-6xl',
    spacious: 'text-4xl sm:text-6xl md:text-8xl'
  };

  const colorClasses = selected 
    ? 'text-cyan-400 group-hover:text-cyan-300' 
    : 'text-purple-400 group-hover:text-purple-300';

  const disabledClasses = disabled 
    ? 'opacity-50 cursor-not-allowed' 
    : 'cursor-pointer';

  const animationClasses = animation === 'off' 
    ? 'transition-none' 
    : animation === 'reduced' 
    ? 'transition-colors duration-200' 
    : 'transition-transform duration-300 ease-in-out';

  return (
    <button
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      disabled={disabled}
      className={`
        group relative block overflow-hidden whitespace-nowrap
        ${sizeClasses[density]}
        ${colorClasses}
        ${disabledClasses}
        ${animationClasses}
        font-black uppercase
        focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-black
        min-h-[44px] min-w-[44px]
        ${className}
      `}
      style={{
        lineHeight: 0.75,
      }}
      role="option"
      aria-selected={selected}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
    >
      {/* 上层文字 - 悬停时向上移动 */}
      <div className="flex">
        {segmentGraphemes(label).map((grapheme, i) => (
          <span
            key={`top-${i}`}
            className={`
              inline-block ${animationClasses}
              ${animation !== 'off' && !disabled ? 'group-hover:-translate-y-[110%]' : ''}
            `}
            style={{
              transitionDelay: animation === 'off' ? '0ms' : `${i * 25}ms`,
            }}
          >
            {grapheme}
          </span>
        ))}
      </div>
      
      {/* 下层文字 - 悬停时从下方滑入 */}
      <div className="absolute inset-0 flex">
        {segmentGraphemes(label).map((grapheme, i) => (
          <span
            key={`bottom-${i}`}
            className={`
              inline-block ${animationClasses}
              ${animation !== 'off' && !disabled ? 'translate-y-[110%] group-hover:translate-y-0' : ''}
            `}
            style={{
              transitionDelay: animation === 'off' ? '0ms' : `${i * 25}ms`,
            }}
          >
            {grapheme}
          </span>
        ))}
      </div>

      {/* 选中状态指示器 */}
      {selected && (
        <div className="absolute -bottom-1 left-0 right-0 h-1 bg-cyan-400 rounded-full" />
      )}
    </button>
  );
};

export default FlipOption;
