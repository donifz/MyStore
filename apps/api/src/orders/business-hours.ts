/**
 * A single daily window in the shop's local time, such as 10:00–19:00.
 * Returns null when the shop has not provided a machine-readable schedule.
 */
export function parseDailyHours(value: string) {
  const match = /^(\d{2}):(\d{2})\s*[-–—]\s*(\d{2}):(\d{2})$/.exec(
    value.trim(),
  );
  if (!match) return null;
  const [, sh, sm, eh, em] = match.map(Number);
  if (sh > 23 || eh > 23 || sm > 59 || em > 59) return null;
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  if (start === end) return null;
  return { start, end };
}

/**
 * Count only minutes during opening hours. Cross-midnight windows are allowed.
 * Time zone is explicit rather than inferred from the server's local clock.
 * Null is returned for an unknown/invalid schedule, never a guessed deadline.
 */
export function addBusinessMinutes(
  from: Date,
  hours: string,
  timeZone: string,
  minutes = 120,
): Date | null {
  const window = parseDailyHours(hours);
  if (!window || !Number.isSafeInteger(minutes) || minutes < 1) return null;
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    formatter.format(from);
  } catch {
    return null;
  }
  const inside = (minute: number) =>
    window.start < window.end
      ? minute >= window.start && minute < window.end
      : minute >= window.start || minute < window.end;
  let remaining = minutes;
  const timestamp = Math.ceil(from.getTime() / 60000) * 60000;
  // Guard against accidentally creating an unbounded reservation.
  for (let n = 0; n < 31 * 24 * 60; n++) {
    const candidate = new Date(timestamp + n * 60000);
    const parts = formatter.formatToParts(candidate);
    const hour = Number(parts.find((p) => p.type === 'hour')?.value);
    const minute = Number(parts.find((p) => p.type === 'minute')?.value);
    if (inside(hour * 60 + minute) && --remaining === 0)
      return new Date(candidate.getTime() + 60000);
  }
  return null;
}
