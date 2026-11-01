import { describe, expect, it } from 'vitest';
import {
  validateNewReceivingItem,
  validateReceivingDraft,
} from './receiving-validation';

describe('receiving validation stages', () => {
  it('validates only the new product when adding it to a draft', () => {
    // Another draft line can still have an empty cost at this stage.
    expect(validateNewReceivingItem('11', '55')).toEqual({
      count: 11,
      unitCostMinor: 5500,
    });
  });

  it('rejects invalid quantity, cost and unsafe amount of the new product', () => {
    expect(() => validateNewReceivingItem('0', '55')).toThrow('количество');
    expect(() => validateNewReceivingItem('1.5', '55')).toThrow('количество');
    expect(() => validateNewReceivingItem('1', '')).toThrow(
      'закупочную цену нового товара',
    );
    expect(() => validateNewReceivingItem('1000000000', '100000000')).toThrow(
      'Сумма слишком велика.',
    );
  });

  it('identifies an invalid previously added item only at posting', () => {
    const lines = [
      { id: 'old', name: 'Пластилин Караван 8 цветов', quantity: 2, unitCostText: '' },
      { id: 'new', name: 'Сквиш сыр', quantity: 11, unitCostText: '55' },
    ];
    expect(() => validateReceivingDraft(lines)).toThrow(
      'Укажите корректную закупочную цену для «Пластилин Караван 8 цветов».',
    );
    lines[0].unitCostText = '20';
    expect(validateReceivingDraft(lines)).toEqual([
      { variantId: 'old', quantity: 2, unitCostMinor: 2000 },
      { variantId: 'new', quantity: 11, unitCostMinor: 5500 },
    ]);
  });

  it('checks quantities and the combined total at posting', () => {
    expect(() =>
      validateReceivingDraft([
        { id: 'v', name: 'Мышь', quantity: 0, unitCostText: '50' },
      ]),
    ).toThrow('Укажите корректное количество для «Мышь».');
    expect(() =>
      validateReceivingDraft([
        { id: 'a', name: 'A', quantity: 1000000000, unitCostText: '90000' },
        { id: 'b', name: 'B', quantity: 1000000000, unitCostText: '1000' },
      ]),
    ).toThrow('Сумма слишком велика.');
  });
});
