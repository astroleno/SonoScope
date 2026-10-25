/** Cross-tab ownership is separate from source/session IDs. */
export function holdRecordingLock(id: string): Promise<() => void> {
  const locks = globalThis.navigator?.locks;
  if (!locks) return Promise.resolve(() => undefined);
  return new Promise((resolve, reject) => {
    let release!: () => void;
    const held = new Promise<void>(done => { release = done; });
    void locks.request(`sonoscope-recording:${id}`, { ifAvailable: true, mode: 'exclusive' }, async lock => {
      if (!lock) throw new Error('这段录播正在另一个 SS 页面中使用，请先结束录制。');
      resolve(release); await held;
    }).catch(reject);
  });
}
