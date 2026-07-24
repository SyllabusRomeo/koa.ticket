/**
 * Business-hours aware duration helpers for SLA due dates.
 * Uses BusinessHours + Holiday rows (timezone from first active hours row).
 */

export type BusinessHoursRow = {
  dayOfWeek: number; // 0=Sun .. 6=Sat (JS getDay)
  startTime: string; // "HH:MM"
  endTime: string;
  timezone: string;
  isActive: boolean;
};

export type HolidayRow = {
  date: Date;
  timezone: string;
};

function parseHm(hm: string): { h: number; m: number } {
  const [h, m] = hm.split(':').map((x) => Number(x));
  return { h: Number.isFinite(h) ? h : 0, m: Number.isFinite(m) ? m : 0 };
}

/** Minutes from local midnight to HH:MM */
function minutesOfDay(hm: string): number {
  const { h, m } = parseHm(hm);
  return h * 60 + m;
}

function ymdInTz(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function weekdayInTz(d: Date, timeZone: string): number {
  const wd = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  }).format(d);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[wd] ?? d.getUTCDay();
}

function partsInTz(d: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const get = (t: string) =>
    Number(parts.find((p) => p.type === t)?.value ?? '0');
  return {
    y: get('year'),
    mo: get('month'),
    d: get('day'),
    h: get('hour'),
    mi: get('minute'),
  };
}

/** Approximate instant for a local wall time in a timezone (DST-safe enough for SLA). */
function zonedLocalToUtc(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
  timeZone: string,
): Date {
  const utcGuess = Date.UTC(y, mo - 1, d, h, mi, 0);
  const asLocal = partsInTz(new Date(utcGuess), timeZone);
  const desired = Date.UTC(y, mo - 1, d, h, mi);
  const actual = Date.UTC(asLocal.y, asLocal.mo - 1, asLocal.d, asLocal.h, asLocal.mi);
  return new Date(utcGuess + (desired - actual));
}

function isHoliday(
  d: Date,
  timeZone: string,
  holidays: HolidayRow[],
): boolean {
  const key = ymdInTz(d, timeZone);
  return holidays.some((h) => ymdInTz(h.date, h.timezone || timeZone) === key);
}

/**
 * Add `minutes` of business time starting at `from`.
 * Falls back to wall-clock if no active business hours are configured.
 */
export function addBusinessMinutes(
  from: Date,
  minutes: number,
  hours: BusinessHoursRow[],
  holidays: HolidayRow[],
): Date {
  const active = hours.filter((h) => h.isActive);
  if (!active.length || minutes <= 0) {
    return new Date(from.getTime() + Math.max(0, minutes) * 60_000);
  }
  const timeZone = active[0].timezone || 'UTC';
  const byDow = new Map<number, BusinessHoursRow[]>();
  for (const row of active) {
    const list = byDow.get(row.dayOfWeek) ?? [];
    list.push(row);
    byDow.set(row.dayOfWeek, list);
  }

  let remaining = minutes;
  let cursor = new Date(from.getTime());
  // Safety: max ~2 years of calendar days
  for (let guard = 0; guard < 800 && remaining > 0; guard++) {
    if (isHoliday(cursor, timeZone, holidays)) {
      const p = partsInTz(cursor, timeZone);
      cursor = zonedLocalToUtc(p.y, p.mo, p.d + 1, 0, 0, timeZone);
      continue;
    }
    const dow = weekdayInTz(cursor, timeZone);
    const windows = byDow.get(dow) ?? [];
    if (!windows.length) {
      const p = partsInTz(cursor, timeZone);
      cursor = zonedLocalToUtc(p.y, p.mo, p.d + 1, 0, 0, timeZone);
      continue;
    }

    const p = partsInTz(cursor, timeZone);
    const nowMin = p.h * 60 + p.mi;

    for (const win of windows.sort(
      (a, b) => minutesOfDay(a.startTime) - minutesOfDay(b.startTime),
    )) {
      const start = minutesOfDay(win.startTime);
      const end = minutesOfDay(win.endTime);
      if (end <= start) continue;
      const open = Math.max(nowMin, start);
      if (open >= end) continue;
      const available = end - open;
      if (remaining <= available) {
        const { h, m } = {
          h: Math.floor((open + remaining) / 60),
          m: (open + remaining) % 60,
        };
        return zonedLocalToUtc(p.y, p.mo, p.d, h, m, timeZone);
      }
      remaining -= available;
    }

    cursor = zonedLocalToUtc(p.y, p.mo, p.d + 1, 0, 0, timeZone);
  }

  return new Date(from.getTime() + minutes * 60_000);
}
