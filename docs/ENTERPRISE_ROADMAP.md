# LogIt — Enterprise Roadmap (industry ITSM trajectory)

Honest path from today’s modular-monolith platform toward ServiceNow-class / Zendesk-style service desk capabilities. **Not** a clone of any vendor UI — LogIt keeps its own brand (`#0F4A40`, `#EDF4AC`, `#456433`, `#FBF1DA`).

**Related:** [GAP_ASSESSMENT.md](./GAP_ASSESSMENT.md) · [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) · [DEVELOPMENT_TODO.md](./DEVELOPMENT_TODO.md) · [USER_AND_DEVELOPER_GUIDE.md](./USER_AND_DEVELOPER_GUIDE.md) · [INTEGRATIONS_SLACK_TEAMS.md](./INTEGRATIONS_SLACK_TEAMS.md) · [INTEGRATIONS_EMAIL.md](./INTEGRATIONS_EMAIL.md)

**Last updated:** 2026-07-24 (IMS MVP partial ship · L1–L5 complete)

---

## Industry pillars → Now / Next / Later

Inspired by common service-desk product pillars (omnichannel, ticket management, automation, reporting, integrations, routing, AI, self-service) and the **agent workspace dashboard** pattern (KPI strip → priority/status breakdown → queue).

| Pillar | Now (shipped through L5) | Next (polish + IMS) | Later |
| --- | --- | --- | --- |
| **Omnichannel intake** | Web + Slack/Teams (+ simulate) + email webhook/IMAP + channel metadata (`web`/`email`/`slack`/`teams`/`chat`/`api`) + Bot Framework JWT / Slack HMAC | Channel endorsements / outbound bot replies | Voice/portal widgets |
| **Ticket management** | Lifecycle, assign, comments, attachments, soft-delete, SLA TTR, parent/child, merge, stage duration, origin location, **watchers/worklogs UI**, **MI badge + dashboard**, Problem/Change/CAB | Parent-resolve child actions, bulk actions | Deeper problem/change records |
| **Incident Management System (IMS)** | ITSM tickets + MI ops + **MVP `/app/im` board/timeline** + IM permissions | War-room chrome, PIR export, deeper bridges | External status pages |
| **Agent workspace** | Home KPI dashboard + `/app/queue` Kanban + workload + presence collision | Saved board presets, WebSocket push | Personalized dashboards, saved widgets |
| **Automation / workflows** | Assignment rules (skills + least-open), SLA worker, Routing & SLA admin, email notifications, digests, multi-step approvals, signed outbound webhooks | Webhook retry worker | Visual workflow designer |
| **Routing / tagging** | Category + location + skill rules → team + auto-assign | Dynamic auto-tagging | Marketplace rule packs |
| **Reporting / analytics** | Summary + CSV/PDF + workspace metrics + byLocation + **heatmap** + **scheduled exports** + stage bottlenecks + KB deflection | Custom dashboards | Marketplace analytics |
| **Integrations** | Integrations hub, Slack/Teams + email/IMAP + signed outbound webhooks | More chat channels | Marketplace / plugin packs |
| **Self-service** | Catalog browse + dynamic forms, knowledge + deflection, employee tickets, portal themes | Guided resolution | Portal widgets |
| **Org admin** | Locations + **Departments** + Teams + **Users** + Roles & Access | Soft-deactivate polish | Full org tree designer |
| **Asset / CMDB** | Register + relations + impact BFS + discovery CSV (**L1**) | Deeper CI class hierarchy | Auto-discovery depth |
| **AI assists** | Classify / summarize / duplicates / SLA risk / related KB (**L2**; heuristic + optional OpenAI) | Draft replies depth | Marketplace AI packs |
| **Identity / trust** | Session RBAC, **TOTP MFA**, optional **Microsoft Entra OIDC** | SAML / more IdPs | Advanced Conditional Access hooks |
| **Compliance** | Audit trail + CSV + **immutable export schedules (SHA-256)** (**L5**) | — | Retention / legal hold packs |

