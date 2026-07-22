# SOP-16 — Notifications

## Purpose

Explain how users are notified and how preferences work.

## Channels

- **In-app notifications** (primary) — bell in AppShell + `/app/notifications` inbox
- **Email** — SMTP outbound via nodemailer for key ticket events (see [INTEGRATIONS_EMAIL.md](../INTEGRATIONS_EMAIL.md))
- **Digests** — optional daily/weekly email rollup of unread notifications (Profile → Notification alerts → Email digest); see [NOTIFICATIONS.md](../NOTIFICATIONS.md)
- Future: Microsoft Teams bot replies, SMS, push

## Common events

- Ticket created (to team members when routed)
- Assignment / status changes (where wired)
- SLA warning / breach thresholds
- Public comments (requester / assignee)
- **Ticket watchers** — fan-out on public comments and status changes (excludes the actor and users already notified as requester/assignee)

## How to view

- **Bell** in the app shell — unread badge, links to inbox
- Workspace Home may show a recent unread strip
- API:

```http
GET /api/v1/notifications
GET /api/v1/notifications/unread-count
POST /api/v1/notifications/:id/read
POST /api/v1/notifications/read-all
```

## Preferences

**UI:** My profile → Notification alerts (per-event in-app / email toggles + digest frequency + quiet hours).

```http
GET /api/v1/notifications/preferences
PATCH /api/v1/notifications/preferences
{
  "eventType": "ticket.created",
  "emailEnabled": true,
  "inAppEnabled": true
}
```

**Policy:** Critical security/admin alerts must remain non-suppressible where required (enforce as event types are finalized).

### Digests

```http
GET /api/v1/notifications/digest
PATCH /api/v1/notifications/digest
{
  "frequency": "daily",
  "quietStartHour": 22,
  "quietEndHour": 7
}
```

`frequency`: `none` | `daily` | `weekly`. Digests leave in-app rows unread and set `lastDigestAt`. Env: `DIGEST_ENABLED`, `DIGEST_POLL_MINUTES`, `DIGEST_SEND_HOUR`, `DIGEST_WEEKDAY`.

## Related SOPs

- [12 SLA and escalations](./12-sla-and-escalations.md)
- [08 Employee self-service](./08-employee-self-service.md)
- [NOTIFICATIONS.md](../NOTIFICATIONS.md)
