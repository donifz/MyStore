/**
 * Calculates a two-working-hour confirmation window without counting time
 * while the store is closed. Kept independent from checkout until store
 * opening hours and IANA timezone are validated in the shop settings API.
 */
export function businessDeadline(
  start: Date,
  schedule: { open: string; close: string; timeZone: string },
  minutes = 120,
): Date {
  const parse = (time: string) => {
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time))
      throw new Error('Invalid store hours');
    const [hour, minute] = time.split(':').map(Number);
    return hour * 60 + minute;
  };
  const open = parse(schedule.open);
  const close = parse(schedule.close);
  if (open === close || !Number.isSafeInteger(minutes) || minutes < 1)
    throw new Error('Invalid business schedule');
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: schedule.timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  let remaining = minutes;
  const date = new Date(start.getTime());
  // Count complete minutes forward; at most two weeks for ordinary daily hours.
  for (let i = 0; i < 14 * 24 * 60; i++) {
    const next = new Date(date.getTime() + 60_000);
    const parts = formatter.formatToParts(date);
    const hour = Number(parts.find((p) => p.type === 'hour')?.value);
    const minute = Number(parts.find((p) => p.type === 'minute')?.value);
    const current = hour * 60 + minute;
    const working =
      open < close
        ? current >= open && current < close
        : current >= open || current < close;
    if (working && --remaining === 0) return next;
    date.setTime(next.getTime());
  }
  throw new Error('Business deadline outside supported period');
}
