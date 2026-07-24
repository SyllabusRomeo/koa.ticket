# SOP-05 — Hetzner Production Setup

## Purpose

Deploy LogIt to Hetzner infrastructure safely.

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

### SSH key for Hetzner (do before creating the VPS)

Full Windows walkthrough (generate Ed25519 → paste into **Security → SSH Keys → Add SSH key** → select key when creating the server):

[DEPLOY_HETZNER_CLOUDFLARE_NAMESILO.md §4.1](../DEPLOY_HETZNER_CLOUDFLARE_NAMESILO.md#41-create-an-ssh-key-on-your-pc-windows-and-add-it-in-hetzner)

Summary:

1. On your PC: `ssh-keygen -t ed25519 -C "logit-hetzner" -f %USERPROFILE%\.ssh\id_ed25519`
2. Copy **only** `id_ed25519.pub` into Hetzner’s **SSH key** field; set a **Name**; optionally **Set as default key**.
3. Never upload the private key (`id_ed25519` without `.pub`).
4. Create the server with that key selected; connect with `ssh root@SERVER_IP`.

### App operator user + Docker (after first root login)

**Order matters:** create user → install Docker → *then* `usermod -aG docker <user>`.  
Running `usermod -aG docker` before Docker exists fails with `group 'docker' does not exist`.

Full copy-paste scripts (example user `romeo`, app dir `/opt/logit`):

[DEPLOY_HETZNER_CLOUDFLARE_NAMESILO.md §4.4–4.7](../DEPLOY_HETZNER_CLOUDFLARE_NAMESILO.md#44-create-an-app-operator-user-do-not-use-root-day-to-day)

1. `adduser romeo` + `usermod -aG sudo romeo` + copy `authorized_keys` from root.  
2. Install Docker CE + Compose plugin (official apt repo).  
3. `usermod -aG docker romeo`; `chown -R romeo:romeo /opt/logit`.  
4. Re-login as `romeo`; `docker ps` without sudo.  
5. Clone/run LogIt as `romeo` — not as root.

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
APP_URL=https://logit.koaimpact.app
WEB_ORIGIN=https://logit.koaimpact.app
APP_PUBLIC_URL=https://logit.koaimpact.app
API_PUBLIC_URL=https://logit.koaimpact.app/api/v1
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
./scripts/init-letsencrypt.sh logit.koaimpact.app you@koaimpact.app
```

- Config: `infra/nginx/tls.conf` (HTTP → HTTPS redirect + ACME webroot)
- Certs: `infra/certs/fullchain.pem` + `privkey.pem` (gitignored)
- Details: [PRODUCTION.md](../PRODUCTION.md)

Prod overlay also sets `COOKIE_SECURE=true` and `TRUST_PROXY=1` on the API.
### 5. Post-deploy verification

- [ ] `https://logit.koaimpact.app/health/ready` returns ok
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
