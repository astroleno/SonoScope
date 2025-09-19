#version 300 es
/*********
* made by Matthias Hurrle (@atzedent)
* Tip: For syntax highlighting, paste the code here:
* https://shadered.org/app?fork=4Y3P9GQID0
*/ 
precision highp float;
out vec4 O;
uniform float time;
uniform vec2 resolution;
uniform vec2 move;
uniform int pointerCount;
#define P pointerCount
#define FC gl_FragCoord.xy
#define R resolution
#define T (time+5.)
#define N normalize
#define S smoothstep
#define MN min(R.x,R.y)
#define rot(a) mat2(cos((a)-vec4(0,11,33,0)))
#define hue(a) (.5+.5*sin((a)*3.3+vec3(1,2,3)))
#define cmul(a,b) vec2(a.x*b.x-a.y*b.y,a.x*b.y+b.x*a.y)
vec3 smin(vec3 a, vec3 b, float k) {
	vec3 h=clamp(.5+.5*(b-a)/k,.0,1.);
	return mix(b,a,h)-k*h*(1.-h);
}
float swirls(vec3 p) {
	vec3 c=p;
	float d=.1;
	for (float i=.0; i<5.; i++) {
		p=smin(p,-p,-.01)/dot(p,p)-.7;
		p.yz=cmul(p.yz,p.yz);
		p=p.zxy;
		d+=exp(-19.*abs(dot(p,c)));
	}
	return d;
}
void anim(inout vec3 p) {
	float k=P>0?.01:mix(.01,6.3,fract(T*.2));
	p.yz*=rot(move.y*6.3/MN+k*.123+T*.2);
	p.xz*=rot(move.x*6.3/MN-.1/k*1.2+k*.2);
}
vec3 march(vec3 p, vec3 rd) {
	anim(p); anim(rd);
	vec3 col=vec3(0);
	float c=.0, t=.0;
	for (float i=.0; i<60.; i++) {
		t+=exp(-t*.65)*exp(-c*1.05);
		c=swirls(p+rd*t);
		col+=c*hue(dot(p,p)+c)*.008;
	}
	return col;
}
float effect(vec2 p) {
  p=abs(abs(p)-vec2(1.1,.85))-vec2(1,.75);
  float d=length(max(p,.0))+min(.0,max(p.x,p.y))-.02;
  return S(.05,.0,d);
}
void cam(inout vec3 p) {
	p.yz*=rot(-.64);
	p.xz*=rot(-.64);
}
void main() {
	vec2 uv=(FC-.5*R)/MN;
	vec3 col=vec3(0),
	p=vec3(0,0,-2),
	rd=N(vec3(uv,.8)), lp=vec3(1,2,-3);
	float dd=.0, at=.0;
	for (float i=.0; i<400.; i++) {
		float d=length(p)-1.;
		if (abs(d)<1e-3 || dd>3.) break;
		p+=rd*d;
		dd+=d;
		at+=.05*(.05/dd);
	}
	if (dd<3.) {
		vec3 n=N(p), l=N(lp-p);
		col+=march(p*4.,refract(rd,n,.98));
		float dif=clamp(dot(l,n),.0,1.), fres=pow(clamp(1.+dot(rd,n),.0,1.),3.),
		spec=pow(clamp(dot(reflect(rd,n),l),.0,1.),4.);
		dif=sqrt(dif);
		col=mix(col,vec3(1.-dif)*sqrt(col),fres);
		col=mix(col,vec3(dif),fres);
		col+=.25*spec*hue(spec)+.5*spec;
		vec3 q=p;
		cam(q);
		col=mix(col,mix(col,vec3(1),.08),effect(q.xy*8.));
		col=mix(col,vec3(1),fres*fres*.22);
		col=S(-.05,.8,col);
		col=max(col,.02);
	} else {
		col=mix(vec3(.1,.2,.3),vec3(.008),pow(S(.0,.65,dot(uv,uv)),.3));
		col+=sqrt(at*vec3(.9,.7,1))*.25;
	}
	float t=min((time-.5)*.3,1.);
	col=mix(vec3(0),col,t);
	col=S(-.15,1.1,.9*col);
	O=vec4(col,1);
}