# LogIT — Development To-do

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
| H6 | SSO / MFA (Entra/SAML) | `[ ]` | Session + Argon2 today |
| H7 | Stage-duration / bottleneck analytics | `[x]` | Reports → Stage bottlenecks + stuck list; detail bars |

---

## Medium priority

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| M1 | IMAP poller + richer email threading | `[ ]` | Webhook inbound MVP works |
| M2 | Skills / workload-aware routing | `[ ]` | Category/location rules exist |
| M3 | Approval config / multi-step | `[ ]` | Queue + decide works |
| M4 | Catalog dynamic forms | `[ ]` | One-click request works |
| M5 | Signed outbound webhooks | `[ ]` | REST session API only |
| M6 | Prod TLS / CI automation | `[ ]` | Docker/Hetzner scaffold done |
| M7 | Slack/Teams Bot Framework JWT polish | `[ ]` | First-cut webhooks shipped |
| M8 | Notification digests | `[ ]` | After watcher fan-out |
| M9 | Reporting heatmaps / scheduled exports | `[ ]` | Summary + CSV shipped |
| M10 | Omnichannel channel metadata on tickets | `[ ]` | Web + chat + email intake |

---

## Later / strategic

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| L1 | CMDB discovery / CI relationships | `[ ]` | Asset register MVP+ shipped |
| L2 | AI assists | `[ ]` | Classify, summarize, duplicate, SLA risk |
| L3 | Knowledge deflection analytics | `[ ]` | Rich KB shipped |
| L4 | Portal themes | `[ ]` | Branding logo/banner shipped |
| L5 | Immutable audit export schedules | `[ ]` | Filtered audit UI shipped |

---

## Sprint alignment (recommended order)

1. **Near-term:** N1–N5 (this pass)  
2. **Sprint 1–2:** H7 stage/timeline analytics depth  
3. **Sprint 4–5:** H1 collision/presence, H2 queue boards  
4. **Sprint 6–7:** Ops/SLA heatmaps (M9 + H7)  
5. **Sprint 8–9:** H5 MI dashboard, duplicate detection  
6. **Sprint 10–11:** M1–M2 routing/email polish  
7. **Sprint 12+:** L2–L3 AI / deflection  

---

## Org admin note — Departments

**Finding (2026-07-22):** Departments are created via `POST /api/v1/org/departments` and seeded as **Information Technology** (`IT`) and **Operations** (`OPS`). Teams admin can *select* a department when creating a team, but there was **no UI to create/edit departments**.  

**Fix:** Admin → **Departments** (`/app/admin/departments`) — create, edit, soft-deactivate (mirrors Locations).

---

## Related docs

- [GAP_ASSESSMENT.md](./GAP_ASSESSMENT.md)  
- [ENTERPRISE_ROADMAP.md](./ENTERPRISE_ROADMAP.md)  
- [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)  
- [sops/11-admin-configuration.md](./sops/11-admin-configuration.md)  
