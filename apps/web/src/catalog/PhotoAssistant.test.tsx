import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import PhotoAssistant from './PhotoAssistant';
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it('releases manual entry when the recognition connection never responds', async () => {
  vi.stubGlobal('fetch', async (_url: string, options: RequestInit) => {
    if (options.method !== 'POST')
      return new Response(
        JSON.stringify({ available: true, categories: ['Другое'] }),
      );
    return new Promise<Response>((_resolve, reject) =>
      options.signal!.addEventListener(
        'abort',
        () => reject(new DOMException('Aborted', 'AbortError')),
        { once: true },
      ),
    );
  });
  const noop = () => {};
  render(
    <PhotoAssistant
      shopId="shop"
      photo="photo"
      onApply={noop}
      onBusyChange={noop}
      onCategories={noop}
    />,
  );
  const button = await screen.findByRole('button', {
    name: 'Определить по фото',
  });
  await act(async () => {});
  expect((button as HTMLButtonElement).disabled).toBe(false);
  vi.useFakeTimers();
  fireEvent.click(button);
  expect(
    (
      screen.getByRole('button', {
        name: 'Определяем товар…',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30000);
  });
  expect(screen.getByRole('alert').textContent).toContain(
    'Заполните товар вручную',
  );
  expect(
    (
      screen.getByRole('button', {
        name: 'Определить по фото',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(false);
});
