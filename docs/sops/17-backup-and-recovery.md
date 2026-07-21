# SOP-17 — Backup & Recovery

## Purpose

Protect LogIT data and prove restores work.

## What to back up

1. **PostgreSQL** database (tickets, users, audit, SLA, …)
2. **Upload volume** (`data/uploads` / Docker `upload_data`)
3. **Configuration** (production `.env`, Nginx TLS material — stored securely)
4. Optionally Redis only if used for durable queues (business truth remains Postgres)

## Automated DB backup (Compose)

```bash
chmod +x scripts/backup-postgres.sh   # Linux/macOS hosts
./scripts/backup-postgres.sh
```

Produces gzipped SQL under `./backups/` (or `BACKUP_DIR`).

Schedule daily via cron / Task Scheduler; copy off-server.

## Restore outline (Postgres)

1. Stop API/worker writers.
2. Create/restore empty target database.
3. `gunzip -c backup.sql.gz | docker compose exec -T postgres psql -U logit logit`
4. Restore upload files to the uploads volume path.
5. Start services; hit `/health/ready`.
6. Spot-check login, a known ticket, an attachment, an audit row.

## Retention

Define organizational retention (e.g. 30/90 daily, monthly longer). Align with Ghana Data Protection Act / internal policy.

## Test cadence

A backup is not valid until restore has been tested. Rehearse at least quarterly.

## Related SOPs

- [05 Hetzner production](./05-hetzner-production.md)
- [18 Troubleshooting](./18-troubleshooting.md)
