export type Particle = {
  x: number;
  y: number;
  r: number;
  a: number;
  vx: number;
  vy: number;
};

export function drawPulse(p: any, particles: Particle[], level: number) {
  const target = Math.max(0, Math.min(1, level));
  const smooth = 0.15;
  const displayed = (p as any)._displayedLevel ?? 0;
  const newDisplayed = displayed + (target - displayed) * smooth;
  (p as any)._displayedLevel = newDisplayed;

  p.noStroke();
  for (const pt of particles) {
    const alpha = pt.a * (0.6 + newDisplayed * 0.8);
    p.fill(255, 255, 255, alpha);
    p.circle(pt.x, pt.y, pt.r + newDisplayed * 2);
    pt.x += pt.vx * (1 + newDisplayed * 2);
    pt.y += pt.vy * (1 + newDisplayed * 2);
    if (pt.x < -10) pt.x = p.width + 10;
    if (pt.x > p.width + 10) pt.x = -10;
    if (pt.y < -10) pt.y = p.height + 10;
    if (pt.y > p.height + 10) pt.y = -10;
  }

  const ringColor = p.color(59, 130, 246);
  const pulseColor = p.color(147, 51, 234);

  const cx = p.width / 2;
  const cy = p.height * 0.55;
  const baseR = Math.min(p.width, p.height) * 0.18;
  const ringR = baseR * (1 + newDisplayed * 0.5);

  p.noFill();
  p.stroke(ringColor);
  p.strokeWeight(4 + newDisplayed * 6);
  p.circle(cx, cy, ringR * 2);

  p.stroke(pulseColor);
  p.strokeWeight(2 + newDisplayed * 4);
  const pulseR = ringR * (0.55 + newDisplayed * 0.35);
  p.circle(cx, cy, pulseR * 2);

  const glow = p.drawingContext as CanvasRenderingContext2D;
  const prevShadow = glow.shadowBlur;
  const prevColor = glow.shadowColor;
  glow.shadowBlur = 30 + newDisplayed * 60;
  glow.shadowColor = `rgba(147,51,234,${0.35 + newDisplayed * 0.3})`;
  p.fill(147, 51, 234, 120 + newDisplayed * 80);
  p.noStroke();
  p.circle(cx, cy, baseR * 0.9 + newDisplayed * baseR * 0.4);
  glow.shadowBlur = prevShadow;
  glow.shadowColor = prevColor as any;
}
