# LogIt — Alerts & notifications workflow

Industry-aligned event model for ITSM ticket lifecycle alerts.

## Principles

1. **Right person** — notify stakeholders who need to act or stay informed (requester, assignee, watchers, approvers, team).
2. **Right moment** — fire on meaningful lifecycle events, not every field edit.
3. **Right channel** — in-app for immediacy; email for offline awareness; digests for rollups (M8).
4. **User control** — per-event in-app / email preferences (Profile → Notification alerts) plus digest frequency.
5. **No noise loops** — do not notify the actor who made the change.

## Event catalog

| Event | Who gets it | Typical trigger |
| --- | --- | --- |
| `ticket.created` | Requester + team members | Ticket opened |
| `ticket.assigned` | New assignee | Manual or auto-assign (skills/workload) |
| `ticket.opened` | Requester, assignee, watchers | Moves to open / active working status |
| `ticket.resolved` | Requester, assignee, watchers | Marked resolved (awaiting close) |
| `ticket.closed` | Requester, assignee, watchers | Closed, cancelled, or merged |
| `ticket.status` | Same | Other status transitions |
| `ticket.comment` | Counterparties + watchers | Public reply (internal notes stay staff-only) |
| `approval.required` | Approver | Approval row created |
| `approval.completed` | Requester | Approve / reject |
| `sla.warning` | Role targets on policy | SLA threshold |

## Delivery pipeline

```
Domain event (create / assign / status / comment / approval / SLA)
  → resolve recipients (role of person on ticket)
  → exclude actor
  → load NotificationPreference (default = both channels on)
  → write in-app Notification row (if enabled)
  → send email via SMTP (if enabled)
```

Real-time delivery is unchanged by digests. Digests are an **additional** email rollup of unread in-app rows.

## Digests (M8)

| Preference | Values | Notes |
| --- | --- | --- |
| Frequency | `none` (default), `daily`, `weekly` | Profile → Notification alerts → Email digest |
| Timezone | User **home location** timezone, else `Africa/Accra` | Used for send hour, quiet hours, calendar day |
| Quiet hours | Optional start/end hour (0–23) | Overnight windows supported (e.g. 22→7) |
| Watermark | `User.lastDigestAt` | Advanced after a successful send (or empty period) |

**Unread policy:** Digests **leave in-app notifications unread**. Only `lastDigestAt` is updated so the next digest starts after that watermark. Users still clear unread in the bell / inbox.

**Poller:** IMAP-style interval on the API process (`NotificationDigestPoller`). Default every **60** minutes; each tick finds users due for a digest.

| Env | Default | Meaning |
| --- | --- | --- |
| `DIGEST_ENABLED` | on | Set `false` / `0` / `off` to disable |
| `DIGEST_POLL_MINUTES` | `60` | Tick interval (1–180) |
| `DIGEST_SEND_HOUR` | `8` | Local hour after which digests may send |
| `DIGEST_WEEKDAY` | `1` | ISO weekday for weekly (1=Mon … 7=Sun) |

Requires SMTP (`SMTP_HOST` + from address). If SMTP is missing, due users are skipped without advancing `lastDigestAt`.

### API

```http
GET  /api/v1/notifications/digest
PATCH /api/v1/notifications/digest
{
  "frequency": "daily",
  "quietStartHour": 22,
  "quietEndHour": 7
}
GET /api/v1/notifications/digest/status
```

## UI surfaces

- **Bell** in AppShell — unread count, links to `/app/notifications`
- **Inbox** — list, open marks read, mark-all-read
- **Profile preferences** — toggle in-app / email per event; digest frequency + quiet hours
- **Home** — recent unread strip for agents and employees

## ITIL alignment

- **Resolved ≠ Closed** — resolved alerts the requester to confirm; closed is the terminal confirmation.
- **Assignment** — dedicated alert so agents act on new ownership.
- **Watchers** — fan-out for stakeholders without ownership.

## Future

- Push / mobile
- Escalation paging for P1 / major incidents
- Optional suppress of per-event email when digest-only is preferred
- Outbound Slack/Teams bot replies for lifecycle events
