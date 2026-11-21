import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CostRevaluationCard from './CostRevaluationCard';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('submits cost revaluation and updates unit cost and stock value', async () => {
  const onRevalued = vi.fn();
  const calls: { url: string; body: any; headers: any }[] = [];

  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    calls.push({
      url,
      body: init?.body ? JSON.parse(String(init.body)) : null,
      headers: init?.headers,
    });
    return new Response(
      JSON.stringify({
        id: 'doc-1',
        kind: 'cost_revaluation',
        newUnitCostMinor: 15000,
        newValueMinor: 60000,
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  });

  render(
    <CostRevaluationCard
      shopId="shop-1"
      variantId="var-1"
      physicalCount={4}
      currentUnitCostMinor={10000}
      currentStockValueMinor={40000}
      onRevalued={onRevalued}
    />,
  );

  const u = userEvent.setup();
  const priceInput = screen.getByLabelText('Новая закупочная цена, сом');
  await u.clear(priceInput);
  await u.type(priceInput, '150');
  await u.type(screen.getByLabelText('Причина переоценки'), 'Ошибка приёмки');

  expect(screen.getByText(/600,00 сом/)).toBeTruthy();

  await u.click(screen.getByRole('button', { name: 'Переоценить остаток' }));

  await screen.findByText(/Переоценка зафиксирована/);
  expect(calls).toHaveLength(1);
  expect(calls[0].url).toBe('/api/shops/shop-1/inventory/revaluations');
  expect(calls[0].body).toEqual({
    variantId: 'var-1',
    unitCostMinor: 15000,
    reason: 'Ошибка приёмки',
  });
  expect(calls[0].headers['idempotency-key']).toBeTruthy();
  expect(onRevalued).toHaveBeenCalledWith({
    newUnitCostMinor: 15000,
    newValueMinor: 60000,
  });
});

it('disables revaluation form when physical stock is zero', () => {
  render(
    <CostRevaluationCard
      shopId="shop-1"
      variantId="var-1"
      physicalCount={0}
      onRevalued={vi.fn()}
    />,
  );

  expect(
    screen.getByText(/Переоценка доступна только при наличии остатка/),
  ).toBeTruthy();
  expect(
    screen.queryByRole('button', { name: 'Переоценить остаток' }),
  ).toBeNull();
});
