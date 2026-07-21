# SOP-18 — Troubleshooting

## Purpose

Diagnose common LogIT failures quickly.

## Health checks

| Endpoint | Meaning |
| --- | --- |
| `GET /health` | Process up |
| `GET /health/live` | Liveness |
| `GET /health/ready` | DB + Redis reachable |

If ready is degraded, fix dependencies before chasing UI bugs.

## Symptom playbook

### Cannot sign in

1. Confirm API up on 4100 (or prod URL).
2. Confirm `WEB_ORIGIN` includes the exact web origin.
3. Browser must send cookies (`credentials: include`); mixed HTTP/HTTPS breaks Secure cookies.
4. Check lockout / wrong password; reset if needed.
5. Inspect API logs for validation errors.

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

LogIT defaults: web **3100**, API **4100**, Nginx **8180**. Change `.env` + `apps/web/.env.local` together.

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
