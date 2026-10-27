// Wave - soft chromatic flowing band with controllable sine parameters
// 三条 R/G/B 正弦亮带，带相位呼吸（有时重合、有时分开），支持细线、高斯柔光、去饱和处理

export const WAVE_VERTEX = `
#ifdef GL_ES
precision highp float;
#endif
attribute vec3 aPosition;
attribute vec2 aTexCoord;
varying vec2 vTexCoord;
void main(){
  vTexCoord = aTexCoord;
  vec4 pos = vec4(aPosition, 1.0);
  pos.xy = pos.xy * 2.0 - 1.0;
  gl_Position = pos;
}
`;

export const WAVE_FRAGMENT = `
#ifdef GL_ES
precision highp float;
#endif

uniform vec2  uResolution;    // 画布像素
uniform float uTime;          // 秒

// 视觉控制
uniform float uAmplitude;     // 振幅 (NDC)
uniform float uFrequency;     // 频率 (每屏周期数)
uniform float uSpeed;         // 沿 x 方向移动速度
uniform float uPhaseBase;     // 基础相位
uniform float uPhaseDelta;    // 相位分离最大幅度
uniform float uPhaseJitter;   // 相位抖动幅度（连续正弦抖动）
uniform float uPhaseSpeed;    // 相位呼吸速度
uniform float uThickness;     // 线条厚度（高斯 sigma）
uniform float uGlowStrength;  // 光晕强度
uniform float uRgbSeparation; // RGB 相位分离比例
uniform float uBrightness;    // 亮度增益
uniform float uDesaturate;    // 去饱和 0..1（向暖白混合）

// 可选音频（轻权重）
uniform float uLevel;         // 0..1
uniform float uFlux;          // 0..1
uniform float uCentroid;      // 0..1
uniform float uZCR;           // 0..1
uniform vec4  uMFCC;          // 0..1
uniform float uPulse;         // 0..1
uniform float uSensitivity;   // 0.5..3.0

varying vec2 vTexCoord;

#define R uResolution

// 高斯带形：细线且边缘干净
float band(vec2 p, float targetY, float thickness){
  float d = abs(p.y - targetY);
  float sigma = max(1e-5, thickness);
  float x = d / sigma;
  float core = exp(-0.5 * x * x);
  float shoulder = smoothstep(sigma*1.2, 0.0, d) * 0.25;
  return core + shoulder;
}

float vignette(vec2 uv){
  float r = length(uv);
  return smoothstep(1.2, 0.3, r);
}

void main(){
  // 归一坐标（按短边保持比例）
  vec2 uv = (gl_FragCoord.xy - 0.5*R) / min(R.x, R.y);

  // 柔和背景
  vec3 bgA = vec3(0.06, 0.07, 0.085);
  vec3 bgB = vec3(0.01, 0.012, 0.015);
  float grad = clamp((uv.y+0.9)/2.0, 0.0, 1.0);
  vec3 col = mix(bgA, bgB, grad);
  col *= 0.98 + 0.02*cos(uTime*0.2);
  col *= vignette(uv)*0.9 + 0.1;

  // 核心相位：固定速度水平推进
  float x = uv.x + uSpeed * uTime;
  float w = 6.2831853 * uFrequency;
  float theta = w * x + uPhaseBase;

  // 呼吸：分离幅度缓慢起伏，同时沿着波形局部化分离
  float breath = 0.5 + 0.5 * sin(uTime * uPhaseSpeed);
  float ampNorm = clamp(uAmplitude / 0.5, 0.0, 1.0);
  float separationBase = mix(0.62, 0.36, ampNorm);
  float separation = separationBase * uPhaseDelta * (0.45 + 0.55 * breath) * cos(theta);

  // 细微相位扰动，保持柔和流动
  float jitter = uPhaseJitter * sin(uTime * (1.1 * uPhaseSpeed) + 1.23);
  float jr = jitter;
  float jb = -jitter;

  float phaseR = theta - separation * uRgbSeparation + jr;
  float phaseG = theta;
  float phaseB = theta + separation * uRgbSeparation + jb;

  // 三条目标曲线（R/G/B）：在零点两次分离，峰谷两次重合
  float yR = uAmplitude * sin(phaseR);
  float yG = uAmplitude * sin(phaseG);
  float yB = uAmplitude * sin(phaseB);

  // 固定厚度，避免音频带来的闪烁
  float t = max(0.001, uThickness);

  // 带形强度
  float iR = band(uv, yR, t);
  float iG = band(uv, yG, t);
  float iB = band(uv, yB, t);

  // 高频变化的扩散光强度 - 只影响光条周围的扩散光晕，不改变光条本身
  float highFreqModulation = sin(uTime * 20.0 + uCentroid * 15.0) * 0.5 + 0.5; // 20Hz高频调制
  float pulseModulation = sin(uTime * 12.0 + uPulse * 8.0) * 0.4 + 0.6;   // 12Hz脉冲调制

  // 强烈的音频响应 - 只影响扩散光晕
  float audioGlowIntensity = (uLevel * 4.0 + uFlux * 3.0 + uPulse * 4.5) * highFreqModulation * pulseModulation;
  audioGlowIntensity = clamp(audioGlowIntensity, 0.2, 8.0); // 强烈的扩散光响应

  // 固定的光晕采样距离，只改变强度，不改变距离
  float gOff = t * 1.8 + 0.001; // 保持原始的扩散距离

  // 只增强扩散光的强度，不改变光条本身
  float glowBoost = uGlowStrength * 0.35 * audioGlowIntensity;
  iR += glowBoost*(band(uv+vec2(0.0, gOff), yR, t*1.35) + band(uv-vec2(0.0, gOff), yR, t*1.35));
  iG += glowBoost*(band(uv+vec2(0.0, gOff), yG, t*1.35) + band(uv-vec2(0.0, gOff), yG, t*1.35));
  iB += glowBoost*(band(uv+vec2(0.0, gOff), yB, t*1.35) + band(uv-vec2(0.0, gOff), yB, t*1.35));

  // 统一 RGB 带，专注振幅表现
  vec3 waves = vec3(iR, iG, iB);
  float lumin = dot(waves, vec3(0.3333));
  vec3 warmWhite = vec3(1.0, 0.97, 0.92) * lumin;
  waves = mix(waves, warmWhite, clamp(uDesaturate, 0.0, 1.0));

  // 亮度整体控制：只增强光晕效果，波形本身保持稳定
  col = mix(col, col + waves * uBrightness, 1.0);

  // 柔和映射
  col = pow(col, vec3(0.95));
  col = clamp(col, 0.0, 1.0);

  gl_FragColor = vec4(col, 1.0);
}
`;

