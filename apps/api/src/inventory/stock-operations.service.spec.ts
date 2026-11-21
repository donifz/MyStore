import { BadRequestException, ConflictException } from '@nestjs/common';
import { StockOperationsService } from './stock-operations.service';

describe('StockOperationsService.revalueCost', () => {
  function makeService(physical: number, stockValueMinor: number) {
    const queries: { sql: string; params: unknown[] }[] = [];
    const tx = {
      query: async (sql: string, params: unknown[] = []) => {
        queries.push({ sql, params });
        return [];
      },
    };
    const ops = {
      execute: async (
        _shop: string,
        _key: string,
        _fingerprint: unknown,
        fn: (tx: any) => Promise<any>,
      ) => fn(tx),
    };
    const stock = {
      lock: async () =>
        new Map([
          [
            '11111111-1111-4111-8111-111111111111',
            { physical, reserved: 0, stock_value_minor: stockValueMinor },
          ],
        ]),
    };
    const service = new StockOperationsService(
      {} as any,
      ops as any,
      stock as any,
    );
    return { service, queries };
  }

  it('revalues stock_value_minor and records stock_documents + cost_revaluations', async () => {
    const { service, queries } = makeService(4, 40000);

    const result = await service.revalueCost('shop-1', 'user-1', 'idem-1', {
      variantId: '11111111-1111-4111-8111-111111111111',
      unitCostMinor: 12500,
      reason: 'Ошибка приёмки',
    });

    expect(result).toMatchObject({
      kind: 'cost_revaluation',
      physical: 4,
      previousUnitCostMinor: 10000,
      newUnitCostMinor: 12500,
      previousValueMinor: 40000,
      newValueMinor: 50000,
      deltaValueMinor: 10000,
    });
    expect(
      queries.some((q) => q.sql.includes('INSERT INTO stock_documents')),
    ).toBe(true);
    expect(
      queries.some((q) => q.sql.includes('INSERT INTO cost_revaluations')),
    ).toBe(true);
    expect(
      queries.some(
        (q) =>
          q.sql.includes('UPDATE stock_balances SET stock_value_minor=$3') &&
          q.params[2] === 50000,
      ),
    ).toBe(true);
  });

  it('rejects revaluation when physical stock is zero', async () => {
    const { service } = makeService(0, 0);
    await expect(
      service.revalueCost('shop-1', 'user-1', 'idem-2', {
        variantId: '11111111-1111-4111-8111-111111111111',
        unitCostMinor: 12500,
        reason: 'Ошибка приёмки',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects revaluation with empty reason', async () => {
    const { service } = makeService(5, 50000);
    await expect(
      service.revalueCost('shop-1', 'user-1', 'idem-3', {
        variantId: '11111111-1111-4111-8111-111111111111',
        unitCostMinor: 12500,
        reason: '   ',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
