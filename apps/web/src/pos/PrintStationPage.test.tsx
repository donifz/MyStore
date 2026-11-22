// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PrintStationPage from './PrintStationPage';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('PrintStationPage', () => {
  it('lists queued print jobs and prints a pending job via browser print', async () => {
    const jobs = [
      {
        id: 'job-1',
        shopId: 'shop-1',
        kind: 'label',
        status: 'pending',
        payload: {
          labelSize: '30x20',
          items: [
            {
              name: 'Кофе арабика',
              barcode: '00001234',
              priceMinor: 25000,
              copies: 2,
            },
          ],
        },
        error: null,
        createdAt: '2026-11-21T12:00:00.000Z',
        printedAt: null,
      },
    ];

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('127.0.0.1:9191')) {
          throw new Error('offline');
        }
        if (url.endsWith('/print-jobs?limit=40')) {
          return new Response(JSON.stringify({ items: jobs }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (
          url.endsWith('/print-jobs/job-1/claim') &&
          init?.method === 'POST'
        ) {
          jobs[0] = { ...jobs[0], status: 'printing' };
          return new Response(JSON.stringify(jobs[0]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (
          url.endsWith('/print-jobs/job-1/complete') &&
          init?.method === 'POST'
        ) {
          jobs[0] = { ...jobs[0], status: 'printed' };
          return new Response(JSON.stringify(jobs[0]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({}), { status: 200 });
      },
    );
    vi.stubGlobal('fetch', fetchMock);
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});

    render(
      <MemoryRouter initialEntries={['/seller/shop-1/print-station']}>
        <Routes>
          <Route
            path="/seller/:shopId/print-station"
            element={<PrintStationPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText('Кофе арабика × 2');
    expect(screen.getByText('Ожидает печати')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Запустить агента' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Скачать установщик (Windows)' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Скачать для Mac / Linux' }),
    ).toBeTruthy();

    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Печатать' }));

    await waitFor(() => expect(printSpy).toHaveBeenCalledOnce());
    await screen.findByText('Напечатано');
  });
});
