import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { FlipOptionList } from '../../app/components/flip-option-list';
afterEach(cleanup);
const options = [{ id: 'wave', label: 'Wave' }, { id: 'accretion', label: 'Accretion' }, { id: 'mochi', label: 'Mochi' }];
it('one Tab stop, arrow moves real focus, Enter triggers exactly one selection', async () => {
  const select = vi.fn(), user = userEvent.setup(); render(<FlipOptionList options={options} value="wave" onChange={select} />);
  const radios = screen.getAllByRole('radio'); expect(radios.filter(r => r.tabIndex === 0)).toHaveLength(1);
  await user.tab(); expect(document.activeElement).toBe(radios[0]); await user.keyboard('{ArrowRight}'); expect(document.activeElement).toBe(radios[1]);
  select.mockClear(); await user.keyboard('{Enter}'); expect(select).toHaveBeenCalledExactlyOnceWith('accretion');
});
it('reduced motion removes duplicate animated glyphs and stagger delays', () => {
  render(<FlipOptionList options={options} value="mochi" animation="off" />);
  const mochi = screen.getByRole('radio', { name: 'Mochi' }); expect(mochi.getAttribute('aria-checked')).toBe('true'); expect(mochi.querySelector('.flip-copy')).toBeNull();
  for (const glyph of mochi.querySelectorAll('span[style]')) expect((glyph as HTMLElement).style.transitionDelay).toBe('0ms');
});
it('an external preset selection becomes the single Tab stop', async () => {
  const user = userEvent.setup(), view = render(<FlipOptionList options={options} value="wave" />);
  await user.tab(); await user.keyboard('{ArrowRight}');
  view.rerender(<FlipOptionList options={options} value="mochi" />);
  expect(screen.getAllByRole('radio').filter(r => r.tabIndex === 0)).toEqual([screen.getByRole('radio', { name: 'Mochi' })]);
});
