'use client';

import { useState, useEffect, useRef } from 'react';
import { Core, EnhancedDanmuAdapter, SimpleVisualAdapter } from '@sonoscope/sdk';
import NeonButton from '../../components/neon-button';

export default function ClientShell() {
  type VisualizationPreset = 'pulse' | 'accretion' | 'spiral' | 'mosaic';
  type AudioSource = { type: 'device'; options: any };
  type ThemeTokens = Record<string, string>;
  const [core, setCore] = useState<InstanceType<typeof Core> | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [currentPreset, setCurrentPreset] = useState<VisualizationPreset>('pulse');
  const [status, setStatus] = useState('Initializing...');
  const [error, setError] = useState<string | null>(null);
  const [features, setFeatures] = useState<any>(null);
  const [danmuStatus, setDanmuStatus] = useState<any>(null);
  const [danmuEvents, setDanmuEvents] = useState<any[]>([]);
  const [enhancedDanmuAdapter, setEnhancedDanmuAdapter] = useState<InstanceType<typeof EnhancedDanmuAdapter> | null>(null);
  
      const canvasRef = useRef<HTMLDivElement>(null);
  const p5Ref = useRef<any>(null);

  // Initialize Core SDK
  useEffect(() => {
    const initCore = async () => {
      try {
        setStatus('Loading SDK...');
        
        // Create Core instance with custom theme
        const customTheme: ThemeTokens = {
          neonBlue: '#00D4FF',
          neonPurple: '#8B5CF6',
          neonPink: '#FF006E',
          neonGreen: '#39FF14',
          bgDark: '#0A0A0F',
          bgMedium: '#1A1A2E',
          bgLight: '#16213E',
        };

        const coreInstance = new Core({
          themeTokens: customTheme,
          sensitivity: 1.5,
          transports: { type: 'memory' },
        });

        // Set up event handlers
        coreInstance.on('ready', () => {
          setIsInitialized(true);
          setStatus('Ready');
        });

        coreInstance.on('features', (f) => {
          setFeatures(f);
          // 处理增强弹幕特征
          if (enhancedDanmuAdapter) {
            enhancedDanmuAdapter.handleAudioFeatures(f.rms || 0, f);
          }
        });

        coreInstance.on('danmu', (event) => {
          console.log('Danmu event:', event);
          setDanmuEvents(prev => [...prev.slice(-9), event]); // 保留最近10个弹幕
        });

        coreInstance.on('log', (level, message, data) => {
          console.log(`[${level.toUpperCase()}] ${message}`, data);
        });

        coreInstance.on('error', (error) => {
          setError(error.message);
          setStatus('Error');
        });

        // Initialize
        await coreInstance.init();
        
        // 创建增强弹幕适配器
        const danmuAdapter = new EnhancedDanmuAdapter();
        danmuAdapter.onDanmu((event) => {
          coreInstance.emit('danmu', event);
        });
        setEnhancedDanmuAdapter(danmuAdapter);
        
        setCore(coreInstance);
        
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize');
        setStatus('Failed');
      }
    };

    initCore();

    return () => {
      if (core) {
        core.dispose();
      }
    };
  }, []);

  // Initialize P5.js when core is ready
  useEffect(() => {
    if (!isInitialized || !core || p5Ref.current) return;

    const initP5 = async () => {
      try {
        // Dynamic import of p5
        const p5 = (await import('p5')).default;
        
        const sketch = (p: any) => {
              p.setup = () => {
                const canvas = p.createCanvas(p.windowWidth, p.windowHeight);
                canvas.parent(canvasRef.current ?? undefined);
                p.background(0);
              };

          p.draw = () => {
            p.background(0, 0, 0, 10); // Trail effect
            
            // Render visualization
            if (core) {
              core.render(p);
            }
          };

          p.windowResized = () => {
            p.resizeCanvas(p.windowWidth, p.windowHeight);
            if (core) {
              core.resize(p.windowWidth, p.windowHeight);
            }
          };
        };

        p5Ref.current = new p5(sketch);
        
        // Set up visual adapter
        const visualAdapter = new SimpleVisualAdapter(p5Ref.current);
        core.setVisualAdapter(visualAdapter);
        core.setPreset(currentPreset);
        
      } catch (err) {
        setError('Failed to initialize P5.js');
      }
    };

    initP5();
  }, [isInitialized, core, currentPreset]);

  const handleStart = async () => {
    if (!core) return;

    try {
      setStatus('Starting audio...');
      
      // Set up audio source (default device)
      const audioSource: AudioSource = {
        type: 'device',
        options: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
        },
      };

      await core.setAudioSource(audioSource);
      await core.start();
      
      // 启动增强弹幕适配器
      if (enhancedDanmuAdapter) {
        enhancedDanmuAdapter.start();
      }
      
      setIsRunning(true);
      setStatus('Running');
      setError(null);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start');
      setStatus('Failed');
    }
  };

  const handleStop = () => {
    if (!core) return;
    
    // 停止增强弹幕适配器
    if (enhancedDanmuAdapter) {
      enhancedDanmuAdapter.stop();
    }
    
    core.stop();
    setIsRunning(false);
    setStatus('Stopped');
  };

  const handlePresetChange = (preset: VisualizationPreset) => {
    setCurrentPreset(preset);
    if (core) {
      core.setPreset(preset);
    }
  };

  const handleTriggerDanmu = () => {
    if (enhancedDanmuAdapter) {
      enhancedDanmuAdapter.trigger({
        text: '🎵 手动触发弹幕',
        style: 'manual',
        color: '#ff6b6b',
        size: 18,
      });
    }
  };

  // Update danmu status
  useEffect(() => {
    if (!core) return;

    const interval = setInterval(() => {
      setDanmuStatus(core.danmuStatus);
    }, 1000);

    return () => clearInterval(interval);
  }, [core]);

  return (
    <main className="min-h-screen bg-[var(--bg-dark)] text-white flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background Canvas */}
      <div className="absolute inset-0 pointer-events-none">
        <div ref={canvasRef} className="w-full h-full" />
      </div>

      {/* UI Overlay */}
      <div className="relative z-10 w-full max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-[var(--neon-blue)] to-[var(--neon-purple)] bg-clip-text text-transparent">
            SonoScope Client
          </h1>
          <p className="text-lg text-gray-300">Independent SDK Demo</p>
        </div>

        {/* Status Panel */}
        <div className="mb-6 p-4 bg-white/5 border border-white/10 rounded-lg backdrop-blur-md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${isRunning ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`} />
              <span className="font-semibold">{status}</span>
            </div>
            {danmuStatus && (
              <div className="text-sm text-gray-300">
                Danmu: {danmuStatus.isActive ? 'Active' : 'Inactive'} | 
                Count: {danmuStatus.count} | 
                Style: {danmuStatus.currentStyle || 'None'}
              </div>
            )}
          </div>
          
          {error && (
            <div className="p-3 bg-red-900/50 border border-red-500 rounded text-red-300 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="space-y-6">
          {/* Preset Selection */}
          <div className="p-4 bg-white/5 border border-white/10 rounded-lg backdrop-blur-md">
            <h3 className="text-lg font-semibold mb-3 text-[var(--neon-blue)]">Visualization Presets</h3>
            <div className="flex gap-2 flex-wrap">
              {(['pulse', 'accretion', 'spiral', 'mosaic'] as VisualizationPreset[]).map((preset) => (
                <NeonButton
                  key={preset}
                  variant={currentPreset === preset ? 'cyan' : 'purple'}
                  size="md"
                  glowing
                  onClick={() => handlePresetChange(preset)}
                >
                  {preset.charAt(0).toUpperCase() + preset.slice(1)}
                </NeonButton>
              ))}
            </div>
          </div>

          {/* Main Controls */}
          <div className="p-4 bg-white/5 border border-white/10 rounded-lg backdrop-blur-md">
            <h3 className="text-lg font-semibold mb-3 text-[var(--neon-green)]">Audio Controls</h3>
            <div className="flex gap-4 flex-wrap">
              <NeonButton
                variant="green"
                size="lg"
                glowing
                onClick={handleStart}
                disabled={!isInitialized || isRunning}
              >
                Start
              </NeonButton>
              <NeonButton
                variant="pink"
                size="lg"
                glowing
                onClick={handleStop}
                disabled={!isRunning}
              >
                Stop
              </NeonButton>
                  <NeonButton
                variant="purple"
                size="md"
                glowing
                onClick={handleTriggerDanmu}
                disabled={!isRunning}
              >
                Trigger Danmu
              </NeonButton>
                  <NeonButton
                    variant="purple"
                    size="md"
                    glowing
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/llm-danmu', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            features: {
                              tempo_bpm: features?.tempo?.bpm ?? 128,
                              voiceProb_mean: features?.voiceProb ?? 0.2,
                              percussiveRatio_mean: features?.percussiveRatio ?? 0.6,
                              harmonicRatio_mean: features?.harmonicRatio ?? 0.4,
                              spectralCentroid_mean: features?.spectralCentroid ?? 2500,
                            },
                          }),
                        });
                        const data = await res.json();
                        if (data?.success && data?.danmu && enhancedDanmuAdapter) {
                          enhancedDanmuAdapter.fromJson(data.danmu);
                        }
                      } catch (e) {
                        console.error('LLM danmu error', e);
                      }
                    }}
                    disabled={!isRunning}
                  >
                    LLM Danmu
                  </NeonButton>
            </div>
          </div>

          {/* Features Display */}
          {features && (
            <div className="p-4 bg-white/5 border border-white/10 rounded-lg backdrop-blur-md">
              <h3 className="text-lg font-semibold mb-3 text-[var(--neon-pink)]">Audio Features</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">RMS:</span>
                  <span className="ml-2">{(features.rms * 100).toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-gray-400">Centroid:</span>
                  <span className="ml-2">{features.spectralCentroid?.toFixed(0) || 'N/A'}Hz</span>
                </div>
                <div>
                  <span className="text-gray-400">ZCR:</span>
                  <span className="ml-2">{(features.zcr * 100).toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-gray-400">Flux:</span>
                  <span className="ml-2">{(features.spectralFlux * 100).toFixed(1)}%</span>
                </div>
                {features.tempo && (
                  <div>
                    <span className="text-gray-400">BPM:</span>
                    <span className="ml-2">{Math.round(features.tempo.bpm)}</span>
                  </div>
                )}
                {features.dominantInstrument && (
                  <div>
                    <span className="text-gray-400">Instrument:</span>
                    <span className="ml-2">{features.dominantInstrument}</span>
                  </div>
                )}
                {features.voiceProb !== undefined && (
                  <div>
                    <span className="text-gray-400">Voice:</span>
                    <span className="ml-2">{(features.voiceProb * 100).toFixed(1)}%</span>
                  </div>
                )}
                {features.percussiveRatio !== undefined && (
                  <div>
                    <span className="text-gray-400">Percussive:</span>
                    <span className="ml-2">{(features.percussiveRatio * 100).toFixed(1)}%</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Danmu Display */}
          {danmuEvents.length > 0 && (
            <div className="p-4 bg-white/5 border border-white/10 rounded-lg backdrop-blur-md">
              <h3 className="text-lg font-semibold mb-3 text-[var(--neon-yellow)]">Recent Danmu</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {danmuEvents.map((event, index) => (
                  <div
                    key={event.id}
                    className="p-2 bg-black/20 rounded border-l-2"
                    style={{ borderLeftColor: event.command.color }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm" style={{ color: event.command.color }}>
                        {event.command.text}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Style: {event.command.style} | Size: {event.command.size}px
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-8 text-center text-gray-400 text-sm">
          <p>Click "Start" to begin audio analysis and visualization</p>
          <p className="mt-1">Use preset buttons to switch between visualizations</p>
          <p className="mt-1">Trigger danmu manually or wait for automatic generation</p>
        </div>
      </div>
    </main>
  );
}
