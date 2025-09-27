// Accretion by Xor-inspired shader preset
// Sources adapted from ref_p5/Accretion vertex/fragment shaders

export const ACCRETION_VERTEX = `
#ifdef GL_ES
precision highp float;
#endif
attribute vec3 aPosition;
attribute vec2 aTexCoord;
varying vec2 vTexCoord;
void main() {
  vTexCoord = aTexCoord;
  vec4 positionVec4 = vec4(aPosition, 1.0);
  positionVec4.xy = positionVec4.xy * 2.0 - 1.0;
  gl_Position = positionVec4;
}
`;

export const ACCRETION_FRAGMENT = `
/* Original code "Accretion" by @XorDev (Shadertoy WcKXDV)
   Adapted for p5.js WebGL pipeline with subtle audio uniforms */
#ifdef GL_ES
precision highp float;
#endif
uniform vec2 iResolution;
uniform float iTime;
// Audio uniforms (normalized 0..1 mostly)
uniform float uLevel;        // rms-like
uniform float uCentroid;     // 0..1 normalized centroid
uniform float uZcr;          // 0..1
uniform vec4  uMfcc;         // first 4 mfcc components mapped to ~0..1
uniform float uSensitivity;  // global reaction multiplier
uniform float uGainScale;    // scales kGain impact (0.5..2.0)
uniform float uFlickerStrength; // zcr flicker strength (0..0.4)
uniform float uFlickerFreq;  // zcr flicker frequency (rad/s ~ 8..32)
uniform float uOverallBoost; // final RGB multiplier (0.7..1.6)
uniform float uPulseLift;    // percussion lift (0..1.5)
varying vec2 vTexCoord;
float tanh_approx(float x) {
  x = clamp(x, -3.0, 3.0);
  float x2 = x * x;
  return x * (27.0 + x2) / (27.0 + 9.0 * x2);
}
void main() {
  vec2 uv = vTexCoord * 2.0 - 1.0;
  const float scale = 1.0;
  uv.x *= scale * iResolution.x / iResolution.y;
  uv.y *= scale;
  const int MAX_STEPS = 20;
  const int NOISE_ITERATIONS = 7;
  const float INITIAL_OFFSET = 0.1;
  const float RADIAL_SCALE = 5.0;
  const float DEPTH_ATTENUATION = 0.2;
  float rayDepth = 0.0;
  float stepDistance = 0.0;
  vec4 finalColor = vec4(0.0);
  vec3 rayDirection = normalize(vec3(uv, 1.0));
  // Small audio-driven knobs (lightly scaled by sensitivity)
  float sens = clamp(uSensitivity, 0.9, 1.6);
  float kPhase = (0.6 * uCentroid + 0.4 * uMfcc.x) * mix(1.0, sens, 0.3); // phase offset
  float kGain  = (0.55 * uLevel + 0.25 * uZcr) * mix(1.0, sens, 0.55);     // color gain (more responsive)
  float kNoise = (0.3 * uMfcc.y) * mix(1.0, sens, 0.2);                   // noise modulation
  for (int step = 0; step < MAX_STEPS; step++) {
    vec3 position = rayDepth * rayDirection + INITIAL_OFFSET;
    float angle = atan(position.y / 0.2, position.x) * 2.0;
    float radius = length(position.xy) - RADIAL_SCALE - rayDepth * DEPTH_ATTENUATION;
    float height = position.z / 3.0;
    position = vec3(angle, height, radius);
    for (int noiseStep = 1; noiseStep <= NOISE_ITERATIONS; noiseStep++) {
      float noiseScale = float(noiseStep);
      // keep original time scale to preserve baseline motion
      vec3 noiseInput = position.yzx * noiseScale + iTime + 0.3 * float(step);
      // revert to default noise influence
      position += sin(noiseInput + kNoise) / noiseScale;
    }
    vec3 surfacePattern = 0.4 * cos(position) - 0.4;
    stepDistance = length(vec4(surfacePattern, position.z));
    rayDepth += stepDistance;
    float colorPhase = position.x + float(step) * (0.4 + 0.2 * uLevel * sens) + rayDepth + kPhase;
    // base palette (no extra hue shift)
    vec4 colorPattern = vec4(6.0, 1.0, 9.0, 0.0);
    finalColor += (1.0 + cos(colorPhase + colorPattern)) / stepDistance;
  }
  vec4 processedColor = finalColor * finalColor / 400.0;
  // 🎵 添加 soft-knee 压缩，降低 RMS 突增时的瞬时冲击
  float levelLift = pow(clamp(uLevel * sens * 1.35, 0.0, 1.5), 0.8);
  float centroidLift = pow(clamp(uCentroid, 0.0, 1.0), 1.2);
  
  // 🎵 降低基础亮度：减少 kGain 影响和基础亮度
  float brightnessPulse = 0.3 + uGainScale * (0.3 * kGain + 0.4 * levelLift + 0.1 * centroidLift); // 从 1.0 降到 0.3 基础
  brightnessPulse = clamp(brightnessPulse, 0.2, 1.5); // 进一步降低范围
  
  // 对 pulseBoost 加对数压缩，防止过度放大
  float pulseBoost = 1.0 + 1.4 * log(1.0 + clamp(uPulseLift, 0.0, 1.5)); // 使用 log(1+x) 替代 log1p
  processedColor.rgb *= uOverallBoost * brightnessPulse * pulseBoost * (1.0 + uFlickerStrength * uZcr * sin(iTime * uFlickerFreq));
  processedColor.rgb += processedColor.rgb * (0.22 * levelLift + 0.18 * clamp(uPulseLift, 0.0, 1.0));
  processedColor.r = tanh_approx(processedColor.r);
  processedColor.g = tanh_approx(processedColor.g);
  processedColor.b = tanh_approx(processedColor.b);
  processedColor.a = 1.0;
  gl_FragColor = processedColor;
}
`;

