# SOP-02 — System Architecture

## Purpose

Describe how LogIT is structured so operators and developers can reason about changes, failures, and scaling.

## Architectural principle

**Modular monolith first** — strong module boundaries, single deployable unit initially. Avoid premature microservices. Future extraction of modules (Identity, Ticketing, SLA, etc.) should remain possible.

## High-level diagram

```
Browser / Client
      │
      ▼
Nginx (reverse proxy, TLS in prod)
      │
      ├──► Web (Next.js) — LogIT UI
      │
      └──► API (NestJS) — /api/v1/*
               │
               ├── PostgreSQL (source of truth)
               ├── Redis (cache / queues / future rate limits)
               ├── File storage (uploads volume)
               └── Worker (SLA ticks, future email/jobs)
```

## Repository layout

```
koa.ticketing/
  apps/
    api/       NestJS API + Prisma
    web/       Next.js portal
    worker/    Background SLA processor
  packages/
    shared/    Shared constants (roles, permissions, brand)
  infra/
    docker/    Dockerfiles
    nginx/     Reverse proxy config
    hetzner/   Production notes
  docs/
    sops/      These SOPs
  docker-compose.yml
  docker-compose.prod.yml
```

## Module boundaries (API)

| Module | Responsibility |
| --- | --- |
| Identity / Auth | Login, sessions, passwords, RBAC guards |
| Users | User administration |
| Org | Locations, departments, teams |
| Tickets | Lifecycle, comments, priority, workflow |
| Attachments | Secure file upload/download |
| Audit | Immutable business audit events |
| SLA | Policies, instances, escalations |
| Assignment | Routing rules |
| Notifications | In-app notifications & preferences |
| Knowledge | Articles |
| Catalog | Service catalog items |
| Assets | Asset register & ticket links |
| Reports | Summaries & CSV export |
| Health | `/health`, `/health/live`, `/health/ready` |

## Data store rules

- **PostgreSQL** is authoritative for business data.
- **Redis** must not be the only copy of critical records.
- Uploads live on disk/volume with randomized stored names (not public predictable URLs).
- Soft-delete / archive preferred over hard delete for business records.

## Security architecture (summary)

- Server-side authorization on every protected API route
- Argon2id password hashing
- HttpOnly session cookie (`logit_session`)
- Helmet security headers on API
- Audit logging for sensitive actions
- Attachment allowlists + size limits

## Local vs production topology

| Concern | Local | Production (Hetzner) |
| --- | --- | --- |
| Entry | Direct ports 3100/4100 | Nginx 80/443 |
| DB | Docker Postgres on host `15432` | Private Docker network only |
| Redis | Host `6379` | Private only |
| Cookies | `COOKIE_SECURE=false` | `COOKIE_SECURE=true` + HTTPS |

## Related SOPs

- [03 Local setup](./03-technical-setup-local.md)
- [04 Docker deployment](./04-docker-deployment.md)
- [05 Hetzner production](./05-hetzner-production.md)
