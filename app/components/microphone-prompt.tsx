'use client';

import { useEffect, useRef } from 'react';

export function MicrophonePrompt({ ready, failed, onAllow, onDismiss }: { ready: boolean; failed: boolean; onAllow(): void; onDismiss(): void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (element.showModal) element.showModal(); else element.setAttribute('open', '');
    return () => { if (element.open && element.close) element.close(); };
  }, []);
  return <dialog ref={dialog} className="microphone-prompt" aria-labelledby="microphone-prompt-title" aria-describedby="microphone-prompt-description" onCancel={event => { event.preventDefault(); onDismiss(); }}>
    <h2 id="microphone-prompt-title">开启麦克风？</h2>
    <p id="microphone-prompt-description">{failed ? '声音暂未准备好，请重新加载后重试。' : '允许后，画面和弹幕会跟随声音变化。'}</p>
    <p className="microphone-privacy">原始音频留在当前浏览器。</p>
    <div className="microphone-prompt-actions">
      <button type="button" className="action-button primary-action" disabled={!ready && !failed} onClick={onAllow}>{failed ? '重新加载声音' : ready ? '允许麦克风' : '声音准备中…'}</button>
      <button type="button" className="text-button" onClick={onDismiss}>先看看</button>
    </div>
  </dialog>;
}
