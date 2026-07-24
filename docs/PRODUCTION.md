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
| ACME / LE state | `infra/certs/live/…` (root-owned; do not commit) |
| ACME webroot | `infra/certbot/www/` |
| Bootstrap script | `scripts/init-letsencrypt.sh` |
| Prod DB seed helper | `scripts/docker-seed.sh` |
| Build context excludes | `.dockerignore` (`infra/certs/**`, `.env`, …) |

### Issue certificates

1. Point DNS **A/AAAA** at the server (**grey cloud** if using Cloudflare); open **80** and **443**.
2. Create production `.env` on the host (never commit):

```env
NODE_ENV=production
COOKIE_SECURE=true
TRUST_PROXY=1
SESSION_SECRET=<long-random-min-32>
POSTGRES_PASSWORD=<strong>
WEB_ORIGIN=https://logit.koaimpact.app
APP_URL=https://logit.koaimpact.app
APP_PUBLIC_URL=https://logit.koaimpact.app
API_PUBLIC_URL=https://logit.koaimpact.app/api/v1
```

3. Bootstrap TLS (creates temporary self-signed if needed, obtains LE cert, copies PEMs for Nginx, reloads):

```bash
bash ./scripts/init-letsencrypt.sh logit.koaimpact.app ops@koaimpact.app
# Use any reachable mailbox you control for Let's Encrypt notices

# Optional dry-run CA: STAGING=1 bash ./scripts/init-letsencrypt.sh ...
```

4. Verify: `curl -fsS https://logit.koaimpact.app/health/ready`

5. Seed users (empty DB): `bash ./scripts/docker-seed.sh` — use the **printed** admin password (`SEED_ADMIN_PASSWORD` if set in `.env`).

### Secure cookies & proxy trust

| Env | Production value | Why |
| --- | --- | --- |
| `COOKIE_SECURE` | `true` | Session cookie only sent over HTTPS |
| `TRUST_PROXY` | `1` | Trust one hop (Nginx); correct `req.ip` from `X-Forwarded-For` |
| `WEB_ORIGIN` | `https://logit.koaimpact.app` | CORS allowlist (must be in `.env`; recreate API after edits) |

API binds **`0.0.0.0:4000`** in Compose (`PORT` / `API_PORT`). Do not confuse with `POSTGRES_PORT=5432` — the entrypoint uses `PGPORT` for the DB URL so it never overwrites the HTTP port.

### Web client API URL (important)

`NEXT_PUBLIC_API_URL` is **compiled into the Next.js client** at **image build** time. Setting it only in Compose `environment:` at runtime does **not** change browser requests.

Production images bake `NEXT_PUBLIC_API_URL=/api/v1` (same-origin via Nginx). After changing that value or web code, rebuild the **web** image (`--no-cache` if unsure) and hard-refresh browsers.

### Background pollers (API process)

| Feature | Disable | Interval env |
| --- | --- | --- |
| IMAP inbound | unset `IMAP_HOST` | `IMAP_POLL_MINUTES` |
| Notification digests | `DIGEST_ENABLED=false` | `DIGEST_POLL_MINUTES` |
| Report schedule emails | `REPORT_SCHEDULE_ENABLED=false` | `REPORT_SCHEDULE_POLL_MINUTES` (default `15`) |

Requires SMTP for digest and scheduled-report delivery.

### Renewal

Re-run `bash ./scripts/init-letsencrypt.sh <domain> <email>` periodically. The script copies live certs into `infra/certs/fullchain.pem` + `privkey.pem` via Docker (Certbot files are root-owned) then reloads Nginx.

### Production pitfalls (quick)

See the fuller table in [DEPLOY_HETZNER_CLOUDFLARE_NAMESILO.md §5.6](./DEPLOY_HETZNER_CLOUDFLARE_NAMESILO.md#56-nuances-learned-on-the-first-hetzner-go-live).

| Pitfall | Reminder |
| --- | --- |
| API on `:5432` | Entrypoint must not assign Postgres port to `PORT` |
| Worker restart loop | Worker image must `prisma generate` |
| Login Failed to fetch | Rebuild web with `/api/v1`, not localhost |
| Build fails on `infra/certs` | Rely on `.dockerignore` |
| `prisma db seed` in `exec` | Use `scripts/docker-seed.sh` |

## Related

- [DEPLOY_HETZNER_CLOUDFLARE_NAMESILO.md](./DEPLOY_HETZNER_CLOUDFLARE_NAMESILO.md) — **step-by-step** NameSilo + Cloudflare + Hetzner + GitHub
- [infra/hetzner/README.md](../infra/hetzner/README.md) — firewall / production gate
- [SOP-17 Backup](./sops/17-backup-and-recovery.md)
- [NOTIFICATIONS.md](./NOTIFICATIONS.md) — digests
- [INTEGRATIONS_EMAIL.md](./INTEGRATIONS_EMAIL.md) — IMAP / SMTP
