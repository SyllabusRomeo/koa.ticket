import {
  cleanEmailSubjectTitle,
  extractTicketNumberFromSubject,
} from './email-subject.parser';

describe('extractTicketNumberFromSubject', () => {
  it('prefers bracketed token', () => {
    expect(
      extractTicketNumberFromSubject('Re: [INC-2026-000123] VPN down'),
    ).toBe('INC-2026-000123');
  });

  it('accepts bare ticket numbers', () => {
    expect(extractTicketNumberFromSubject('Update on SR-2026-000042 please')).toBe(
      'SR-2026-000042',
    );
  });

  it('returns null when absent', () => {
    expect(extractTicketNumberFromSubject('Help with printer')).toBeNull();
    expect(extractTicketNumberFromSubject('')).toBeNull();
    expect(extractTicketNumberFromSubject(null)).toBeNull();
  });

  it('normalizes case', () => {
    expect(extractTicketNumberFromSubject('[inc-2026-000001]')).toBe(
      'INC-2026-000001',
    );
  });
});

describe('cleanEmailSubjectTitle', () => {
  it('strips Re:/Fwd: prefixes', () => {
    expect(cleanEmailSubjectTitle('Re: Re: Printer offline')).toBe(
      'Printer offline',
    );
    expect(cleanEmailSubjectTitle('Fwd: VPN')).toBe('VPN');
  });

  it('falls back when empty', () => {
    expect(cleanEmailSubjectTitle('   ')).toBe('Email ticket');
  });
});
