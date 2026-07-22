# LogIT — Implementation Plan

Enterprise ITSM platform per PRD v1.0. Modular monolith, Docker-first, Hetzner-ready.

**Last updated:** 2026-07-22 (phases 0–11 + N/H/M through M10)

## Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| API | NestJS (TypeScript) | Modular boundaries, DI, enterprise patterns |
| ORM | Prisma | Typed schema, migrations, PostgreSQL-native |
| DB | PostgreSQL 16 | PRD-mandated relational store |
| Cache / queues | Redis 7 + BullMQ | Jobs, rate limits, cache, presence (not source of truth) |
| Worker | NestJS worker process | SLA, escalations; API also runs digest/IMAP/report schedule pollers |
| Frontend | Next.js (App Router) | SSR-capable portal, API client |
| Proxy | Nginx | TLS termination, headers, static |
| Containers | Docker Compose | Single-server Hetzner deploy |
| Auth | Session cookies + Argon2id + optional TOTP MFA + Entra OIDC | SAML / more IdPs later |

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
- [x] TOTP MFA (Profile setup + login challenge)
- [x] Optional Microsoft Entra OIDC SSO

## Phase 2 — Organization (done — MVP)

- [x] Company → Country → Site → Department → Team → User (location/dept/team models)
- [x] Dynamic locations (no hard-coding)
- [x] Support group membership
- [x] Locations admin UI + ticket origin site + user home location
- [x] Departments admin UI
- [x] Teams admin UI
- [ ] Soft-deactivate UX polish / full org tree designer (later)

## Phase 3 — Core ticketing (done — MVP+)

- [x] Human IDs: `INC-YYYY-######`, `REQ-…`, etc.
- [x] Types, categories/subcategories, impact×urgency priority matrix
- [x] Status workflow with invalid-transition rejection
- [x] Public comments vs internal notes
- [x] Optimistic locking (`version`)
- [x] Soft delete / archive flags
- [x] Parent/child link + merge
- [x] Watchers API + UI; work-log API + UI; major-incident flag + badge/filter
- [x] Omnichannel `channel` / `channelMeta` on tickets
- [x] Agent presence (viewing/composing)
- [x] Queue / Kanban board (`/app/queue`)
- [x] Problem / Change workflows + CAB request

## Phase 4 — Attachments & audit (done)

- [x] Secure uploads (MIME, extension, size, randomized names)
- [x] Immutable audit_logs (actor, action, before/after, IP)
- [x] Separate app logs vs audit logs

## Phase 5 — SLA & business hours (done — MVP)

- [x] SLA policies + first-response / resolution instances
- [x] Pause on statuses with `pausesSla`
- [x] Business hours seed (Mon–Fri 08:00–17:00 Africa/Accra)
- [x] Escalation thresholds via worker tick + in-app notify

## Phase 6 — Assignment & notifications (done — MVP+)

- [x] Auto-routing rules (category / type / location → team)
- [x] Skills catalog + least-open auto-assign on rules
- [x] In-app notifications + preferences API + bell / inbox UI
- [x] Email delivery (SMTP nodemailer) + inbound webhook + IMAP poller
- [x] Notification digests (daily/weekly, quiet hours)
- [x] Watcher fan-out on comment + status
- [x] Ticket detail: visible assign/reassign (team + assignee) + auto-rule explanation
- [x] Ticket lifecycle action buttons (workflow transitions + soft-delete for elevated roles)
- [x] Assignment-rule + SLA policy admin UI (`/app/admin/routing`)
- [x] Multi-step approval policies (`/app/admin/approvals`)

See also [GAP_ASSESSMENT.md](./GAP_ASSESSMENT.md) and [NOTIFICATIONS.md](./NOTIFICATIONS.md).

## Phase 7 — Portals & dashboards (done — MVP+)

- [x] Role-aware workspace dashboard
- [x] Tickets / queue / problems / changes / major-incidents / knowledge / catalog / assets / reports nav
- [x] Major-incident ops dashboard
- [x] LogIT brand UI

## Phase 8 — Knowledge & catalog (done — MVP+)

- [x] Knowledge articles (draft / publish, rich HTML)
- [x] Service catalog + per-item dynamic `formSchema`

## Phase 9 — Assets (done — MVP)

- [x] Asset register + types
- [x] Link assets ↔ tickets API

## Phase 10 — Reporting (done — MVP+)

- [x] Summary metrics API
- [x] CSV / PDF export with audit
- [x] Volume heatmap (weekday × hour)
- [x] Stage bottleneck analytics
- [x] Scheduled email exports (`ReportSchedule`)

## Phase 11 — Production (Hetzner) (done — scaffold + TLS/CI)

- [x] `docker-compose.prod.yml`
- [x] Hetzner checklist + backup script
- [x] Health endpoints retained
- [x] Full CI pipeline (GitHub Actions) + TLS cert bootstrap (`scripts/init-letsencrypt.sh`, `infra/nginx/tls.conf`)
- [x] Signed outbound webhooks (HMAC)

---

## Module boundaries (modular monolith)

```
Identity | Ticketing | SLA | Assets | Knowledge
Notifications | Reporting | Audit | Admin | Integrations
```

## Definition of Done (every feature)

Functional + server authz + validation + migration + audit (if needed) + errors + tests + responsive UI + security review.

## Out of MVP / still pending

See **[GAP_ASSESSMENT.md](./GAP_ASSESSMENT.md)** and **[DEVELOPMENT_TODO.md](./DEVELOPMENT_TODO.md)** for the live shipped-vs-pending matrix.

Notable remaining (**L1–L5**): CMDB discovery/relationships, AI assists, knowledge deflection analytics, portal themes, immutable audit export schedules.
