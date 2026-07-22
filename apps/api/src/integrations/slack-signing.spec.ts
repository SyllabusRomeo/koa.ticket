import { createHmac } from 'crypto';
import { verifySlackRequestSignature } from './slack-signing';

describe('verifySlackRequestSignature', () => {
  const secret = 'test_signing_secret';
  const timestamp = '1700000000';
  const body = '{"type":"event_callback"}';

  function sign(ts: string, raw: string) {
    const base = `v0:${ts}:${raw}`;
    return `v0=${createHmac('sha256', secret).update(base, 'utf8').digest('hex')}`;
  }

  it('accepts a valid signature', () => {
    const signature = sign(timestamp, body);
    const result = verifySlackRequestSignature({
      signingSecret: secret,
      rawBody: body,
      timestamp,
      signature,
      nowSec: 1700000000,
    });
    expect(result).toEqual({ ok: true });
  });

  it('rejects an invalid signature', () => {
    const result = verifySlackRequestSignature({
      signingSecret: secret,
      rawBody: body,
      timestamp,
      signature: 'v0=deadbeef',
      nowSec: 1700000000,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid');
  });

  it('rejects expired timestamps', () => {
    const signature = sign(timestamp, body);
    const result = verifySlackRequestSignature({
      signingSecret: secret,
      rawBody: body,
      timestamp,
      signature,
      nowSec: 1700000000 + 60 * 10,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('expired');
  });

  it('rejects missing headers', () => {
    const result = verifySlackRequestSignature({
      signingSecret: secret,
      rawBody: body,
      timestamp: '',
      signature: '',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('missing');
  });
});
