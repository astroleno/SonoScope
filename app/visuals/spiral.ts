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
    float bend = mix(.58,.86,clamp(uFlatness + uFlux*.35,.0,1.));
    float fold = .01 + .02*uMFCC.w;
    p=smin(p,-p,-fold)/dot(p,p)-bend;
    p.yz=cmul(p.yz + vec2(uFlux*.04,uMFCC.x*.05),p.yz);
    p=p.zxy; d+=exp(-19.*abs(dot(p,c)));
  }
  return d;
}

void anim(inout vec3 p){
  float k = .01; // pointer disabled
  float centroid = mix(.2,.85,uCentroid);
  float fluxSpin = mix(.4,1.3,uFlux);
  vec3 mf = uMFCC.xyz;
  p += vec3(
    sin(p.y*5.+T*2.5+mf.x*6.)*.035*mf.x,
    cos(p.z*4.-T*1.8+mf.y*5.)*.028*mf.y,
    sin(p.x*6.+T*3.+mf.z*4.)*.03*(.5+mf.z)
  );
  p.yz*=rot(uMove.y*6.3/MN+k*.123+T*(.22+.45*centroid));
  p.xz*=rot(uMove.x*6.3/MN-.1/k*1.2+k*.2+fluxSpin*.08);
}

vec3 march(vec3 p, vec3 rd){
  anim(p); anim(rd);
  vec3 col=vec3(0.);
  float c=.0,t=.0;
  for(float i=.0;i<60.;i++){
    t+=exp(-t*.65)*exp(-c*1.05);
    c=swirls(p+rd*t);
    float hueShift = uCentroid*3.2 - uMFCC.y*1.4 + uMFCC.z*1.1 + uPulse*2.4;
    float gain = .008*(1. + uFlux*.9 + uFlatness*.45);
    col+=c*hue(dot(p,p)+c+hueShift)*gain;
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
    col=mix(col,vec3(1.-dif)*sqrt(col),fres);
    col=mix(col,vec3(dif),fres*(.8+.3*uFlatness));
    float specBoost=mix(.12,.42,clamp(uFlux+uPulse*.6,.0,1.));
    vec3 specHue=hue(spec+uCentroid*4.+uMFCC.x*2.2);
    col+=specBoost*spec*(specHue+.5*vec3(.6+.7*uFlatness));
    col=mix(col,vec3(1.),fres*fres*(.18+.18*uFlatness));
    float tone= mix(.04,.18,clamp(uZCR+.3*uFlatness,.0,1.));
    col=mix(col,col+vec3(tone),uPulse*.5);
    col=S(-.05,.8,col); col=max(col,.02);
  } else {
    col=mix(vec3(.1,.2,.3),vec3(.008),pow(S(.0,.65,dot(uv,uv)),.3));
    col+=sqrt(at*vec3(.9,.7,1.))*.25*(.5+uFlux*.8);
    col+=vec3(.05*uCentroid,.04*uFlux,.06*uFlatness);
  }
  float t=min((uTime-.5)*.3,1.);
  col=mix(vec3(0.),col,t);
  // Simple audio reactivity on brightness
  float response = uLevel + uFlux*.35 + uPulse*.6;
  col *= (1.0 + uSensitivity * response * 0.6);
  col=S(-.15,1.1,.9*col);
  gl_FragColor=vec4(col,1.);
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
  sensitivity: number
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
}

export function drawSpiral(p: any, shader: any) {
  p.shader(shader);
  p.noStroke();
  p.rectMode(p.CENTER);
  p.rect(0, 0, p.width, p.height);
}
