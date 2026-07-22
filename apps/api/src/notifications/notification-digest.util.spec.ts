import {
  DIGEST_FREQUENCIES,
  inQuietHours,
  isDigestDue,
  isDigestFrequency,
  zonedParts,
} from './notification-digest.util';

describe('notification-digest.util', () => {
  describe('isDigestFrequency', () => {
    it('accepts catalog values', () => {
      for (const f of DIGEST_FREQUENCIES) {
        expect(isDigestFrequency(f)).toBe(true);
      }
      expect(isDigestFrequency('monthly')).toBe(false);
    });
  });

  describe('inQuietHours', () => {
    it('handles same-day window', () => {
      expect(inQuietHours(10, 9, 17)).toBe(true);
      expect(inQuietHours(8, 9, 17)).toBe(false);
      expect(inQuietHours(17, 9, 17)).toBe(false);
    });

    it('handles overnight window', () => {
      expect(inQuietHours(23, 22, 7)).toBe(true);
      expect(inQuietHours(3, 22, 7)).toBe(true);
      expect(inQuietHours(12, 22, 7)).toBe(false);
    });

    it('treats equal start/end as disabled', () => {
      expect(inQuietHours(5, 5, 5)).toBe(false);
      expect(inQuietHours(5, null, 7)).toBe(false);
    });
  });

  describe('zonedParts', () => {
    it('returns stable Accra parts', () => {
      // Accra is UTC+0 year-round
      const d = new Date('2026-07-20T10:30:00.000Z');
      const p = zonedParts(d, 'Africa/Accra');
      expect(p.ymd).toBe('2026-07-20');
      expect(p.hour).toBe(10);
      expect(p.isoWeekday).toBe(1); // Monday
    });
  });

  describe('isDigestDue', () => {
    const mondayMorning = new Date('2026-07-20T09:00:00.000Z'); // Mon 09:00 Accra

    it('returns false for none', () => {
      expect(
        isDigestDue({
          frequency: 'none',
          lastDigestAt: null,
          now: mondayMorning,
          timeZone: 'Africa/Accra',
        }),
      ).toBe(false);
    });

    it('daily is due when never sent and past send hour', () => {
      expect(
        isDigestDue({
          frequency: 'daily',
          lastDigestAt: null,
          now: mondayMorning,
          timeZone: 'Africa/Accra',
          sendHour: 8,
        }),
      ).toBe(true);
    });

    it('daily waits for send hour', () => {
      const early = new Date('2026-07-20T06:00:00.000Z');
      expect(
        isDigestDue({
          frequency: 'daily',
          lastDigestAt: null,
          now: early,
          timeZone: 'Africa/Accra',
          sendHour: 8,
        }),
      ).toBe(false);
    });

    it('daily not due same calendar day', () => {
      expect(
        isDigestDue({
          frequency: 'daily',
          lastDigestAt: new Date('2026-07-20T08:05:00.000Z'),
          now: mondayMorning,
          timeZone: 'Africa/Accra',
          sendHour: 8,
        }),
      ).toBe(false);
    });

    it('daily due next calendar day', () => {
      expect(
        isDigestDue({
          frequency: 'daily',
          lastDigestAt: new Date('2026-07-19T09:00:00.000Z'),
          now: mondayMorning,
          timeZone: 'Africa/Accra',
          sendHour: 8,
        }),
      ).toBe(true);
    });

    it('respects quiet hours', () => {
      expect(
        isDigestDue({
          frequency: 'daily',
          lastDigestAt: null,
          now: mondayMorning,
          timeZone: 'Africa/Accra',
          sendHour: 8,
          quietStartHour: 8,
          quietEndHour: 12,
        }),
      ).toBe(false);
    });

    it('weekly requires matching weekday', () => {
      const tuesday = new Date('2026-07-21T09:00:00.000Z');
      expect(
        isDigestDue({
          frequency: 'weekly',
          lastDigestAt: null,
          now: tuesday,
          timeZone: 'Africa/Accra',
          sendHour: 8,
          weeklyWeekday: 1,
        }),
      ).toBe(false);
      expect(
        isDigestDue({
          frequency: 'weekly',
          lastDigestAt: null,
          now: mondayMorning,
          timeZone: 'Africa/Accra',
          sendHour: 8,
          weeklyWeekday: 1,
        }),
      ).toBe(true);
    });
  });
});
