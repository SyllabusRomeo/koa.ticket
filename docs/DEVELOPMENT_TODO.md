# LogIt — Development To-do

Living checklist derived from [GAP_ASSESSMENT.md](./GAP_ASSESSMENT.md) and [ENTERPRISE_ROADMAP.md](./ENTERPRISE_ROADMAP.md).  
Update statuses here as work lands. Principle: **capture data → workflows → real-time → analytics → automation → AI.**

**Started:** 2026-07-22

---

## How to use

| Status | Meaning |
| --- | --- |
| `[ ]` | Not started |
| `[~]` | In progress |
| `[x]` | Done (shipped in codebase) |

---

## Near-term polish (start here)

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| N1 | Watchers UI on ticket detail | `[x]` | Watch / Unwatch on ticket detail |
| N2 | Work-log UI on ticket detail | `[x]` | Agents log minutes + notes on detail |
| N3 | Watcher notification fan-out | `[x]` | Watchers notified on comment + status |
| N4 | Major-incident badge + list filter | `[x]` | Badge + toggle + Major queue chip |
| N5 | Departments admin UI | `[x]` | `/app/admin/departments` create/edit/deactivate |

---

## High priority

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| H1 | Collision detection / agent presence | `[x]` | Redis (+ memory fallback); viewing/composing on ticket detail |
| H2 | Agent queue boards / Kanban / workload | `[x]` | `/app/queue` Kanban + workload; drag status (transition-aware) |
| H3 | Problem management workflow | `[x]` | `/app/problems`, RCA fields, Under investigation / Known error, Raise problem |
| H4 | Change management / CAB | `[x]` | `/app/changes`, plan/rollback/schedule, Submit to CAB → Approvals → Scheduled |
| H5 | Major-incident ops dashboard | `[x]` | `/app/major-incidents` KPIs + active MI cards with related work |
| H6 | SSO / MFA (Entra/SAML) | `[x]` | TOTP MFA + optional Microsoft Entra OIDC |
| H7 | Stage-duration / bottleneck analytics | `[x]` | Reports → Stage bottlenecks + stuck list; detail bars |

---

## Medium priority

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| M1 | IMAP poller + richer email threading | `[x]` | IMAP UNSEEN poll + Message-ID / In-Reply-To threading |
| M2 | Skills / workload-aware routing | `[x]` | Skills catalog + least-open auto-assign on rules |
| M3 | Approval config / multi-step | `[x]` | Policies + sequential steps; Admin → Approval policies |
| M4 | Catalog dynamic forms | `[x]` | Per-item formSchema; validate + persist answers |
| M5 | Signed outbound webhooks | `[x]` | HMAC endpoints + Admin → Integrations |
| M6 | Prod TLS / CI automation | `[x]` | GitHub Actions CI; Nginx TLS + Let's Encrypt script; `docs/PRODUCTION.md` |
| M7 | Slack/Teams Bot Framework JWT polish | `[x]` | Slack HMAC + Bot Framework JWT (JWKS) + shared-secret fallback |
| M8 | Notification digests | `[x]` | Daily/weekly email + quiet hours; leave in-app unread; `lastDigestAt` |
| M9 | Reporting heatmaps / scheduled exports | `[x]` | Heatmap (dow×hour) + ReportSchedule email exports |
| M10 | Omnichannel channel metadata on tickets | `[x]` | Web + chat + email intake; `Ticket.channel` + badge/filter |

---

## Later / strategic

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| L1 | CMDB discovery / CI relationships | `[x]` | Relations + impact BFS; discovery CSV import; Assets UI |
| L2 | AI assists | `[x]` | Classify / summarize / duplicates / SLA risk (+ optional OpenAI) |
| L3 | Knowledge deflection analytics | `[x]` | Views + feedback events; Reports deflection panel |
| L4 | Portal themes | `[x]` | Presets + custom colors; CSS vars site-wide; Admin → Branding |
| L5 | Immutable audit export schedules | `[x]` | Checksummed CSV email schedules on Audit trail |

---

## Sprint alignment (recommended order)

**Shipped:** Near-term N1–N5 · High H1–H7 · Medium M1–M10 · **L1–L5** (CMDB, AI, KB deflection, portal themes, immutable audit exports).

**Next product slice:** **Incident Management System (IMS)** — dedicated module on the same URL; see [ENTERPRISE_ROADMAP.md — Phase IMS](./ENTERPRISE_ROADMAP.md#phase-ims--dedicated-incident-management-module).

**Optional polish:** outbound webhook retry worker, bot outbound replies, board presets, SAML / more IdPs.

---

## Next build — Incident Management System (IMS)

Queued from roadmap (2026-07-23). Same host/login as LogIt; **separate module** (`/im` or `/app/im/*`, `/api/v1/im/*`). Full intent: [ENTERPRISE_ROADMAP.md](./ENTERPRISE_ROADMAP.md#phase-ims--dedicated-incident-management-module).

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| IMS-0 | Architecture spike (routes, boundaries, ticket link) | `[ ]` | Tomorrow’s build — start here |
| IMS-1 | Prisma `ImIncident` + severities | `[ ]` | |
| IMS-2 | Nest `im` API + permissions | `[ ]` | `im:read` / `im:write` / … |
| IMS-3 | Web `/im` shell + product switcher | `[ ]` | Same URL, different chrome |
| IMS-4+ | Board, timeline, roles, PIR, bridges | `[ ]` | Follow-on slices |

---

## Org admin note — Users

**Finding (2026-07-23):** `POST /api/v1/users` existed (`users:manage`), but there was no admin UI to create accounts.  

**Fix:** Admin → **Users** (`/app/admin/users`) — create, edit, activate/deactivate; link to Roles & Access for permissions.

---

## Org admin note — Departments

**Finding (2026-07-22):** Departments are created via `POST /api/v1/org/departments` and seeded as **Information Technology** (`IT`) and **Operations** (`OPS`). Teams admin can *select* a department when creating a team, but there was **no UI to create/edit departments**.  

**Fix:** Admin → **Departments** (`/app/admin/departments`) — create, edit, soft-deactivate (mirrors Locations).

---

## Related docs

- [USER_AND_DEVELOPER_GUIDE.md](./USER_AND_DEVELOPER_GUIDE.md) — book-style user + developer guide (+ [guide/](./guide/) chapters)  
- [GAP_ASSESSMENT.md](./GAP_ASSESSMENT.md)  
- [ENTERPRISE_ROADMAP.md](./ENTERPRISE_ROADMAP.md)  
- [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)  
- [CHANGELOG.md](./CHANGELOG.md) — shipped summary  
- [PRODUCTION.md](./PRODUCTION.md) — TLS + CI  
- [NOTIFICATIONS.md](./NOTIFICATIONS.md) — digests  
- [sops/11-admin-configuration.md](./sops/11-admin-configuration.md)  
- [INTEGRATIONS_EMAIL.md](./INTEGRATIONS_EMAIL.md) — email + omnichannel channel stamp  
- [INTEGRATIONS_SLACK_TEAMS.md](./INTEGRATIONS_SLACK_TEAMS.md)  
- [INTEGRATIONS_OUTBOUND_WEBHOOKS.md](./INTEGRATIONS_OUTBOUND_WEBHOOKS.md)  

---

## Org note — Omnichannel channel (M10)

Tickets carry `channel` (`web` | `email` | `slack` | `teams` | `chat` | `api`) and optional `channelMeta` (JSON). Portal/API creates default to **web**; Slack/Teams/chat simulate and email inbound stamp their channel. List/detail show a channel badge; staff can filter by channel; CSV exports include `channel`.
