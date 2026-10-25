// Spiral (2662875) adapted preset
// Based on ref_p5/Spiral_2662875 shaders, adapted to p5 WebGL1

export const SPIRAL_VERTEX = `
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

export const SPIRAL_FRAGMENT = `
#ifdef GL_ES
precision highp float;
#endif
// Uniforms adapted
uniform float uTime;           // seconds
uniform vec2  uResolution;     // pixels
uniform vec2  uMove;           // not used (0,0)
uniform float uPointerCount;   // not used
// Audio uniforms (optional)
uniform float uLevel;
uniform float uSensitivity;
uniform float uFlux;
uniform float uCentroid;
uniform float uFlatness;
uniform float uZCR;
uniform vec4  uMFCC;
uniform float uPulse;

#define R uResolution
#define T (uTime+5.)
#define N normalize
#define S smoothstep
#define MN min(R.x,R.y)

vec2 cmul(vec2 a, vec2 b){return vec2(a.x*b.x-a.y*b.y, a.x*b.y+b.x*a.y);} 
mat2 rot(float a){return mat2(cos(a),-sin(a),sin(a),cos(a));}
// 🎨 极光冷淡色调：仅保留 蓝->绿->青 循环，去除紫色
vec3 hue(float a){
  // 蓝 -> 绿 -> 青 -> 蓝 循环，不包含紫色
  float hue = a * 1.2; // 降低色相变化速度，更平滑

  // 三段循环：0-1 蓝->绿，1-2 绿->青，2-3 青->蓝
  float phase = mod(hue, 3.0); // 0-3 循环

  vec3 color;
  if (phase < 1.0) {
    // 蓝 -> 绿 (0-1)
    float t = phase;
    color = mix(vec3(0.1, 0.3, 0.9), vec3(0.1, 0.8, 0.4), t);
  } else if (phase < 2.0) {
    // 绿 -> 青 (1-2)
    float t = phase - 1.0;
    color = mix(vec3(0.1, 0.8, 0.4), vec3(0.1, 0.9, 0.8), t);
  } else {
    // 青 -> 蓝 (2-3)
    float t = phase - 2.0;
    color = mix(vec3(0.1, 0.9, 0.8), vec3(0.1, 0.3, 0.9), t);
  }

  return color;
}

// 🎨 最中心位置白色：简化版本，避免复杂计算
vec3 hueWithCenterWhite(float a, float brightness, vec3 p){
  // 基础色相
  vec3 baseColor = hue(a);
  
  // 色相位移
  float hueShift = brightness * 0.5;
  float shiftedHue = a + hueShift;
  vec3 shiftedColor = hue(shiftedHue);
  vec3 mixedColor = mix(baseColor, shiftedColor, brightness);
  
  // 🎨 简化的中心区域判断：只基于距离
  float distanceFromCenter = length(p);
  float centerFactor = 1.0 - distanceFromCenter;
  
  // 基础亮度分布：从中心到四周减弱 3 成（7成亮度）
  float baseBrightness = 0.7 + centerFactor * 0.3; // 0.7-1.0 范围
  
  // 高音量时：中心变成 HSL L=1（白色）
  float audioBoost = brightness * 0.5; // 音频响应
  float finalBrightness = baseBrightness + audioBoost;
  
  if (finalBrightness > 0.8) { // 高亮度阈值
    float whiteMix = (finalBrightness - 0.8) / 0.2; // 0.8-1.0 映射到 0-1
    mixedColor = mix(mixedColor, vec3(1.0), whiteMix);
  }
  
  return mixedColor;
}

vec3 smin(vec3 a, vec3 b, float k){
  vec3 h=clamp(.5+.5*(b-a)/k,.0,1.);
  return mix(b,a,h)-k*h*(1.-h);
}

float swirls(vec3 p){
  vec3 c=p; float d=.1;
  for(float i=.0;i<5.;i++){
    // 🎵 固定形状参数：不受音频影响
    float bend = 0.7; // 固定值，保持稳定的旋涡形状
    float fold = 0.02; // 固定值，保持稳定的折叠效果
    float dotProduct = max(dot(p,p), 0.001);
    p=smin(p,-p,-fold)/dotProduct-bend;
    // 🎵 保持基础旋转，但不受音频影响
    p.yz=cmul(p.yz, p.yz); // 基础旋转，不受音频控制
    p=p.zxy; d+=exp(-19.*abs(dot(p,c)));
  }
  return clamp(d, 0.0, 1.0);
}