### Omnichannel flow (product north star)

```text
Unify channels (web · Slack · Teams · email · chat)
        ↓
Capture request (message / form / attach) — stamp Ticket.channel
        ↓
Create & assign (rules + skills + agent workspace)
        ↓
Track · resolve · learn (SLA, KB, reports, digests)
```

Email = SMTP + inbound webhook + IMAP poller (Message-ID / In-Reply-To threading).

### Agent workspace dashboard pattern

Structure (not visual clone of blue “IT servicedesk” mockups):

1. **KPI strip** — attention metrics with emphasis on overdue / unassigned  
2. **Breakdown panels** — by priority + by status (simple bars)  
3. **Queue / recent** — jump into work (`/app/queue` Kanban)  
4. **CTAs** — New ticket, Unassigned, Approvals, Major incidents  

**Resolved vs Closed:** Home / Reports “Resolved today” counts tickets with `resolvedAt` set today (Resolved status), not Closed. Closure is a separate terminal confirmation after requester verify.

LogIt styling uses forest primary + lime/warm cream — never purple AI-generic or royal-blue clone themes.

---

## Phase checklist

### Phase 1 — Foundations (now — complete)

| Capability | Status |
| --- | --- |
| Core tickets, RBAC, SLA worker, assignment rules | Done |
| Roles & Access admin UX | Done |
| Ticket attachments UI (create + detail) | Done |
| Integrations hub + Slack/Teams + simulate + email/IMAP | Done |
| Agent / IT workspace Home KPIs | Done |
| SLA time-to-resolution display (list, detail, agent queue) | Done |
| Knowledge, catalog (+ dynamic forms), asset register, approvals, audit | Done |
| Locations + Departments admin + ticket origin site | Done |
| Parent/child, merge, Routing & SLA admin (skills), catalog request | Done |
| Watchers + work logs + major-incident **API + UI** | Done |
| Presence, queue/Kanban, Problem/Change/CAB, MI dashboard | Done |
| SSO (Entra) / MFA (TOTP), stage analytics, digests, heatmaps/schedules | Done |
| Signed outbound webhooks, CI + Nginx TLS | Done |
| Omnichannel `Ticket.channel` metadata | Done |
| L1–L5: CMDB relations/impact/discovery · AI assists · KB deflection · portal themes · immutable audit exports · Users admin | Done |

### Phase 2 — Operations polish

Webhook retry worker · outbound bot replies · board presets · bulk ticket actions · business-hour calendar polish  

~~Queue boards / presence / digests / MI ops / IMAP / stage analytics / skills routing / approvals / catalog forms / channel metadata / L1–L5~~ (shipped)

### Phase IMS — Dedicated Incident Management Module

> **Build target:** next engineering cycle (queued for tomorrow’s build planning).  
> **URL strategy:** same site / host as LogIt (one deployment, one login). IMS is a **completely different module** — own routes, nav chrome, permissions, and domain language — not a rename of today’s ticket list.

#### Why a separate module

Today’s ITSM already has incidents, major-incident toggles, and `/app/major-incidents`. That remains the **service-desk** path.

The **Incident Management System (IMS)** is a first-class ops product for structured incident command: severity boards, timelines, stakeholder comms, runbooks, post-incident review — usable by IT, SRE, plant ops, or security without feeling like “just another ticket queue.”

#### Same URL, different module

| Concern | Decision |
| --- | --- |
| Host / TLS / SSO session | Shared with LogIt (same `APP_URL`, cookie session) |
| Entry path (proposed) | `/im` or `/app/im/*` — distinct from `/app/tickets`, `/app/major-incidents` |
| Product switcher | Header/home control: **Service Desk** ↔ **Incident Management** |
| API namespace (proposed) | `/api/v1/im/*` Nest module (`ImModule`) — not overloaded ticket CRUD |
| Data | Prefer `ImIncident` (+ timeline, roles, updates) linked optionally to `Ticket` / assets — avoid forking comments/SLA blindly |
| RBAC | New permissions e.g. `im:read`, `im:write`, `im:command`, `im:postmortem` in `@logit/shared` |
| Brand | Same LogIt visual system; IMS-specific labels and layouts |

