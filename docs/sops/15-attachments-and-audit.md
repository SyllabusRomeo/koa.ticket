# SOP-15 — Attachments & Audit Trail

## Purpose

Handle files safely and understand audit evidence.

## Attachments

### Rules

- Size limited (`UPLOAD_MAX_BYTES`, default 10 MB)
- Extension allowlist (`ALLOWED_UPLOAD_EXTENSIONS`)
- Stored under `UPLOAD_DIR` with **random** filenames
- Download requires ticket access authorization
- No predictable public URLs

### Upload

```http
POST /api/v1/tickets/:id/attachments
Content-Type: multipart/form-data
file: <binary>
```

### List / download

```http
GET /api/v1/tickets/:id/attachments
GET /api/v1/attachments/:id/download
```

### User guidance

- Prefer PDF/PNG/JPG for screenshots
- Do not upload executables
- Do not put passwords in filenames

## Audit logs

Audit records are **immutable** from the application (no update/delete APIs).

Typical events: ticket create, attachment upload, report export, (expand login/config events over time).

### Read audits (`audit:read`)

```http
GET /api/v1/audit?limit=100
```

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
