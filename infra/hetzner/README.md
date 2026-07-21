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

- Terminate TLS at Nginx / reverse proxy
- Prefer Let's Encrypt with automated renewal
- Redirect HTTP → HTTPS

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
- [ ] Rate limiting on login
- [ ] Health checks: `/health`, `/health/ready`, `/health/live`
- [ ] Dependency + image scans
- [ ] MFA for privileged accounts when available

## Compose

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```
