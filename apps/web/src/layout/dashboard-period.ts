export type DashboardPeriod = 'today' | 'week' | 'month' | 'custom';

// Financial reporting follows the shop's operating day in Kyrgyzstan.
const SHOP_UTC_OFFSET = '+06:00';
const DAY_MS = 86_400_000;

export function shopDate(now = new Date(), daysAgo = 0): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bishkek',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(now.getTime() - daysAgo * DAY_MS));
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function reportStart(date: string): string {
  return `${date}T00:00:00${SHOP_UTC_OFFSET}`;
}

export function dashboardPeriodRange(
  period: DashboardPeriod,
  customFrom?: string,
  customTo?: string,
  now = new Date(),
) {
  const today = shopDate(now);
  const from =
    period === 'today'
      ? today
      : period === 'week'
        ? shopDate(now, 6)
        : period === 'month'
          ? shopDate(now, 29)
          : customFrom || today;
  const through = period === 'custom' ? customTo || today : today;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(through) ||
    from > through
  ) {
    throw new Error('Выберите правильный диапазон дат.');
  }
  const days =
    Math.round(
      (Date.parse(`${through}T00:00:00Z`) -
        Date.parse(`${from}T00:00:00Z`)) /
        DAY_MS,
    ) + 1;
  return {
    from: reportStart(from),
    to: reportStart(shiftDate(through, 1)),
    previousFrom: reportStart(shiftDate(from, -days)),
    previousTo: reportStart(from),
  };
}

export function comparisonTrend(
  current?: number,
  previous?: number,
  period: DashboardPeriod = 'today',
): string {
  if (current === undefined || previous === undefined)
    return 'Сравнение недоступно';
  if (current === previous) return 'Без изменений';
  if (previous === 0) return 'Нет базы для сравнения';
  const percentage = Math.round(((current - previous) / Math.abs(previous)) * 100);
  const periodLabel =
    period === 'today' ? 'к вчерашнему дню' : 'к предыдущему периоду';
  return `${percentage > 0 ? '↑ +' : '↓ '}${Math.abs(percentage)}% ${periodLabel}`;
}
