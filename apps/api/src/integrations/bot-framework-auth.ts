import { timingSafeEqual } from 'crypto';
import * as jose from 'jose';

/** Bot Connector → bot OpenID metadata (static). */
export const BOT_FRAMEWORK_OPENID_CONFIG =
  'https://login.botframework.com/v1/.well-known/openidconfiguration';
export const BOT_FRAMEWORK_JWKS_URI =
  'https://login.botframework.com/v1/.well-known/keys';
export const BOT_FRAMEWORK_ISSUER = 'https://api.botframework.com';

/** Emulator → bot (MSA) OpenID / JWKS. */
export const EMULATOR_OPENID_CONFIG =
  'https://login.microsoftonline.com/botframework.com/v2.0/.well-known/openid-configuration';
export const EMULATOR_JWKS_URI =
  'https://login.microsoftonline.com/common/discovery/v2.0/keys';

/** Known Emulator issuers (v3.1 / v3.2, 1.0 / 2.0 tokens). */
export const EMULATOR_ISSUERS = [
  'https://sts.windows.net/d6d49420-f39b-4df7-a1dc-d59a935871db/',
  'https://login.microsoftonline.com/d6d49420-f39b-4df7-a1dc-d59a935871db/v2.0',
  'https://sts.windows.net/f8cdef31-a31e-4b4a-93e4-5f571e91255a/',
  'https://login.microsoftonline.com/f8cdef31-a31e-4b4a-93e4-5f571e91255a/v2.0',
] as const;

export type BotFrameworkAuthResult =
  | { ok: true; mode: 'jwt' | 'jwt-emulator'; serviceUrl?: string }
  | { ok: false; reason: string };

let connectorJwks: ReturnType<typeof jose.createRemoteJWKSet> | null = null;
let emulatorJwks: ReturnType<typeof jose.createRemoteJWKSet> | null = null;

function getConnectorJwks() {
  if (!connectorJwks) {
    connectorJwks = jose.createRemoteJWKSet(new URL(BOT_FRAMEWORK_JWKS_URI));
  }
  return connectorJwks;
}

function getEmulatorJwks() {
  if (!emulatorJwks) {
    emulatorJwks = jose.createRemoteJWKSet(new URL(EMULATOR_JWKS_URI));
  }
  return emulatorJwks;
}

/** Extract Bearer token; returns null if missing/malformed. */
export function extractBearerToken(
  authorization: string | undefined,
): string | null {
  if (!authorization?.trim()) return null;
  const raw = authorization.trim();
  if (/^Bearer\s+/i.test(raw)) {
    const token = raw.replace(/^Bearer\s+/i, '').trim();
    return token || null;
  }
  // Non-Bearer shared secrets are handled separately.
  return null;
}

function normalizeServiceUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/**
 * Verify Bot Connector → bot JWT (RS256 via Bot Framework JWKS).
 * Optionally accepts Emulator JWTs when `allowEmulator` is true.
 *
 * @see https://learn.microsoft.com/en-us/azure/bot-service/rest-api/bot-framework-rest-connector-authentication
 */
export async function verifyBotFrameworkJwt(opts: {
  token: string;
  appId: string;
  /** Activity.serviceUrl from the request body (required when claim present). */
  activityServiceUrl?: string | null;
  allowEmulator?: boolean;
  clockToleranceSec?: number;
  /** Test hook: override connector JWKS. */
  connectorJwks?: ReturnType<typeof jose.createRemoteJWKSet> | jose.JWTVerifyGetKey;
  /** Test hook: override emulator JWKS. */
  emulatorJwks?: ReturnType<typeof jose.createRemoteJWKSet> | jose.JWTVerifyGetKey;
}): Promise<BotFrameworkAuthResult> {
  const appId = opts.appId.trim();
  if (!appId) {
    return { ok: false, reason: 'missing_app_id' };
  }

  const clockTolerance = opts.clockToleranceSec ?? 5 * 60;
  const connectorKey = opts.connectorJwks ?? getConnectorJwks();

  try {
    const { payload } = await jose.jwtVerify(opts.token, connectorKey, {
      issuer: BOT_FRAMEWORK_ISSUER,
      audience: appId,
      clockTolerance,
      algorithms: ['RS256'],
    });

    const claimServiceUrl =
      typeof payload.serviceUrl === 'string' ? payload.serviceUrl : undefined;
    if (claimServiceUrl && opts.activityServiceUrl) {
      if (
        normalizeServiceUrl(claimServiceUrl) !==
        normalizeServiceUrl(opts.activityServiceUrl)
      ) {
        return { ok: false, reason: 'service_url_mismatch' };
      }
    }

    return {
      ok: true,
      mode: 'jwt',
      serviceUrl: claimServiceUrl,
    };
  } catch {
    // Fall through to emulator path when enabled.
  }

  if (!opts.allowEmulator) {
    return { ok: false, reason: 'invalid_jwt' };
  }

  const emulatorKey = opts.emulatorJwks ?? getEmulatorJwks();

  try {
    const { payload } = await jose.jwtVerify(opts.token, emulatorKey, {
      issuer: [...EMULATOR_ISSUERS],
      audience: appId,
      clockTolerance,
      algorithms: ['RS256'],
    });

    // Emulator may put app id in `appid` (v1) or `azp` (v2).
    const appid =
      (typeof payload.appid === 'string' && payload.appid) ||
      (typeof payload.azp === 'string' && payload.azp) ||
      null;
    if (appid && appid !== appId) {
      return { ok: false, reason: 'emulator_appid_mismatch' };
    }

    return { ok: true, mode: 'jwt-emulator' };
  } catch {
    return { ok: false, reason: 'invalid_jwt' };
  }
}

/** Timing-safe compare for shared webhook secrets (non-JWT connectors). */
export function verifySharedBearerSecret(
  token: string,
  secret: string,
): boolean {
  const a = Buffer.from(token, 'utf8');
  const b = Buffer.from(secret, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
