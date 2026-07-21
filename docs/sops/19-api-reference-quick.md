# SOP-19 — API Quick Reference

## Purpose

Give developers/integrators a map of MVP HTTP APIs.

## Base

- Local: `http://localhost:4100/api/v1`
- Auth: session cookie `logit_session` after login (or future Bearer)
- JSON unless multipart upload / CSV export

## Auth

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/auth/login` | Sets cookie |
| POST | `/auth/logout` | Auth required |
| GET | `/auth/me` | Current user + roles/permissions |
| POST | `/auth/change-password` | Revokes sessions |
| POST | `/auth/password-reset/request` | |
| POST | `/auth/password-reset/confirm` | |

## Users / Org

| Method | Path | Permission |
| --- | --- | --- |
| GET/POST | `/users` | users:read / users:manage |
| GET | `/users/roles/matrix` | roles:manage — roles + allPermissions |
| PATCH | `/users/:id/roles` | users:manage — `{ roleCode, extraPermissionCodes? }` |
| GET/POST | `/org/locations` | org:read / org:manage |
| PATCH/DELETE | `/org/locations/:id` | org:manage — update / soft-deactivate |
| GET/POST | `/org/departments` | org:read / org:manage |
| GET/POST | `/org/teams` | org:read / org:manage |
| PATCH | `/org/teams/:id` | org:manage |
| POST | `/org/teams/:id/members` | org:manage |
| DELETE | `/org/teams/:id/members/:userId` | org:manage |
| PATCH | `/users/:id` | users:manage — profile fields incl. `locationId` |

## Tickets

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/tickets/meta` | Types, statuses, categories, matrix |
| GET/POST | `/tickets` | List/create (`locationId` query filter for staff; create accepts `locationId` origin) |
| GET/PATCH | `/tickets/:id` | Get/update (`version` required on PATCH; `locationId` for origin site) |
| POST | `/tickets/:id/comments` | `isInternal` optional |
| POST | `/tickets/:id/children` | Link child `{ childNumber }` (staff + `tickets:write`) |
| DELETE | `/tickets/:id/children/:childId` | Unlink child |
| POST | `/tickets/:id/merge` | Merge sources into primary `{ sourceTicketIds: string[] }` (staff + write/assign) |

## Attachments / Audit

| Method | Path |
| --- | --- |
| POST/GET | `/tickets/:idOrNumber/attachments` |
| GET | `/attachments/:id/download` |
| GET | `/attachments/limits` |
| GET | `/integrations/status` (sysadmin) |
| POST | `/integrations/chat/simulate` (sysadmin) |
| POST | `/integrations/slack/events` · `/slack/commands` |
| POST | `/integrations/teams/messages` |
| GET | `/audit` | Query: limit, action, actor, entityType, from, to, q |
| GET | `/audit/facets` | Distinct actions + entity types |

## SLA / Assignment / Notifications

| Method | Path |
| --- | --- |
| GET/POST | `/sla/policies` |
| GET | `/sla/tickets/:id` |
| GET/POST | `/assignment-rules` |
| GET | `/notifications` |
| POST | `/notifications/:id/read` |
| GET/PATCH | `/notifications/preferences` |

## Knowledge / Catalog / Assets / Reports

| Method | Path |
| --- | --- |
| GET/POST | `/knowledge` |
| GET | `/knowledge/:slug` |
| PATCH | `/knowledge/:id` |
| POST | `/knowledge/:id/publish` |
| POST | `/knowledge/media` (inline image, `knowledge:write`) |
| GET/POST | `/knowledge/:id/attachments` |
| GET | `/knowledge/attachments/:id/content` · `…/download` |
| GET/POST | `/catalog` |
| GET/POST | `/assets` |
| GET | `/assets/types` |
| POST | `/assets/tickets/:ticketId/link` |
| GET | `/reports/summary?from=&to=` · `/reports/workspace` (agent KPIs) |
| GET | `/reports/export.csv?from=&to=` · `/reports/export.pdf?from=&to=` (`reports:read`) |
| GET | `/tickets/export.csv` (same visibility as ticket list) |
| GET | `/audit/export.csv?…` (same filters as `/audit`, `audit:read`) |

## Health (no `/api/v1` prefix)

- `/health`
- `/health/live`
- `/health/ready`

## Error handling expectations

- 401 unauthenticated
- 403 unauthorized
- 400 validation
- 409 ticket version conflict
- Safe messages to clients; details in server logs

## Related SOPs

- [02 Architecture](./02-system-architecture.md)
- [03 Local setup](./03-technical-setup-local.md)
