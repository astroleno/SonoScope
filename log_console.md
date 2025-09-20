
Build Error
Failed to compile

Next.js (14.2.32) is outdated (learn more)
./visuals/mosaic.ts
Error: 
  × Expected ',', got ';'
     ╭─[/Users/zuobowen/Documents/GitHub/SonoScope/app/visuals/mosaic.ts:346:1]
 346 │     Math.max(0, Math.min(1, audio.mfcc?.[3] ?? 0)),
 347 │   ]);
 348 │   shader.setUniform('uPulse', Math.max(0, Math.min(1, audio.pulse || 0)));
 349 │   shader.setUniform('uSensitivity', Math.max(0.5, Math.min(3.0, sensitivity || 1.5));
     ·                                                                                     ─
 350 │   
 351 │   // Color scheme uniforms
 352 │   const [r1, g1, b1] = hexToRgb(colorScheme.colors[0]);
     ╰────

Caused by:
    Syntax Error

Import trace for requested module:
./visuals/mosaic.ts
./components/visualizer.tsx
./app/page.tsx
This error occurred during the build process and can only be dismissed by fixing the error.