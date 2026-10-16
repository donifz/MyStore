import { addBusinessMinutes, parseDailyHours } from '../src/orders/business-hours';

describe('shop business-hours reservation', () => {
  it('parses a daily schedule without assuming an opening window', () => {
    expect(parseDailyHours('10:00–19:00')).toEqual({ start: 600, end: 1140 });
    expect(parseDailyHours('по звонку')).toBeNull();
    expect(parseDailyHours('25:00–19:00')).toBeNull();
  });

  it('pauses the two-hour clock while the store is closed', () => {
    const start = new Date('2026-10-17T12:00:00.000Z'); // 18:00 Bishkek
    expect(
      addBusinessMinutes(start, '10:00–19:00', 'Asia/Bishkek')?.toISOString(),
    ).toBe('2026-10-18T05:00:00.000Z'); // 11:00 next day
  });

  it('handles an overnight opening window', () => {
    const start = new Date('2026-10-17T16:00:00.000Z'); // 22:00 Bishkek
    expect(
      addBusinessMinutes(start, '21:00–02:00', 'Asia/Bishkek')?.toISOString(),
    ).toBe('2026-10-17T18:00:00.000Z'); // midnight
  });

  it('does not invent a deadline when schedule or timezone is missing', () => {
    const start = new Date('2026-10-17T12:00:00.000Z');
    expect(addBusinessMinutes(start, '', 'Asia/Bishkek')).toBeNull();
    expect(addBusinessMinutes(start, '10:00–19:00', 'bad-zone')).toBeNull();
  });
});
