import {
  extractBearerToken,
  verifyBotFrameworkJwt,
  verifySharedBearerSecret,
} from './bot-framework-auth';

jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(() => jest.fn()),
  jwtVerify: jest.fn(),
}));

import { jwtVerify } from 'jose';

const jwtVerifyMock = jwtVerify as jest.MockedFunction<typeof jwtVerify>;

describe('bot-framework-auth helpers', () => {
  beforeEach(() => {
    jwtVerifyMock.mockReset();
  });

  it('extractBearerToken parses Bearer scheme case-insensitively', () => {
    expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
    expect(extractBearerToken('bearer xyz')).toBe('xyz');
    expect(extractBearerToken('raw-secret')).toBeNull();
    expect(extractBearerToken(undefined)).toBeNull();
  });

  it('verifySharedBearerSecret is timing-safe and rejects mismatches', () => {
    expect(verifySharedBearerSecret('same', 'same')).toBe(true);
    expect(verifySharedBearerSecret('a', 'b')).toBe(false);
    expect(verifySharedBearerSecret('short', 'longer')).toBe(false);
  });

  it('rejects empty app id', async () => {
    const result = await verifyBotFrameworkJwt({
      token: 'a.b.c',
      appId: '  ',
    });
    expect(result).toEqual({ ok: false, reason: 'missing_app_id' });
  });

  it('accepts a valid connector JWT and checks serviceUrl', async () => {
    const serviceUrl = 'https://smba.trafficmanager.net/teams/';
    jwtVerifyMock.mockResolvedValueOnce({
      payload: { serviceUrl },
      protectedHeader: { alg: 'RS256' },
      key: {} as never,
    } as never);

    const ok = await verifyBotFrameworkJwt({
      token: 'hdr.payload.sig',
      appId: '00000000-0000-0000-0000-000000000001',
      activityServiceUrl: serviceUrl,
      connectorJwks: jest.fn() as never,
    });
    expect(ok).toEqual({
      ok: true,
      mode: 'jwt',
      serviceUrl,
    });

    jwtVerifyMock.mockResolvedValueOnce({
      payload: { serviceUrl },
      protectedHeader: { alg: 'RS256' },
      key: {} as never,
    } as never);

    const mismatch = await verifyBotFrameworkJwt({
      token: 'hdr.payload.sig',
      appId: '00000000-0000-0000-0000-000000000001',
      activityServiceUrl: 'https://evil.example/',
      connectorJwks: jest.fn() as never,
    });
    expect(mismatch).toEqual({ ok: false, reason: 'service_url_mismatch' });
  });

  it('returns invalid_jwt when signature verification fails', async () => {
    jwtVerifyMock.mockRejectedValueOnce(new Error('bad sig'));
    const result = await verifyBotFrameworkJwt({
      token: 'hdr.payload.sig',
      appId: '00000000-0000-0000-0000-000000000002',
      connectorJwks: jest.fn() as never,
      allowEmulator: false,
    });
    expect(result).toEqual({ ok: false, reason: 'invalid_jwt' });
  });
});
