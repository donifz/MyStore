import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SessionProvider } from '../auth/SessionProvider';
import CategoriesPage from './CategoriesPage';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('paginates categories and finds a nested subcategory', async () => {
  const categories = Array.from({ length: 15 }, (_, index) => ({
    id: 'cat-' + index,
    name: 'Категория ' + String(index + 1).padStart(2, '0'),
    builtIn: index % 2 === 0,
    children: index === 14
      ? [{ id: 'nested', name: 'Робототехника', builtIn: false }]
      : [],
  }));
  vi.stubGlobal('fetch', async (url: string) => {
    const body = url === '/api/auth/me'
      ? {
          userId: 'owner',
          shops: [{ id: 'shop', name: 'Магазин', role: 'owner' }],
        }
      : categories;
    return new Response(JSON.stringify(body), {
      headers: { 'content-type': 'application/json' },
    });
  });
  render(
    <MemoryRouter initialEntries={['/seller/shop/categories']}>
      <SessionProvider>
        <Routes>
          <Route path="/seller/:shopId/categories" element={<CategoriesPage />} />
        </Routes>
      </SessionProvider>
    </MemoryRouter>,
  );
  await screen.findByText('Категория 01');
  expect(screen.queryByText('Категория 15')).toBeNull();
  const pager = screen.getByRole('navigation', { name: 'Страницы категорий' });
  await userEvent.setup().click(within(pager).getByRole('button', { name: 'Далее' }));
  expect(await screen.findByText('Категория 15')).toBeTruthy();
  await userEvent.setup().type(screen.getByLabelText('Поиск категории'), 'Робототехника');
  expect(screen.getByText('Категория 15')).toBeTruthy();
  expect(screen.getByText('Робототехника')).toBeTruthy();
  expect(screen.queryByText('Категория 01')).toBeNull();
});
