# LogIT — Gap Assessment vs PRD v2.0 / Technical Feature Roadmap

Honest status after competitive PRD V.20 (Notion), **Product Requirements Document – ITSM Platform** PDF, and **Technical Feature Roadmap** PDF.

**Sources:** [Notion New PRD V.20](https://cliff-seeker-02f.notion.site/New-PRD-V-20-39c9521ce1f480469374dfe64329a26c) · local PDFs · [ENTERPRISE_ROADMAP.md](./ENTERPRISE_ROADMAP.md) · [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)

**Last updated:** 2026-07-21

**Verdict:** LogIT is a **strong modular-monolith ITSM MVP** (tickets, RBAC, SLA worker, assignment, knowledge, catalog, assets, approvals, audit, chat + email intake, locations admin, watchers/worklogs APIs, major-incident flag). It is **not** yet ServiceNow/Jira SM complete — missing dedicated Problem/Change workflows, MI ops dashboard, collision detection, stage-analytics depth, and AI.

---

## Snapshot — shipped vs pending

### Shipped (usable now)

| Capability | Notes |
| --- | --- |
| Core tickets | Lifecycle, assign, comments, attachments, soft-delete, TTR timers, optimistic locking |
| Parent / child | Link API + detail UI |
| Ticket merge | `POST /tickets/:id/merge`, status `merged` |
| Locations | Admin UI `/app/admin/locations`, ticket origin site, list filter, reports `byLocation` |
| Roles & Access | Matrix + extras; user home `locationId` |
| Teams admin | Create/edit/members |
| Routing & SLA admin | Policies + assignment rules UI |
| Catalog one-click request | Browse → ticket |
| Email I/O | SMTP outbound + inbound webhook MVP |
| Slack / Teams | Webhooks + simulate + Bot Framework JWT + Slack HMAC |
| Assets register | CRUD, retire, CSV, ticket link |
| Knowledge | Rich HTML, media, attachments, publish |
| Reports | Summary, CSV, workspace KPIs, location breakdown |
| Branding / audit | Logo/banner admin; filtered audit trail |
| **Watchers** | API `POST/DELETE /tickets/:id/watch` |
| **Work logs** | API `GET/POST /tickets/:id/work-logs` |
| **Major incident flag** | `majorIncident` on create/update + list filter; statuses for investigation / change-ish flows |

### Pending (next / later)

| Priority | Item | Notes |
| --- | --- | --- |
| **High** | Watchers + work-log **UI** | Backend ready; wire detail page + notifications to watchers |
| **High** | Major-incident **ops UX** | Flag exists; need badge/filter UI, MI dashboard, related grouping polish |
| **High** | Collision detection / agent presence | Real-time viewing/composing |
| **High** | Agent queue boards / workload | Kanban / pipeline beyond Home KPIs |
| **High** | Problem / Change workflows | Types seeded; dedicated records + CAB later |
| **High** | SSO / MFA | Session + Argon2 today; Entra/SAML + MFA UX |
| **Critical** | Stage-duration analytics depth | History exists; ops columns / bottleneck engine |
| **Medium** | IMAP poller, richer email threading | Webhook inbound works |
| **Medium** | Skills / workload-aware routing | Category/location rules exist |
| **Medium** | Approval config / multi-step | Queue + decide works |
| **Medium** | Catalog dynamic forms | One-click request works |
| **Medium** | Signed outbound webhooks | **Done MVP** (HMAC + Admin Integrations) |
| **Medium** | Prod TLS / CI automation | **Done** (GitHub Actions + Nginx TLS / LE script) |
| **Later** | CMDB discovery / CI relationships | Asset register MVP+ shipped |
| **Strategic** | AI assists | Classify, summarize, duplicate, SLA risk |

---

## Capability matrix (PRD + tech roadmap)

| Area | Done in LogIT | Pending vs new PRD / tech roadmap | Priority |
| --- | --- | --- | --- |
| Ticket create / list / detail | Lifecycle, assign, comments, attachments, soft-delete, TTR, origin location | Richer filters, bulk actions | Low |
| Ticket event / status history | `TicketHistory` + audit on mutations | Formal event bus; richer timeline UX | **Critical** (tech Sprint 1–2) |
| Stage-duration analytics | Partial (history timestamps exist) | Stage duration engine + ops dashboard columns | **Critical** |
| Parent / child tickets | **Done** (link API + UI) | Parent-resolve child actions, MI grouping polish | High polish |
| Ticket merge / duplicates | **Done** (`POST /tickets/:id/merge`) | Later AI duplicate detection | Done MVP |
| Watchers | **API done** | Detail UI + notify watchers on updates | High |
| Work logs (time spent) | **API done** | Agent UI + reporting rollups | High |
| Collision detection / agent presence | — | Real-time “viewing/composing” + presence | High |
| Agent workspace / queue boards | Home KPI strip + recent queue TTR | Kanban/pipeline boards, workload views | High |
| SLA engine | Policies, instances, pause, escalations, worker, UI timers | Business-hour calendars polish, advanced SLA dashboard | Medium |
| SLA / assignment **admin UI** | **Done** (`/app/admin/routing`) | Visual rule designer later | Done MVP |
| Automated routing | Category/type/location → team rules | Skills / workload-aware routing | Medium → Later |
| Approvals | Queue + decide for service/access | Admin approval config, multi-step | Medium |
| Service catalog | Browse + create items | Dynamic forms | Medium |
| Catalog → one-click request | **Done** | Form schemas per item | Done MVP |
| Knowledge | Rich HTML, media, attachments, publish | Deflection analytics, AI search | Low → Later |
| Assets / CMDB | Register CRUD, retire, CSV, ticket link | Discovery, CI relationships, impact | Medium / Later |
| Problem management | Type `problem` + statuses seeded | Dedicated Problem workflow / records | High (PRD) |
| Change management | Type `change` + statuses seeded | Change enablement workflow / CAB | High (PRD) |
| Major incident | **Flag + API filter** (`majorIncident`) | MI dashboard, badge/filter UI, related grouping | High |
| Email-to-ticket / outbound | **Done MVP** (SMTP + inbound webhook) | IMAP poller, richer threading | Done MVP |
| Slack / Teams | Webhooks + simulate + **Bot Framework JWT** + Slack HMAC | Channel endorsements / outbound replies | Low |
| Omnichannel source model | Web + chat + email intake | Unified channel metadata on tickets | Medium |
| Notifications | In-app + preferences + **email delivery** | Digests; watcher fan-out | Medium |
| Reporting | Summary, CSV, workspace KPIs, byLocation | Stage/bottleneck/SLA heatmaps, scheduled | Medium |
| RBAC / Roles & Access | Full matrix + extras; sysadmin = all | Fine-grained custom roles UX polish | Low |
| Org / teams / locations | API + Teams + **Locations admin** + ticket origin | Soft-deactivate UX polish | Done MVP |
| Branding | Login logo/banner admin | Portal themes | Low |
| Audit | Filtered trail UI | Immutable export schedules | Low |
| API / webhooks out | **Done MVP** (signed outbound) | Retry worker / marketplace | Medium |
| SSO / MFA | Session + Argon2 | Entra/SAML, MFA UX | High (identity) |
| AI assists | — | Classify, summarize, duplicate, SLA risk (Phase 3+) | Strategic |
| Self-hosting / deploy | Docker Compose, Render-aware, **CI + Nginx TLS** | Scheduled LE renew polish / multi-node | Medium |

---

## Module matrix (implementation depth)

| Module | Backend | UI browse | UI create/manage | Gap severity |
| --- | --- | --- | --- | --- |
| Auth / sessions | Done | Login | Password reset API; MFA later | Medium |
| RBAC | Done | Roles & Access | Assign + extras + home location | Low |
| Org / locations | Done | **Locations admin** | Create / edit / soft-deactivate | Low |
| Org / teams | Done | Teams admin | Create/edit/members | Low |
| Tickets | Done | List + detail + TTR + location | Create, lifecycle, assign, origin site | Low |
| Watchers | Done | — | API only | Medium |
| Work logs | Done | — | API only | Medium |
| Major incident | Flag + filter | — | API / PATCH; UI pending | Medium |
| Parent / child | Done | On detail | Link / unlink / create child | Low |
| Ticket merge | Done | On detail | Merge sources → primary | Low |
| Attachments | Done | Create + detail | Upload | Low (durable storage) |
| Comments / notes | Done | Detail | Public + internal | Low |
| Approvals | Done | Queue | Decide; no config UI | Medium |
| Knowledge | Rich text + attach | Browse / article | Create / edit / publish | Low |
| Catalog + request | List + create + request | Browse | One-click → ticket | Low |
| Assets | Register MVP+ | Register | CRUD / retire / CSV | Low |
| Reports | Summary + CSV + workspace | Home + Reports | Limited polish | Medium |
| SLA admin | Policies API | **Admin Routing & SLA** | Create policy | Low |
| Assignment admin | Rules API | **Admin Routing & SLA** | Create rule | Low |
| Integrations | Slack/Teams + **email SMTP/inbound** | Hub (status + inbound URL) | Env secrets | Low |
| Branding | Done | Admin | Logo / banner | Low |
| Email / SSO / Problem / Change / AI | Email MVP done; rest partial/none | Email on Integrations | — | Medium–High |

---

## Tech roadmap sprint alignment

Recommended order from **Technical Feature Roadmap** (do not boil the ocean):

1. **Sprint 1–2:** Event/history foundation, timeline, stage duration *(history exists; deepen analytics)*  
2. **Sprint 3:** Parent/child *(done)*, related tickets, **merge** *(done)*  
3. **Sprint 4–5:** Collision detection, agent presence, workload  
4. **Sprint 6–7:** Ops dashboard, bottleneck/SLA analytics  
5. **Sprint 8–9:** Major incident **ops** (flag done → dashboard/UI), duplicate/recurring detection  
6. **Sprint 10–11:** Smart routing, email/omnichannel polish *(email MVP done)*  
7. **Sprint 12+:** Knowledge deflection, AI foundation  

**Near-term product polish (this codebase):** watchers/worklogs UI · major-incident badge/filter UI · watcher notifications.

Principle: **Capture data → workflows → real-time → analytics → automation → AI.**

---

## Sysadmin completeness

- Seed: `sysadmin` → all shared permissions.  
- UI: Roles, **Locations**, Teams, Integrations, Branding, Routing & SLA, tickets, knowledge, catalog, assets, reports, audit, approvals.  
- Soft-delete tickets: sysadmin / IT manager elevated paths.

---

## What improved recently

- Asset register, roles radio + extra permissions, reports export, SLA TTR timers, branding, knowledge rich text, lucide icons, audit filters, teams admin, Slack/Teams intake.  
- Email inbound webhook + SMTP outbound (nodemailer), Integrations email status.  
- Ticket merge, parent/child, catalog request, Routing & SLA admin, stage duration.  
- **Latest:** Locations admin + ticket origin site; watcher / work-log / major-incident **APIs** (migration + service methods); problem/change-friendly statuses seeded.