export type WaveControls = {
  amplitude?: number;      // 振幅 (NDC)
  frequency?: number;      // ≤1 周期/屏宽 推荐 0.8~1.0
  speed?: number;          // 流速
  phaseBase?: number;      // 基础相位
  phaseDelta?: number;     // 相位分离最大幅度
  phaseJitter?: number;    // 抖动幅度
  phaseSpeed?: number;     // 相位呼吸速度
  thickness?: number;      // 高斯 sigma
  glowStrength?: number;   // 光晕强度
  rgbSeparation?: number;  // RGB 分离比例
  brightness?: number;     // 亮度增益
};

export type WaveAudioUniforms = {
  level: number;
  flux: number;
  centroid: number;
  flatness: number;
  zcr: number;
  mfcc: [number, number, number, number];
  pulse: number;
};

export const WAVE_QUIET_AMPLITUDE = .015;
const clampUnit = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

/** Flux is relative to the previous spectrum, so even near-silence can have a large flux. */
export function waveActivity(rms: number) {
  const x = clampUnit((rms - .002) / .008);
  return x * x * (3 - 2 * x);
}
function waveAmplitude(audio: WaveAudioUniforms, sensitivity: number) {
  const activity = waveActivity(audio.level);
  const energy = Math.pow(clampUnit(audio.level * activity * 5 * sensitivity / 1.5), .6);
  return Math.min(.42, WAVE_QUIET_AMPLITUDE + .28 * energy + .06 * activity * Math.max(clampUnit(audio.flux), clampUnit(audio.pulse)));
}

/** One time-based envelope owns amplitude. Quiet input cannot retrigger a large pulse. */
export class WaveEnvelope {
  private at: number | null = null;
  private audio: WaveAudioUniforms = { level: 0, flux: 0, centroid: 0, flatness: 0, zcr: 0, mfcc: [0, 0, 0, 0], pulse: 0 };
  private amplitude = WAVE_QUIET_AMPLITUDE;
  reset() { this.at = null; this.amplitude = WAVE_QUIET_AMPLITUDE; this.audio = { level: 0, flux: 0, centroid: 0, flatness: 0, zcr: 0, mfcc: [0, 0, 0, 0], pulse: 0 }; }
  update(input: WaveAudioUniforms, atMs: number, sensitivity = 1.5, snap = false) {
    const dt = this.at === null ? 1 / 60 : Math.max(0, (atMs - this.at) / 1000);
    if (this.at !== null && atMs < this.at) this.reset();
    this.at = atMs;
    const activity = waveActivity(input.level);
    const approach = (value: number, target: number) => snap ? target : target + (value - target) * Math.exp(-dt / (target > value ? .055 : .16));
    for (const key of ['level', 'flux', 'centroid', 'flatness', 'zcr', 'pulse'] as const) this.audio[key] = approach(this.audio[key], clampUnit(input[key]) * activity);
    this.audio.mfcc = input.mfcc.map((value, i) => approach(this.audio.mfcc[i], clampUnit(value) * activity)) as WaveAudioUniforms['mfcc'];
    const target = waveAmplitude(input, sensitivity);
    this.amplitude = snap ? target : target + (this.amplitude - target) * Math.exp(-dt / (target > this.amplitude ? .07 : .18));
    return { audio: this.audio, amplitude: this.amplitude };
  }
}

