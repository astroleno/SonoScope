'use client';

import { useState, useEffect } from 'react';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({
  message = '正在初始化 SonoScope...',
}: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');

  useEffect(() => {
    const steps = [
      '检查浏览器兼容性...',
      '初始化音频引擎...',
      '加载可视化插件...',
      '准备弹幕系统...',
      '完成初始化',
    ];

    let currentStepIndex = 0;
    const interval = setInterval(() => {
      if (currentStepIndex < steps.length) {
        setCurrentStep(steps[currentStepIndex]);
        setProgress((currentStepIndex + 1) * 20);
        currentStepIndex++;
      } else {
        clearInterval(interval);
      }
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="loading">
      <div className="flex flex-col items-center space-y-6">
        {/* Logo */}
        <div className="text-4xl font-bold text-white">SonoScope</div>

        {/* 进度条 */}
        <div className="w-64 bg-gray-700 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* 当前步骤 */}
        <div className="text-gray-300 text-center">
          <div className="text-lg">{message}</div>
          <div className="text-sm mt-2">{currentStep}</div>
        </div>

        {/* 加载动画 */}
        <div className="flex space-x-2">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-3 h-3 bg-blue-600 rounded-full animate-pulse"
              style={{
                animationDelay: `${i * 0.2}s`,
                animationDuration: '1s',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
