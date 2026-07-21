# Email inbound / outbound — LogIT omnichannel Phase 2

LogIT sends ticket event emails over SMTP (nodemailer) and accepts inbound parse webhooks to create tickets or add comments.

**Admin UI:** `/app/admin/integrations` (sysadmin) — Email (SMTP) status card + inbound webhook URL  
**Related:** [INTEGRATIONS_SLACK_TEAMS.md](./INTEGRATIONS_SLACK_TEAMS.md) · [GAP_ASSESSMENT.md](./GAP_ASSESSMENT.md)

---

## Environment variables

| Variable | Purpose |
| --- | --- |
| `SMTP_HOST` | SMTP server hostname (required for outbound) |
| `SMTP_PORT` | Port (default `587`; `465` uses TLS) |
| `SMTP_USER` | SMTP auth user (optional if relay allows anonymous) |
| `SMTP_PASS` | SMTP password (`SMTP_PASSWORD` alias accepted) |
| `EMAIL_FROM` | From address (`SMTP_FROM` alias accepted) |
| `APP_PUBLIC_URL` | Base URL for ticket deep links in emails |
| `API_PUBLIC_URL` | Public API base for inbound webhook URL display |
| `EMAIL_INBOUND_SECRET` | Optional Bearer secret for inbound webhook |
| `INTEGRATION_SERVICE_USER_EMAIL` | Fallback requester when From email is unknown |

When `SMTP_HOST` or from-address is **absent**, outbound sends are **logged and skipped** (no hard failure). In-app notifications still work.

---

## Outbound behavior

Notifications (`NotificationsService.notify`) create in-app rows and, when SMTP is configured and the user’s preference allows email, send mail for:

- Ticket created (requester + assigned team members)
- Ticket assigned
- Public comments (requester / assignee, excluding author)
- Status changes (requester / assignee, excluding actor)

Subject format: `[INC-2026-000123] Event label: title`

---

## Inbound webhook

| Method | Path | Auth |
| --- | --- | --- |
| `POST` | `/api/v1/integrations/email/inbound` | Bearer `EMAIL_INBOUND_SECRET` when set; open in local/dev when unset |

### Payload (JSON or form fields)

Compatible with SendGrid Inbound Parse / Mailgun-style routes:

| Field | Notes |
| --- | --- |
| `from` / `sender` | Sender; mapped to a LogIT user by email when possible |
| `subject` | Used for ticket token + new-ticket title |
| `text` / `plain` / `body-plain` | Preferred body |
| `html` / `body-html` | Used if text missing (tags stripped) |

### Routing rules

1. If subject contains `[INC-2026-…]` (or bare `INC-2026-…`) → **public comment** on that ticket.
2. Otherwise → **create** a new incident (title = cleaned subject, body = email text).

### Example — create ticket

```http
POST /api/v1/integrations/email/inbound
Content-Type: application/json
Authorization: Bearer <EMAIL_INBOUND_SECRET>

{
  "from": "demo@logit.local",
  "subject": "VPN down in Accra",
  "text": "Cannot connect since 09:00."
}
```

### Example — comment on existing ticket

```http
POST /api/v1/integrations/email/inbound
Content-Type: application/json

{
  "from": "demo@logit.local",
  "subject": "Re: [INC-2026-000042] VPN down in Accra",
  "text": "Still failing after reboot."
}
```

### Provider setup (summary)

**SendGrid Inbound Parse:** Host → MX to SendGrid; Destination URL = `{API}/api/v1/integrations/email/inbound`; POST the raw MIME or parsed fields (from, subject, text).

**Mailgun Routes:** Match recipient → forward / store-and-notify to the same URL with `from`, `subject`, `body-plain`.

Optional: send `Authorization: Bearer <EMAIL_INBOUND_SECRET>`.

---

## IMAP poller

**Not implemented** in this MVP. Admin status shows an IMAP stub note. Prefer inbound webhooks for production intake.

---

## Security notes

- Inbound is a public route; set `EMAIL_INBOUND_SECRET` in production.
- Unknown From addresses use `INTEGRATION_SERVICE_USER_EMAIL`.
- Do not commit SMTP credentials; use Render env groups / secret managers.