type AccretionControls = {
  gainScale?: number;
  flickerStrength?: number;
  flickerFreq?: number;
  overallBoost?: number;
  genre?: 'electronic' | 'acoustic' | 'rock' | 'jazz';
};
export function applyAccretionAudioUniforms(
  p: any,
  shader: any,
  level: number,
  features: {
    spectralCentroid?: number;
    zcr?: number;
    mfcc?: number[];
    spectralFlux?: number;
    voiceProb?: number;
    percussiveRatio?: number;
  } | null,
  sensitivity: number,
  controls?: AccretionControls
) {
  const rms = Math.max(0, Math.min(1, level || 0));
  const centroidHz = Math.max(
    0,
    Math.min(8000, features?.spectralCentroid ?? 0)
  );
  const centroid = centroidHz / 8000.0;
  const zcr = Math.max(0, Math.min(1, features?.zcr ?? 0));
  const mfcc = features?.mfcc ?? [];
  const mapM = (v: number) => Math.max(0, Math.min(1, (v + 100.0) / 200.0));
  const mf = [
    mapM(mfcc[0] ?? 0),
    mapM(mfcc[1] ?? 0),
    mapM(mfcc[2] ?? 0),
    mapM(mfcc[3] ?? 0),
  ];
  shader.setUniform('uLevel', rms);
  shader.setUniform('uCentroid', centroid);
  shader.setUniform('uZcr', zcr);
  shader.setUniform('uMfcc', mf);
  const sens = Math.max(0.5, Math.min(3.0, sensitivity || 1));
  const fluxRaw = Math.max(0, Math.min(1, features?.spectralFlux ?? 0));
  const pulseLift = Math.min(1.2, (fluxRaw * 1.1 + zcr * 0.35 + rms * 0.25) * sens);
  shader.setUniform('uPulseLift', pulseLift);
  // Optional genre presets
  const presets = {
    electronic: { gainScale: 1.3, flickerStrength: 0.15, flickerFreq: 24.0, overallBoost: 1.1 },
    acoustic:   { gainScale: 0.9, flickerStrength: 0.08, flickerFreq: 12.0, overallBoost: 0.95 },
    rock:       { gainScale: 1.5, flickerStrength: 0.25, flickerFreq: 18.0, overallBoost: 1.2 },
    jazz:       { gainScale: 1.1, flickerStrength: 0.12, flickerFreq: 16.0, overallBoost: 1.05 },
  } as const;
  const genre = controls?.genre;
  const preset = genre ? presets[genre] : undefined;

  const gainScale = Math.max(0.5, Math.min(2.0, controls?.gainScale ?? preset?.gainScale ?? 1.1));
  const flickerStrength = Math.max(
    0.0,
    Math.min(0.4, controls?.flickerStrength ?? preset?.flickerStrength ?? 0.12)
  );
  const flickerFreq = Math.max(
    4.0,
    Math.min(48.0, controls?.flickerFreq ?? preset?.flickerFreq ?? 16.0)
  );
  // 🎵 修复过亮问题：进一步降低默认 overallBoost
  const baseOverallBoost = controls?.overallBoost ?? preset?.overallBoost ?? 0.5; // 从 0.85 进一步降到 0.5
  
  // 自适应补偿：根据人声和打击乐比例调整亮度
  const voiceProb = features?.voiceProb ?? 0;
  const percussiveRatio = features?.percussiveRatio ?? 0;
  
  // 人声占比高 → 允许更亮（补偿至 1.0）
  const voiceCompensation = voiceProb > 0.6 ? 0.15 : 0;
  // 打击占比高 → 使用较低阈值防止持续闪白
  const percussiveDampening = percussiveRatio > 0.7 ? -0.1 : 0;
  
  const overallBoost = Math.max(
    0.3, // 进一步降低最小值
    Math.min(1.0, // 进一步降低最大值
      baseOverallBoost + voiceCompensation + percussiveDampening
    )
  );
  shader.setUniform('uSensitivity', sens);
  shader.setUniform('uGainScale', gainScale);
  shader.setUniform('uFlickerStrength', flickerStrength);
  shader.setUniform('uFlickerFreq', flickerFreq);
  shader.setUniform('uOverallBoost', overallBoost);
}

export function drawAccretion(p: any, shader: any) {
  shader.setUniform('iResolution', [p.width, p.height]);
  shader.setUniform('iTime', p.millis() / 1000.0);
  p.shader(shader);
  p.noStroke();
  p.rectMode(p.CENTER);
  p.rect(0, 0, p.width, p.height);
}
