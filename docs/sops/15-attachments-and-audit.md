# SOP-15 — Attachments & Audit Trail

## Purpose

Handle files safely and understand audit evidence.

## Attachments

### UI (how users attach)

1. **Create ticket** (`/app/tickets`) — use **Choose files** / Attach files before Submit. Files upload immediately after the ticket is created; you land on the ticket detail page.
2. **Ticket detail** — **Attachments** section with primary **Attach files** button. List shows filename, size, uploader, time; **Download** opens the file.

Who can upload: the **requester** on their ticket, or any user with `tickets:write` who can already view the ticket (agents, managers, sysadmin).

### Rules

- Size limited (`UPLOAD_MAX_BYTES`, default 10 MB)
- Extension allowlist (`ALLOWED_UPLOAD_EXTENSIONS` — pdf, png, jpg, jpeg, gif, doc, docx, xls, xlsx, txt, csv, zip, …)
- Stored under `UPLOAD_DIR` with **random** filenames
- Download requires ticket access authorization
- No predictable public URLs
- **Production note:** local disk is **ephemeral** on Render/container hosts unless you attach a persistent disk or move to object storage. Backups must include the upload volume (see SOP-17).

### API

```http
POST /api/v1/tickets/:idOrNumber/attachments
Content-Type: multipart/form-data
file: <binary>

GET /api/v1/tickets/:idOrNumber/attachments
GET /api/v1/attachments/:id/download
GET /api/v1/attachments/limits
```

`:idOrNumber` accepts ticket cuid **or** ticket number (e.g. `INC-2026-000001`).

### User guidance

- Prefer PDF/PNG/JPG for screenshots
- Do not upload executables
- Do not put passwords in filenames

## Audit logs

Audit records are **immutable** from the application (no update/delete APIs).

Typical events: ticket create, attachment upload, report export, (expand login/config events over time).

### Read audits (`audit:read`)

UI: `/app/audit` — filterable event table (action, actor, entity type, date range, search).

```http
GET /api/v1/audit?limit=100&action=&actor=&entityType=&from=&to=&q=
GET /api/v1/audit/facets
```

Response: `{ rows, total, limit }` with actor, action, entity, optional `after` JSON for ticket number links.

Each event should capture actor, action, entity, timestamps, and optional before/after JSON + IP.

### Audit vs application logs

| Type | Purpose |
| --- | --- |
| Application logs | Technical troubleshooting (errors, restarts) |
| Audit logs | Who performed a business/admin action |

Do not rely on server logs alone for compliance evidence.

## Related SOPs

- [10 Manager operations](./10-manager-operations.md)
- [17 Backup and recovery](./17-backup-and-recovery.md)
- [Integrations Slack/Teams](../INTEGRATIONS_SLACK_TEAMS.md)
