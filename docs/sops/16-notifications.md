# SOP-16 — Notifications

## Purpose

Explain how users are notified and how preferences work.

## Channels (MVP)

- **In-app notifications** (primary today)
- **Email** — architecture ready; SMTP wiring is a later completion item
- Future: Microsoft Teams, SMS, push

## Common events

- Ticket created (to team members when routed)
- SLA warning / breach thresholds
- (Expand) assignment, approval required, resolved, etc.

## How to view

Workspace shows recent unread notifications after login.  
API:

```http
GET /api/v1/notifications
POST /api/v1/notifications/:id/read
```

## Preferences

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

## Related SOPs

- [12 SLA and escalations](./12-sla-and-escalations.md)
- [08 Employee self-service](./08-employee-self-service.md)
