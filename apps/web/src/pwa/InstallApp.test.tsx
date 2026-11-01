import { afterEach, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { InstallApp, InstallAppProvider } from './InstallApp';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function open() {
  return render(
    <InstallAppProvider>
      <InstallApp />
    </InstallAppProvider>,
  );
}
function offer(outcome: 'accepted' | 'dismissed' = 'dismissed') {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  const prompt = vi.fn().mockResolvedValue(undefined);
  Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome }) });
  act(() => {
    window.dispatchEvent(event);
  });
  return { event, prompt };
}
it('explains Android and iPhone installation without prompting automatically', () => {
  open();
  expect(screen.getByText('Установить MyStore')).toBeTruthy();
  expect(screen.getByText(/На экран «Домой»/)).toBeTruthy();
  expect(
    screen.queryByRole('button', { name: 'Установить приложение' }),
  ).toBeNull();
});
it('prompts only on click and retains instructions after cancellation', async () => {
  open();
  const { event, prompt } = offer();
  expect(event.defaultPrevented).toBe(true);
  expect(prompt).not.toHaveBeenCalled();
  await act(async () => {
    fireEvent.click(
      screen.getByRole('button', { name: 'Установить приложение' }),
    );
  });
  expect(prompt).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Установить MyStore')).toBeTruthy();
  expect(
    screen.queryByRole('button', { name: 'Установить приложение' }),
  ).toBeNull();
  offer('accepted');
  await act(async () => {
    fireEvent.click(
      screen.getByRole('button', { name: 'Установить приложение' }),
    );
  });
  expect(screen.queryByText('Установить MyStore')).toBeNull();
});
it('keeps the captured prompt when the install control remounts', () => {
  const view = render(
    <InstallAppProvider>
      <InstallApp key="login" />
    </InstallAppProvider>,
  );
  offer();
  view.rerender(
    <InstallAppProvider>
      <InstallApp key="workspace" />
    </InstallAppProvider>,
  );
  expect(
    screen.getByRole('button', { name: 'Установить приложение' }),
  ).toBeTruthy();
});
it('handles native prompt errors without losing installation help', async () => {
  open();
  const { prompt } = offer();
  prompt.mockRejectedValue(new Error('Unavailable'));
  await act(async () => {
    fireEvent.click(
      screen.getByRole('button', { name: 'Установить приложение' }),
    );
  });
  expect(screen.getByRole('alert').textContent).toContain('меню браузера');
  expect(screen.getByText(/На экран «Домой»/)).toBeTruthy();
});
it('hides controls on appinstalled and removes event listeners on unmount', () => {
  const view = open();
  act(() => {
    window.dispatchEvent(new Event('appinstalled'));
  });
  expect(screen.queryByText('Установить MyStore')).toBeNull();
  view.unmount();
  const event = new Event('beforeinstallprompt', { cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
});
it('hides installation help in standalone mode', () => {
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  open();
  expect(screen.queryByText('Установить MyStore')).toBeNull();
});
