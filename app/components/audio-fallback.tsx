'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  AudioFallbackManager,
  FileUploadConfig,
} from '../lib/audio-fallback';

interface AudioFallbackProps {
  onFallbackStarted: (
    audioContext: AudioContext,
    analyser: AnalyserNode
  ) => void;
  onFallbackStopped?: () => void;
}

export default function AudioFallback({
  onFallbackStarted,
  onFallbackStopped,
}: AudioFallbackProps) {
  const [fallbackManager] = useState(() => new AudioFallbackManager());
  const [availableSources, setAvailableSources] = useState<any[]>([]);
  const [currentSource, setCurrentSource] = useState<any>(null);
  // const [selectedTestTone, setSelectedTestTone] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const testToneConfigs = AudioFallbackManager.createTestToneConfigs();

  useEffect(() => {
    // 初始化可用源
    setAvailableSources(fallbackManager.getAvailableSources());
  }, [fallbackManager]);

  const handleStartTestTone = async (configIndex: number = 0) => {
    setIsLoading(true);
    setError('');

    try {
      const config = testToneConfigs[configIndex];
      const audioContext = await fallbackManager.startTestTone(config);
      const analyser = fallbackManager.getAnalyser();

      setCurrentSource(fallbackManager.getCurrentSource());
      setAvailableSources(fallbackManager.getAvailableSources());

      if (analyser) {
        onFallbackStarted(audioContext, analyser);
      }
    } catch (err) {
      setError('测试音频启动失败');
      console.error('测试音频启动失败:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartDynamicTestTone = async () => {
    setIsLoading(true);
    setError('');

    try {
      const audioContext = await fallbackManager.startDynamicTestTone();
      const analyser = fallbackManager.getAnalyser();

      setCurrentSource(fallbackManager.getCurrentSource());
      setAvailableSources(fallbackManager.getAvailableSources());

      if (analyser) {
        onFallbackStarted(audioContext, analyser);
      }
    } catch (err) {
      setError('动态测试音频启动失败');
      console.error('动态测试音频启动失败:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError('');

    try {
      const config: FileUploadConfig = {
        supportedFormats: ['mp3', 'wav', 'ogg', 'm4a', 'aac'],
        maxSize: 50,
        autoPlay: true,
      };

      const audioContext = await fallbackManager.handleFileUpload(file, config);
      const analyser = fallbackManager.getAnalyser();

      setCurrentSource(fallbackManager.getCurrentSource());
      setAvailableSources(fallbackManager.getAvailableSources());

      if (analyser) {
        onFallbackStarted(audioContext, analyser);
      }
    } catch (err: any) {
      setError(err.message || '文件处理失败');
      console.error('文件处理失败:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartSystemAudio = async () => {
    setIsLoading(true);
    setError('');

    try {
      const audioContext = await fallbackManager.startSystemAudio();
      const analyser = fallbackManager.getAnalyser();

      setCurrentSource(fallbackManager.getCurrentSource());
      setAvailableSources(fallbackManager.getAvailableSources());

      if (analyser) {
        onFallbackStarted(audioContext, analyser);
      }
    } catch (err: any) {
      setError(err.message || '系统音频捕获失败');
      console.error('系统音频捕获失败:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = () => {
    fallbackManager.stopCurrentSource();
    setCurrentSource(fallbackManager.getCurrentSource());
    setAvailableSources(fallbackManager.getAvailableSources());

    if (onFallbackStopped) {
      onFallbackStopped();
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const renderTestToneOptions = () => {
    const testToneSource = availableSources.find(s => s.type === 'testTone');
    if (!testToneSource) return null;

    return (
      <div className="p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-green-300">测试音频</h4>
          {currentSource?.type === 'testTone' && (
            <button
              onClick={handleStop}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
            >
              停止
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          {testToneConfigs.slice(0, 4).map((config, index) => (
            <button
              key={index}
              onClick={() => handleStartTestTone(index)}
              disabled={isLoading || currentSource?.type === 'testTone'}
              className="p-2 bg-green-600/20 hover:bg-green-600/30 disabled:opacity-50 border border-green-500/30 rounded text-green-200 text-xs transition-colors"
            >
              {config.frequency}Hz {config.waveType}
            </button>
          ))}
        </div>

        <button
          onClick={handleStartDynamicTestTone}
          disabled={isLoading || currentSource?.type === 'testTone'}
          className="w-full p-2 bg-green-600/30 hover:bg-green-600/40 disabled:opacity-50 border border-green-500/30 rounded text-green-200 text-xs transition-colors"
        >
          动态测试音频（频率变化）
        </button>
      </div>
    );
  };

  const renderFileUploadOption = () => {
    const fileUploadSource = availableSources.find(
      s => s.type === 'fileUpload'
    );
    if (!fileUploadSource) return null;

    return (
      <div className="p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-blue-300">音频文件</h4>
          {currentSource?.type === 'fileUpload' && (
            <button
              onClick={handleStop}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
            >
              停止
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileUpload}
          className="hidden"
        />

        <button
          onClick={triggerFileUpload}
          disabled={isLoading}
          className="w-full p-3 bg-blue-600/30 hover:bg-blue-600/40 disabled:opacity-50 border border-blue-500/30 rounded text-blue-200 text-sm transition-colors flex items-center justify-center gap-2"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          选择音频文件
        </button>

        <p className="text-xs text-blue-300 mt-2">
          支持格式: MP3, WAV, OGG, M4A, AAC (最大 50MB)
        </p>
      </div>
    );
  };

  const renderSystemAudioOption = () => {
    const systemAudioSource = availableSources.find(
      s => s.type === 'systemAudio'
    );
    if (!systemAudioSource) return null;

    return (
      <div className="p-4 bg-purple-900/20 border border-purple-500/30 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-purple-300">系统音频</h4>
          {currentSource?.type === 'systemAudio' && (
            <button
              onClick={handleStop}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
            >
              停止
            </button>
          )}
        </div>

        <button
          onClick={handleStartSystemAudio}
          disabled={isLoading}
          className="w-full p-3 bg-purple-600/30 hover:bg-purple-600/40 disabled:opacity-50 border border-purple-500/30 rounded text-purple-200 text-sm transition-colors flex items-center justify-center gap-2"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
            />
          </svg>
          捕获系统音频
        </button>

        <p className="text-xs text-purple-300 mt-2">
          实验性功能，需要浏览器支持屏幕共享权限
        </p>
      </div>
    );
  };

  if (availableSources.length === 0) {
    return (
      <div className="p-4 bg-gray-800 rounded-lg">
        <p className="text-gray-400 text-sm">没有可用的降级方案</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 当前源状态 */}
      {currentSource && (
        <div className="p-3 bg-gray-700/50 rounded-lg border border-gray-600">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-white">当前音频源</h4>
              <p className="text-xs text-gray-300">
                {currentSource.description}
              </p>
            </div>
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          </div>
        </div>
      )}

      {/* 错误消息 */}
      {error && (
        <div className="p-3 bg-red-900/30 border border-red-500/30 rounded-lg">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* 加载状态 */}
      {isLoading && (
        <div className="p-3 bg-gray-700/50 rounded-lg">
          <div className="flex items-center justify-center gap-2">
            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
            <span className="text-sm text-gray-300">正在启动...</span>
          </div>
        </div>
      )}

      {/* 测试音频选项 */}
      {renderTestToneOptions()}

      {/* 文件上传选项 */}
      {renderFileUploadOption()}

      {/* 系统音频选项 */}
      {renderSystemAudioOption()}

      {/* 提示信息 */}
      <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
        <h4 className="text-sm font-medium text-gray-300 mb-2">使用提示</h4>
        <ul className="text-xs text-gray-400 space-y-1">
          <li>• 测试音频：适合快速体验可视化效果</li>
          <li>• 音频文件：支持播放本地音乐文件</li>
          <li>• 系统音频：捕获电脑正在播放的音频</li>
          <li>• 可以随时切换不同的音频源</li>
        </ul>
      </div>
    </div>
  );
}
