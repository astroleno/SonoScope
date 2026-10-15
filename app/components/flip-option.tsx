'use client';
import { forwardRef } from 'react';
interface FlipOptionProps { label: string; selected?: boolean; disabled?: boolean; onSelect?: () => void; density?: 'compact' | 'normal' | 'spacious'; animation?: 'auto' | 'reduced' | 'off'; className?: string; tabIndex?: number; onKeyDown?: React.KeyboardEventHandler<HTMLButtonElement>; onFocus?: React.FocusEventHandler<HTMLButtonElement>; role?: 'radio' }
export const FlipOption = forwardRef<HTMLButtonElement, FlipOptionProps>(function FlipOption({ label, selected = false, disabled = false, onSelect, animation = 'auto', className = '', tabIndex, onKeyDown, onFocus, role }, ref) {
  const letters = typeof Intl.Segmenter === 'function' ? Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(label), s => s.segment) : Array.from(label);
  return <button ref={ref} type="button" className={`flip-option ${className}`} data-selected={selected} data-motion={animation} disabled={disabled} onClick={onSelect} onKeyDown={onKeyDown} onFocus={onFocus} tabIndex={tabIndex} role={role} aria-checked={role === 'radio' ? selected : undefined} aria-pressed={role ? undefined : selected} aria-label={label}>
    <span className="flip-line" aria-hidden="true">{letters.map((letter, i) => <span key={i} style={{ transitionDelay: animation === 'auto' ? `${i * 22}ms` : '0ms' }}>{letter}</span>)}</span>
    {animation === 'auto' && <span className="flip-line flip-copy" aria-hidden="true">{letters.map((letter, i) => <span key={i} style={{ transitionDelay: `${i * 22}ms` }}>{letter}</span>)}</span>}
  </button>;
});
export default FlipOption;
