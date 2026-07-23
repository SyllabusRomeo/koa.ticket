# LogIT — Gap Assessment vs PRD v2.0 / Technical Feature Roadmap

Honest status after competitive PRD V.20 (Notion), **Product Requirements Document – ITSM Platform** PDF, and **Technical Feature Roadmap** PDF.

**Sources:** [Notion New PRD V.20](https://cliff-seeker-02f.notion.site/New-PRD-V-20-39c9521ce1f480469374dfe64329a26c) · local PDFs · [ENTERPRISE_ROADMAP.md](./ENTERPRISE_ROADMAP.md) · [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) · [DEVELOPMENT_TODO.md](./DEVELOPMENT_TODO.md)

**Last updated:** 2026-07-23

**Verdict:** LogIT is a **strong modular-monolith ITSM platform** through **L5** — tickets, RBAC (roles/extras), org admin (including Users create/deactivate), SLA/routing, knowledge, catalog forms, assets/CMDB relations, approvals, audit + immutable export schedules, email/IMAP + Slack/Teams, presence, queue/Kanban, Problem/Change/CAB, MI dashboard, SSO/MFA, analytics/digests/heatmaps, webhooks, CI/TLS, AI assists, KB deflection, portal themes. It is **not** yet ServiceNow/Jira SM complete. Remaining work is polish (webhook retries, SAML, bot outbound, etc.).

---

## Snapshot — shipped vs pending

### Shipped (usable now)

| Capability | Notes |
| --- | --- |
| Core tickets | Lifecycle, assign, comments, attachments, soft-delete, TTR, optimistic locking |
| Parent / child · merge | Link API + UI; merge with `merged` status |
| Locations · Departments · Teams · Users | Full admin UIs (create/edit/soft-deactivate; Users + Roles & Access) |
| Roles & Access | Matrix + extras + home location |
| Routing & SLA · skills | Policies + assignment rules; least-open auto-assign |
| Catalog + dynamic forms | Browse → request; `formSchema` validate + persist |
| Email / Slack / Teams | SMTP + inbound + IMAP threading; HMAC + Bot Framework JWT; channel stamp |
| Assets / CMDB | Register CRUD + relations + impact + discovery CSV |
| Knowledge + deflection | Rich HTML; view/helpful/deflected; Reports panel |
| Reports | Summary, CSV/PDF, heatmap, stages, scheduled exports |
| Audit | Filtered UI + CSV + **immutable scheduled exports (SHA-256 runs)** |
| Branding / portal themes | Logo/banner + theme presets/custom CSS vars |
| Watchers · work logs · MI | Detail UI + MI ops dashboard |
| Presence · queue / Kanban | Redis (+ memory fallback); `/app/queue` |
| Problem / Change / CAB | Dedicated pages + CAB → Approvals |
| Approvals | Queue + multi-step policies |
| SSO / MFA | TOTP + optional Entra OIDC |
| Notifications | Bell + inbox + prefs + digests |
| Outbound webhooks · CI/TLS | HMAC endpoints; GitHub Actions; Nginx TLS docs |
| AI assists | Classify / summarize / duplicates / SLA risk (+ optional OpenAI) |

### Pending / gaps

| Priority | Item | Notes |
| --- | --- | --- |
| **Polish** | Retry worker for outbound webhooks | Deliveries logged; no auto-retry |
| **Polish** | Soft-deactivate UX / full org tree designer | Soft-deactivate works; designer later |
| **Polish** | Business-hour calendars / advanced SLA dashboards | SLA engine + stage bottlenecks shipped |
| **Polish** | SAML / more IdPs · bot outbound replies · board presets | Documented optional follow-ons |
| **Polish** | Voice / portal widgets · push/paging | Omnichannel web/email/chat only |

---

## Capability matrix (PRD + tech roadmap)

| Area | Done in LogIT | Pending vs PRD / roadmap | Priority |
| --- | --- | --- | --- |
| Ticket lifecycle | Full + channel + merge + parent/child | Bulk actions polish | Low |
| Watchers / work logs / presence | Done | WebSocket push polish | Low |
| Agent queue / Kanban | `/app/queue` | Saved board presets | Low |
| SLA / routing admin | Done MVP | Business hours · visual designer | Medium |
| Approvals | Multi-step policies | Visual policy designer | Low |
| Catalog / Knowledge | Forms + deflection analytics | Guided resolution · AI search | Low |
| Assets / CMDB | Relations + discovery + impact | Deeper CI class hierarchy | Low |
| Problem / Change / MI | Done MVP | CAB calendar · related grouping polish | Low |
| Email / Slack / Teams | Done MVP | Outbound bot replies · ESP packs | Low |
| Notifications | Digests + quiet hours | Push / paging | Later |
| Reporting | Heatmap + schedules + stages | Custom dashboards | Medium |
| **User provisioning** | **Admin Users UI** + API + seed + Entra SSO | Invite email polish | Low |
| RBAC | Roles & Access matrix + extras | Fine-grained custom role editor | Low |
| Org | Locations · Depts · Teams | Org tree designer | Low |
| Branding | Themes + logo/banner | — | Done |
| Audit | Filtered UI + CSV + **immutable schedules (L5)** | — | Done |
| Webhooks out | HMAC signed | Retry worker | Medium |
| SSO / MFA | TOTP + Entra | SAML / more IdPs | Low |
| AI assists | Heuristic + optional OpenAI | Draft replies depth | Low |
| Self-hosting | Docker · CI · TLS docs | Multi-node / renew cron polish | Medium |

---

## Module matrix (implementation depth)

| Module | Backend | UI browse | UI create/manage | Gap severity |
| --- | --- | --- | --- | --- |
| Auth / MFA / SSO | Done | Login + Entra | Profile TOTP | Low |
| **Users** | **List / get / create / update / setAccess** | `/app/admin/users` | Create / edit / deactivate | Low |
| RBAC | Done | Roles & Access | Assign role + extras + location | Low |
| Org (loc/dept/team) | Done | Admin pages | Create/edit/deactivate | Low |
| Tickets (+ watchers/worklogs/MI) | Done | List/detail/queues | Create + lifecycle | Low |
| Presence / Kanban | Done | Detail + `/app/queue` | Drag status | Low |
| Problem / Change | Done | Dedicated pages | Raise + CAB | Low |
| Approvals | Done | Queue + policies | Decide + config | Low |
| Knowledge | Done | Browse + deflection metrics | CRUD + feedback | Low |
| Catalog | Done | Browse | Dynamic forms | Low |
| Assets / CMDB | Done | Register + relations | CRUD + discovery | Low |
| Reports | Done | Hub | CSV/PDF + schedules | Low |
| SLA / assignment | Done | Routing & SLA | Policies + skills | Low |
| Integrations | Done | Hub | Env + webhook CRUD | Low |
| Branding / themes | Done | Admin | Logo/banner/theme | Low |
| Notifications | Done | Bell + Profile | Digests | Low |
| Audit | Done | Filtered trail + CSV + schedules | Checksummed runs | Low |
| AI | Done | Create + detail assists | Suggest-only | Low |

---

## User management — detailed finding (2026-07-23, updated)

| Layer | Status |
| --- | --- |
| API `POST /api/v1/users` | Exists — requires `users:manage` |
| API `PATCH /api/v1/users/:id` | Exists — profile + `isActive` |
| API `PATCH /api/v1/users/:id/roles` | Exists — used by Roles & Access UI |
| Web `api.createUser` / `updateUser` | Shipped |
| Admin → **Users** | Shipped — `/app/admin/users` create / edit / deactivate |
| Roles & Access | Permission matrix for existing users |

---

## Tech roadmap sprint alignment

**N1–N5 · H1–H7 · M1–M10 · L1–L5 are shipped.**

Optional polish: webhook retry, SAML, bot replies, board presets.

Principle: **Capture data → workflows → real-time → analytics → automation → AI.**

---

## Sysadmin completeness

- Seed: `sysadmin` (display **Administrator**) → all shared permissions.  
- UI: Users, Roles & Access, Locations, Departments, Teams, Integrations, Branding (themes), Routing & SLA, Approval policies, tickets/queue/problems/changes/MI, knowledge, catalog, assets, reports, audit (incl. immutable export schedules), Profile MFA.

---

## What improved recently (through L5)

- L5 immutable audit export schedules (SHA-256 runs) · Users admin UI.  
- L1 CMDB relations + discovery · L2 AI assists · L3 KB deflection · L4 portal themes.  
- Prior: M1–M10 omnichannel/digests/heatmaps/webhooks/CI; H1–H7 presence/queue/Problem/Change/SSO; N1–N5 polish.
