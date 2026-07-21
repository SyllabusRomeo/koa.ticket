# LogIT — Implementation Plan

Enterprise ITSM platform per PRD v1.0. Modular monolith, Docker-first, Hetzner-ready.

## Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| API | NestJS (TypeScript) | Modular boundaries, DI, enterprise patterns |
| ORM | Prisma | Typed schema, migrations, PostgreSQL-native |
| DB | PostgreSQL 16 | PRD-mandated relational store |
| Cache / queues | Redis 7 + BullMQ | Jobs, rate limits, cache (not source of truth) |
| Worker | NestJS worker process | SLA, email, escalations, exports |
| Frontend | Next.js (App Router) | SSR-capable portal, API client |
| Proxy | Nginx | TLS termination, headers, static |
| Containers | Docker Compose | Single-server Hetzner deploy |
| Auth (MVP) | Session cookies + Argon2id | MFA / Entra ID later |

**Brand:** LogIT — primary `#0F4A40`, light `#EDF4AC`, secondary `#456433`, warm `#FBF1DA`.

---

## Phase 0 — Foundation (done)

- [x] Monorepo (`apps/api`, `apps/web`, `apps/worker`, `packages/shared`)
- [x] Docker Compose: postgres, redis, api, worker, web, nginx
- [x] LogIT design tokens + base layout shell
- [x] Health endpoints: `/health`, `/health/ready`, `/health/live`
- [x] `.env.example`, `.gitignore`, seed stub
- [x] Git init

## Phase 1 — Identity & Access (done)

- [x] Users, roles, permissions, user_roles
- [x] Email/password auth, password policy, lockout, reset
- [x] Session management (DB sessions + httpOnly cookie)
- [x] Server-side RBAC guards
- [x] Roles: Employee, Agent, Tier2/3, IT Manager, Approver, SysAdmin, Auditor

## Phase 2 — Organization (done — API)

- [x] Company → Country → Site → Department → Team → User (location/dept/team models)
- [x] Dynamic locations (no hard-coding)
- [x] Support group membership
- [ ] Richer org admin UI (Phase 7)

## Phase 3 — Core ticketing (done)

- [x] Human IDs: `INC-YYYY-######`, `REQ-…`, etc.
- [x] Types, categories/subcategories, impact×urgency priority matrix
- [x] Status workflow with invalid-transition rejection
- [x] Public comments vs internal notes
- [x] Optimistic locking (`version`)
- [x] Soft delete / archive flags

## Phase 4 — Attachments & audit (done)

- [x] Secure uploads (MIME, extension, size, randomized names)
- [x] Immutable audit_logs (actor, action, before/after, IP)
- [x] Separate app logs vs audit logs

## Phase 5 — SLA & business hours (done — MVP)

- [x] SLA policies + first-response / resolution instances
- [x] Pause on statuses with `pausesSla`
- [x] Business hours seed (Mon–Fri 08:00–17:00 Africa/Accra)
- [x] Escalation thresholds via worker tick + in-app notify

## Phase 6 — Assignment & notifications (done — MVP)

- [x] Auto-routing rules (category → team)
- [x] In-app notifications + preferences API
- [x] Ticket detail: visible assign/reassign (team + assignee) + auto-rule explanation
- [x] Ticket lifecycle action buttons (workflow transitions + soft-delete for elevated roles)
- [ ] Email delivery (SMTP wiring later)
- [ ] Assignment-rule admin UI (API exists)

See also [GAP_ASSESSMENT.md](./GAP_ASSESSMENT.md) for module matrix and honest PRD gaps.

## Phase 7 — Portals & dashboards (done — MVP)

- [x] Role-aware workspace dashboard
- [x] Tickets / knowledge / catalog / assets / reports nav
- [x] LogIT brand UI

## Phase 8 — Knowledge & catalog (done — MVP)

- [x] Knowledge articles (draft / publish)
- [x] Basic service catalog

## Phase 9 — Assets (done — MVP)

- [x] Asset register + types
- [x] Link assets ↔ tickets API

## Phase 10 — Reporting (done — MVP)

- [x] Summary metrics API
- [x] CSV export with audit

## Phase 11 — Production (Hetzner) (done — scaffold)

- [x] `docker-compose.prod.yml`
- [x] Hetzner checklist + backup script
- [x] Health endpoints retained
- [ ] Full CI pipeline / TLS cert automation on live host

---

## Module boundaries (modular monolith)

```
Identity | Ticketing | SLA | Assets | Knowledge
Notifications | Reporting | Audit | Admin | Integrations
```

## Definition of Done (every feature)

Functional + server authz + validation + migration + audit (if needed) + errors + tests + responsive UI + security review.

## Out of MVP (Phase 2+ product)

Dynamic forms, advanced approvals, problems/changes, email-to-ticket, Entra SSO, Teams, CMDB, AI assists.
