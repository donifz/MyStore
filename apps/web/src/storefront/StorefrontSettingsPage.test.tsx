import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { SessionProvider } from '../auth/SessionProvider';
import StorefrontSettingsPage from './StorefrontSettingsPage';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function setup(role = 'owner', reject = false, overrides: any = {}) {
  const saves = Object.assign([] as any[], { bannerSaves: [] as any[] });
  const profile = {
    name: 'Тест',
    slug: 'test',
    description: '',
    city: 'Ош',
    address: '',
    phone: '+996700123456',
    hours: 'По звонку',
    published: false,
    banner: null,
    pickupEnabled: true,
    timeZone: 'Asia/Bishkek',
    businessSchedule: null,
    reservationPolicy: 'legacy-30-minutes',
    confirmationPreview: {
      from: '2026-10-17T12:00:00Z',
      expiresAt: '2026-10-17T12:30:00Z',
    },
    ...overrides,
  };
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (url === '/api/auth/me')
      return new Response(
        JSON.stringify({
          userId: 'owner',
          email: 'owner@example.test',
          csrfToken: 'csrf',
          shops: [{ id: 'shop', name: 'Тест', role }],
        }),
      );
    if (init?.method === 'PUT' && url.endsWith('/storefront/banner')) {
      const body = JSON.parse(String(init.body));
      saves.bannerSaves.push(body);
      return new Response(JSON.stringify({ banner: body.banner }));
    }
    if (init?.method === 'PUT') {
      saves.push(JSON.parse(String(init.body)));
      if (reject)
        return new Response(
          JSON.stringify({ message: 'Рабочие интервалы пересекаются.' }),
          { status: 400 },
        );
      return new Response(
        JSON.stringify({
          ...profile,
          ...saves.at(-1),
          reservationPolicy: 'business-hours',
        }),
      );
    }
    return new Response(JSON.stringify(profile));
  });
  render(
    <MemoryRouter initialEntries={['/seller/shop/storefront']}>
      <SessionProvider>
        <Routes>
          <Route
            path="/seller/:shopId/storefront"
            element={<StorefrontSettingsPage />}
          />
        </Routes>
      </SessionProvider>
    </MemoryRouter>,
  );
  return saves;
}
it('makes the legacy policy explicit and saves the selected week and timezone', async () => {
  const saves = setup();
  await screen.findByText(/Расписание не настроено/);
  fireEvent.click(screen.getByLabelText('Учитывать рабочие часы'));
  expect(screen.getAllByRole('checkbox', { name: /Выходной/ })).toHaveLength(7);
  fireEvent.change(screen.getByLabelText('Пн, начало 1'), {
    target: { value: '11:00' },
  });
  fireEvent.change(screen.getByLabelText('Часовой пояс'), {
    target: { value: 'Europe/Berlin' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Скопировать Пн на будни' }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить витрину' }));
  await screen.findByText('Настройки витрины сохранены.');
  expect(saves[0].timeZone).toBe('Europe/Berlin');
  expect(saves[0].businessSchedule).toEqual([
    ...Array.from({ length: 5 }, () => [{ open: '11:00', close: '19:00' }]),
    [],
    [],
  ]);
  expect(screen.getByLabelText('Пн, начало 1')).toHaveProperty(
    'value',
    '11:00',
  );
});
it('edits and previews the canonical shop address', async () => {
  const saves = setup();
  await screen.findByDisplayValue('test');
  fireEvent.change(screen.getByLabelText('Адрес витрины'), {
    target: { value: 'new-home' },
  });
  expect(screen.getByText('/shop/new-home')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить витрину' }));
  await waitFor(() => expect(saves).toHaveLength(1));
  expect(saves[0].slug).toBe('new-home');
});
it('saves an image-only banner without validating storefront profile fields', async () => {
  const saves = setup('owner', false, {
    published: true,
    city: '',
    phone: '',
  });
  await screen.findByLabelText('Изображение JPEG (до 512 КБ)');
  expect(screen.queryByLabelText('Заголовок')).toBeNull();
  const file = new File(['jpeg image bytes'], 'banner.jpg', {
    type: 'image/jpeg',
  });
  fireEvent.change(screen.getByLabelText('Изображение JPEG (до 512 КБ)'), {
    target: { files: [file] },
  });
  await screen.findByRole('img', { name: 'Предпросмотр баннера' });
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить баннер' }));
  await waitFor(() => expect(saves.bannerSaves).toHaveLength(1));
  expect(saves.bannerSaves[0].banner.imageDataUrl).toMatch(
    /^data:image\/jpeg;base64,/,
  );
  expect(saves).toHaveLength(0);
  await screen.findByText('Баннер сохранён.');
});
it('retains typed intervals and all fields after a rejected save', async () => {
  setup('owner', true);
  await screen.findByText(/Расписание не настроено/);
  fireEvent.click(screen.getByLabelText('Учитывать рабочие часы'));
  fireEvent.change(screen.getByLabelText('Пн, начало 1'), {
    target: { value: '21:00' },
  });
  fireEvent.change(screen.getByLabelText('Пн, конец 1'), {
    target: { value: '02:00' },
  });
  expect(screen.getByText('До следующего дня')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Город'), {
    target: { value: 'Бишкек' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить витрину' }));
  await screen.findByRole('alert');
  expect(screen.getByLabelText('Пн, начало 1')).toHaveProperty(
    'value',
    '21:00',
  );
  expect(screen.getByLabelText('Пн, конец 1')).toHaveProperty('value', '02:00');
  expect(screen.getByLabelText('Город')).toHaveProperty('value', 'Бишкек');
  expect(screen.queryByText('Настройки витрины сохранены.')).toBeNull();
});
it('adds a break and requires explicit action to clear a schedule', async () => {
  const saves = setup();
  await screen.findByText(/Расписание не настроено/);
  fireEvent.click(screen.getByLabelText('Учитывать рабочие часы'));
  fireEvent.click(
    screen.getByRole('button', { name: 'Добавить интервал, Пн' }),
  );
  expect(screen.getByLabelText('Пн, начало 2')).toBeTruthy();
  fireEvent.click(screen.getByLabelText('Выходной, Пн'));
  expect(screen.queryByLabelText('Пн, начало 1')).toBeNull();
  fireEvent.click(screen.getByLabelText('Учитывать рабочие часы'));
  expect(screen.getByText(/Расписание не настроено/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить витрину' }));
  await waitFor(() => expect(saves).toHaveLength(1));
  expect(saves[0].businessSchedule).toBeNull();
});
it.each(['manager', 'cashier'])(
  'denies %s access to settings',
  async (role) => {
    const saves = setup(role);
    await screen.findByText('Настройка витрины доступна владельцу.');
    expect(
      screen.queryByRole('button', { name: 'Сохранить витрину' }),
    ).toBeNull();
    expect(saves).toHaveLength(0);
  },
);

it('disables mutations during save and invalidates the saved preview after edits', async () => {
  setup();
  await screen.findByText(/Расписание не настроено/);
  expect(screen.getByText(/Если заказ поступит сейчас/)).toBeTruthy();
  fireEvent.click(screen.getByLabelText('Учитывать рабочие часы'));
  expect(screen.queryByText(/Если заказ поступит сейчас/)).toBeNull();
  const original = global.fetch;
  let finish!: () => void;
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (init?.method === 'PUT')
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
    return original(url, init);
  });
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить витрину' }));
  await screen.findByRole('button', { name: 'Сохранение…' });
  expect(screen.getByLabelText('Пн, начало 1')).toHaveProperty(
    'disabled',
    true,
  );
  expect(screen.getByLabelText('Учитывать рабочие часы')).toHaveProperty(
    'disabled',
    true,
  );
  finish();
  await screen.findByText('Настройки витрины сохранены.');
});
