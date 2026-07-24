# LogIT on Hetzner — production checklist

## Ports (local vs prod)

| Service | Local host | Container |
| --- | --- | --- |
| Web | 3100 | 3000 |
| API | 4100 | 4000 |
| Nginx | 8180 | 80/443 |
| Postgres | 15432 | 5432 (private) |
| Redis | 6379 | 6379 (private) |

## Firewall

- Public: 80, 443 only (SSH restricted to admin IPs)
- Never expose Postgres or Redis publicly

## TLS

- Terminate TLS at Nginx (`infra/nginx/tls.conf` via `docker-compose.prod.yml`)
- Bootstrap: `./scripts/init-letsencrypt.sh your.domain.example you@example.com`
- Prefer Let's Encrypt with automated renewal (re-run script or `certbot renew` + copy + reload)
- Redirect HTTP → HTTPS; set `COOKIE_SECURE=true` and `TRUST_PROXY=1`
- Full runbook: [docs/PRODUCTION.md](../../docs/PRODUCTION.md)

## Backups

```bash
./scripts/backup-postgres.sh
```

- Daily encrypted DB dumps off-server
- Include `data/uploads` volume
- Test restore periodically (PRD §58)

## Production gate (PRD §91)

- [ ] No debug mode / default credentials
- [ ] HTTPS + secure cookies (`COOKIE_SECURE=true`)
- [ ] `TRUST_PROXY=1` behind Nginx
- [ ] Rate limiting on login
- [ ] Health checks: `/health`, `/health/ready`, `/health/live`
- [ ] Dependency + image scans
- [ ] MFA for privileged accounts when available
- [ ] CI green on `main` (`.github/workflows/ci.yml`)

## Compose

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
./scripts/init-letsencrypt.sh your.domain.example you@example.com
```

## Full triad guide (NameSilo + Cloudflare + GitHub)

Step-by-step production tutorial (subdomain, WAF/SSL, VPS, clone/pull deploys):

[docs/DEPLOY_HETZNER_CLOUDFLARE_NAMESILO.md](../../docs/DEPLOY_HETZNER_CLOUDFLARE_NAMESILO.md)
