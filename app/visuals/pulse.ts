export type Particle = {
  x: number;
  y: number;
  r: number;
  a: number;
  vx: number;
  vy: number;
};

export type PulseFeatures = {
  spectralCentroid?: number;     // Hz
  spectralBandwidth?: number;    // 0..1 normalized or Hz
  spectralFlux?: number;         // 0..1
  tempo?: number;                // BPM
  beatStrength?: number;         // 0..1
};

export function drawPulse(
  p: any,
  particles: Particle[],
  level: number,
  features?: PulseFeatures
) {
  const target = Math.max(0, Math.min(1, level));
  const smooth = 0.15;
  const displayed = (p as any)._displayedLevel ?? 0;
  const newDisplayed = displayed + (target - displayed) * smooth;
  (p as any)._displayedLevel = newDisplayed;

  const centroidHz = Math.max(0, Math.min(8000, features?.spectralCentroid ?? 0));
  const centroid = centroidHz / 8000;
  const bandwidth = Math.max(0, Math.min(1, features?.spectralBandwidth ?? 0));
  const flux = Math.max(0, Math.min(1, features?.spectralFlux ?? 0));
  const beat = Math.max(0, Math.min(1, features?.beatStrength ?? 0));
  const tempo = Math.max(0, features?.tempo ?? 0);

  p.noStroke();
  for (const pt of particles) {
    const alpha = pt.a * (0.6 + newDisplayed * 0.8);
    // Audio-reactive color: map centroid to hue-ish gradient between blue→purple→pink
    const hueShift = centroid; // 0..1
    const r = Math.floor(147 + 108 * hueShift);
    const g = Math.floor(51 * (1 - hueShift));
    const b = Math.floor(234 - 117 * hueShift);
    p.fill(r, g, b, alpha);
    // Particle radius influenced by bandwidth
    p.circle(pt.x, pt.y, pt.r + newDisplayed * 2 * (1 + bandwidth * 0.5));
    // Velocity boosted by flux and beat
    const speedBoost = 1 + newDisplayed * 2 + flux * 1.2 + beat * 0.6;
    pt.x += pt.vx * speedBoost;
    pt.y += pt.vy * speedBoost;
    if (pt.x < -10) pt.x = p.width + 10;
    if (pt.x > p.width + 10) pt.x = -10;
    if (pt.y < -10) pt.y = p.height + 10;
    if (pt.y > p.height + 10) pt.y = -10;
  }

  // Ring colors adapt with centroid
  const ringColor = p.color(
    Math.floor(59 + 196 * centroid),
    Math.floor(130 * (1 - centroid)),
    Math.floor(246 - 146 * centroid)
  );
  const pulseColor = p.color(
    Math.floor(147 + 80 * centroid),
    Math.floor(51 * (1 - centroid)),
    Math.floor(234 - 120 * centroid)
  );

  const cx = p.width / 2;
  const cy = p.height * 0.55;
  const baseR = Math.min(p.width, p.height) * 0.18;
  // BPM-synced subtle breathing on ring radius
  const beatPhase = tempo > 0 ? Math.sin((p.millis() / 1000) * (tempo / 60) * Math.PI * 2) * 0.05 : 0;
  const ringR = baseR * (1 + newDisplayed * 0.5 + beatPhase * (0.2 + beat * 0.3));

  p.noFill();
  p.stroke(ringColor);
  p.strokeWeight(4 + newDisplayed * 6);
  p.circle(cx, cy, ringR * 2);

  p.stroke(pulseColor);
  p.strokeWeight(2 + newDisplayed * 4);
  const pulseR = ringR * (0.55 + newDisplayed * 0.35 + flux * 0.1);
  p.circle(cx, cy, pulseR * 2);

  const glow = p.drawingContext as CanvasRenderingContext2D;
  const prevShadow = glow.shadowBlur;
  const prevColor = glow.shadowColor;
  glow.shadowBlur = 30 + newDisplayed * 60 + beat * 20;
  const glowR = Math.floor(147 + 80 * centroid);
  const glowG = Math.floor(51 * (1 - centroid));
  const glowB = Math.floor(234 - 120 * centroid);
  glow.shadowColor = `rgba(${glowR},${glowG},${glowB},${0.35 + newDisplayed * 0.3})`;
  p.fill(glowR, glowG, glowB, 120 + newDisplayed * 80);
  p.noStroke();
  p.circle(cx, cy, baseR * 0.9 + newDisplayed * baseR * 0.4);
  glow.shadowBlur = prevShadow;
  glow.shadowColor = prevColor as any;
}
