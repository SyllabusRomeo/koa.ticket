# SOP-05 — Hetzner Production Setup

## Purpose

Deploy LogIT to Hetzner infrastructure safely.

## Recommended topology

```
Internet → DNS → Firewall → Nginx (TLS) → api / web / worker
                              ↓
                         Postgres + Redis (private)
                              ↓
                         Persistent volumes + backups
```

## Preconditions

- Hetzner Cloud/server with Docker + Docker Compose
- Domain name pointed at server
- Strong secrets generated (DB password, `SESSION_SECRET`, SMTP later)
- SSH key auth; password root login disabled

## Procedure (high level)

### 1. Server hardening

- Update OS packages
- Configure firewall: allow **22** (admin IPs), **80**, **443** only
- Deny public access to Postgres (`5432`) and Redis (`6379`)

### 2. Place application code

Clone repo to server (or pull release artifact). Create production `.env` **on the server only** (never commit).

Critical production settings:

```env
NODE_ENV=production
COOKIE_SECURE=true
TRUST_PROXY=1
SESSION_SECRET=<long-random>
POSTGRES_PASSWORD=<strong>
WEB_ORIGIN=https://your-domain.example
APP_PUBLIC_URL=https://your-domain.example
API_PUBLIC_URL=https://your-domain.example/api/v1
```
### 3. Start with production overrides

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Prod overlay typically:

- Restarts `unless-stopped`
- Removes public DB/Redis port publishing
- Publishes Nginx on 80/443

### 4. TLS

Use the production Nginx TLS config (Let's Encrypt):

```bash
chmod +x scripts/init-letsencrypt.sh
./scripts/init-letsencrypt.sh your-domain.example you@example.com
```

- Config: `infra/nginx/tls.conf` (HTTP → HTTPS redirect + ACME webroot)
- Certs: `infra/certs/fullchain.pem` + `privkey.pem` (gitignored)
- Details: [PRODUCTION.md](../PRODUCTION.md)

Prod overlay also sets `COOKIE_SECURE=true` and `TRUST_PROXY=1` on the API.
### 5. Post-deploy verification

- [ ] `https://your-domain/health/ready` returns ok
- [ ] Login works over HTTPS; cookie Secure flag set
- [ ] Create a test ticket as employee
- [ ] Agent can see queue ticket
- [ ] Worker logs show SLA ticks
- [ ] Backup script runs successfully

### 6. Production gate (must pass)

Before go-live:

- No debug mode / default seed passwords
- No secrets in Git
- HTTPS enforced
- Firewall correct
- DB/Redis not public
- Backups scheduled + restore tested
- Monitoring/health checks watched
- Admin accounts secured (MFA when available)

Details: `infra/hetzner/README.md`

## Related SOPs

- [NameSilo + Cloudflare + Hetzner + GitHub](../DEPLOY_HETZNER_CLOUDFLARE_NAMESILO.md) — full step-by-step triad
- [17 Backup and recovery](./17-backup-and-recovery.md)
- [18 Troubleshooting](./18-troubleshooting.md)
- [PRODUCTION.md](../PRODUCTION.md) — CI + TLS runbook
