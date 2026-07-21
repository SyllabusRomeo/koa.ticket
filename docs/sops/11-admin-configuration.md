# SOP-11 — Admin Configuration

## Purpose

Guide system administrators configuring organization, users, routing, and SLA.

## Org structure model

```
Company → Country → Site (Location) → Department → Team → User
```

Nothing location-related should be hard-coded; configure via API/admin tools.

### Locations

`GET/POST /api/v1/org/locations`  
Fields: code, name, country, site, timezone (default `Africa/Accra`).

### Departments

`GET/POST /api/v1/org/departments`  
Optional `locationId`.

### Teams (support groups)

`GET/POST /api/v1/org/teams`  
Add members: `POST /api/v1/org/teams/:id/members` with `{ userId, isLead? }`.

Examples: Service Desk, Infrastructure, Applications, Security.

## Users

- List: `GET /api/v1/users` (`users:read`)
- Create: `POST /api/v1/users` (`users:manage`) with `roleCodes`, optional temp password

Disable users by setting inactive / soft-delete practices (expand UI later). Prefer deactivation over hard delete.

## Categories

Seeded examples: Hardware, Software, Network, Accounts & Access (with subcategories).  
Admins should extend categories via DB/admin APIs as the catalog grows — avoid hard-coding in app code.

## Assignment rules

`GET/POST /api/v1/assignment-rules` (`org:manage`)

Rule matching order: lowest `priority` number first. Match optional filters:

- categoryId
- ticketTypeId
- locationId  
→ target `teamId`

Seed example: Network → Service Desk.

## SLA policies

`GET/POST /api/v1/sla/policies` (`settings:manage`)

Include first response minutes, resolve minutes, escalation thresholds (75/90/100/120).

Business hours seed: Mon–Fri 08:00–17:00 `Africa/Accra`.

## System settings

`system_settings` table holds keys such as `app.name`. Expand admin UI over time for logo, SMTP, attachment limits, password policy.

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
