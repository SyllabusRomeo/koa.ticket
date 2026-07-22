/** Digest frequency values stored on User.digestFrequency. */
export const DIGEST_FREQUENCIES = ['none', 'daily', 'weekly'] as const;
export type DigestFrequency = (typeof DIGEST_FREQUENCIES)[number];

export function isDigestFrequency(v: string): v is DigestFrequency {
  return (DIGEST_FREQUENCIES as readonly string[]).includes(v);
}

export type ZonedParts = {
  /** YYYY-MM-DD in the zone */
  ymd: string;
  hour: number;
  /** ISO weekday 1=Mon … 7=Sun */
  isoWeekday: number;
};

/** Local calendar parts for a Date in an IANA timezone (no extra deps). */
export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';

  const ymd = `${get('year')}-${get('month')}-${get('day')}`;
  const hour = Number(get('hour'));
  const wd = get('weekday').toLowerCase();
  const isoWeekday =
    wd === 'mon'
      ? 1
      : wd === 'tue'
        ? 2
        : wd === 'wed'
          ? 3
          : wd === 'thu'
            ? 4
            : wd === 'fri'
              ? 5
              : wd === 'sat'
                ? 6
                : 7;

  return {
    ymd,
    hour: Number.isFinite(hour) ? hour : 0,
    isoWeekday,
  };
}

/**
 * Quiet hours in local clock. Supports overnight windows (e.g. 22→7).
 * When start === end, treated as disabled.
 */
export function inQuietHours(
  hour: number,
  start: number | null | undefined,
  end: number | null | undefined,
): boolean {
  if (start == null || end == null) return false;
  if (start === end) return false;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

export function isDigestDue(opts: {
  frequency: DigestFrequency;
  lastDigestAt: Date | null;
  now: Date;
  timeZone: string;
  quietStartHour?: number | null;
  quietEndHour?: number | null;
  /** Local hour (0–23) after which digests may send. Default 8. */
  sendHour?: number;
  /** ISO weekday 1–7 for weekly digests. Default 1 (Monday). */
  weeklyWeekday?: number;
}): boolean {
  if (opts.frequency === 'none') return false;

  const local = zonedParts(opts.now, opts.timeZone);
  if (inQuietHours(local.hour, opts.quietStartHour, opts.quietEndHour)) {
    return false;
  }

  const sendHour =
    opts.sendHour != null && Number.isFinite(opts.sendHour)
      ? Math.min(23, Math.max(0, Math.trunc(opts.sendHour)))
      : 8;
  if (local.hour < sendHour) return false;

  if (opts.frequency === 'daily') {
    if (!opts.lastDigestAt) return true;
    const last = zonedParts(opts.lastDigestAt, opts.timeZone);
    return local.ymd > last.ymd;
  }

  // weekly
  const weekday =
    opts.weeklyWeekday != null && Number.isFinite(opts.weeklyWeekday)
      ? Math.min(7, Math.max(1, Math.trunc(opts.weeklyWeekday)))
      : 1;
  if (local.isoWeekday !== weekday) return false;
  if (!opts.lastDigestAt) return true;
  const elapsedMs = opts.now.getTime() - opts.lastDigestAt.getTime();
  return elapsedMs >= 6 * 24 * 60 * 60 * 1000;
}
