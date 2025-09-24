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

  // 相位呼吸（R/G/B 会周期性分离与重合），抖动改为连续正弦，避免跳变
  float phaseBreath = uPhaseDelta * (0.5 + 0.5*sin(uTime*uPhaseSpeed));
  float jr = uPhaseJitter * sin(uTime*(1.3*uPhaseSpeed)+1.23);
  float jg = uPhaseJitter * sin(uTime*(1.1*uPhaseSpeed)+3.14);
  float jb = uPhaseJitter * sin(uTime*(1.5*uPhaseSpeed)+6.28);

  float basePhase = uPhaseBase + 0.15*sin(uTime*0.7);
  float phaseR = basePhase - phaseBreath*(0.6*uRgbSeparation) + jr;
  float phaseG = basePhase + jg;
  float phaseB = basePhase + phaseBreath*(0.6*uRgbSeparation) + jb;

  // 水平流动
  float x = uv.x + uSpeed*uTime;
  float w = 6.2831853 * uFrequency;

  // 三条目标曲线（R/G/B）
  float yR = uAmplitude * sin(w*x + phaseR);
  float yG = uAmplitude * sin(w*x + phaseG);
  float yB = uAmplitude * sin(w*x + phaseB);

  // 厚度轻度受音频影响
  float t = max(0.001, uThickness * (1.0 - 0.18*uLevel - 0.10*uFlux));

  // 带形强度
  float iR = band(uv, yR, t);
  float iG = band(uv, yG, t);
  float iB = band(uv, yB, t);

  // 柔光（沿法线近似取样）
  float gOff = t*1.2 + 0.001;
  iR += uGlowStrength*0.35*(band(uv+vec2(0.0, gOff), yR, t*1.35) + band(uv-vec2(0.0, gOff), yR, t*1.35));
  iG += uGlowStrength*0.35*(band(uv+vec2(0.0, gOff), yG, t*1.35) + band(uv-vec2(0.0, gOff), yG, t*1.35));
  iB += uGlowStrength*0.35*(band(uv+vec2(0.0, gOff), yB, t*1.35) + band(uv-vec2(0.0, gOff), yB, t*1.35));

  // 轻微色相偏移与去饱和混合
  float hueBias = (uCentroid-0.5)*0.15;
  vec3 waves = vec3(iR*(1.0+0.05*hueBias), iG, iB*(1.0-0.05*hueBias));
  float lumin = dot(waves, vec3(0.3333));
  vec3 warmWhite = vec3(1.0, 0.97, 0.92) * lumin;
  waves = mix(waves, warmWhite, clamp(uDesaturate, 0.0, 1.0));

  // 亮度整体控制（音频轻权重）
  float audioBoost = 1.0 + uSensitivity * (uLevel*0.22 + uFlux*0.12 + uPulse*0.18);
  col = mix(col, col + waves*uBrightness*audioBoost, 1.0);

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

export function applyWaveUniforms(
  p: any,
  shader: any,
  audio: WaveAudioUniforms,
  sensitivity: number,
  controls?: WaveControls
){
  try {
    shader.setUniform('uTime', p.millis() / 1000.0);
    shader.setUniform('uResolution', [p.width, p.height]);

    const c = {
      amplitude: Math.max(0.0, Math.min(0.7, controls?.amplitude ?? 0.25)),
      // 强制 ≤ 1 周期/屏宽
      frequency: Math.max(0.1, Math.min(1.0, controls?.frequency ?? 0.9)),
      speed: controls?.speed ?? 0.08,
      phaseBase: controls?.phaseBase ?? 0.0,
      phaseDelta: Math.max(0.0, Math.min(3.14, controls?.phaseDelta ?? 0.6)),
      phaseJitter: Math.max(0.0, Math.min(0.8, controls?.phaseJitter ?? 0.02)),
      phaseSpeed: Math.max(0.0, Math.min(4.0, controls?.phaseSpeed ?? 0.7)),
      thickness: Math.max(0.001, Math.min(0.25, controls?.thickness ?? 0.02)),
      glowStrength: Math.max(0.0, Math.min(2.0, controls?.glowStrength ?? 0.6)),
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

    // 音频
    const clamp01 = (v: number) => Math.max(0, Math.min(1, v || 0));
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


