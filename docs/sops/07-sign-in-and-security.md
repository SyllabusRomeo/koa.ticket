# SOP-07 — Sign-in & Account Security

## Purpose

Guide users through authentication and explain security controls.

## How to sign in (UI)

1. Open the LogIt login page (local: http://localhost:3100/login · production: https://logit.koaimpact.app/login).
2. Enter **email** and **password**.
3. Submit **Sign in**.
4. On success you land in `/app` workspace.

Session cookie name: `logit_session` (HttpOnly).

## Password policy (MVP)

- Minimum length: 12 (configurable via `PASSWORD_MIN_LENGTH`)
- Must include uppercase, lowercase, and a number
- Passwords stored with **Argon2id** (never reversible encryption)

## Account lockout

- After repeated failed logins, the account locks temporarily (~15 minutes after 5 failures).
- Failed and successful attempts are recorded in `login_attempts`.

## Change password

Authenticated users:

```http
POST /api/v1/auth/change-password
{ "currentPassword": "...", "newPassword": "..." }
```

All sessions are revoked; user must sign in again.

## Password reset

1. Request reset: `POST /api/v1/auth/password-reset/request` with `{ "email": "..." }`  
   Response always looks successful (anti-enumeration).
2. Confirm: `POST /api/v1/auth/password-reset/confirm` with token + new password.

In non-production, `EXPOSE_RESET_TOKENS=true` may return the token for testing. **Disable in production** and send token by email when SMTP is wired.

## Sign out

UI: **Sign out** on workspace.  
API: `POST /api/v1/auth/logout` clears cookie and revokes session.

## MFA

Users can enable **TOTP MFA** from **My profile** (authenticator app QR + confirm code).

Sign-in flow when MFA is on:

1. Email + password (validated as usual)
2. Enter 6-digit authenticator code
3. Session cookie is issued only after MFA succeeds

API:

```http
POST /api/v1/auth/mfa/setup
POST /api/v1/auth/mfa/confirm   { "code": "123456" }
POST /api/v1/auth/mfa/disable   { "password": "...", "code": "123456" }
POST /api/v1/auth/mfa/verify-login { "mfaToken": "...", "code": "123456" }
```

Schema fields: `mfaEnabled`, `mfaSecret`. Short-lived challenges live in `auth_challenges`.

## Microsoft Entra SSO (optional)

When `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, and `ENTRA_CLIENT_SECRET` are set:

1. Login shows **Sign in with Microsoft**
2. Browser redirects to Entra → API callback sets session cookie → `/app`
3. Existing users are matched by email (or `external_subject`)
4. Optional auto-provision: `ENTRA_AUTO_PROVISION=true` (default role `ENTRA_DEFAULT_ROLE`, usually `employee`)

Redirect URI must match app registration:  
`{API_PUBLIC_URL}/auth/sso/entra/callback` (local default in `.env.example`).

App MFA is not required after Entra login (IdP MFA should be enforced in Entra Conditional Access).

## Related SOPs

- [06 Roles and permissions](./06-roles-and-permissions.md)
- [18 Troubleshooting](./18-troubleshooting.md)
