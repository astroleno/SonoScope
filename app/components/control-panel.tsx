"use client";

import React, { useState, useCallback } from 'react';

interface ControlPanelProps {
  isRunning: boolean;
  onStart: () => void;
  onStop: () => void;
  sensitivity?: number;
  onSensitivityChange?: (value: number) => void;
  showRawMic?: boolean;
  onRawMicChange?: (enabled: boolean) => void;
  className?: string;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  isRunning,
  onStart,
  onStop,
  sensitivity = 1.0,
  onSensitivityChange,
  showRawMic = false,
  onRawMicChange,
  className = ''
}) => {
  const [isStarting, setIsStarting] = useState(false);

  // 处理开始/停止
  const handleToggle = useCallback(async () => {
    if (isRunning) {
      onStop();
    } else {
      setIsStarting(true);
      try {
        await onStart();
      } finally {
        setIsStarting(false);
      }
    }
  }, [isRunning, onStart, onStop]);

  // 处理敏感度变化
  const handleSensitivityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    if (onSensitivityChange) {
      onSensitivityChange(value);
    }
  }, [onSensitivityChange]);

  // 处理原始麦克风切换
  const handleRawMicChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (onRawMicChange) {
      onRawMicChange(e.target.checked);
    }
  }, [onRawMicChange]);

  return (
    <div className={`
      p-6 bg-white/5 border border-white/10 rounded-lg backdrop-blur-md
      ${className}
    `}>
      <h3 className="text-xl font-semibold mb-4 text-cyan-400">控制面板</h3>
      
      <div className="space-y-6">
        {/* 主控制按钮 */}
        <div className="flex justify-center">
          <button
            onClick={handleToggle}
            disabled={isStarting}
            className={`
              px-8 py-4 rounded-lg font-bold text-lg transition-all duration-300
              ${isRunning 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-cyan-500 hover:bg-cyan-600 text-white'
              }
              ${isStarting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-black
            `}
          >
            {isStarting ? '启动中...' : isRunning ? '停止' : '开始'}
          </button>
        </div>

        {/* 反应强度控制 */}
        {onSensitivityChange && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">
              反应强度
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={0.5}
                max={3}
                step={0.1}
                value={sensitivity}
                onChange={handleSensitivityChange}
                className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                aria-label="反应强度"
              />
              <span className="text-sm text-gray-300 w-12 text-right">
                {sensitivity.toFixed(1)}x
              </span>
            </div>
          </div>
        )}

        {/* 原始麦克风开关 */}
        {onRawMicChange && (
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="rawMic"
              checked={showRawMic}
              onChange={handleRawMicChange}
              className="w-4 h-4 text-cyan-600 bg-gray-700 border-gray-600 rounded focus:ring-cyan-500 focus:ring-2"
            />
            <label htmlFor="rawMic" className="text-sm text-gray-300">
              显示原始麦克风数据
            </label>
          </div>
        )}

        {/* 状态指示器 */}
        <div className="flex items-center gap-2 text-sm">
          <div className={`
            w-3 h-3 rounded-full
            ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}
          `} />
          <span className="text-gray-300">
            {isRunning ? '运行中' : '已停止'}
          </span>
        </div>
      </div>

      {/* 自定义滑块样式 */}
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #06b6d4;
          cursor: pointer;
          border: 2px solid #ffffff;
        }
        
        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #06b6d4;
          cursor: pointer;
          border: 2px solid #ffffff;
        }
      `}</style>
    </div>
  );
};

export default ControlPanel;
