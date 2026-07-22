# LogIT — Gap Assessment vs PRD v2.0 / Technical Feature Roadmap

Honest status after competitive PRD V.20 (Notion), **Product Requirements Document – ITSM Platform** PDF, and **Technical Feature Roadmap** PDF.

**Sources:** [Notion New PRD V.20](https://cliff-seeker-02f.notion.site/New-PRD-V-20-39c9521ce1f480469374dfe64329a26c) · local PDFs · [ENTERPRISE_ROADMAP.md](./ENTERPRISE_ROADMAP.md) · [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) · [DEVELOPMENT_TODO.md](./DEVELOPMENT_TODO.md)

**Last updated:** 2026-07-22

**Verdict:** LogIT is a **strong modular-monolith ITSM platform** through **M10** — tickets (watchers, work logs, MI, channel metadata), RBAC, SLA worker, skills/workload routing, knowledge, catalog dynamic forms, assets, multi-step approvals, audit, email/IMAP + Slack/Teams intake, presence, queue/Kanban, Problem/Change/CAB UX, MI dashboard, SSO/MFA, stage analytics, digests, heatmaps/scheduled exports, signed outbound webhooks, CI + TLS. It is **not** yet ServiceNow/Jira SM complete — remaining gaps are CMDB discovery/relationships, AI assists, knowledge deflection analytics, portal themes, and immutable audit export schedules (L1–L5).

---

## Snapshot — shipped vs pending

### Shipped (usable now)

| Capability | Notes |
| --- | --- |
| Core tickets | Lifecycle, assign, comments, attachments, soft-delete, TTR timers, optimistic locking |
| Parent / child | Link API + detail UI |
| Ticket merge | `POST /tickets/:id/merge`, status `merged` |
| Locations | Admin UI `/app/admin/locations`, ticket origin site, list filter, reports `byLocation` |
| Departments | Admin UI `/app/admin/departments` create/edit/soft-deactivate |
| Roles & Access | Matrix + extras; user home `locationId` |
| Teams admin | Create/edit/members |
| Routing & SLA admin | Policies + assignment rules UI; skills + least-open auto-assign |
| Catalog + dynamic forms | Browse → request; per-item `formSchema`; validate + persist answers |
| Email I/O | SMTP outbound + inbound webhook + IMAP UNSEEN poll + Message-ID threading |
| Slack / Teams | Webhooks + simulate + Bot Framework JWT + Slack HMAC; channel stamp |
| Omnichannel channel | `Ticket.channel` (`web` \| `email` \| `slack` \| `teams` \| `chat` \| `api`) + badge/filter |
| Assets register | CRUD, retire, CSV, ticket link |
| Knowledge | Rich HTML, media, attachments, publish |
| Reports | Summary, CSV/PDF, workspace KPIs, byLocation, heatmap, stage bottlenecks, scheduled exports |
| Branding / audit | Logo/banner admin; filtered audit trail |
| **Watchers** | API + Watch/Unwatch UI; fan-out on comment + status |
| **Work logs** | API + agent UI on ticket detail |
| **Major incident** | Flag, badge, list filter, `/app/major-incidents` ops dashboard |
| Collision / presence | Redis (+ memory fallback); viewing/composing on ticket detail |
| Agent queue / Kanban | `/app/queue` board + workload; drag status (transition-aware) |
| Problem / Change / CAB | `/app/problems`, `/app/changes`; RCA / plan fields; Submit to CAB → Approvals |
| Approvals | Queue + decide + multi-step policies (`/app/admin/approvals`) |
| SSO / MFA | TOTP MFA (Profile) + optional Microsoft Entra OIDC |
| Notifications | Bell + inbox + prefs + digests (daily/weekly, quiet hours) |
| Outbound webhooks | HMAC-signed endpoints; Admin → Integrations |
| Prod TLS / CI | GitHub Actions CI; Nginx TLS + Let's Encrypt script |

### Pending (Later / strategic — L1–L5)

| Priority | Item | Notes |
| --- | --- | --- |
| **Later** | CMDB discovery / CI relationships | Asset register MVP+ shipped |
| **Strategic** | AI assists | Classify, summarize, duplicate, SLA risk |
| **Later** | Knowledge deflection analytics | Rich KB shipped |
| **Later** | Portal themes | Branding logo/banner shipped |
| **Later** | Immutable audit export schedules | Filtered audit UI shipped |
| **Polish** | Retry worker for outbound webhooks | Deliveries logged; no auto-retry |
| **Polish** | Soft-deactivate UX / full org tree designer | Soft-deactivate works; designer later |
| **Polish** | Business-hour calendars / advanced SLA dashboards | SLA engine + stage bottlenecks shipped |

---

## Capability matrix (PRD + tech roadmap)

| Area | Done in LogIT | Pending vs new PRD / tech roadmap | Priority |
| --- | --- | --- | --- |
| Ticket create / list / detail | Lifecycle, assign, comments, attachments, soft-delete, TTR, origin location, channel | Richer bulk actions | Low |
| Ticket event / status history | `TicketHistory` + audit; stage duration on detail | Formal event bus polish | Low |
| Stage-duration analytics | Reports → Stage bottlenecks + stuck list; detail bars | Custom ops widgets | Low |
| Parent / child tickets | **Done** (link API + UI) | Parent-resolve child actions polish | Low |
| Ticket merge / duplicates | **Done** (`POST /tickets/:id/merge`) | AI duplicate detection | Later |
| Watchers | API + UI + notify on comment/status | — | Done |
| Work logs (time spent) | API + agent UI | Reporting rollups depth | Low |
| Collision detection / agent presence | Viewing/composing presence on detail | WebSocket push polish | Low |
| Agent workspace / queue boards | Home KPIs + `/app/queue` Kanban + workload | Saved board presets | Low |
| SLA engine | Policies, instances, pause, escalations, worker, UI timers | Business-hour calendars polish | Medium |
| SLA / assignment **admin UI** | **Done** (`/app/admin/routing`) | Visual rule designer later | Done MVP |
| Automated routing | Category/type/location → team; skills + least-open auto-assign | Dynamic auto-tagging | Low |
| Approvals | Queue + decide + multi-step policies | Visual policy designer | Done MVP |
| Service catalog | Browse + create + dynamic forms + one-click request | Guided resolution flows | Low |
| Knowledge | Rich HTML, media, attachments, publish | Deflection analytics, AI search | Later |
| Assets / CMDB | Register CRUD, retire, CSV, ticket link | Discovery, CI relationships, impact | Later |
| Problem management | `/app/problems`, RCA fields, Under investigation / Known error | Deeper problem records | Done MVP |
| Change management | `/app/changes`, plan/rollback/schedule, CAB submit | Full CAB calendar | Done MVP |
| Major incident | Flag + badge + filter + `/app/major-incidents` | Related grouping polish | Done MVP |
| Email-to-ticket / outbound | SMTP + inbound webhook + IMAP + threading | ESP marketplace packs | Done MVP |
| Slack / Teams | HMAC + Bot Framework JWT + simulate | Outbound bot replies | Low |
| Omnichannel source model | `channel` + `channelMeta` on tickets | Voice/portal widgets | Later |
| Notifications | In-app + prefs + email + digests + watcher fan-out | Push / paging | Later |
| Reporting | Summary, CSV/PDF, heatmap, schedules, stage bottlenecks | Custom dashboards | Medium |
| RBAC / Roles & Access | Full matrix + extras; sysadmin = all | Fine-grained custom roles UX | Low |
| Org / teams / locations / depts | Locations + Departments + Teams admin | Full org tree designer | Low |
| Branding | Login logo/banner admin | Portal themes | Later |
| Audit | Filtered trail UI + CSV | Immutable export schedules | Later |
| API / webhooks out | Signed outbound HMAC | Retry worker / marketplace | Medium |
| SSO / MFA | TOTP MFA + optional Entra OIDC | SAML / more IdPs | Low |
| AI assists | — | Classify, summarize, duplicate, SLA risk | Strategic |
| Self-hosting / deploy | Docker Compose, Render-aware, **CI + Nginx TLS** | Multi-node / LE renew cron polish | Medium |

---

## Module matrix (implementation depth)

| Module | Backend | UI browse | UI create/manage | Gap severity |
| --- | --- | --- | --- | --- |
| Auth / sessions / MFA / SSO | Done | Login + Entra button | TOTP setup on Profile | Low |
| RBAC | Done | Roles & Access | Assign + extras + home location | Low |
| Org / locations | Done | Locations admin | Create / edit / soft-deactivate | Low |
| Org / departments | Done | Departments admin | Create / edit / soft-deactivate | Low |
| Org / teams | Done | Teams admin | Create/edit/members | Low |
| Tickets | Done | List + detail + TTR + location + channel | Create, lifecycle, assign, origin site | Low |
| Watchers | Done | Detail Watch/Unwatch | Fan-out notifications | Low |
| Work logs | Done | Detail work-log panel | Add minutes + notes | Low |
| Major incident | Done | Badge + filter + MI dashboard | Toggle on detail | Low |
| Presence | Done | Detail banners | Viewing / composing | Low |
| Queue / Kanban | Done | `/app/queue` | Drag status + workload | Low |
| Problem / Change | Done | `/app/problems`, `/app/changes` | Raise + CAB request | Low |
| Parent / child | Done | On detail | Link / unlink / create child | Low |
| Ticket merge | Done | On detail | Merge sources → primary | Low |
| Attachments | Done | Create + detail | Upload | Low (durable storage) |
| Comments / notes | Done | Detail | Public + internal | Low |
| Approvals | Done | Queue + Admin policies | Decide + multi-step config | Low |
| Knowledge | Rich text + attach | Browse / article | Create / edit / publish | Low |
| Catalog + request | List + formSchema + request | Browse + form | One-click / dynamic form → ticket | Low |
| Assets | Register MVP+ | Register | CRUD / retire / CSV | Low |
| Reports | Summary + heatmap + schedules + stages | Home + Reports | CSV/PDF + schedules | Low |
| SLA admin | Policies API | Admin Routing & SLA | Create policy | Low |
| Assignment admin | Rules + skills API | Admin Routing & SLA | Create rule + skills | Low |
| Integrations | Slack/Teams + email/IMAP + outbound webhooks | Hub (status + URLs + webhooks) | Env secrets + endpoint CRUD | Low |
| Branding | Done | Admin | Logo / banner | Low |
| Notifications | In-app + email + digests | Bell + inbox + Profile prefs | Digests + quiet hours | Low |

---

## Tech roadmap sprint alignment

Recommended order from **Technical Feature Roadmap** — **N1–N5, H1–H7, and M1–M10 are shipped.** Remaining work:

1. ~~Sprint 1–2: Event/history / stage duration~~ *(shipped)*  
2. ~~Sprint 3: Parent/child, merge~~ *(shipped)*  
3. ~~Sprint 4–5: Collision detection, agent presence, queue boards~~ *(shipped)*  
4. ~~Sprint 6–7: Ops dashboard, bottleneck/SLA analytics, heatmaps~~ *(shipped)*  
5. ~~Sprint 8–9: Major incident ops~~ *(shipped)*; duplicate/recurring detection → **Later / AI**  
6. ~~Sprint 10–11: Smart routing, email/omnichannel~~ *(shipped)*  
7. **Sprint 12+:** Knowledge deflection, AI foundation (**L2–L3**); CMDB depth (**L1**)

**What’s next:** Later / strategic items in [DEVELOPMENT_TODO.md](./DEVELOPMENT_TODO.md) (**L1–L5**).

Principle: **Capture data → workflows → real-time → analytics → automation → AI.**

---

## Sysadmin completeness

- Seed: `sysadmin` → all shared permissions.  
- UI: Roles, Locations, **Departments**, Teams, Integrations (email/IMAP/chat/outbound webhooks), Branding, Routing & SLA (skills), Approval policies, tickets, queue, problems/changes, major incidents, knowledge, catalog, assets, reports (heatmap + schedules), audit, approvals, Profile MFA.  
- Soft-delete tickets: sysadmin / IT manager elevated paths.

---

## What improved recently (through M10)

- Near-term: watchers/worklogs UI, MI badge/filter, departments admin, watcher notifications.  
- High: presence, queue/Kanban, Problem/Change/CAB, MI dashboard, SSO/MFA, stage analytics.  
- Medium M1–M10: IMAP + threading, skills/workload routing, multi-step approvals, catalog forms, signed webhooks, CI/TLS, Slack HMAC + Teams JWT, notification digests, reporting heatmaps + scheduled exports, ticket channel metadata.
