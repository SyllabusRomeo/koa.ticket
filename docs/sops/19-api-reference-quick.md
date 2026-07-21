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
| GET/POST | `/org/locations` | org:read / org:manage |
| GET/POST | `/org/departments` | org:read / org:manage |
| GET/POST | `/org/teams` | org:read / org:manage |
| POST | `/org/teams/:id/members` | org:manage |

## Tickets

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/tickets/meta` | Types, statuses, categories, matrix |
| GET/POST | `/tickets` | List/create |
| GET/PATCH | `/tickets/:id` | Get/update (`version` required on PATCH) |
| POST | `/tickets/:id/comments` | `isInternal` optional |

## Attachments / Audit

| Method | Path |
| --- | --- |
| POST/GET | `/tickets/:id/attachments` |
| GET | `/attachments/:id/download` |
| GET | `/audit` |

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
| POST | `/knowledge/:id/publish` |
| GET/POST | `/catalog` |
| GET/POST | `/assets` |
| GET | `/assets/types` |
| POST | `/assets/tickets/:ticketId/link` |
| GET | `/reports/summary` |
| GET | `/reports/export.csv` |

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
