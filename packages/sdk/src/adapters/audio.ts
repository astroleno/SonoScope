import { AudioFeatures, AudioSource } from '../types';

export interface AudioAdapter {
  setSource(source: AudioSource): Promise<void>;
  start(): Promise<void>;
  stop(): void;
  onFeatures(callback: (features: AudioFeatures) => void): void;
  dispose(): void;
}

export class WebAudioAdapter implements AudioAdapter {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private animationFrame: number | null = null;
  private isRunning = false;
  private featuresCallback: ((features: AudioFeatures) => void) | null = null;
  private meydaAnalyzer: any = null;

  async setSource(source: AudioSource): Promise<void> {
    await this.stop();
    
    if (source.type === 'device') {
      await this.setupDeviceSource(source);
    } else if (source.type === 'stream') {
      await this.setupStreamSource(source);
    } else if (source.type === 'file') {
      await this.setupFileSource(source);
    }
  }

  private async setupDeviceSource(source: AudioSource): Promise<void> {
    const constraints: MediaStreamConstraints = {
      audio: {
        deviceId: source.deviceId ? { exact: source.deviceId } : undefined,
        echoCancellation: source.options?.echoCancellation ?? true,
        noiseSuppression: source.options?.noiseSuppression ?? true,
        autoGainControl: source.options?.autoGainControl ?? true,
        sampleRate: source.options?.sampleRate ?? 44100,
      },
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error: any) {
      // Fallback to default device if specific device fails
      if (error.name === 'NotFoundError' || error.name === 'NotAllowedError') {
        console.warn('Specific device failed, falling back to default:', error.message);
        const fallbackConstraints = { ...constraints };
        delete (fallbackConstraints.audio as any).deviceId;
        this.stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
      } else {
        throw error;
      }
    }

    await this.setupAudioContext();
  }

  private async setupStreamSource(source: AudioSource): Promise<void> {
    this.stream = source.stream!;
    await this.setupAudioContext();
  }

  private async setupFileSource(source: AudioSource): Promise<void> {
    // TODO: Implement file audio source
    throw new Error('File audio source not implemented yet');
  }

  private async setupAudioContext(): Promise<void> {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.analyser = this.audioContext.createAnalyser();
    this.microphone = this.audioContext.createMediaStreamSource(this.stream!);

    // Configure analyser
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.5;

    // Connect
    this.microphone.connect(this.analyser);

    // Initialize Meyda if available
    if (typeof window !== 'undefined' && (window as any).Meyda) {
      const Meyda = (window as any).Meyda;
      if (Meyda.isBrowser) {
        this.meydaAnalyzer = Meyda.createMeydaAnalyzer({
          audioContext: this.audioContext,
          source: this.microphone,
          bufferSize: 1024,
          featureExtractors: [
            'rms', 'spectralCentroid', 'zcr', 'mfcc', 'spectralFlatness',
            'spectralFlux', 'chroma', 'spectralBandwidth', 'spectralRolloff',
            'spectralContrast', 'spectralSpread', 'spectralSkewness',
            'spectralKurtosis', 'loudness', 'perceptualSpread', 'perceptualSharpness'
          ],
          callback: (features: any) => {
            if (this.featuresCallback) {
              this.featuresCallback(this.normalizeFeatures(features));
            }
          },
        });
      }
    }

    // Ensure audio context is running
    if (this.audioContext.state !== 'running') {
      await this.audioContext.resume();
    }
  }

  private normalizeFeatures(rawFeatures: any): AudioFeatures {
    return {
      rms: this.clampOptional(rawFeatures.rms),
      spectralCentroid: this.clampOptional(rawFeatures.spectralCentroid),
      zcr: this.clampOptional(rawFeatures.zcr),
      mfcc: Array.isArray(rawFeatures.mfcc) ? rawFeatures.mfcc : undefined,
      spectralFlatness: this.clampOptional(rawFeatures.spectralFlatness),
      spectralFlux: this.clampOptional(rawFeatures.spectralFlux),
      chroma: Array.isArray(rawFeatures.chroma) ? rawFeatures.chroma : undefined,
      spectralBandwidth: this.clampOptional(rawFeatures.spectralBandwidth),
      spectralRolloff: this.clampOptional(rawFeatures.spectralRolloff),
      spectralContrast: Array.isArray(rawFeatures.spectralContrast) ? rawFeatures.spectralContrast : undefined,
      spectralSpread: this.clampOptional(rawFeatures.spectralSpread),
      spectralSkewness: this.clampOptional(rawFeatures.spectralSkewness),
      spectralKurtosis: this.clampOptional(rawFeatures.spectralKurtosis),
      loudness: this.clampOptional(rawFeatures.loudness),
      perceptualSpread: this.clampOptional(rawFeatures.perceptualSpread),
      perceptualSharpness: this.clampOptional(rawFeatures.perceptualSharpness),
    };
  }

  private clampOptional(value: unknown): number | undefined {
    if (typeof value !== 'number') return undefined;
    if (Number.isNaN(value) || !Number.isFinite(value)) return undefined;
    return Math.max(0, Math.min(1, value));
  }

  async start(): Promise<void> {
    if (this.isRunning || !this.meydaAnalyzer) return;
    
    this.isRunning = true;
    this.meydaAnalyzer.start();
  }

  stop(): void {
    this.isRunning = false;
    
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    if (this.meydaAnalyzer) {
      this.meydaAnalyzer.stop();
    }

    if (this.microphone) {
      this.microphone.disconnect();
      this.microphone = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.analyser = null;
  }

  onFeatures(callback: (features: AudioFeatures) => void): void {
    this.featuresCallback = callback;
  }

  dispose(): void {
    this.stop();
    this.featuresCallback = null;
  }
}
