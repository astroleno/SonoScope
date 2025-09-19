#version 300 es 
in vec3 aPosition; void main() { gl_Position=vec4(aPosition*2.-1., 1.0); }