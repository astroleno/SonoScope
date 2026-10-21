import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

function processor(sampleRate = 48000) {
  const messages: { pcm: Float32Array; audioTime: number }[] = [];
  let Processor!: new () => { process(inputs: Float32Array[][]): boolean };
  class BaseProcessor {
    port = { postMessage(data: { pcm: Float32Array; audioTime: number }, transfer: ArrayBuffer[]) { messages.push(structuredClone(data, { transfer })); } };
  }
  const scope = createContext({ AudioWorkletProcessor: BaseProcessor, Float32Array, sampleRate, currentFrame: 0, registerProcessor: (_name: string, type: typeof Processor) => { Processor = type; } });
  runInContext(readFileSync(new URL('../../app/public/audio/capture-worklet.js', import.meta.url), 'utf8'), scope);
  const instance = new Processor();
  return { messages, process(channels: Float32Array[], currentFrame: number) { scope.currentFrame = currentFrame; return instance.process([channels]); } };
}

describe('production AudioWorklet processor algorithm', () => {
  it('transfers uninterrupted 1024-sample frames across render quanta with end-of-frame audio timestamps', () => {
    const p = processor();
    for (let quantum = 0; quantum < 16; quantum++) {
      const pcm = Float32Array.from({ length: 128 }, (_, index) => (quantum * 128 + index) / 2048);
      expect(p.process([pcm], quantum * 128)).toBe(true);
    }
    expect(p.messages).toHaveLength(2);
    expect(p.messages[0].pcm).toHaveLength(1024); expect(p.messages[1].pcm).toHaveLength(1024);
    expect([...p.messages[0].pcm, ...p.messages[1].pcm]).toEqual(Array.from({ length: 2048 }, (_, i) => i / 2048));
    expect(p.messages[0].audioTime).toBeCloseTo(1024 / 48000);
    expect(p.messages[1].audioTime).toBeCloseTo(2048 / 48000);
  });

  it('averages actual input channels instead of doubling stereo level', () => {
    const p = processor(44100);
    p.process([new Float32Array(1024).fill(.25), new Float32Array(1024).fill(.75)], 0);
    expect(p.messages).toHaveLength(1); expect(p.messages[0].pcm.every(v => v === .5)).toBe(true);
    expect(p.messages[0].audioTime).toBeCloseTo(1024 / 44100);
  });

  it('does not fabricate PCM for disconnected inputs and retains partial buffers across variable quantum sizes', () => {
    const p = processor();
    expect(p.process([], 0)).toBe(true); expect(p.messages).toHaveLength(0);
    p.process([new Float32Array(600).fill(.25)], 128);
    p.process([], 728); expect(p.messages).toHaveLength(0);
    p.process([new Float32Array(600).fill(.5)], 856);
    expect(p.messages).toHaveLength(1); expect(p.messages[0].pcm.slice(0, 600).every(v => v === .25)).toBe(true);
    expect(p.messages[0].pcm.slice(600).every(v => v === .5)).toBe(true);
    expect(p.messages[0].audioTime).toBeCloseTo((856 + 424) / 48000);
    p.process([new Float32Array(848).fill(.75)], 1456);
    expect(p.messages).toHaveLength(2);
    expect(p.messages[1].pcm.slice(0, 176).every(v => v === .5)).toBe(true);
    expect(p.messages[1].pcm.slice(176).every(v => v === .75)).toBe(true);
  });
});