void anim(inout vec3 p){
  float k = .01; // pointer disabled
  
  // 🎵 固定动画参数：移除音频影响，保持稳定的形状
  // 只保留基础的时间动画，不受音频控制
  vec3 animationOffset = vec3(
    sin(p.y*5.+T*2.2)*.008,  // 固定时间动画
    cos(p.z*4.-T*1.6)*.007,  // 固定时间动画
    sin(p.x*6.+T*2.8)*.005   // 固定时间动画
  );

  // 限制偏移幅度，防止数值溢出
  animationOffset = clamp(animationOffset, vec3(-0.05), vec3(0.05));
  p += animationOffset;

  // 🎵 固定旋转：移除音频影响，保持稳定的旋转
  p.yz*=rot(k*.123+T*.12);  // 固定旋转速度
  p.xz*=rot(-.1/k*1.2+k*.2); // 固定旋转速度
}

vec3 march(vec3 p, vec3 rd){
  anim(p); anim(rd);
  vec3 col=vec3(0.);
  float c=.0,t=.0;
  for(float i=.0;i<60.;i++){
    t+=exp(-t*.7)*exp(-c*.95);
    c=swirls(p+rd*t);
    
    // 🎵 改进色相控制：平滑变化，正确的色相方向
    float timeHueShift = T * 0.15; // 适中的变化速度
    float audioHueShift = uCentroid * 0.3 + uPulse * 0.2 + uFlux * 0.15; // 降低音频响应强度
    float totalHueShift = timeHueShift + audioHueShift;
    
    // 🎵 优化亮度控制：降低整体亮度，平滑过渡
    float baseGain = 0.008; // 降低基础亮度
    float audioBrightness = uLevel * 0.3 + uFlux * 0.25 + uPulse * 0.2; // 降低音频响应强度
    float gain = baseGain * (1.0 + audioBrightness * 1.5); // 降低亮度变化倍数
    
    // 🎨 颜色计算：暂时使用基础色相，避免复杂计算
    vec3 baseHue = hue(dot(p,p)+c+totalHueShift);
    vec3 finalHue = baseHue;
    
    // 🎵 增强中间亮色：让中心更明显
    vec3 addition = c * finalHue * gain;
    col += clamp(addition, vec3(0.0), vec3(0.15)); // 进一步增加最大贡献
    // 保护累积颜色不超过安全范围
    col = clamp(col, vec3(0.0), vec3(0.8)); // 进一步提高上限
  }
  return col;
}

