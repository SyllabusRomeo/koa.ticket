# LogIT — Alerts & notifications workflow

Industry-aligned event model for ITSM ticket lifecycle alerts.

## Principles

1. **Right person** — notify stakeholders who need to act or stay informed (requester, assignee, watchers, approvers, team).
2. **Right moment** — fire on meaningful lifecycle events, not every field edit.
3. **Right channel** — in-app for immediacy; email for offline awareness; digests later (M8).
4. **User control** — per-event in-app / email preferences (Profile → Notification alerts).
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

## UI surfaces

- **Bell** in AppShell — unread count, links to `/app/notifications`
- **Inbox** — list, open marks read, mark-all-read
- **Profile preferences** — toggle in-app / email per event
- **Home** — recent unread strip for agents and employees

## ITIL alignment

- **Resolved ≠ Closed** — resolved alerts the requester to confirm; closed is the terminal confirmation.
- **Assignment** — dedicated alert so agents act on new ownership.
- **Watchers** — fan-out for stakeholders without ownership.

## Future (M8+)

- Digest digests (daily/weekly rollups)
- Push / mobile
- Quiet hours
- Escalation paging for P1 / major incidents
