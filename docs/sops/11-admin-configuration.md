# SOP-11 — Admin Configuration

## Purpose

Guide system administrators configuring organization, users, routing, and SLA.

## Org structure model

```
Company → Country → Site (Location) → Department → Team → User
```

Nothing location-related should be hard-coded; configure via API/admin tools.

### Locations

**Admin UI (preferred):** `/app/admin/locations` — list, create, edit, soft-deactivate (`org:manage`; sysadmin / IT manager).

API:

`GET /api/v1/org/locations` (`org:read`)  
`POST /api/v1/org/locations` · `PATCH /api/v1/org/locations/:id` · `DELETE /api/v1/org/locations/:id` (soft) (`org:manage`)

Fields: `code`, `name`, `country`, `site`, `timezone` (default `Africa/Accra`), `isActive`.

Active locations also appear on `GET /tickets/meta` so requesters can pick a **ticket origin site** without `org:read`.

### Ticket origin location

Every ticket stores `locationId` — the site the issue is coming from (not necessarily the assignee’s office).

| Moment | Behavior |
| --- | --- |
| Create | Defaults to the requester’s home `user.locationId`; create form / API may override via `locationId` |
| List | Location shown on each row; staff can filter `GET /tickets?locationId=` |
| Detail | “Ticket origin site” shown prominently; staff (`tickets:read_queue` / `read_all`) can correct via `PATCH` |
| Routing | Assignment rules may match on ticket `locationId` |
| Reports | Summary includes `byLocation` breakdown |

Set user home location on **Roles & Access** (`PATCH /users/:id` with `locationId`) so new tickets stamp correctly.

### Departments

**Admin UI (preferred):** `/app/admin/departments` — list, create, edit, soft-deactivate (`org:manage`). Also linked from the profile **Admin** menu.

Seed (dev): **Information Technology** (`IT`) and **Operations** (`OPS`).

API:

`GET /api/v1/org/departments` (`org:read`)  
`POST /api/v1/org/departments` · `PATCH /api/v1/org/departments/:id` · `DELETE /api/v1/org/departments/:id` (soft) (`org:manage`)

Optional `locationId` ties a department to a primary site. Departments appear on **Teams** create and **My profile**.

### Teams (support groups)

**Admin UI (preferred):** `/app/admin/teams` — create/edit service teams, assign members (requires `org:manage`; sysadmin and IT manager).

API:

`GET/POST /api/v1/org/teams`  
`PATCH /api/v1/org/teams/:id`  
Add members: `POST /api/v1/org/teams/:id/members` with `{ userId, isLead? }`  
Remove members: `DELETE /api/v1/org/teams/:id/members/:userId`

Examples: Service Desk, Infrastructure, Applications, Security. Seed creates **Service Desk** (`SD`); production admins should create additional teams in the UI rather than editing seed.

## Users

- List: `GET /api/v1/users` (`users:read`) — includes `locationId` / `location`
- Create: `POST /api/v1/users` (`users:manage`) with a single primary role via `roleCodes` (length 0–1), optional temp password, optional `locationId`
- Update profile: `PATCH /api/v1/users/:id` — `locationId`, name, department
- Assign access: **Roles & Access** UI (also sets home location) or `PATCH /api/v1/users/:id/roles` with `roleCode` + optional `extraPermissionCodes` (additive). See [SOP-06](./06-roles-and-permissions.md).

Disable users by setting inactive / soft-delete practices (expand UI later). Prefer deactivation over hard delete.

## Categories

Seeded examples: Hardware, Software, Network, Accounts & Access (with subcategories).  
Admins should extend categories via DB/admin APIs as the catalog grows — avoid hard-coding in app code.

## Assignment rules

**Admin UI (preferred):** `/app/admin/routing` — create/list assignment rules (`org:manage`) and SLA policies (`settings:manage`).

API: `GET/POST /api/v1/assignment-rules` (`org:manage`)

Rule matching order: lowest `priority` number first. Match optional filters:

- categoryId
- ticketTypeId
- locationId  
→ target `teamId`

Seed example: Network → Service Desk.

## SLA policies

**Admin UI:** `/app/admin/routing` · API: `GET/POST /api/v1/sla/policies` (`settings:manage`)

Include first response minutes, resolve minutes, escalation thresholds (75/90/100).

Business hours seed: Mon–Fri 08:00–17:00 `Africa/Accra`.

## System settings

`system_settings` table holds keys such as `app.name` and branding file references (`branding.logoStoredName`, `branding.bannerStoredName`).

### Login branding (sysadmin)

Admin UI: `/app/admin/branding` — upload organization logo and login page background banner, preview, Save, or Reset to LogIT defaults.

| Endpoint | Auth | Notes |
|----------|------|--------|
| `GET /api/v1/branding` | Public | `logoUrl`, `loginBannerUrl`, limits |
| `GET /api/v1/branding/assets/logo` · `/banner` | Public | Inline image stream |
| `POST /api/v1/branding/logo` · `/banner` | Sysadmin | Multipart `file` |
| `POST /api/v1/branding/reset` | Sysadmin | Clears custom assets |

Logo: png/jpg/webp/svg (2 MB). Banner: jpg/png/webp (5 MB). When unset, `/login` keeps the default CSS mark and body gradient.

Expand further over time for attachment limits, password policy.

## Integrations (Slack / Teams / Email)

Sysadmin UI: `/app/admin/integrations` — webhook URLs, env status (Slack, Teams, SMTP), chat ticket simulate, email inbound URL.  
Docs: [INTEGRATIONS_SLACK_TEAMS.md](../INTEGRATIONS_SLACK_TEAMS.md) · [INTEGRATIONS_EMAIL.md](../INTEGRATIONS_EMAIL.md) · Roadmap: [ENTERPRISE_ROADMAP.md](../ENTERPRISE_ROADMAP.md).

Outbound email uses `SMTP_*` / `EMAIL_FROM` (skipped gracefully when unset). Inbound: `POST /api/v1/integrations/email/inbound` with optional `EMAIL_INBOUND_SECRET`.

## Seed vs production

After first production deploy:

1. Change all seed passwords immediately.
2. Disable/remove demo employee if not needed.
3. Set real org locations/departments/teams.
4. Turn off `EXPOSE_RESET_TOKENS`.

## Related SOPs

- [06 Roles and permissions](./06-roles-and-permissions.md)
- [12 SLA and escalations](./12-sla-and-escalations.md)
- [20 Change and release](./20-change-and-release.md)
