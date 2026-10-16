export type BusinessInterval = { open: string; close: string };
export type BusinessSchedule = BusinessInterval[][];
const dayMinutes = 1440;
const weekMinutes = 7 * dayMinutes;
const names = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function minute(value: unknown): number {
  if (typeof value !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value))
    throw new Error('Укажите время в формате ЧЧ:ММ.');
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

export function validateTimeZone(value: unknown): asserts value is string {
  if (
    typeof value !== 'string' ||
    !value ||
    value.length > 80 ||
    /^[+-]\d{2}:?\d{2}$/.test(value.trim())
  )
    throw new Error('Укажите часовой пояс IANA, например Asia/Bishkek.');
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: value }).format(new Date(0));
  } catch {
    throw new Error(
      'Неизвестный часовой пояс. Используйте Asia/Bishkek или другой IANA-пояс.',
    );
  }
}

function windows(schedule: BusinessSchedule) {
  return schedule
    .flatMap((day, index) =>
      day.flatMap(({ open, close }) => {
        const start = index * dayMinutes + minute(open);
        const end =
          index * dayMinutes + minute(close) + (close < open ? dayMinutes : 0);
        return end > weekMinutes
          ? [
              { start, end: weekMinutes },
              { start: 0, end: end - weekMinutes },
            ]
          : [{ start, end }];
      }),
    )
    .sort((a, b) => a.start - b.start);
}

export function validateBusinessSchedule(
  value: unknown,
  timeZone: string,
): BusinessSchedule {
  validateTimeZone(timeZone);
  if (!Array.isArray(value) || value.length !== 7)
    throw new Error(
      'Расписание должно содержать семь дней, начиная с понедельника.',
    );
  const schedule = value.map((day, i) => {
    if (!Array.isArray(day) || day.length > 2)
      throw new Error(`${names[i]}: допускается не более двух интервалов.`);
    return day
      .map((interval: unknown) => {
        if (
          !interval ||
          typeof interval !== 'object' ||
          !('open' in interval) ||
          !('close' in interval)
        )
          throw new Error(`${names[i]}: укажите начало и конец работы.`);
        const { open, close } = interval;
        if (minute(open) === minute(close))
          throw new Error(`${names[i]}: начало и конец не должны совпадать.`);
        return { open: open as string, close: close as string };
      })
      .sort((a, b) => a.open.localeCompare(b.open));
  });
  const intervals = windows(schedule);
  if (intervals.some((v, i) => i > 0 && v.start < intervals[i - 1].end))
    throw new Error(
      'Рабочие интервалы пересекаются, в том числе через полночь.',
    );
  if (intervals.reduce((sum, v) => sum + v.end - v.start, 0) < 120)
    throw new Error('Укажите не менее двух рабочих часов в неделю.');
  return schedule;
}

export function businessDeadline(
  from: Date,
  schedule: BusinessSchedule,
  timeZone: string,
  minutes = 120,
): Date {
  const valid = validateBusinessSchedule(schedule, timeZone);
  if (
    !Number.isFinite(from.getTime()) ||
    !Number.isSafeInteger(minutes) ||
    minutes < 1 ||
    minutes > 14 * dayMinutes
  )
    throw new Error('Неверное время или длительность резерва.');
  const intervals = windows(valid);
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  let at = from.getTime();
  const limit = at + 14 * dayMinutes * 60_000;
  let remaining = minutes * 60_000;
  while (at < limit) {
    const parts = formatter.formatToParts(new Date(at));
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)!.value;
    const local =
      weekdays.indexOf(part('weekday')) * dayMinutes +
      Number(part('hour')) * 60 +
      Number(part('minute'));
    const end = Math.min((Math.floor(at / 60_000) + 1) * 60_000, limit);
    if (intervals.some((v) => local >= v.start && local < v.end)) {
      const available = end - at;
      if (remaining <= available) return new Date(at + remaining);
      remaining -= available;
    }
    at = end;
  }
  throw new Error('Не удалось рассчитать резерв в пределах двух недель.');
}

export function formatBusinessSchedule(schedule: BusinessSchedule): string {
  return schedule
    .map(
      (day, index) =>
        `${names[index]}: ${day.length ? day.map((v) => `${v.open}–${v.close}${v.close < v.open ? ' следующего дня' : ''}`).join(', ') : 'выходной'}`,
    )
    .join('; ');
}
