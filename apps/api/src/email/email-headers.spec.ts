import {
  formatMessageIdHeader,
  normalizeMessageId,
  parseReferencesHeader,
} from './email-headers';

describe('email-headers', () => {
  it('normalizes Message-IDs', () => {
    expect(normalizeMessageId('<ABC@x.com>')).toBe('abc@x.com');
    expect(normalizeMessageId('  XYZ@Y.COM  ')).toBe('xyz@y.com');
    expect(normalizeMessageId('')).toBeNull();
  });

  it('parses References headers', () => {
    expect(
      parseReferencesHeader('<a@x.com> <b@x.com>'),
    ).toEqual(['a@x.com', 'b@x.com']);
  });

  it('formats Message-ID headers', () => {
    expect(formatMessageIdHeader('a@x.com')).toBe('<a@x.com>');
    expect(formatMessageIdHeader('<a@x.com>')).toBe('<a@x.com>');
  });
});
