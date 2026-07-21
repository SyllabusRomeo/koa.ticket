# LogIT — Gap Assessment vs modern ITSM / PRD

Honest status as of this assessment. LogIT is a **solid modular-monolith MVP**, not a complete modern enterprise ITSM suite.

**Verdict: No — not a complete modern ticketing / ITSM system yet.**  
Core ticket + RBAC + SLA worker + assignment rules exist; many PRD Phase-2+ capabilities and several create/manage UIs were missing or thin (now partially closed for assignment, lifecycle actions, knowledge, catalog, assets, roles, attachments UI, chat integrations).

**Roadmap:** [ENTERPRISE_ROADMAP.md](./ENTERPRISE_ROADMAP.md) · [INTEGRATIONS_SLACK_TEAMS.md](./INTEGRATIONS_SLACK_TEAMS.md)

## Module matrix

| Module | Backend | UI browse | UI create/manage | Gap severity |
| --- | --- | --- | --- | --- |
| Auth / sessions | Done | Login | Password reset API; MFA UI later | Medium |
| RBAC / Roles & Access | Done (sysadmin = all perms) | Redesigned matrix | Assign roles + Save/Cancel | Low |
| Org (locations/teams) | Done | **Service teams** UI `/app/admin/teams` | Create/edit team + members (`org:manage`) | Low |
| Tickets create/list | Done | List + **TTR badges** + queue chips | Create form | Low |
| Ticket detail / assign | Done | Detail + ownership + **SLA TTR panel** | Assign/reassign team+agent | Low |
| Ticket lifecycle actions | Transitions + soft-delete | Action buttons on detail | Resolve/Close/Reopen/Cancel/Delete | Low |
| Attachments | Upload/list/download | **Done** on create + detail | Attach files CTA | Low (durable storage for prod) |
| Comments / internal notes | Done | On detail | Post public/internal | Low |
| Approvals | Done | Queue + decide | No admin config UI | Medium |
| Knowledge | Create/update/publish + rich text + attachments | Browse + article | Create/edit/publish + toolbar + Attach files | Low |
| Catalog | List + create (settings:manage) | Browse | Create item (sysadmin) | Medium (no one-click request from item) |
| Assets | List/filter/CRUD + soft-retire + CSV + ticket link API | **Register** `/app/assets` | Create + detail edit (status/assignee/notes) | Low (discovery / CI relationships later) |
| Reports | Summary + CSV + workspace | Summary + **agent Home KPIs** | Limited polish | Medium |
| Agent workspace Home | `GET /reports/workspace` | KPI strip + bars + **TTR on recent queue** (agents+) | Employee home unchanged | Low |
| SLA time-to-resolution UI | `dueAt` + resolution SLA → `slaRemainingMs` | List / detail / queue | Countdown & overdue (danger) | Low (worklogs Later) |
| Slack / Teams chat create | First-cut webhooks + simulate | Admin Integrations hub | Env-based secrets | Medium (full Bot Framework JWT later) |
| Email / SSO / CMDB / AI | Out of MVP | — | — | High (roadmap Phases 2–4) |
| Problems / Changes | Types seeded | — | No dedicated workflows | High |

## Knowledge — answers

| Question | Answer |
| --- | --- |
| Who creates the knowledge base? | Users with `knowledge:write`: **senior_agent**, **it_manager**, **sysadmin** (seed). Agents have read only. |
| How is it created? | `POST /api/v1/knowledge` (title, slug, **HTML body**, category, publish). Body is sanitized server-side. Inline images: `POST /knowledge/media`. File attachments: `POST /knowledge/:id/attachments`. Seed also upserts a sample article. |
| Which interface? | `/app/knowledge` (browse), `/app/knowledge/new` (create + rich text + pending attachments), `/app/knowledge/[slug]` (read sanitized HTML / edit / publish / attachments). |

## Attachments — answers

| Question | Answer |
| --- | --- |
| Why couldn't users attach files? | API existed; **web UI was missing**. |
| Who can attach? | Ticket **requester**, or anyone with `tickets:write` who can access the ticket. |
| Limits | `UPLOAD_MAX_BYTES` (default 10 MB); extensions from `ALLOWED_UPLOAD_EXTENSIONS`. |
| Storage | Local `UPLOAD_DIR` — ephemeral on Render unless a disk/object store is attached. |

## Sysadmin completeness

- Seed maps `sysadmin` → `Object.values(PERMISSIONS)` — **all shared permissions**.
- UI: Roles & Access, Integrations, ticket assign + lifecycle + soft-delete + attachments, knowledge create, catalog create, asset create, reports, audit, approvals (decide), home CTAs for admin + ops paths.
- Soft-delete tickets: sysadmin (`settings:manage`) and IT managers (`tickets:read_all` + `tickets:write`).

## Critical gaps still missing for “modern enterprise ITSM”

1. Email inbound/outbound, Entra/SSO, MFA UX  
2. SLA / assignment-rule **admin configuration UI**  
3. Agent board / workload views, richer filters  
4. Problem / Change management workflows (beyond type codes)  
5. Dynamic forms, advanced approvals, **CMDB depth** (discovery, CI relationships — register MVP+ is shipped), full Bot Framework auth, AI assists  

## What improved in this pass

- Roles & Access **enterprise layout** (clear selection, Save/Cancel, empty states)  
- Ticket **attachments** on create + detail  
- **Integrations** hub + Slack/Teams chat ticket create + simulate  
- Enterprise roadmap doc linked from this assessment  
- **SLA time-to-resolution** timers on ticket list, detail, and agent recent queue (countdown / overdue). Deeper time-spent worklogs remain Later.  
