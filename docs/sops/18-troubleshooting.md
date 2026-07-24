# SOP-18 — Troubleshooting

## Purpose

Diagnose common LogIt failures quickly.

## Health checks

| Endpoint | Meaning |
| --- | --- |
| `GET /health` | Process up |
| `GET /health/live` | Liveness |
| `GET /health/ready` | DB + Redis reachable |

If ready is degraded, fix dependencies before chasing UI bugs.

## Symptom playbook

### Cannot sign in

1. Confirm API up: prod health `https://<host>/health/ready` or `exec api wget -qO- http://127.0.0.1:4000/health/ready`.
2. Confirm `WEB_ORIGIN` includes the exact web origin (in `.env`, then recreate API).
3. Browser must send cookies (`credentials: include`); mixed HTTP/HTTPS breaks Secure cookies.
4. In DevTools → Network: login must call **`/api/v1/auth/login` on the same host**. If it calls `http://localhost:4100`, rebuild the **web** image with `NEXT_PUBLIC_API_URL=/api/v1` and hard-refresh.
5. Check lockout / wrong password; after seed, use the **printed** password (`SEED_ADMIN_PASSWORD` may override docs defaults).
6. Inspect API logs for validation errors.

### Production Docker (Hetzner / Compose)

| Symptom | Check |
| --- | --- |
| API listening on `:5432` | Entrypoint must use `PGPORT` for Postgres; HTTP `PORT=4000`. Pull latest entrypoint and recreate API. |
| Worker `Restarting` | Worker image must run `prisma generate`. Rebuild worker. |
| `docker build` permission denied under `infra/certs` | Ensure `.dockerignore` excludes cert dirs (Certbot files are root-owned). |
| Let’s Encrypt `cp` permission denied | Copy via Docker alpine (see `scripts/init-letsencrypt.sh`); then `nginx -s reload`. |
| No users after fresh volume | `bash ./scripts/docker-seed.sh` (not bare `prisma db seed` in exec). |
| CORS after editing `.env` | `up -d --force-recreate api` so the container reloads env. |

Full deploy nuances: [DEPLOY_HETZNER_CLOUDFLARE_NAMESILO.md §5.6](../DEPLOY_HETZNER_CLOUDFLARE_NAMESILO.md#56-nuances-learned-on-the-first-hetzner-go-live).

### Tickets not visible

1. Employee sees only own tickets — expected.
2. Agent needs queue/all permissions.
3. Soft-deleted tickets hidden.

### SLA not updating

1. Ensure **worker** process is running.
2. Check `sla_instances` rows exist for new tickets.
3. Pending/On Hold may pause timers.

### Attachments fail

1. Extension allowlisted?
2. Under size limit?
3. `UPLOAD_DIR` writable?
4. User authorized on that ticket?

### Docker / DB issues (Windows)

1. Docker Desktop running?
2. Use Postgres host port **15432**, not 5432, if local Postgres conflicts.
3. `docker compose ps` / `docker compose logs postgres`

### Port already in use

LogIt defaults: web **3100**, API **4100**, Nginx **8180**. Change `.env` + `apps/web/.env.local` together.

### Prisma generate EPERM

Stop Node processes using the Prisma engine, then:

```bash
npx prisma generate --schema=apps/api/prisma/schema.prisma
```

## Log collection for support

Provide:

- Approximate time of issue
- User email + role
- Ticket number
- `/health/ready` JSON
- API/worker log snippets (no passwords/secrets)

## Related SOPs

- [03 Local setup](./03-technical-setup-local.md)
- [04 Docker deployment](./04-docker-deployment.md)