export function applyWaveUniforms(
  p: any,
  shader: any,
  audio: WaveAudioUniforms,
  sensitivity: number,
  controls?: WaveControls,
  mediaSeconds?: number
){
  try {
    shader.setUniform('uTime', mediaSeconds ?? p.millis() / 1000.0);
    shader.setUniform('uResolution', [p.width, p.height]);

    const clamp01 = (v: number) => Math.max(0, Math.min(1, v || 0));
    
    // An envelope-supplied amplitude is authoritative; do not add a second pulse boost.
    const dynamicAmplitude = Math.max(0, Math.min(.47, controls?.amplitude ?? waveAmplitude(audio, sensitivity)));
    
    // 2. 频率控制：用 spectralCentroid 控制相位分离和频率
    const centroidNorm = clamp01(audio.centroid);
    const dynamicPhaseDelta = 0.4 + (1.1 - 0.4) * centroidNorm; // 0.4 到 1.1
    const dynamicFrequency = 0.65 + (1.05 - 0.65) * centroidNorm; // 0.65 到 1.05
    
    // 3. 光晕强度：基于 spectralFlux 和 pulse，增大打击音时的高亮区域
    const fluxBoost = clamp01(audio.flux) * 0.8;
    const pulseBoost = clamp01(audio.pulse) * 0.6;
    const dynamicGlowStrength = Math.max(0.0, Math.min(2.0, (controls?.glowStrength ?? 0.6) + fluxBoost + pulseBoost));

    const c = {
      amplitude: dynamicAmplitude,
      frequency: dynamicFrequency,
      speed: controls?.speed ?? 0.08,
      phaseBase: controls?.phaseBase ?? 0.0,
      phaseDelta: Math.max(0.0, Math.min(3.14, dynamicPhaseDelta)),
      phaseJitter: Math.max(0.0, Math.min(0.8, controls?.phaseJitter ?? 0.02)),
      phaseSpeed: Math.max(0.0, Math.min(4.0, controls?.phaseSpeed ?? 0.7)),
      thickness: Math.max(0.001, Math.min(0.25, controls?.thickness ?? 0.02)),
      glowStrength: dynamicGlowStrength,
      rgbSeparation: Math.max(0.0, Math.min(2.0, controls?.rgbSeparation ?? 1.0)),
      brightness: Math.max(0.2, Math.min(3.0, controls?.brightness ?? 1.2)),
    } as Required<WaveControls>;

    shader.setUniform('uAmplitude', c.amplitude);
    shader.setUniform('uFrequency', c.frequency);
    shader.setUniform('uSpeed', c.speed);
    shader.setUniform('uPhaseBase', c.phaseBase);
    shader.setUniform('uPhaseDelta', c.phaseDelta);
    shader.setUniform('uPhaseJitter', c.phaseJitter);
    shader.setUniform('uPhaseSpeed', c.phaseSpeed);
    shader.setUniform('uThickness', c.thickness);
    shader.setUniform('uGlowStrength', c.glowStrength);
    shader.setUniform('uRgbSeparation', c.rgbSeparation);
    shader.setUniform('uBrightness', c.brightness);
    shader.setUniform('uDesaturate', 0.35);

    // 音频参数
    shader.setUniform('uLevel', clamp01(audio.level));
    shader.setUniform('uFlux', clamp01(audio.flux));
    shader.setUniform('uCentroid', clamp01(audio.centroid));
    shader.setUniform('uZCR', clamp01(audio.zcr));
    shader.setUniform('uMFCC', [
      clamp01(audio.mfcc?.[0] ?? 0),
      clamp01(audio.mfcc?.[1] ?? 0),
      clamp01(audio.mfcc?.[2] ?? 0),
      clamp01(audio.mfcc?.[3] ?? 0),
    ]);
    shader.setUniform('uPulse', clamp01(audio.pulse));
    shader.setUniform('uSensitivity', Math.max(0.5, Math.min(3.0, sensitivity || 1.2)));
  } catch (err) {
    console.error('[Wave] applyWaveUniforms error:', err);
  }
}

export function drawWave(p: any, shader: any){
  try {
    shader.setUniform('uResolution', [p.width, p.height]);
    p.shader(shader);
    p.noStroke();
    p.rectMode(p.CENTER);
    p.rect(0, 0, p.width, p.height);
  } catch (err) {
    console.error('[Wave] drawWave error:', err);
  }
}
