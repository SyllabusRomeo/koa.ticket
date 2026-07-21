# SOP-07 — Sign-in & Account Security

## Purpose

Guide users through authentication and explain security controls.

## How to sign in (UI)

1. Open the LogIT login page (local: http://localhost:3100/login).
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

Schema supports `mfaEnabled` / `mfaSecret` for future MFA (especially privileged accounts). Enforce MFA before production go-live when available.

## Related SOPs

- [06 Roles and permissions](./06-roles-and-permissions.md)
- [18 Troubleshooting](./18-troubleshooting.md)
