# SOP-20 — Change, Release & Seed Data

## Purpose

Control how LogIT changes move from development to production.

## Source control

- Repo: https://github.com/SyllabusRomeo/koa.ticket
- Never commit `.env`, secrets, or upload binaries
- Prefer PRs for production-bound changes

## Database changes

1. Update `apps/api/prisma/schema.prisma`
2. Create migration: `npx prisma migrate dev --name <name>`
3. Commit migration SQL under `prisma/migrations/`
4. Deploy with `prisma migrate deploy` (API container also runs deploy on start)

Never hand-edit production schemas without a migration.

## Seed data

```bash
npm run db:seed
```

Safe for empty/dev databases. On production:

- Run only controlled seeds (roles/statuses) or replace with admin bootstrap
- Rotate/remove demo users and passwords immediately

## Release checklist (staging → prod)

1. Tests / smoke: login, create ticket, assign, comment, SLA row exists, report summary
2. Migrate backup taken ([SOP-17](./17-backup-and-recovery.md))
3. Deploy images / compose
4. Migrate
5. Verify health endpoints
6. Smoke again on production URL
7. Monitor worker logs for SLA ticks
8. Communicate change window to IT staff

## Rollback strategy

- Keep previous container images tagged
- Restore DB from pre-deploy backup if migration is incompatible
- Roll forward with fix preferred when data migration already applied

## Configuration changes

Document changes to:

- Assignment rules
- SLA policies
- Categories
- Roles/permissions
- Nginx / firewall / TLS

Prefer auditable admin actions where available.

## Related SOPs

- [03 Local setup](./03-technical-setup-local.md)
- [05 Hetzner production](./05-hetzner-production.md)
- [11 Admin configuration](./11-admin-configuration.md)
