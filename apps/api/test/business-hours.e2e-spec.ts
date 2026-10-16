import {
  businessDeadline,
  validateBusinessSchedule,
  formatBusinessSchedule,
} from '../src/orders/business-hours';

const daily = () =>
  Array.from({ length: 7 }, () => [{ open: '10:00', close: '19:00' }]);
describe('business-hours deadlines', () => {
  const weekdays = () => [...daily().slice(0, 5), [], []];
  it.each([
    ['2026-10-16T12:00:00Z', '2026-10-19T05:00:00.000Z'],
    ['2026-10-17T12:00:00Z', '2026-10-19T06:00:00.000Z'],
    ['2026-10-19T03:00:00Z', '2026-10-19T06:00:00.000Z'],
    ['2026-10-19T04:00:00Z', '2026-10-19T06:00:00.000Z'],
    ['2026-10-19T13:00:00Z', '2026-10-20T06:00:00.000Z'],
  ])('counts open time from %s', (from, expected) => {
    expect(
      businessDeadline(
        new Date(from),
        weekdays(),
        'Asia/Bishkek',
      ).toISOString(),
    ).toBe(expected);
  });
  it('carries seconds across a closed period', () => {
    expect(
      businessDeadline(
        new Date('2026-10-17T12:00:30.250Z'),
        daily(),
        'Asia/Bishkek',
      ).toISOString(),
    ).toBe('2026-10-18T05:00:30.250Z');
  });
  it('excludes a lunch break', () => {
    const week = daily().map(() => [
      { open: '10:00', close: '12:00' },
      { open: '13:00', close: '19:00' },
    ]);
    expect(
      businessDeadline(
        new Date('2026-10-19T05:00:00Z'),
        week,
        'Asia/Bishkek',
      ).toISOString(),
    ).toBe('2026-10-19T08:00:00.000Z');
  });
  it('keeps Friday overnight hours on a closed Saturday', () => {
    const week = Array.from(
      { length: 7 },
      () => [] as { open: string; close: string }[],
    );
    week[4] = [{ open: '21:00', close: '02:00' }];
    expect(
      businessDeadline(
        new Date('2026-10-16T16:00:00Z'),
        week,
        'Asia/Bishkek',
      ).toISOString(),
    ).toBe('2026-10-16T18:00:00.000Z');
  });
  it.each([
    ['2026-03-29T00:00:00Z', '01:00', '05:00', '2026-03-29T02:00:00.000Z'],
    ['2026-10-25T00:00:00Z', '02:00', '04:00', '2026-10-25T02:00:00.000Z'],
  ])(
    'counts real open minutes over DST at %s',
    (from, open, close, expected) => {
      const week = daily().map(() => [{ open, close }]);
      expect(
        businessDeadline(new Date(from), week, 'Europe/Berlin').toISOString(),
      ).toBe(expected);
    },
  );
  it('accepts adjacent windows and describes overnight hours', () => {
    const week = daily();
    week[0] = [
      { open: '10:00', close: '12:00' },
      { open: '12:00', close: '19:00' },
    ];
    expect(validateBusinessSchedule(week, 'Asia/Bishkek')).toEqual(week);
    week[4] = [{ open: '21:00', close: '02:00' }];
    expect(formatBusinessSchedule(week)).toContain('следующего дня');
  });
  it.each(
    [
      [],
      Array(7).fill([]),
      Array(6).fill([]),
      Array(8).fill([]),
      [[{ open: '10:00', close: '11:00' }], ...Array(6).fill([])],
      [[{ open: '10:00', close: '10:00' }], ...daily().slice(1)],
      [[{ open: '25:00', close: '19:00' }], ...daily().slice(1)],
      [[{ open: '9:00', close: '19:00' }], ...daily().slice(1)],
      [
        [
          { open: '10:00', close: '12:00' },
          { open: '11:00', close: '19:00' },
        ],
        ...daily().slice(1),
      ],
      [
        [{ open: '00:00', close: '03:00' }],
        ...daily().slice(1, 6),
        [{ open: '21:00', close: '02:00' }],
      ],
      [
        [
          { open: '10:00', close: '11:00' },
          { open: '12:00', close: '13:00' },
          { open: '14:00', close: '15:00' },
        ],
        ...daily().slice(1),
      ],
      [null, ...daily().slice(1)],
    ].map((value) => [value]),
  )('rejects an invalid weekly schedule %#', (value) => {
    expect(() => validateBusinessSchedule(value, 'Asia/Bishkek')).toThrow();
  });
  it('rejects invalid timezone, instant and duration', () => {
    expect(() => validateBusinessSchedule(daily(), 'bad-zone')).toThrow();
    expect(() => validateBusinessSchedule(daily(), '+06:00')).toThrow();
    expect(() =>
      businessDeadline(new Date(NaN), daily(), 'Asia/Bishkek'),
    ).toThrow();
    for (const minutes of [0, -1, 1.5, NaN, Infinity])
      expect(() =>
        businessDeadline(new Date(), daily(), 'Asia/Bishkek', minutes),
      ).toThrow();
  });
});
