import type { BusinessInterval, Store } from './public-api';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function parseMinute(value: unknown): number | null {
  if (typeof value !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value))
    return null;
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

export type StoreOpenStatus = {
  isOpen: boolean;
  label: string;
};

/**
 * Computes whether a store is open right now from its structured 7-day schedule
 * and IANA time zone. Returns null if no structured schedule is available.
 */
export function getStoreOpenStatus(
  store: Pick<Store, 'businessSchedule' | 'timeZone'>,
  now = new Date(),
): StoreOpenStatus | null {
  const schedule = store.businessSchedule;
  if (!Array.isArray(schedule) || schedule.length !== 7) return null;

  const tz = store.timeZone || 'Asia/Bishkek';
  let dayIdx = -1;
  let currentMinute = 0;
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value ?? '';
    dayIdx = WEEKDAYS.indexOf(part('weekday'));
    currentMinute = Number(part('hour')) * 60 + Number(part('minute'));
  } catch {
    return null;
  }

  if (dayIdx < 0 || !Number.isFinite(currentMinute)) return null;

  const prevDayIdx = (dayIdx + 6) % 7;
  const prevDay = schedule[prevDayIdx];
  if (Array.isArray(prevDay)) {
    for (const slot of prevDay as BusinessInterval[]) {
      const open = parseMinute(slot?.open);
      const close = parseMinute(slot?.close);
      if (
        open !== null &&
        close !== null &&
        close < open &&
        currentMinute < close
      ) {
        return { isOpen: true, label: `Открыто до ${slot.close}` };
      }
    }
  }

  const today = schedule[dayIdx];
  if (Array.isArray(today)) {
    for (const slot of today as BusinessInterval[]) {
      const open = parseMinute(slot?.open);
      const close = parseMinute(slot?.close);
      if (open === null || close === null) continue;
      if (close >= open) {
        if (currentMinute >= open && currentMinute < close) {
          return { isOpen: true, label: `Открыто до ${slot.close}` };
        }
      } else if (currentMinute >= open) {
        return { isOpen: true, label: `Открыто до ${slot.close}` };
      }
    }
  }

  return { isOpen: false, label: 'Сейчас закрыто' };
}
