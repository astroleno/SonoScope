'use client';
import { useRef, useState } from 'react';
import { FlipOption } from './flip-option';
export interface OptionItem { id: string; label: string; disabled?: boolean }
interface Props { options: OptionItem[]; value?: string; onChange?: (id: string) => void; orientation?: 'horizontal' | 'vertical'; density?: 'compact' | 'normal' | 'spacious'; animation?: 'auto' | 'reduced' | 'off'; className?: string; 'aria-label'?: string }
export function FlipOptionList({ options, value, onChange, orientation = 'horizontal', density, animation, className = '', 'aria-label': label = '画面预设' }: Props) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [focusState, setFocusState] = useState<{ id: string; selected?: string } | null>(null);
  const focus = focusState?.selected === value && options.some(o => o.id === focusState?.id && !o.disabled) ? focusState?.id : options.find(o => o.id === value && !o.disabled)?.id ?? options.find(o => !o.disabled)?.id;
  const move = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const enabled = options.map((o, i) => !o.disabled ? i : -1).filter(i => i >= 0); const position = enabled.indexOf(index);
    let next: number | undefined;
    if (event.key === 'Home') next = enabled[0];
    else if (event.key === 'End') next = enabled.at(-1);
    else if (['ArrowRight', 'ArrowDown'].includes(event.key)) next = enabled[(position + 1) % enabled.length];
    else if (['ArrowLeft', 'ArrowUp'].includes(event.key)) next = enabled[(position + enabled.length - 1) % enabled.length];
    if (next === undefined) return;
    event.preventDefault(); setFocusState({ id: options[next].id, selected: value }); refs.current[next]?.focus(); onChange?.(options[next].id);
  };
  return <div className={`flip-option-list ${className}`} role="radiogroup" aria-label={label} aria-orientation={orientation}>{options.map((option, i) => <FlipOption key={option.id} ref={el => { refs.current[i] = el; }} label={option.label} role="radio" selected={option.id === value} disabled={option.disabled} density={density} animation={animation} tabIndex={option.id === focus ? 0 : -1} onFocus={() => setFocusState({ id: option.id, selected: value })} onKeyDown={event => move(event, i)} onSelect={() => onChange?.(option.id)} />)}</div>;
}
export default FlipOptionList;
