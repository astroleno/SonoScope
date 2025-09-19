'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface AccessibilityContextType {
  highContrast: boolean;
  reducedMotion: boolean;
  screenReader: boolean;
  setHighContrast: (value: boolean) => void;
  setReducedMotion: (value: boolean) => void;
  setScreenReader: (value: boolean) => void;
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

interface AccessibilityProviderProps {
  children: ReactNode;
}

export function AccessibilityProvider({ children }: AccessibilityProviderProps) {
  const [highContrast, setHighContrast] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [screenReader, setScreenReader] = useState(false);

  // 检测系统偏好设置
  useEffect(() => {
    // 检测高对比度模式
    if (window.matchMedia) {
      const highContrastQuery = window.matchMedia('(prefers-contrast: high)');
      setHighContrast(highContrastQuery.matches);
      
      const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setReducedMotion(reducedMotionQuery.matches);

      // 监听变化
      const handleHighContrastChange = (e: MediaQueryListEvent) => {
        setHighContrast(e.matches);
      };
      
      const handleReducedMotionChange = (e: MediaQueryListEvent) => {
        setReducedMotion(e.matches);
      };

      highContrastQuery.addEventListener('change', handleHighContrastChange);
      reducedMotionQuery.addEventListener('change', handleReducedMotionChange);

      return () => {
        highContrastQuery.removeEventListener('change', handleHighContrastChange);
        reducedMotionQuery.removeEventListener('change', handleReducedMotionChange);
      };
    }
  }, []);

  // 检测屏幕阅读器
  useEffect(() => {
    // 简单的屏幕阅读器检测
    const isScreenReaderActive = () => {
      // 检查常见的屏幕阅读器标识
      const userAgent = navigator.userAgent.toLowerCase();
      const hasScreenReader = 
        userAgent.includes('nvda') ||
        userAgent.includes('jaws') ||
        userAgent.includes('voiceover') ||
        userAgent.includes('talkback');
      
      // 检查 ARIA 支持
      const hasAriaSupport = 'ariaLive' in document.createElement('div');
      
      return hasScreenReader || hasAriaSupport;
    };

    setScreenReader(isScreenReaderActive());
  }, []);

  // 公告功能
  const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcement = document.getElementById('a11y-announcements');
    if (announcement) {
      announcement.setAttribute('aria-live', priority);
      announcement.textContent = message;
      
      // 清空内容以便下次公告
      setTimeout(() => {
        announcement.textContent = '';
      }, 1000);
    }
  };

  // 应用无障碍样式
  useEffect(() => {
    const root = document.documentElement;
    
    if (highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }
    
    if (reducedMotion) {
      root.classList.add('reduced-motion');
    } else {
      root.classList.remove('reduced-motion');
    }
    
    if (screenReader) {
      root.classList.add('screen-reader');
    } else {
      root.classList.remove('screen-reader');
    }
  }, [highContrast, reducedMotion, screenReader]);

  const value: AccessibilityContextType = {
    highContrast,
    reducedMotion,
    screenReader,
    setHighContrast,
    setReducedMotion,
    setScreenReader,
    announce
  };

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (context === undefined) {
    throw new Error('useAccessibility 必须在 AccessibilityProvider 内部使用');
  }
  return context;
}
