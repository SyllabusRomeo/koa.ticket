# Email inbound / outbound — LogIt omnichannel

LogIt sends ticket event emails over SMTP (nodemailer), accepts inbound parse webhooks, and can poll IMAP for new mail. Threading uses **Message-ID / In-Reply-To / References** plus subject ticket tokens.

**Admin UI:** `/app/admin/integrations` (sysadmin) — Email (SMTP) + IMAP status, inbound webhook URL, manual IMAP poll  
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
| `APP_PUBLIC_URL` | Base URL for ticket deep links in emails (prod: `https://logit.koaimpact.app`) |
| `API_PUBLIC_URL` | Public API base for inbound webhook URL display (prod: `https://logit.koaimpact.app/api/v1`) |
| `EMAIL_INBOUND_SECRET` | Optional Bearer secret for inbound webhook |
| `INTEGRATION_SERVICE_USER_EMAIL` | Fallback requester when From email is unknown |
| `IMAP_HOST` | IMAP server (enables poller when set with user/pass) |
| `IMAP_PORT` | Default `993` |
| `IMAP_USER` / `IMAP_PASS` | Mailbox credentials (`IMAP_PASSWORD` alias) |
| `IMAP_MAILBOX` | Folder to poll (default `INBOX`) |
| `IMAP_POLL_MINUTES` | Poll interval (default `5`, max `60`) |
| `DIGEST_ENABLED` | Notification digests on by default; `false` / `0` / `off` disables |
| `DIGEST_POLL_MINUTES` | Digest tick interval (default `60`, max `180`) |
| `DIGEST_SEND_HOUR` | Local hour after which digests may send (default `8`) |
| `DIGEST_WEEKDAY` | ISO weekday for weekly digests (default `1` = Monday) |
| `IMAP_TLS` | Set `false` only for non-TLS lab servers |

When `SMTP_HOST` or from-address is **absent**, outbound sends are **logged and skipped** (no hard failure). In-app notifications still work.

---

## Outbound behavior

Notifications (`NotificationsService.notify`) create in-app rows and, when SMTP is configured and the user’s preference allows email, send mail for:

- Ticket created (requester + assigned team members)
- Ticket assigned
- Public comments (requester / assignee, excluding author)
- Status changes (requester / assignee, excluding actor)

Subject format: `[INC-2026-000123] Event label: title`

When the ticket already has inbound email messages, outbound mail sets **In-Reply-To** / **References** so client threads stay together. Outbound Message-IDs are stored in `email_messages`.

---

## Inbound webhook

| Method | Path | Auth |
| --- | --- | --- |
| `POST` | `/api/v1/integrations/email/inbound` | Bearer `EMAIL_INBOUND_SECRET` when set; open in local/dev when unset |

### Payload (JSON or form fields)

Compatible with SendGrid Inbound Parse / Mailgun-style routes:

| Field | Notes |
| --- | --- |
| `from` / `sender` | Sender; mapped to a LogIt user by email when possible |
| `subject` | Used for ticket token + new-ticket title |
| `text` / `plain` / `body-plain` | Preferred body |
| `html` / `body-html` | Used if text missing (tags stripped) |
| `messageId` / `Message-ID` | Dedupes repeats; stored for threading |
| `inReplyTo` / `In-Reply-To` | Prefer this over subject for reply routing |
| `references` / `References` | Fallback thread chain |

### Routing rules

1. Duplicate **Message-ID** → return existing ticket (`action: duplicate`), no new comment.
2. **In-Reply-To** / **References** match a stored message → **public comment** on that ticket.
3. Subject contains `[INC-2026-…]` (or bare `INC-2026-…`) → **public comment**.
4. Otherwise → **create** a new incident (title = cleaned subject, body = email text).

### Example — create ticket

```http
POST /api/v1/integrations/email/inbound
Content-Type: application/json
Authorization: Bearer <EMAIL_INBOUND_SECRET>

{
  "from": "demo@logit.local",
  "subject": "VPN down in Accra",
  "text": "Cannot connect since 09:00.",
  "messageId": "<vpn-1@mail.example>"
}
```

### Example — comment via reply headers

```http
POST /api/v1/integrations/email/inbound
Content-Type: application/json

{
  "from": "demo@logit.local",
  "subject": "Re: VPN down in Accra",
  "text": "Still failing after reboot.",
  "messageId": "<vpn-2@mail.example>",
  "inReplyTo": "<vpn-1@mail.example>"
}
```

### Provider setup (summary)

**SendGrid Inbound Parse:** Host → MX to SendGrid; Destination URL = `{API}/api/v1/integrations/email/inbound`; POST parsed fields (from, subject, text) plus headers when available.

**Mailgun Routes:** Match recipient → forward / store-and-notify to the same URL with `from`, `subject`, `body-plain`.

Optional: send `Authorization: Bearer <EMAIL_INBOUND_SECRET>`.

---

## IMAP poller

When `IMAP_HOST` + `IMAP_USER` + `IMAP_PASS` are set, the API polls **UNSEEN** messages on a timer (`IMAP_POLL_MINUTES`), parses MIME with mailparser, runs the same inbound pipeline, then marks messages **\\Seen**.

| Method | Path | Auth |
| --- | --- | --- |
| `POST` | `/api/v1/integrations/email/imap/poll` | Sysadmin session — run one poll now |

Prefer inbound webhooks when your ESP supports them (lower latency). Use IMAP for mailboxes that only expose IMAP.

New tickets from inbound/IMAP are stamped `channel=email` with optional `channelMeta` (Message-ID, In-Reply-To, From). See DEVELOPMENT_TODO M10.

---

## Security notes

- Inbound is a public route; set `EMAIL_INBOUND_SECRET` in production.
- Unknown From addresses use `INTEGRATION_SERVICE_USER_EMAIL`.
- Do not commit SMTP/IMAP credentials; use Render env groups / secret managers.
