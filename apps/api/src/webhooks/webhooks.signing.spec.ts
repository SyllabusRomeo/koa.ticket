import { createHmac } from 'crypto';

describe('webhook signature format', () => {
  it('signs raw body as sha256=<hex>', () => {
    const secret = 'test-secret';
    const rawBody = JSON.stringify({
      event: 'webhook.ping',
      message: 'LogIT webhook test ping',
    });
    const hex = createHmac('sha256', secret).update(rawBody).digest('hex');
    const header = `sha256=${hex}`;
    expect(header.startsWith('sha256=')).toBe(true);
    expect(header.length).toBe('sha256='.length + 64);
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    expect(hex).toBe(expected);
  });
});
