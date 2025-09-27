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
vec3 hue(float a){return .5+.5*sin(a*3.3+vec3(1.,2.,3.));}

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
    
    // 🎵 改进色相控制：时间基础变化 + 音频响应
    float timeHueShift = T * 0.3; // 基础时间色相变化
    float audioHueShift = uCentroid * 1.5 + uPulse * 0.8 + uFlux * 0.6; // 音频色相响应
    float totalHueShift = timeHueShift + audioHueShift;
    
    // 🎵 优化亮度控制：增强亮度变化范围
    float baseGain = 0.005; // 基础亮度
    float audioBrightness = uLevel * 0.8 + uFlux * 0.6 + uPulse * 0.4; // 音频亮度响应
    float gain = baseGain * (1.0 + audioBrightness * 2.0); // 增强亮度变化
    
    // 颜色计算
    vec3 finalHue = hue(dot(p,p)+c+totalHueShift);
    
    // 增强核心亮点：让中心更亮，响应音频
    vec3 addition = c * finalHue * gain;
    col += clamp(addition, vec3(0.0), vec3(0.12)); // 增加最大贡献，让核心更亮
    // 保护累积颜色不超过安全范围
    col = clamp(col, vec3(0.0), vec3(0.8)); // 预留空间给后续处理
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
  // Conservative audio reactivity - prevent overflow
  float response = clamp(uLevel * 1.2 + uFlux * 0.8 + uPulse * 1.0, 0.0, 2.0);

  // Reduced brightness lift - more conservative approach
  float brightnessLift = response * 0.08;  // Reduced from 0.15 to 0.08

  // Conservative color enhancement
  vec3 colorEnhanced = col * (1.0 + brightnessLift * 0.5);

  // Safer mixing with clamped factors
  float mixFactor = clamp(brightnessLift * 1.5, 0.0, 0.4); // Reduced from 0.6
  col = mix(col, colorEnhanced, mixFactor);

  // Minimal additional brightness
  col += vec3(brightnessLift * 0.15);  // Reduced from 0.3

  // Intermediate clamp to prevent overflow
  col = clamp(col, 0.0, 0.9);  // Leave headroom

  // Conservative sensitivity multiplier
  col *= (1.0 + uSensitivity * 0.05);  // Reduced from 0.1
  col = clamp(col, 0.0, 0.95);

  // Conservative pulse effect
  float pulseEffect = uPulse * 0.05 * sin(T * 3.0 + uCentroid * 1.5);
  col += vec3(pulseEffect);
  col = clamp(col, 0.0, 0.95);  // Final clamp before smoothstep

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
  }
) {
  shader.setUniform('uTime', p.millis() / 1000.0);
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
