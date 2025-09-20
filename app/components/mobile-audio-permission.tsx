'use client';

import React, { useState, useEffect } from 'react';
import {
  MobileAudioAdapter,
  MobileInfo,
  FallbackOptions,
} from '../lib/mobile-audio-adapter';

interface MobileAudioPermissionProps {
  onPermissionGranted: (
    stream: MediaStream,
    audioContext: AudioContext
  ) => void;
  onFallbackSelected?: (type: string) => void;
  onError?: (error: Error) => void;
}

export default function MobileAudioPermission({
  onPermissionGranted,
  onFallbackSelected,
  onError,
}: MobileAudioPermissionProps) {
  const [status, setStatus] = useState<
    'idle' | 'requesting' | 'granted' | 'denied' | 'error'
  >('idle');
  const [mobileInfo, setMobileInfo] = useState<MobileInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showFallback, setShowFallback] = useState<boolean>(false);
  const [fallbackOptions, setFallbackOptions] = useState<FallbackOptions>({});
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');

  const mobileAdapter = new MobileAudioAdapter();

  useEffect(() => {
    // 初始化移动设备信息
    const info = mobileAdapter.getMobileInfo();
    setMobileInfo(info);
    setFallbackOptions(mobileAdapter.getFallbackOptions());

    // 如果是移动设备，预先获取音频设备列表
    if (info.isMobile) {
      loadAudioDevices();
    }
  }, []);

  const loadAudioDevices = async () => {
    try {
      const devices = await mobileAdapter.getAudioDevices();
      setAudioDevices(devices);
      if (devices.length > 0) {
        setSelectedDevice(devices[0].deviceId);
      }
    } catch (error) {
      console.warn('无法加载音频设备:', error);
    }
  };

  const requestPermission = async () => {
    setStatus('requesting');
    setErrorMessage('');

    try {
      // 获取优化的音频约束
      const constraints = mobileAdapter.getOptimizedAudioConstraints(
        selectedDevice || undefined
      );

      console.log('📱 移动端请求权限，设备ID:', selectedDevice);
      console.log('📱 移动端音频约束:', constraints);

      // 请求麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // 创建 AudioContext
      const audioContext = await mobileAdapter.createAudioContext();

      setStatus('granted');
      onPermissionGranted(stream, audioContext);
    } catch (error: any) {
      console.error('麦克风权限请求失败:', error);
      setStatus('error');

      // 获取用户友好的错误消息
      const friendlyMessage = mobileAdapter.getUserFriendlyError(error);
      setErrorMessage(friendlyMessage);

      // 如果权限被拒绝，显示降级选项
      if (
        error.name === 'NotAllowedError' ||
        error.message.includes('permission denied')
      ) {
        setShowFallback(true);
      }

      if (onError) {
        onError(error);
      }
    }
  };

  const handleFallback = (type: string) => {
    if (onFallbackSelected) {
      onFallbackSelected(type);
    }
  };

  const renderMobileOptimizationTips = () => {
    if (!mobileInfo || !mobileInfo.isMobile) return null;

    return (
      <div className="mt-4 p-3 bg-blue-900/30 border border-blue-500/30 rounded-lg">
        <h4 className="text-sm font-semibold text-blue-300 mb-2">
          移动设备优化提示
        </h4>
        <ul className="text-xs text-blue-200 space-y-1">
          {mobileInfo.isIOS && (
            <>
              <li>• 确保在 iOS 设置中允许麦克风访问权限</li>
              <li>• 建议使用 Safari 浏览器以获得最佳兼容性</li>
              <li>• 首次使用可能需要手动授权</li>
            </>
          )}
          {mobileInfo.isAndroid && (
            <>
              <li>• 推荐使用 Chrome 浏览器</li>
              <li>• 确保麦克风权限已启用</li>
              <li>• 部分设备可能需要重启浏览器</li>
            </>
          )}
          <li>• 建议在安静环境中使用以获得更好的效果</li>
          <li>• 如果遇到问题，可以尝试降级选项</li>
        </ul>
      </div>
    );
  };

  const renderFallbackOptions = () => {
    if (!showFallback) return null;

    return (
      <div className="mt-4 p-4 bg-yellow-900/30 border border-yellow-500/30 rounded-lg">
        <h4 className="text-sm font-semibold text-yellow-300 mb-3">降级选项</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {fallbackOptions.testTone && (
            <button
              onClick={() => handleFallback('testTone')}
              className="p-3 bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-500/30 rounded-lg text-yellow-200 text-sm transition-colors"
            >
              <div className="font-medium">测试音频</div>
              <div className="text-xs text-yellow-300 mt-1">
                使用生成的测试音频进行演示
              </div>
            </button>
          )}

          {fallbackOptions.fileUpload && (
            <button
              onClick={() => handleFallback('fileUpload')}
              className="p-3 bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-500/30 rounded-lg text-yellow-200 text-sm transition-colors"
            >
              <div className="font-medium">音频文件</div>
              <div className="text-xs text-yellow-300 mt-1">
                上传音频文件进行分析
              </div>
            </button>
          )}

          {fallbackOptions.systemAudio && (
            <button
              onClick={() => handleFallback('systemAudio')}
              className="p-3 bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-500/30 rounded-lg text-yellow-200 text-sm transition-colors"
            >
              <div className="font-medium">系统音频</div>
              <div className="text-xs text-yellow-300 mt-1">
                捕获系统音频（仅支持部分设备）
              </div>
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderDeviceSelector = () => {
    if (audioDevices.length === 0) return null;

    return (
      <div className="mt-3">
        <label className="block text-sm text-gray-300 mb-2">选择音频设备</label>
        <select
          value={selectedDevice}
          onChange={e => setSelectedDevice(e.target.value)}
          className="w-full p-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
        >
          {audioDevices.map(device => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `设备 ${audioDevices.indexOf(device) + 1}`}
            </option>
          ))}
        </select>
      </div>
    );
  };

  if (status === 'granted') {
    return null; // 权限已授予，不显示组件
  }

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-gray-800/90 backdrop-blur-sm rounded-xl border border-gray-700 shadow-xl">
      <div className="text-center">
        <div className="mb-4">
          <div className="w-16 h-16 mx-auto bg-blue-500/20 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
          </div>
        </div>

        <h2 className="text-xl font-bold text-white mb-2">需要麦克风权限</h2>

        <p className="text-gray-300 text-sm mb-6">
          为了提供实时音频可视化效果，需要访问您的麦克风
        </p>

        {/* 设备选择器 */}
        {renderDeviceSelector()}

        {/* 主按钮 */}
        <button
          onClick={requestPermission}
          disabled={status === 'requesting'}
          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {status === 'requesting' ? (
            <>
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
              <span>正在请求权限...</span>
            </>
          ) : (
            <>
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
              <span>允许使用麦克风</span>
            </>
          )}
        </button>

        {/* 错误消息 */}
        {status === 'error' && errorMessage && (
          <div className="mt-4 p-3 bg-red-900/30 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-300">{errorMessage}</p>
          </div>
        )}

        {/* 降级选项 */}
        {renderFallbackOptions()}

        {/* 移动设备优化提示 */}
        {renderMobileOptimizationTips()}

        {/* 兼容性信息 */}
        {mobileInfo && (
          <div className="mt-4 text-xs text-gray-400">
            <p>设备信息: {mobileInfo.isMobile ? '移动设备' : '桌面设备'}</p>
            {mobileInfo.isMobile && (
              <p>
                系统: {mobileInfo.isIOS ? 'iOS' : 'Android'} | 浏览器:{' '}
                {mobileInfo.browser}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
