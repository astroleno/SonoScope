import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import Visualizer from '../../app/components/visualizer';

const sketches = vi.hoisted(() => [] as any[]);
vi.mock('../../app/node_modules/p5', () => ({ default: class {
  constructor(sketch: (p: any) => void) {
    const p: any = { width: 100, height: 100, windowWidth: 1280, windowHeight: 720, WEBGL: 'webgl', P2D: 'p2d' };
    p.lose = vi.fn(); p.drawingContext = { getExtension: vi.fn(() => ({ loseContext: p.lose })) };
    p.pixelDensity = vi.fn(); p.frameRate = vi.fn(); p.noLoop = vi.fn(); p.loop = vi.fn(); p.redraw = vi.fn(); p.remove = vi.fn();
    p.createCanvas = vi.fn((width, height) => { p.width = width; p.height = height; return { parent: vi.fn() }; });
    p.resizeCanvas = vi.fn((width, height) => { p.width = width; p.height = height; }); p.createShader = vi.fn(() => ({}));
    sketch(p); p.setup(); sketches.push(p); return p;
  }
} }));
afterEach(() => { cleanup(); sketches.length = 0; });

it('allocates the final canvas density once and avoids an unchanged deferred resize', async () => {
  render(<Visualizer audioLevel={0} running={false} preset="wave" />);
  await waitFor(() => expect(sketches).toHaveLength(1));
  const p = sketches[0];
  expect(p.pixelDensity).toHaveBeenCalledExactlyOnceWith(1);
  expect(p.pixelDensity.mock.invocationCallOrder[0]).toBeLessThan(p.createCanvas.mock.invocationCallOrder[0]);
  await new Promise(resolve => setTimeout(resolve, 80));
  expect(p.resizeCanvas).not.toHaveBeenCalled();
});

it('releases each detached GPU context on preset replacement and unmount', async () => {
  const view = render(<Visualizer audioLevel={0} running preset="wave" />);
  await waitFor(() => expect(sketches).toHaveLength(1));
  const first = sketches[0]; view.rerender(<Visualizer audioLevel={0} running preset="accretion" />);
  await waitFor(() => expect(sketches).toHaveLength(2));
  expect(first.remove).toHaveBeenCalledOnce(); expect(first.lose).toHaveBeenCalledOnce();
  expect(first.remove.mock.invocationCallOrder[0]).toBeLessThan(first.lose.mock.invocationCallOrder[0]);
  expect(sketches[1].lose).not.toHaveBeenCalled();
  view.unmount(); expect(sketches[1].remove).toHaveBeenCalledOnce(); expect(sketches[1].lose).toHaveBeenCalledOnce();
});
