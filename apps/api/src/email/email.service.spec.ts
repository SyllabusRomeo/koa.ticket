import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

describe('EmailService', () => {
  function make(env: Record<string, string | undefined> = {}) {
    const config = {
      get: (key: string) => env[key],
    } as unknown as ConfigService;
    return new EmailService(config);
  }

  it('reports not configured when SMTP_HOST missing', () => {
    const email = make({ EMAIL_FROM: 'noreply@logit.local' });
    expect(email.isConfigured()).toBe(false);
    expect(email.status().configured).toBe(false);
  });

  it('reports configured when host + from set', () => {
    const email = make({
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      EMAIL_FROM: 'noreply@logit.local',
      SMTP_USER: 'u',
      SMTP_PASS: 'p',
      APP_PUBLIC_URL: 'https://app.example',
      API_PUBLIC_URL: 'https://api.example/api/v1',
    });
    expect(email.isConfigured()).toBe(true);
    const status = email.status();
    expect(status.outbound.configured).toBe(true);
    expect(status.outbound.from).toBe('noreply@logit.local');
    expect(status.inbound.webhookUrl).toContain('/integrations/email/inbound');
    expect(status.imap.implemented).toBe(false);
  });

  it('skips send gracefully when SMTP not configured', async () => {
    const email = make({});
    const result = await email.send({
      to: 'a@b.com',
      subject: 'Test',
      text: 'Hello',
    });
    expect(result).toEqual({
      ok: true,
      skipped: true,
      reason: 'smtp_not_configured',
    });
  });

  it('accepts SMTP_PASSWORD and SMTP_FROM aliases', () => {
    const email = make({
      SMTP_HOST: 'localhost',
      SMTP_PASSWORD: 'secret',
      SMTP_FROM: 'old@logit.local',
    });
    expect(email.isConfigured()).toBe(true);
    expect(email.smtpPass()).toBe('secret');
    expect(email.fromAddress()).toBe('old@logit.local');
  });

  it('imap stub returns not implemented', () => {
    const email = make({});
    expect(email.pollImapOnce().ok).toBe(false);
  });
});
