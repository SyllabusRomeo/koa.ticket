# Part I — Product & capabilities

← [Book home](../USER_AND_DEVELOPER_GUIDE.md) · Next: [Setup & configuration](./02-setup-configuration.md)

---

## 1. What LogIT is

LogIT is a **self-hosted enterprise IT Service Management (ITSM)** platform. It is not a bare ticket form — it is an operating system for IT work:

- Capture demand from **web, email, Slack, Teams, chat, and API**
- Route and prioritize work with **skills, teams, locations, and SLA**
- Collaborate with **comments, internal notes, watchers, work logs, and presence**
- Manage **incidents, requests, access, problems, changes (CAB), and major incidents**
- Publish **knowledge** and a **service catalog** with dynamic forms
- Track **assets / CMDB** relationships and impact
- Prove control with **approvals, audit (incl. checksummed export schedules), and reports**

**Brand:** primary `#0F4A40`, light `#EDF4AC`, secondary `#456433`, warm `#FBF1DA`.

**Principle of the product roadmap:** *Capture data → workflows → real-time → analytics → automation → AI.*

---

## 2. Capabilities map (360°)

Everything below is **current product** unless marked otherwise.

### Identity & access

| Capability | Where |
| --- | --- |
| Email/password sessions (HttpOnly cookie) | `/login` |
| Password reset / must-change-password | Auth flows |
| TOTP MFA | Profile |
| Optional Microsoft Entra OIDC SSO | Login (when env configured) |
| Primary role + additive extra permissions | Admin → Roles & Access |
| Users create / edit / deactivate | Admin → Users |

### Organization

| Capability | Where |
| --- | --- |
| Locations (sites, timezone) | Admin → Locations |
| Departments | Admin → Departments |
| Teams + members / leads | Admin → Teams |
| Ticket origin site (`locationId`) | Ticket create / detail |

### Ticketing core

| Capability | Where |
| --- | --- |
| Types: INC / REQ / ACC / SEC / PRB / CHG / TSK | Tickets |
| Status lifecycle + allowed transitions | Detail + Queue drag |
| Priority matrix (impact × urgency) | Create / triage |
| Comments (public) + internal notes | Detail |
| Attachments (allowlisted types/size) | Detail |
| Watchers + work logs | Detail |
| Parent/child links + merge (`merged`) | Detail |
| Soft-delete (elevated) | Detail |
| Optimistic locking (`version`) | API saves |
| Channel stamp (`web`/`email`/`slack`/`teams`/`chat`/`api`) | List badge + filter |
| AI assists (classify, summarize, duplicates, SLA risk, related KB) | Create + detail (heuristic; optional OpenAI) |

### Agent operations

| Capability | Where |
| --- | --- |
| Queue / Kanban + workload | `/app/queue` |
| Presence (viewing/composing) | Ticket detail |
| Major-incident badge + ops dashboard | Detail + `/app/major-incidents` |
| Problem management + Raise problem | `/app/problems` |
| Change + Submit to CAB | `/app/changes` → Approvals |

### Service delivery extras

| Capability | Where |
| --- | --- |
| Knowledge articles + feedback / deflection | `/app/knowledge`, Reports |
| Catalog items + `formSchema` answers | `/app/catalog` |
| Asset register, relations, impact BFS, discovery CSV | `/app/assets` |
| Multi-step approval policies | Approvals + Admin → Approval policies |
| SLA policies, instances, escalations | Worker + Routing & SLA |
| Skills + least-open auto-assign | Routing & SLA |
| Notifications bell, inbox, digests, quiet hours | Bell + Profile + `/app/notifications` |
| Reports: summary, heatmap, stages, CSV/PDF, schedules | `/app/reports` |
| Audit trail + CSV + immutable export schedules (SHA-256) | `/app/audit` |
| Branding logo/banner + portal themes | Admin → Branding |
| Integrations: SMTP/IMAP, Slack, Teams, outbound HMAC webhooks | Admin → Integrations |

### Platform

| Capability | Notes |
| --- | --- |
| NestJS API + Prisma + PostgreSQL | `apps/api` |
| Next.js web | `apps/web` |
| SLA worker | `apps/worker` |
| Redis presence (+ memory fallback) | Optional infra |
| Docker Compose + Nginx; Hetzner notes; GitHub Actions CI | `docs/PRODUCTION.md` |

### Known polish gaps (not missing cores)

Webhook auto-retry worker, SAML / more IdPs, bot outbound replies, board presets, business-hour calendar polish, voice/push paging. See [GAP_ASSESSMENT.md](../GAP_ASSESSMENT.md).

---

## 3. Personas, roles & permissions

### Personas

| Persona | Job in LogIT |
| --- | --- |
| Employee / requester | Create & track own tickets; catalog; knowledge |
| IT agent | Queue work, respond, assign, link assets |
| Senior agent | Escalations, KB/asset write, problems |
| IT manager | Oversight, reports, org, MI |
| Approver | Decide multi-step approvals (incl. CAB) |
| Administrator (`sysadmin`) | Full configuration |
| Auditor | Read-oriented audit / reports / history |

