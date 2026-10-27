import { act } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import RootLayout from '../../app/app/layout';

vi.mock('../../app/components/accessibility-provider', () => ({ AccessibilityProvider: ({ children }: { children: React.ReactNode }) => children }));

let root: Root | undefined;
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  document.documentElement.removeAttribute('data-immersive-translate-page-theme');
  document.body.removeAttribute('monica-id'); document.body.removeAttribute('monica-version');
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});
function serverDocument() {
  document.open();
  document.write(renderToString(<RootLayout><main><button>声音准备就绪</button></main></RootLayout>));
  document.close();
  // The user's extensions mutate both document shells before React hydrates.
  document.documentElement.setAttribute('data-immersive-translate-page-theme', 'dark');
  document.body.setAttribute('monica-id', 'qa-extension'); document.body.setAttribute('monica-version', '9.0.23');
}

it('hydrates the actual layout with translation/assistant attributes added before hydration', async () => {
  serverDocument();
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {}), recover = vi.fn();
  await act(async () => { root = hydrateRoot(document, <RootLayout><main><button>声音准备就绪</button></main></RootLayout>, { onRecoverableError: recover }); });
  expect(errors.mock.calls.flat().join(' ')).not.toMatch(/hydrat|didn't match/i);
  expect(recover).not.toHaveBeenCalled();
  expect(document.querySelector('main button')?.textContent).toBe('声音准备就绪');
  expect(document.body.getAttribute('monica-version')).toBe('9.0.23');
});

it('still reports mismatches inside the application', async () => {
  serverDocument();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const recover = vi.fn();
  await act(async () => { root = hydrateRoot(document, <RootLayout><main><button>不同的声音状态</button></main></RootLayout>, { onRecoverableError: recover }); });
  expect(recover).toHaveBeenCalled();
  expect(document.querySelector('main button')?.textContent).toBe('不同的声音状态');
});
