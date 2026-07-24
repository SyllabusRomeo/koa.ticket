# LogIt — Production (TLS + CI)

Short runbook for production HTTPS and continuous integration. Complements [SOP-04 Docker](./sops/04-docker-deployment.md) and [SOP-05 Hetzner](./sops/05-hetzner-production.md).

## CI (GitHub Actions)

Workflow: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)

Triggers on **push/PR** to `main` / `master`:

1. `npm ci` (Node from [`.nvmrc`](../.nvmrc) — currently **22**)
2. Prisma generate
3. Typecheck shared + API + worker
4. API unit tests (`jest`)
5. Build API, worker, web

### Local equivalent

```bash
npm ci
npx prisma generate --schema=apps/api/prisma/schema.prisma
npm run ci
```

Or step-by-step: `npm run typecheck` → `npm run test -w @logit/api` → `npm run build`.

> ESLint scripts exist in packages but are not fully wired (no eslint dep/config yet). CI gates on **TypeScript + tests + build**.

## TLS (Nginx + Let's Encrypt)

Local compose (`docker-compose.yml`) stays **HTTP** on port `8180`.

Production overlay mounts TLS config and certs:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

| Piece | Path |
| --- | --- |
| Nginx TLS config | `infra/nginx/tls.conf` |
| Certs (gitignored) | `infra/certs/fullchain.pem`, `privkey.pem` |
| ACME webroot | `infra/certbot/www/` |
| Bootstrap script | `scripts/init-letsencrypt.sh` |

### Issue certificates

1. Point DNS **A/AAAA** at the server; open **80** and **443**.
2. Create production `.env` on the host (never commit):

```env
NODE_ENV=production
COOKIE_SECURE=true
TRUST_PROXY=1
SESSION_SECRET=<long-random-min-32>
POSTGRES_PASSWORD=<strong>
WEB_ORIGIN=https://your.domain.example
APP_URL=https://your.domain.example
APP_PUBLIC_URL=https://your.domain.example
API_PUBLIC_URL=https://your.domain.example/api/v1
```

3. Bootstrap TLS (creates temporary self-signed, obtains LE cert, reloads Nginx):

```bash
chmod +x scripts/init-letsencrypt.sh
./scripts/init-letsencrypt.sh your.domain.example you@example.com
# Optional dry-run CA: STAGING=1 ./scripts/init-letsencrypt.sh ...
```

4. Verify: `https://your.domain.example/health/ready`

### Secure cookies & proxy trust

| Env | Production value | Why |
| --- | --- | --- |
| `COOKIE_SECURE` | `true` | Session cookie only sent over HTTPS |
| `TRUST_PROXY` | `1` | Trust one hop (Nginx); correct `req.ip` from `X-Forwarded-For` |
| `WEB_ORIGIN` | `https://your.domain…` | CORS allowlist |

API and web already bind **`0.0.0.0:$PORT`** (Render / Docker friendly).

### Background pollers (API process)

| Feature | Disable | Interval env |
| --- | --- | --- |
| IMAP inbound | unset `IMAP_HOST` | `IMAP_POLL_MINUTES` |
| Notification digests | `DIGEST_ENABLED=false` | `DIGEST_POLL_MINUTES` |
| Report schedule emails | `REPORT_SCHEDULE_ENABLED=false` | `REPORT_SCHEDULE_POLL_MINUTES` (default `15`) |

Requires SMTP for digest and scheduled-report delivery.

### Renewal

Re-run `./scripts/init-letsencrypt.sh <domain> <email>` periodically, or schedule `certbot renew` and copy live certs into `infra/certs/` then `nginx -s reload`.

## Related

- [DEPLOY_HETZNER_CLOUDFLARE_NAMESILO.md](./DEPLOY_HETZNER_CLOUDFLARE_NAMESILO.md) — **step-by-step** NameSilo + Cloudflare + Hetzner + GitHub
- [infra/hetzner/README.md](../infra/hetzner/README.md) — firewall / production gate
- [SOP-17 Backup](./sops/17-backup-and-recovery.md)
- [NOTIFICATIONS.md](./NOTIFICATIONS.md) — digests
- [INTEGRATIONS_EMAIL.md](./INTEGRATIONS_EMAIL.md) — IMAP / SMTP
