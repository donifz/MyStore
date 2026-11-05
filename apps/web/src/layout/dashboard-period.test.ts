import { describe, expect, it } from 'vitest';
import { comparisonTrend, dashboardPeriodRange, shopDate } from './dashboard-period';

describe('financial reporting periods in Asia/Bishkek', () => {
  const now = new Date('2026-11-04T20:30:00.000Z');

  it('uses the local operating date instead of the UTC calendar date', () => {
    expect(shopDate(now)).toBe('2026-11-05');
    expect(dashboardPeriodRange('today', undefined, undefined, now)).toEqual({
      from: '2026-11-05T00:00:00+06:00',
      to: '2026-11-06T00:00:00+06:00',
      previousFrom: '2026-11-04T00:00:00+06:00',
      previousTo: '2026-11-05T00:00:00+06:00',
    });
  });

  it('includes today in seven- and thirty-day reporting windows', () => {
    expect(dashboardPeriodRange('week', undefined, undefined, now)).toEqual({
      from: '2026-10-30T00:00:00+06:00',
      to: '2026-11-06T00:00:00+06:00',
      previousFrom: '2026-10-23T00:00:00+06:00',
      previousTo: '2026-10-30T00:00:00+06:00',
    });
    expect(dashboardPeriodRange('month', undefined, undefined, now).to).toBe(
      '2026-11-06T00:00:00+06:00',
    );
  });

  it('compares a custom inclusive range to the preceding equal-length range', () => {
    expect(dashboardPeriodRange('custom', '2026-10-30', '2026-11-03', now)).toEqual({
      from: '2026-10-30T00:00:00+06:00',
      to: '2026-11-04T00:00:00+06:00',
      previousFrom: '2026-10-25T00:00:00+06:00',
      previousTo: '2026-10-30T00:00:00+06:00',
    });
    expect(() =>
      dashboardPeriodRange('custom', '2026-11-06', '2026-11-05', now),
    ).toThrow('Выберите правильный диапазон дат.');
  });
});

describe('financial comparison', () => {
  it('uses actual amounts and never invents increases', () => {
    expect(comparisonTrend(0, 0)).toBe('Без изменений');
    expect(comparisonTrend(100, 50)).toBe('↑ +100% к вчерашнему дню');
    expect(comparisonTrend(50, 100, 'week')).toBe('↓ 50% к предыдущему периоду');
    expect(comparisonTrend(100, 0)).toBe('Нет базы для сравнения');
    expect(comparisonTrend()).toBe('Сравнение недоступно');
  });
});