void main(){
  vec2 uv=(gl_FragCoord.xy-.5*R)/MN;
  vec3 col=vec3(0.), p=vec3(0.,0.,-2.), rd=N(vec3(uv,.8)), lp=vec3(1.,2.,-3.);
  float dd=.0, at=.0;
  for(float i=.0;i<400.;i++){
    float d=length(p)-1.;
    if(abs(d)<1e-3 || dd>3.) break;
    p+=rd*d; dd+=d; at+=.05*(.05/dd);
  }
  if(dd<3.){
    vec3 n=N(p), l=N(lp-p);
    col+=march(p*4., refract(rd,n,.98));
    float dif=clamp(dot(l,n),.0,1.), fres=pow(clamp(1.+dot(rd,n),.0,1.),3.),
          spec=pow(clamp(dot(reflect(rd,n),l),.0,1.),4.);
    dif=sqrt(dif);
    // 保守的混合和光照计算
    col=mix(col,vec3(1.-dif)*sqrt(col),clamp(fres*0.45, 0.0, 0.8));
    col=mix(col,vec3(dif),clamp(fres*(.5+.16*uFlatness), 0.0, 0.8));
    float specBoost=mix(.015,.04,clamp(uFlux*.3+uPulse*.08,.0,1.));
    vec3 specHue=hue(spec+uCentroid*2.0+uMFCC.x*1.0);
    // 限制镜面反射的强度
    vec3 specularContribution = specBoost*spec*(specHue+.18*vec3(.6+.3*uFlatness));
    specularContribution = clamp(specularContribution, vec3(0.0), vec3(0.2));
    col += specularContribution;
    col=mix(col,vec3(1.),clamp(fres*fres*0.05*(1.+0.15*uFlatness), 0.0, 0.3));
    float tone= mix(.025,.08,clamp(uZCR*.4+.1*uFlatness,.0,1.));
    col += vec3(tone) * 0.15;
    col = mix(col, col + vec3(0.06 + tone * 0.3), 0.3);
    // 限制颜色范围
    col = clamp(col, 0.0, 0.8);
    col=S(-.05,.65,col);
    col=max(col,.02);
  } else {
    col=mix(vec3(.1,.2,.3),vec3(.008),pow(S(.0,.65,dot(uv,uv)),.3));
    // 限制背景音频响应
    vec3 audioBoost = vec3(.04*uCentroid,.03*uFlux,.05*uFlatness);
    audioBoost = clamp(audioBoost, vec3(0.0), vec3(0.1));  // 限制音频影响
    col+=clamp(sqrt(at*vec3(.9,.7,1.))*.2*(.5+uFlux*.6), 0.0, 0.15);
    col += audioBoost;
    col = clamp(col, 0.0, 0.5);  // 限制背景亮度
  }
  float t=min((uTime-.5)*.3,1.);
  col=mix(vec3(0.),col,t);
  // 🎵 极光冷淡色调：降低整体亮度，平滑过渡
  float response = clamp(uLevel * 0.6 + uFlux * 0.4 + uPulse * 0.5, 0.0, 1.5);

  // 降低亮度提升，避免过亮
  float brightnessLift = response * 0.04;  // 降低亮度响应

  // 降低颜色效果
  vec3 colorEnhanced = col * (1.0 + brightnessLift * 0.4);

  // 降低混合效果
  float mixFactor = clamp(brightnessLift * 1.2, 0.0, 0.25); // 降低混合强度
  col = mix(col, colorEnhanced, mixFactor);

  // 降低额外亮度
  col += vec3(brightnessLift * 0.06);  // 降低额外亮度

  // 降低上限，避免过亮
  col = clamp(col, 0.0, 0.7);  // 降低上限

  // 降低敏感度倍数
  col *= (1.0 + uSensitivity * 0.03);  // 降低敏感度
  col = clamp(col, 0.0, 0.75);

  // 降低脉冲效果
  float pulseEffect = uPulse * 0.03 * sin(T * 2.0 + uCentroid * 1.0);
  col += vec3(pulseEffect);
  col = clamp(col, 0.0, 0.75);  // 最终限制

  // Final smoothstep with safe parameters
  col = clamp(col, 0.0, 1.0);  // Ensure col is in safe range
  col = S(-.15, 1.1, .9 * col);

  // Final safety clamp
  col = clamp(col, 0.0, 1.0);
  gl_FragColor = vec4(col, 1.);
}
`;

export type SpiralAudioUniforms = {
  level: number;
  flux: number;
  centroid: number;
  flatness: number;
  zcr: number;
  mfcc: [number, number, number, number];
  pulse: number;
};

export function applySpiralUniforms(
  p: any,
  shader: any,
  audio: SpiralAudioUniforms,
  sensitivity: number,
  controls?: {
    theme?: 'default' | 'warm' | 'cool' | 'neon' | 'pastel';
    dominantInstrument?: string;
    percussiveRatio?: number;
  },
  mediaSeconds?: number
) {
  shader.setUniform('uTime', mediaSeconds ?? p.millis() / 1000.0);
  shader.setUniform('uResolution', [p.width, p.height]);
  shader.setUniform('uMove', [0, 0]);
  shader.setUniform('uPointerCount', 0);
  shader.setUniform('uLevel', Math.max(0, Math.min(1, audio.level || 0)));
  shader.setUniform('uFlux', Math.max(0, Math.min(1, audio.flux || 0)));
  shader.setUniform(
    'uCentroid',
    Math.max(0, Math.min(1, audio.centroid || 0))
  );
  shader.setUniform(
    'uFlatness',
    Math.max(0, Math.min(1, audio.flatness || 0))
  );
  shader.setUniform('uZCR', Math.max(0, Math.min(1, audio.zcr || 0)));
  shader.setUniform('uMFCC', [
    Math.max(0, Math.min(1, audio.mfcc?.[0] ?? 0)),
    Math.max(0, Math.min(1, audio.mfcc?.[1] ?? 0)),
    Math.max(0, Math.min(1, audio.mfcc?.[2] ?? 0)),
    Math.max(0, Math.min(1, audio.mfcc?.[3] ?? 0)),
  ]);
  shader.setUniform('uPulse', Math.max(0, Math.min(1, audio.pulse || 0)));
  shader.setUniform(
    'uSensitivity',
    Math.max(0.5, Math.min(3.0, sensitivity || 1.5))
  );

  // 🎨 简化：移除复杂的调色板系统，使用基础 hue 函数
}

export function drawSpiral(p: any, shader: any) {
  p.shader(shader);
  p.noStroke();
  p.rectMode(p.CENTER);
  p.rect(0, 0, p.width, p.height);
}
