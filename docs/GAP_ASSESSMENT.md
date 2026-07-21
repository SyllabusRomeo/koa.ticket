# LogIT — Gap Assessment vs PRD v2.0 / Technical Feature Roadmap

Honest status after competitive PRD V.20 (Notion), **Product Requirements Document – ITSM Platform** PDF, and **Technical Feature Roadmap** PDF.

**Sources:** [Notion New PRD V.20](https://cliff-seeker-02f.notion.site/New-PRD-V-20-39c9521ce1f480469374dfe64329a26c) · local PDFs · [ENTERPRISE_ROADMAP.md](./ENTERPRISE_ROADMAP.md) · [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)

**Verdict:** LogIT is a **strong modular-monolith ITSM MVP** (tickets, RBAC, SLA worker, assignment, knowledge, catalog, assets, approvals, audit, chat intake, email I/O). It is **not** yet ServiceNow/Jira SM complete — missing dedicated Problem/Change, stage-duration analytics depth, collision detection, and AI.

---

## Capability matrix (PRD + tech roadmap)

| Area | Done in LogIT | Pending vs new PRD / tech roadmap | Priority |
| --- | --- | --- | --- |
| Ticket create / list / detail | Lifecycle, assign, comments, attachments, soft-delete, TTR timers | Richer filters, bulk actions | Low |
| Ticket event / status history | `TicketHistory` + audit on mutations | Formal event bus; richer timeline UX | **Critical** (tech Sprint 1–2) |
| Stage-duration analytics | Partial (history timestamps exist) | Stage duration engine + ops dashboard columns | **Critical** |
| Parent / child tickets | **Done** (link API + UI) | Parent-resolve child actions, major-incident grouping | High polish |
| Ticket merge / duplicates | **Done** (`POST /tickets/:id/merge`, `mergedIntoId`, status `merged`) | Later AI duplicate detection | High → Done MVP |
| Collision detection / agent presence | — | Real-time “viewing/composing” + presence | High |
| Agent workspace / queue boards | Home KPI strip + recent queue TTR | Kanban/pipeline boards, workload views | High |
| SLA engine | Policies, instances, pause, escalations, worker, UI timers | Business-hour calendars polish, advanced SLA dashboard | Medium |
| SLA / assignment **admin UI** | **Shipping this pass** | Visual rule designer later | High → Done MVP |
| Automated routing | Category/type/location → team rules | Skills / workload-aware routing | Medium → Later |
| Approvals | Queue + decide for service/access | Admin approval config, multi-step | Medium |
| Service catalog | Browse + create items | Dynamic forms | Medium |
| Catalog → one-click request | **Shipping this pass** | Form schemas per item | High → Done MVP |
| Knowledge | Rich HTML, media, attachments, publish | Deflection analytics, AI search | Low → Later |
| Assets / CMDB | Register CRUD, retire, CSV, ticket link | Discovery, CI relationships, impact | Medium / Later |
| Problem management | Type `problem` seeded | Dedicated Problem workflow / records | High (PRD) |
| Change management | Type `change` seeded | Change enablement workflow / CAB | High (PRD) |
| Major incident | — | MI dashboard, related grouping | High |
| Email-to-ticket / outbound | **Done MVP** (SMTP nodemailer + inbound webhook) | IMAP poller, richer threading | High → Done MVP |
| Slack / Teams | First-cut webhooks + simulate + admin hub | Full Bot Framework JWT | Medium |
| Omnichannel source model | Web + chat + email intake | Unified channel metadata on tickets | Medium |
| Notifications | In-app + preferences + **email delivery** | Digest / digests schedules | High → Done MVP |
| Reporting | Summary, CSV, workspace KPIs | Stage/bottleneck/SLA heatmaps, scheduled | Medium |
| RBAC / Roles & Access | Full matrix + extras; sysadmin = all | Fine-grained custom roles UX polish | Low |
| Org / teams / locations | API + Teams + **Locations admin** + ticket origin | Soft-deactivate UX polish | Low → Done MVP |
| Branding | Login logo/banner admin | Portal themes | Low |
| Audit | Filtered trail UI | Immutable export schedules | Low |
| API / webhooks out | REST session API | Signed outbound webhooks | Medium |
| SSO / MFA | Session + Argon2 | Entra/SAML, MFA UX | High (identity) |
| AI assists | — | Classify, summarize, duplicate, SLA risk (Phase 3+) | Strategic |
| Self-hosting / deploy | Docker Compose, Render-aware | Prod TLS/CI automation | Medium |

---

## Module matrix (implementation depth)

| Module | Backend | UI browse | UI create/manage | Gap severity |
| --- | --- | --- | --- | --- |
| Auth / sessions | Done | Login | Password reset API; MFA later | Medium |
| RBAC | Done | Roles & Access | Assign + extras | Low |
| Org / teams | Done | Teams admin | Create/edit/members | Low |
| Tickets | Done | List + detail + TTR | Create, lifecycle, assign | Low |
| Parent / child | Done | On detail | Link / unlink / create child | Low |
| Ticket merge | Done | On detail | Merge sources → primary | Low |
| Attachments | Done | Create + detail | Upload | Low (durable storage) |
| Comments / notes | Done | Detail | Public + internal | Low |
| Approvals | Done | Queue | Decide; no config UI | Medium |
| Knowledge | Rich text + attach | Browse / article | Create / edit / publish | Low |
| Catalog + request | List + create + **request** | Browse | One-click → ticket | Low |
| Assets | Register MVP+ | Register | CRUD / retire / CSV | Low |
| Reports | Summary + CSV + workspace | Home + Reports | Limited polish | Medium |
| SLA admin | Policies API | **Admin Routing & SLA** | Create policy | Low |
| Assignment admin | Rules API | **Admin Routing & SLA** | Create rule | Low |
| Integrations | Slack/Teams + **email SMTP/inbound** | Hub (status + inbound URL) | Env secrets | Low |
| Branding | Done | Admin | Logo / banner | Low |
| Email / SSO / Problem / Change / AI | Email MVP done; rest partial/none | Email on Integrations | — | Medium (SSO/Problem/Change/AI) |

---

## Tech roadmap sprint alignment

Recommended order from **Technical Feature Roadmap** (do not boil the ocean):

1. **Sprint 1–2:** Event/history foundation, timeline, stage duration *(history exists; stage UI shipping)*  
2. **Sprint 3:** Parent/child *(done)*, related tickets, **merge** *(done)*  
3. **Sprint 4–5:** Collision detection, agent presence, workload  
4. **Sprint 6–7:** Ops dashboard, bottleneck/SLA analytics  
5. **Sprint 8–9:** Major incident, duplicate/recurring detection  
6. **Sprint 10–11:** Smart routing, email/omnichannel  
7. **Sprint 12+:** Knowledge deflection, AI foundation  

Principle: **Capture data → workflows → real-time → analytics → automation → AI.**

---

## Sysadmin completeness

- Seed: `sysadmin` → all shared permissions.  
- UI: Roles, Teams, Integrations, Branding, Routing & SLA, tickets, knowledge, catalog, assets, reports, audit, approvals.  
- Soft-delete tickets: sysadmin / IT manager elevated paths.

---

## What improved recently

- Asset register, roles radio + extra permissions, reports export, SLA TTR timers, branding, knowledge rich text, lucide icons, audit filters, teams admin, Slack/Teams intake.  
- **This pass:** Email inbound webhook + SMTP outbound (nodemailer), Integrations email status. Prior: ticket merge, parent/child, catalog request, Routing & SLA admin, stage duration.
