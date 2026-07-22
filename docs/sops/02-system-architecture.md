# SOP-02 — System Architecture

## Purpose

Describe how LogIT is structured so operators and developers can reason about changes, failures, and scaling.

## Architectural principle

**Modular monolith first** — strong module boundaries, single deployable unit initially. Avoid premature microservices. Future extraction of modules (Identity, Ticketing, SLA, etc.) should remain possible.

## High-level diagram

```
Browser / Client / Slack / Teams / Email
      │
      ▼
Nginx (reverse proxy, TLS in prod)
      │
      ├──► Web (Next.js) — LogIT UI
      │
      └──► API (NestJS) — /api/v1/*
               │
               ├── PostgreSQL (source of truth)
               ├── Redis (cache / queues / presence)
               ├── File storage (uploads volume)
               ├── Worker (SLA ticks)
               └── In-process pollers (IMAP, digests, report schedules)
```

## Repository layout

```
koa.ticket/
  apps/
    api/       NestJS API + Prisma
    web/       Next.js portal
    worker/    Background SLA processor
  packages/
    shared/    Shared constants (roles, permissions, brand)
  infra/
    docker/    Dockerfiles
    nginx/     Reverse proxy + TLS config
    hetzner/   Production notes
  docs/
    sops/      These SOPs
  docker-compose.yml
  docker-compose.prod.yml
```

## Module boundaries (API)

| Module | Responsibility |
| --- | --- |
| Identity / Auth | Login, sessions, passwords, MFA, Entra SSO, RBAC guards |
| Users | User administration |
| Org | Locations, departments, teams |
| Tickets | Lifecycle, comments, priority, workflow, watchers, work logs, presence, channel |
| Attachments | Secure file upload/download |
| Audit | Immutable business audit events |
| SLA | Policies, instances, escalations |
| Assignment | Routing rules + skills / workload auto-assign |
| Approvals | Queue + multi-step policies |
| Notifications | In-app, preferences, digests |
| Knowledge | Articles |
| Catalog | Service catalog + dynamic forms |
| Assets | Asset register & ticket links |
| Reports | Summaries, heatmap, stages, CSV/PDF, schedules |
| Integrations | Slack/Teams, email/IMAP, outbound webhooks |
| Health | `/health`, `/health/live`, `/health/ready` |

## Data store rules

- **PostgreSQL** is authoritative for business data.
- **Redis** must not be the only copy of critical records (presence may fall back to memory).
- Uploads live on disk/volume with randomized stored names (not public predictable URLs).
- Soft-delete / archive preferred over hard delete for business records.

## Security architecture (summary)

- Server-side authorization on every protected API route
- Argon2id password hashing; optional TOTP MFA; optional Entra OIDC
- HttpOnly session cookie (`logit_session`); `COOKIE_SECURE` + `TRUST_PROXY` in prod
- Helmet security headers on API
- Audit logging for sensitive actions
- Attachment allowlists + size limits
- Slack HMAC / Teams Bot Framework JWT / webhook HMAC signatures

## Local vs production topology

| Concern | Local | Production (Hetzner) |
| --- | --- | --- |
| Entry | Direct ports 3100/4100 | Nginx 80/443 |
| DB | Docker Postgres on host `15432` | Private Docker network only |
| Redis | Host `6379` | Private only |
| Cookies | `COOKIE_SECURE=false` | `COOKIE_SECURE=true` + HTTPS |
| Proxy | — | `TRUST_PROXY=1` |

## Related SOPs

- [03 Local setup](./03-technical-setup-local.md)
- [04 Docker deployment](./04-docker-deployment.md)
- [05 Hetzner production](./05-hetzner-production.md)
- [Production TLS + CI](../PRODUCTION.md)