```text
https://logit.koaimpact.app/
├── /login                    shared identity
├── /app/*                    Service Desk (ITSM) — current product
└── /im/*  (or /app/im/*)     Incident Management System — new module
         ├── board / active
         ├── incident/:id (timeline, roles, updates)
         ├── postmortems
         └── admin (severities, templates)
```

#### Scope for first IMS slice (build backlog)

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| IMS-0 | Architecture spike: routes, module boundary, link-to-ticket strategy | `[x]` | `/app/im` + optional ticket link |
| IMS-1 | Prisma `ImIncident` (+ severity, status, commander, started/resolved) | `[x]` | Migration + seed IM permissions |
| IMS-2 | Nest `im` module + `/api/v1/im` CRUD + permissions | `[x]` | list/create/get/updates/roles |
| IMS-3 | Web shell: product switcher + `/im` layout (own nav) | `[~]` | Nav item + board/detail; chrome polish later |
| IMS-4 | Active incidents board + create/declare flow | `[x]` | Severity + summary |
| IMS-5 | Incident timeline + stakeholder updates | `[x]` | Public vs internal |
| IMS-6 | Roles on incident (commander, scribe, comms) | `[~]` | Assign API; richer UI later |
| IMS-7 | Optional bridge: link ITSM ticket / MI / assets | `[~]` | `ticketId` on create/get |
| IMS-8 | Post-incident review (PIR) draft from timeline | `[ ]` | Export + knowledge promote later |
| IMS-9 | Docs: SOP + USER guide chapter for IMS | `[~]` | Roadmap/TODO marked partial |

#### Explicit non-goals (v1)

- Replacing `/app/tickets` or deleting Major incidents  
- Separate deployable microservice (stay modular monolith)  
- Separate IdP / second login  
- Full status-page SaaS clone (later optional)

#### Mapping to tomorrow’s build

Treat **IMS-0 → IMS-3** as the minimum vertical slice for the next build day: spike + schema + API stub + `/im` shell with product switcher. Deeper timeline/PIR follows in subsequent slices.

Track execution checkboxes in [DEVELOPMENT_TODO.md](./DEVELOPMENT_TODO.md) once work starts; keep this roadmap as the product intent.

### Phase 3 — Enterprise control plane (polish / depth)

SAML / more IdPs · workflow designer · parent-resolve child actions · deeper CI hierarchy · custom report dashboards

~~CMDB relations/impact/discovery · knowledge deflection · portal themes · immutable audit exports~~ (shipped as L1–L5)

### Phase 4 — Scale & intelligence

AI draft-reply depth · multi-tenant · marketplace · advanced reporting · IMS war-room / external status page

---

## Principles

1. Modular monolith first — **new modules (IMS) ship as Nest + Next slices, not new services**  
2. RBAC always (integrations admin = sysadmin; IMS gets its own permission codes)  
3. Secrets in env  
4. Ephemeral disk awareness for uploads  
5. Ship vertical slices — structure inspired by industry UX, brand stays LogIt  
6. Login branding (logo + banner) is sysadmin-configurable via `/app/admin/branding` — defaults remain LogIt when unset  
7. **Same URL, clear module boundaries** — shared auth/host; distinct routes, nav, and domain models when the product surface is different

---

## Mapping to gaps

See [GAP_ASSESSMENT.md](./GAP_ASSESSMENT.md) and [DEVELOPMENT_TODO.md](./DEVELOPMENT_TODO.md). Update these docs when a phase item lands. IMS is **roadmap-next**, not yet a GAP “shipped” row.
