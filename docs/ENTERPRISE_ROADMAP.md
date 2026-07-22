# LogIT — Enterprise Roadmap (industry ITSM trajectory)

Honest path from today’s modular-monolith platform toward ServiceNow-class / Zendesk-style service desk capabilities. **Not** a clone of any vendor UI — LogIT keeps its own brand (`#0F4A40`, `#EDF4AC`, `#456433`, `#FBF1DA`).

**Related:** [GAP_ASSESSMENT.md](./GAP_ASSESSMENT.md) · [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) · [DEVELOPMENT_TODO.md](./DEVELOPMENT_TODO.md) · [INTEGRATIONS_SLACK_TEAMS.md](./INTEGRATIONS_SLACK_TEAMS.md) · [INTEGRATIONS_EMAIL.md](./INTEGRATIONS_EMAIL.md)

**Last updated:** 2026-07-22 (through M10)

---

## Industry pillars → Now / Next / Later

Inspired by common service-desk product pillars (omnichannel, ticket management, automation, reporting, integrations, routing, AI, self-service) and the **agent workspace dashboard** pattern (KPI strip → priority/status breakdown → queue).

| Pillar | Now (shipped through M10) | Next (polish) | Later (Phase 3–4 / L1–L5) |
| --- | --- | --- | --- |
| **Omnichannel intake** | Web + Slack/Teams (+ simulate) + email webhook/IMAP + channel metadata (`web`/`email`/`slack`/`teams`/`chat`/`api`) + Bot Framework JWT / Slack HMAC | Channel endorsements / outbound bot replies | Voice/portal widgets |
| **Ticket management** | Lifecycle, assign, comments, attachments, soft-delete, SLA TTR, parent/child, merge, stage duration, origin location, **watchers/worklogs UI**, **MI badge + dashboard**, Problem/Change/CAB | Parent-resolve child actions, bulk actions | Deeper problem/change records |
| **Agent workspace** | Home KPI dashboard + `/app/queue` Kanban + workload + presence collision | Saved board presets, WebSocket push | Personalized dashboards, saved widgets |
| **Automation / workflows** | Assignment rules (skills + least-open), SLA worker, Routing & SLA admin, email notifications, digests, multi-step approvals, signed outbound webhooks | Webhook retry worker | Visual workflow designer |
| **Routing / tagging** | Category + location + skill rules → team + auto-assign | Dynamic auto-tagging | Marketplace rule packs |
| **Reporting / analytics** | Summary + CSV/PDF + workspace metrics + byLocation + **heatmap** + **scheduled exports** + stage bottlenecks | Custom dashboards | Marketplace analytics |
| **Integrations** | Integrations hub, Slack/Teams + email/IMAP + signed outbound webhooks | More chat channels | Marketplace / plugin packs |
| **Self-service** | Catalog browse + dynamic forms, knowledge, employee tickets, one-click request | Guided resolution | Portal themes |
| **Org admin** | Locations + **Departments** + Teams + Roles & Access | Soft-deactivate polish | Full org tree designer |
| **Asset / CMDB** | Asset register MVP+ (filters, CRUD, retire, CSV, ticket link) | Discovery / auto-import | Full CMDB relationships & impact (**L1**) |
| **AI assists** | — | Suggest similar KB (light) | Draft replies, auto-categorize (**L2**) |
| **Identity / trust** | Session RBAC, **TOTP MFA**, optional **Microsoft Entra OIDC** | SAML / more IdPs | Advanced Conditional Access hooks |

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

LogIT styling uses forest primary + lime/warm cream — never purple AI-generic or royal-blue clone themes.

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

### Phase 2 — Operations polish

Webhook retry worker · outbound bot replies · board presets · bulk ticket actions · business-hour calendar polish  

~~Queue boards / presence / digests / MI ops / IMAP / stage analytics / skills routing / approvals / catalog forms / channel metadata~~ (shipped)

### Phase 3 — Enterprise control plane (Later — L1+)

**CMDB depth** (discovery, CI relationships, impact) · SAML / more IdPs · workflow designer · parent-resolve child actions · knowledge deflection analytics · portal themes · immutable audit export schedules

> **Asset register (shipped now vs later):** Now = tagged inventory with status lifecycle (`in_stock` / `in_service` / `in_repair` / `retired` / `disposed`), assignment, location, notes, purchase/warranty dates, list filters + search, soft-retire, CSV export, ticket–asset link API. Later = network discovery, CI class hierarchy, relationship graph, change impact analysis (**L1**).

### Phase 4 — Scale & intelligence (L2+)

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

See [GAP_ASSESSMENT.md](./GAP_ASSESSMENT.md) and [DEVELOPMENT_TODO.md](./DEVELOPMENT_TODO.md) (**L1–L5**). Update these docs when a phase item lands.
