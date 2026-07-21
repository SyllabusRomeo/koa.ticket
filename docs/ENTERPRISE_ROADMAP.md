# LogIT — Enterprise Roadmap (industry ITSM trajectory)

Honest path from today’s modular-monolith MVP toward ServiceNow-class / Zendesk-style service desk capabilities. **Not** a clone of any vendor UI — LogIT keeps its own brand (`#0F4A40`, `#EDF4AC`, `#456433`, `#FBF1DA`).

**Related:** [GAP_ASSESSMENT.md](./GAP_ASSESSMENT.md) · [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) · [INTEGRATIONS_SLACK_TEAMS.md](./INTEGRATIONS_SLACK_TEAMS.md)

---

## Industry pillars → Now / Next / Later

Inspired by common service-desk product pillars (omnichannel, ticket management, automation, reporting, integrations, routing, AI, self-service) and the **agent workspace dashboard** pattern (KPI strip → priority/status breakdown → queue).

| Pillar | Now (shipped / shipping) | Next (Phase 2) | Later (Phase 3–4) |
| --- | --- | --- | --- |
| **Omnichannel intake** | Web tickets + **Slack/Teams chat → ticket** (+ simulate) | Email inbound | Voice/portal widgets, full Bot Framework JWT |
| **Ticket management** | Lifecycle, assign, comments, **attachments UI**, soft-delete, **SLA time-to-resolution timers** | Rich filters, bulk actions | Problem/Change dedicated workflows |
| **Agent workspace** | **Home KPI dashboard** (overdue / due today / open / on hold / unassigned / assigned to me) + bar breakdowns + **queue TTR badges** | Queue boards, workload views | Personalized dashboards, saved widgets |
| **Automation / workflows** | Assignment rules on create, SLA worker | Rules admin UI, email notifications | Visual workflow designer |
| **Routing / tagging** | Category + rules → team | Skills-based / load-balance UI | Dynamic forms, auto-tagging |
| **Reporting / analytics** | Summary + CSV + **workspace metrics API** | Scheduled exports, SLA heatmaps | Custom dashboards, marketplace analytics |
| **Integrations** | Integrations admin hub, Slack/Teams first cut | More chat channels, webhooks out | Marketplace / plugin packs |
| **Self-service** | Catalog browse, knowledge, employee tickets | One-click catalog request | Guided resolution, portal themes |
| **Asset / CMDB** | **Asset register MVP+** (filters, CRUD, retire, CSV, ticket link API) | Discovery / auto-import, richer CI classes | Full CMDB relationships & impact |
| **AI assists** | — | Suggest similar KB (light) | Draft replies, auto-categorize |
| **Identity / trust** | Session RBAC, sysadmin full perms | MFA UX | SSO / Entra / SAML |

### Omnichannel flow (product north star)

```text
Unify channels (web · Slack · Teams · email*)
        ↓
Capture request (message / form / attach)
        ↓
Create & assign (rules + agent workspace)
        ↓
Track · resolve · learn (SLA, KB, reports)
```

\*Email = Next.

### Agent workspace dashboard pattern

Structure (not visual clone of blue “IT servicedesk” mockups):

1. **KPI strip** — attention metrics with emphasis on overdue / unassigned  
2. **Breakdown panels** — by priority + by status (simple bars)  
3. **Queue / recent** — jump into work  
4. **CTAs** — New ticket, Unassigned, Approvals  

LogIT styling uses forest primary + lime/warm cream — never purple AI-generic or royal-blue clone themes.

---

## Phase checklist

### Phase 1 — Foundations (now)

| Capability | Status |
| --- | --- |
| Core tickets, RBAC, SLA worker, assignment rules | Done |
| Roles & Access admin UX | Done |
| Ticket attachments UI (create + detail) | Done |
| Integrations hub + Slack/Teams + simulate | Done |
| **Agent / IT workspace Home KPIs** | Done (this pass) |
| **SLA time-to-resolution display** (list, detail, agent queue) | Done |
| Knowledge, catalog, **asset register MVP+**, approvals, audit | Done (assets: filters/CRUD/retire/CSV) |

### Phase 2 — Operations depth

Email I/O · SLA admin UI · Assignment rules UI · Agent queue boards · richer notifications · catalog → request · time-spent worklogs (Later vs display timers)

### Phase 3 — Enterprise control plane

Problem/Change · **CMDB depth** (discovery, CI relationships, impact) · SSO/MFA · workflow designer · polished org admin

> **Asset register (shipped now vs later):** Now = tagged inventory with status lifecycle (`in_stock` / `in_service` / `in_repair` / `retired` / `disposed`), assignment, location, notes, purchase/warranty dates, list filters + search, soft-retire, CSV export, ticket–asset link API. Later = network discovery, CI class hierarchy, relationship graph, change impact analysis.

### Phase 4 — Scale & intelligence

AI assists · multi-tenant · marketplace · advanced reporting

---

## Principles

1. Modular monolith first  
2. RBAC always (integrations admin = sysadmin)  
3. Secrets in env  
4. Ephemeral disk awareness for uploads  
5. Ship vertical slices — structure inspired by industry UX, brand stays LogIT  
6. Login branding (logo + banner) is sysadmin-configurable via `/app/admin/branding` — defaults remain LogIT when unset

---

## Mapping to gaps

See [GAP_ASSESSMENT.md](./GAP_ASSESSMENT.md). Update both docs when a phase item lands.
