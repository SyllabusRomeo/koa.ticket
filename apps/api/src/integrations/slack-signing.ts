import { createHmac, timingSafeEqual } from 'crypto';

export type SlackSignatureResult =
  | { ok: true }
  | { ok: false; reason: 'missing' | 'expired' | 'invalid' };

/**
 * Verify Slack Signing Secret (v0 HMAC-SHA256).
 * @see https://api.slack.com/authentication/verifying-requests-from-slack
 */
export function verifySlackRequestSignature(opts: {
  signingSecret: string;
  rawBody: Buffer | string;
  timestamp: string;
  signature: string;
  /** Max age of the request timestamp (seconds). Default 5 minutes. */
  maxAgeSec?: number;
  nowSec?: number;
}): SlackSignatureResult {
  const { signingSecret, rawBody, timestamp, signature } = opts;
  if (!rawBody || !timestamp || !signature) {
    return { ok: false, reason: 'missing' };
  }

  const ts = Number(timestamp);
  const now = opts.nowSec ?? Math.floor(Date.now() / 1000);
  const maxAge = opts.maxAgeSec ?? 60 * 5;
  if (!Number.isFinite(ts) || Math.abs(now - ts) > maxAge) {
    return { ok: false, reason: 'expired' };
  }

  const body =
    typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
  const base = `v0:${timestamp}:${body}`;
  const digest = `v0=${createHmac('sha256', signingSecret)
    .update(base, 'utf8')
    .digest('hex')}`;

  const a = Buffer.from(digest, 'utf8');
  const b = Buffer.from(signature.trim(), 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: 'invalid' };
  }
  return { ok: true };
}
