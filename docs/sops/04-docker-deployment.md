# SOP-04 — Docker Compose Deployment

## Purpose

Run LogIT as containers (all-in-one or split) for staging-like or single-server demos.

## Services in `docker-compose.yml`

| Service | Role |
| --- | --- |
| `postgres` | Database |
| `redis` | Cache / future queues |
| `api` | NestJS API (runs migrations on start) |
| `worker` | SLA background worker |
| `web` | Next.js frontend |
| `nginx` | Reverse proxy entrypoint |

## Procedure — full stack

1. Copy env: `cp .env.example .env` and set strong passwords/secrets.
2. For in-compose networking, API/worker must use hostnames `postgres` and `redis` in their container env (compose already overrides `DATABASE_URL` / `REDIS_URL` for those services).
3. Build and start:

```bash
docker compose up --build -d
```

4. Open **http://localhost:8180** (Nginx).
5. Health via Nginx: **http://localhost:8180/health**

## Procedure — data only (dev)

```bash
docker compose up -d postgres redis
```

Then run API/web on the host (SOP-03).

## Volumes

- `postgres_data` — database files
- `redis_data` — Redis AOF
- `upload_data` — ticket attachments

Treat volumes as durable; back them up in production.

## Stopping / restarting

```bash
docker compose stop
docker compose start
docker compose down          # stops; keeps volumes
docker compose down -v       # DESTROYS volumes — data loss
```

## Related SOPs

- [05 Hetzner production](./05-hetzner-production.md)
- [17 Backup and recovery](./17-backup-and-recovery.md)
- [PRODUCTION.md](../PRODUCTION.md) — TLS overlay + CI
