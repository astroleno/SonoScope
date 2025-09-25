"use client";

import React from 'react';

interface AudioFeatures {
  rms?: number;
  spectralCentroid?: number;
  zcr?: number;
  mfcc?: number[];
  spectralFlatness?: number;
  spectralFlux?: number;
  chroma?: number[];
  spectralBandwidth?: number;
  spectralRolloff?: number;
  loudness?: number;
  perceptualSpread?: number;
  perceptualSharpness?: number;
  pitch?: {
    fundamentalFreq: number;
    pitchConfidence: number;
    pitchClass: string;
    octave: number;
  };
  tempo?: {
    bpm: number;
    confidence: number;
  };
  instruments?: Array<{
    name: string;
    confidence: number;
  }>;
}

interface StatusDisplayProps {
  currentPreset: string;
  isRunning: boolean;
  features?: AudioFeatures | null;
  danmuCount?: number;
  className?: string;
}

export const StatusDisplay: React.FC<StatusDisplayProps> = ({
  currentPreset,
  isRunning,
  features,
  danmuCount = 0,
  className = ''
}) => {
  // 格式化数值显示
  const formatValue = (value: number, decimals: number = 2): string => {
    return value.toFixed(decimals);
  };

  // 格式化百分比
  const formatPercent = (value: number): string => {
    return `${(value * 100).toFixed(1)}%`;
  };

  // 获取状态颜色
  const getStatusColor = (isActive: boolean): string => {
    return isActive ? 'text-green-400' : 'text-gray-400';
  };

  return (
    <div className={`
      p-6 bg-white/5 border border-white/10 rounded-lg backdrop-blur-md
      ${className}
    `}>
      <h3 className="text-xl font-semibold mb-4 text-cyan-400">状态信息</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 基础状态 */}
        <div className="space-y-3">
          <h4 className="text-lg font-medium text-purple-400">基础状态</h4>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-300">当前预设:</span>
              <span className="text-white font-medium capitalize">{currentPreset}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-300">运行状态:</span>
              <span className={getStatusColor(isRunning)}>
                {isRunning ? '运行中' : '已停止'}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-300">弹幕数量:</span>
              <span className="text-white font-medium">{danmuCount}</span>
            </div>
          </div>
        </div>

        {/* 音频特征 */}
        {features && (
          <div className="space-y-3">
            <h4 className="text-lg font-medium text-purple-400">音频特征</h4>
            
            <div className="space-y-2 text-sm">
              {/* 基础特征 */}
              {features.rms !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-300">音量强度:</span>
                  <span className="text-white">{formatValue(features.rms)}</span>
                </div>
              )}
              
              {features.spectralCentroid !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-300">频谱质心:</span>
                  <span className="text-white">{formatValue(features.spectralCentroid)} Hz</span>
                </div>
              )}
              
              {features.zcr !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-300">过零率:</span>
                  <span className="text-white">{formatValue(features.zcr)}</span>
                </div>
              )}
              
              {features.loudness !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-300">响度:</span>
                  <span className="text-white">{formatValue(features.loudness)}</span>
                </div>
              )}

              {/* 音高信息 */}
              {features.pitch && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="flex justify-between">
                    <span className="text-gray-300">音高:</span>
                    <span className="text-white">
                      {features.pitch.pitchClass}{features.pitch.octave}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">频率:</span>
                    <span className="text-white">{formatValue(features.pitch.fundamentalFreq)} Hz</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">置信度:</span>
                    <span className="text-white">{formatPercent(features.pitch.pitchConfidence)}</span>
                  </div>
                </div>
              )}

              {/* 节拍信息 */}
              {features.tempo && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="flex justify-between">
                    <span className="text-gray-300">BPM:</span>
                    <span className="text-white">{formatValue(features.tempo.bpm)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">节拍置信度:</span>
                    <span className="text-white">{formatPercent(features.tempo.confidence)}</span>
                  </div>
                </div>
              )}

              {/* 乐器识别 */}
              {features.instruments && features.instruments.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="text-gray-300 mb-2">识别乐器:</div>
                  {features.instruments.slice(0, 3).map((instrument, index) => (
                    <div key={index} className="flex justify-between text-xs">
                      <span className="text-gray-400">{instrument.name}</span>
                      <span className="text-white">{formatPercent(instrument.confidence)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 实时特征图表占位 */}
      {isRunning && features && (
        <div className="mt-6 pt-6 border-t border-white/10">
          <h4 className="text-lg font-medium text-purple-400 mb-3">实时特征</h4>
          <div className="h-32 bg-black/20 rounded-lg flex items-center justify-center">
            <span className="text-gray-500 text-sm">特征可视化图表</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatusDisplay;
