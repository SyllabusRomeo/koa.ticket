/** Format remaining/overdue ms as HH:MM or Xd Xh (negative when overdue). */
export function formatSlaDuration(ms: number): string {
  const sign = ms < 0 ? '-' : '';
  const abs = Math.abs(ms);
  const totalMinutes = Math.floor(abs / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${sign}${days}d ${hours}h`;
  }
  if (hours >= 1 || totalMinutes >= 60) {
    return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }
  return `${sign}00:${String(minutes).padStart(2, '0')}`;
}

export type SlaTimerFields = {
  dueAt?: string | Date | null;
  slaDueAt?: string | Date | null;
  slaRemainingMs?: number | null;
  slaBreached?: boolean;
  slaPaused?: boolean;
  slaCompleted?: boolean;
  timeToResolution?: string | null;
};

/** Live remaining ms from API snapshot + client clock (or frozen when paused). */
export function liveSlaRemainingMs(
  fields: SlaTimerFields,
  nowMs = Date.now(),
): number | null {
  if (fields.slaCompleted) return null;
  if (fields.slaRemainingMs == null && !fields.slaDueAt && !fields.dueAt) {
    return null;
  }
  if (fields.slaPaused && fields.slaRemainingMs != null) {
    return fields.slaRemainingMs;
  }
  const due = fields.slaDueAt ?? fields.dueAt;
  if (!due) return fields.slaRemainingMs ?? null;
  return new Date(due).getTime() - nowMs;
}