There is **no separate admin app** — elevation is role-based inside the same UI.

### Seeded roles

| Code | Display | Typical access |
| --- | --- | --- |
| `employee` | Employee | Own tickets, KB read, catalog |
| `agent` | IT Support Agent | Queue, assign, internal notes, assets read |
| `senior_agent` | Senior IT Agent | Agent + stronger KB/asset write |
| `it_manager` | IT Manager | Broad tickets, reports, audit, org |
| `approver` | Approver | Approvals queue |
| `sysadmin` | Administrator | All permissions |
| `auditor` | Auditor | Audit/reports/read style |

### Permission model

- One **primary role** per user.
- Optional **extra permissions** (additive only).
- Effective permissions = role ∪ extras.
- **UI hiding is not security** — API guards enforce every action.

Key codes (from `@logit/shared`):

`users:read|write|manage` · `roles:manage` · `tickets:read_own|read_queue|read_all|write|assign|internal_note` · `org:read|manage` · `audit:read` · `reports:read` · `settings:manage` · `knowledge:read|write` · `assets:read|write` · `approvals:read|decide`

### Demo accounts (development only)

After `npm run db:seed` — passwords are `LogIT-<Role>-2026!` style:

| Email | Role |
| --- | --- |
| `admin@logit.local` | sysadmin / Administrator |
| `employee@logit.local` | employee |
| `agent@logit.local` | agent |
| `senior@logit.local` | senior_agent |
| `manager@logit.local` | it_manager |
| `approver@logit.local` | approver |
| `auditor@logit.local` | auditor |

Default admin password (seed): `LogIT-Admin-2026!` — **dev only; rotate in any shared environment.**

Full table: [SOP-03](../sops/03-technical-setup-local.md) · [SOP-06](../sops/06-roles-and-permissions.md).

---

## 4. Architecture at a glance

```
Browser / Slack / Teams / Email
        │
        ▼
   Nginx (prod TLS)
        │
   ┌────┴────┐
   ▼         ▼
 Web       API (/api/v1)
(Next.js)   (NestJS)
             │
     ┌───────┼────────┐
     ▼       ▼        ▼
 Postgres  Redis   Uploads volume
             │
          Worker (SLA ticks)
             │
   In-process pollers: IMAP, digests, report/audit schedules
```

**Modular monolith:** clear Nest modules, one deployable API. PostgreSQL is source of truth; Redis is cache/presence/queues, not the system of record.

Local ports: Web **3100**, API **4100**, Nginx compose **8180**, Postgres host **15432**, Redis **6379**.

Detail: [SOP-02](../sops/02-system-architecture.md).

---

## 5. Navigation tour

Nav is **permission-filtered** (`apps/web/src/lib/access.ts`).

### Always (signed-in)

| Nav | Route | Purpose |
| --- | --- | --- |
| Home | `/app` | Role-aware shortcuts |
| Tickets / My tickets / My assignments | `/app/tickets` | List + create |
| Knowledge | `/app/knowledge` | Articles |
| Catalog | `/app/catalog` | Service requests |

Also: notification bell → `/app/notifications`; avatar → Profile (`/app/profile`).

### Agent workspace (queue-capable staff)

| Nav | Route |
| --- | --- |
| Queue | `/app/queue` |
| Major | `/app/major-incidents` |
| Problems | `/app/problems` |
| Changes | `/app/changes` |

### Role tools

| Nav | Permission |
| --- | --- |
| Approvals | `approvals:read` |
| Assets | `assets:read` |
| Reports | `reports:read` |
| Audit | `audit:read` |

### Admin tools

| Nav | Typical gate |
| --- | --- |
| Users | `users:manage` |
| Roles & Access | `roles:manage` / `users:manage` |
| Teams / Departments / Locations | `org:manage` |
| Routing & SLA | `settings:manage` / `org:manage` |
| Approval policies | `settings:manage` |
| Integrations / Branding | `sysadmin` |

---

## 30. Glossary

| Term | Meaning |
| --- | --- |
| CI / Asset | Configuration item in the asset register |
| CAB | Change Advisory Board — change approval path |
| Channel | Intake source stamped on the ticket |
| Deflection | KB view/feedback that avoided a ticket |
| Extra permission | Additive grant beyond primary role |
| MI | Major incident |
| Origin site | Ticket `locationId` — where the issue is from |
| Presence | Who is viewing/composing a ticket |
| Soft-deactivate | Record kept, `isActive=false` |
| Watcher | User subscribed to ticket updates without owning it |

More terms: [SOP-00 Glossary](../sops/00-glossary.md).

---

← [Book home](../USER_AND_DEVELOPER_GUIDE.md) · Next: [Setup & configuration](./02-setup-configuration.md)
