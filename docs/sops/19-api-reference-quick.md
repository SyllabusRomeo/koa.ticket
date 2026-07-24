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
| POST | `/auth/login` | Sets cookie; may return `{ mfaRequired, mfaToken }` |
| POST | `/auth/mfa/verify-login` | Completes MFA challenge → session |
| POST | `/auth/mfa/setup` · `/mfa/confirm` · `/mfa/cancel-setup` · `/mfa/disable` | TOTP setup / disable |
| GET | `/auth/sso/entra` · `/auth/sso/entra/callback` | Optional Microsoft Entra OIDC |
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
| PATCH/DELETE | `/org/departments/:id` | org:manage — update / soft-deactivate |
| GET/POST | `/org/teams` | org:read / org:manage |
| PATCH | `/org/teams/:id` | org:manage |
| POST | `/org/teams/:id/members` | org:manage |
| DELETE | `/org/teams/:id/members/:userId` | org:manage |
| PATCH | `/users/:id` | users:manage — profile fields incl. `locationId` |

## Tickets

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/tickets/meta` | Types, statuses, categories, matrix, locations |
| GET | `/tickets/board` | Kanban columns + workload (`scope=all\|mine\|unassigned`) |
| GET | `/tickets/major-incidents` | MI ops dashboard payload |
| GET/POST | `/tickets` | List/create (`locationId` / `majorIncident` / `channel` / `typeCode` filters; create accepts `locationId`, `majorIncident`) |
| GET/PATCH | `/tickets/:id` | Get/update (`version` required on PATCH; `locationId`, `majorIncident`, channel read-only from intake) |
| POST | `/tickets/:id/comments` | `isInternal` optional |
| POST | `/tickets/:id/watch` | Subscribe current user as watcher |
| DELETE | `/tickets/:id/watch` | Unsubscribe |
| GET/POST | `/tickets/:id/work-logs` | List / add time (`{ minutes, note? }`; staff write) |
| POST/GET/DELETE | `/tickets/:id/presence` | Agent viewing/composing presence |
| POST | `/tickets/:id/children` | Link child `{ childNumber }` (staff + `tickets:write`) |
| DELETE | `/tickets/:id/children/:childId` | Unlink child |
| POST | `/tickets/:id/merge` | Merge sources into primary `{ sourceTicketIds: string[] }` |
| POST | `/tickets/:id/request-cab` | Change → CAB / approval path |
| POST | `/tickets/:id/promote-problem` | Incident → raise linked problem |

## Attachments / Audit / Integrations

| Method | Path |
| --- | --- |
| POST/GET | `/tickets/:idOrNumber/attachments` |
| GET | `/attachments/:id/download` |
| GET | `/attachments/limits` |
| GET | `/integrations/status` (sysadmin) |
| POST | `/integrations/chat/simulate` (sysadmin) |
| POST | `/integrations/slack/events` · `/slack/commands` |
| POST | `/integrations/teams/messages` |
| POST | `/integrations/email/inbound` |
| POST | `/integrations/email/imap/poll` (sysadmin) |
| GET/POST/PATCH/DELETE | `/webhooks/endpoints` (`settings:manage`) |
| POST | `/webhooks/endpoints/:id/test` |
| GET | `/webhooks/endpoints/:id/deliveries` |
| GET | `/audit` | Query: limit, action, actor, entityType, from, to, q |
| GET | `/audit/facets` | Distinct actions + entity types |

## SLA / Assignment / Notifications

| Method | Path |
| --- | --- |
| GET/POST | `/sla/policies` |
| GET | `/sla/tickets/:id` |
| GET/POST | `/assignment-rules` |
| GET/POST | `/skills` |
| GET/PUT | `/skills/users/:userId` |
| GET | `/notifications` |
| GET | `/notifications/unread-count` |
| POST | `/notifications/read-all` |
| POST | `/notifications/:id/read` |
| GET/PATCH | `/notifications/preferences` |
| GET/PATCH | `/notifications/digest` |
| GET | `/notifications/digest/status` |
| GET/POST | `/approvals` · `/approvals/:id/decide` |
| GET/POST | `/approvals/policies` |

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
| GET | `/reports/heatmap?from=&to=&metric=created\|resolved` (`reports:read`) |
| GET | `/reports/stages?from=&to=` (stage bottlenecks) |
| GET | `/reports/export.csv?from=&to=` · `/reports/export.pdf?from=&to=` (`reports:read`) |
| GET/POST | `/reports/schedules` · `PATCH/DELETE /reports/schedules/:id` · `POST …/:id/run` (`reports:read` or `settings:manage`) |
| GET | `/reports/ims-kpis?from=&to=` (`reports:read`) — ops KPI strip (ticket/SLA derived) |
| GET | `/tickets/export.csv` (same visibility as ticket list) |
| GET | `/audit/export.csv?…` (same filters as `/audit`, `audit:read`) |

## Incident Management (`im:*`)

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/im` | `im:read` |
| POST | `/im` | `im:write` — optional `ticketId`, `commanderId` |
| GET | `/im/:id` | `im:read` |
| GET | `/im/:id/pir` | `im:read` / `im:postmortem` — markdown draft |
| PATCH | `/im/:id/status` | `im:write` |
| POST | `/im/:id/updates` | `im:write` |
| POST | `/im/:id/roles` | `im:write` or `im:command` |

## Automation & monitoring (no Admin UI yet)

| Method | Path | Notes |
| --- | --- | --- |
| GET/POST/PATCH | `/automation/rules` | `settings:manage` |
| POST | `/integrations/monitoring/alerts` | Bearer `MONITORING_INGEST_SECRET` → creates ticket |

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
- [21 Incident Management](./21-incident-management.md)
