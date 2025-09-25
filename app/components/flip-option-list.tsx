"use client";

import React, { useCallback, useRef, useEffect } from 'react';
import { FlipOption } from './flip-option';

export interface OptionItem {
  id: string;
  label: string;
  disabled?: boolean;
}

interface FlipOptionListProps {
  options: OptionItem[];
  value?: string;
  onChange?: (id: string) => void;
  orientation?: 'horizontal' | 'vertical';
  density?: 'compact' | 'normal' | 'spacious';
  animation?: 'auto' | 'reduced' | 'off';
  className?: string;
  'aria-label'?: string;
}

export const FlipOptionList: React.FC<FlipOptionListProps> = ({
  options,
  value,
  onChange,
  orientation = 'horizontal',
  density = 'normal',
  animation = 'auto',
  className = '',
  'aria-label': ariaLabel = '选项列表'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = React.useState(-1);

  // 键盘导航处理
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!containerRef.current) return;

    const currentIndex = focusedIndex;
    let newIndex = currentIndex;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        newIndex = orientation === 'vertical' 
          ? Math.min(currentIndex + 1, options.length - 1)
          : Math.min(currentIndex + Math.ceil(Math.sqrt(options.length)), options.length - 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        newIndex = orientation === 'vertical'
          ? Math.max(currentIndex - 1, 0)
          : Math.max(currentIndex - Math.ceil(Math.sqrt(options.length)), 0);
        break;
      case 'ArrowRight':
        e.preventDefault();
        newIndex = orientation === 'horizontal'
          ? Math.min(currentIndex + 1, options.length - 1)
          : Math.min(currentIndex + Math.ceil(Math.sqrt(options.length)), options.length - 1);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        newIndex = orientation === 'horizontal'
          ? Math.max(currentIndex - 1, 0)
          : Math.max(currentIndex - Math.ceil(Math.sqrt(options.length)), 0);
        break;
      case 'Home':
        e.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        newIndex = options.length - 1;
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (currentIndex >= 0 && currentIndex < options.length) {
          const option = options[currentIndex];
          if (!option.disabled && onChange) {
            onChange(option.id);
          }
        }
        return;
      default:
        return;
    }

    setFocusedIndex(newIndex);
  }, [focusedIndex, options, orientation, onChange]);

  // 处理选项选择
  const handleOptionSelect = useCallback((id: string) => {
    if (onChange) {
      onChange(id);
    }
  }, [onChange]);

  // 设置初始焦点
  useEffect(() => {
    if (value) {
      const index = options.findIndex(option => option.id === value);
      if (index >= 0) {
        setFocusedIndex(index);
      }
    }
  }, [value, options]);

  // 动态样式类
  const containerClasses = `
    flex gap-4
    ${orientation === 'vertical' ? 'flex-col' : 'flex-wrap justify-center'}
    focus:outline-none
    ${className}
  `;

  return (
    <div
      ref={containerRef}
      className={containerClasses}
      role="listbox"
      aria-label={ariaLabel}
      aria-activedescendant={focusedIndex >= 0 ? `option-${options[focusedIndex]?.id}` : undefined}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {options.map((option, index) => (
        <div
          key={option.id}
          id={`option-${option.id}`}
          className={`
            ${index === focusedIndex ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-black rounded-lg' : ''}
          `}
        >
          <FlipOption
            label={option.label}
            selected={value === option.id}
            disabled={option.disabled}
            onSelect={() => handleOptionSelect(option.id)}
            density={density}
            animation={animation}
          />
        </div>
      ))}
    </div>
  );
};

export default FlipOptionList;
