# SOP-12 — SLA & Escalations

## Purpose

Explain how LogIt measures response/resolution time and escalates risk.

## Concepts

| Concept | Meaning |
| --- | --- |
| First Response SLA | Time until an agent first responds |
| Resolution SLA | Time until ticket is resolved |
| SLA instance | Per-ticket timer record (`first_response` or `resolution`) |
| Pause | Timer pauses in statuses flagged `pausesSla` (e.g. Pending User) |
| Breach | Consumption ≥ 100% without completion |
| Escalation | Notifications at configured % thresholds |

## Default policy (seed)

**Standard IT Support**

- First response: 60 minutes
- Resolution: 480 minutes (8 hours)
- Escalations: 75% → agents; 90% → agent+IT manager; 100% → IT manager+sysadmin; 120% → sysadmin

## Lifecycle

1. Ticket created → matching SLA policy attaches two instances.
2. Worker ticks about every 60 seconds:
   - Updates `% consumed`
   - Pauses/resumes based on status
   - Completes first-response when `firstResponseAt` set
   - Completes resolution when `resolvedAt` set
   - Fires notifications on threshold crossings
3. Agents/managers act on notifications.

## How to view SLA for a ticket

```http
GET /api/v1/sla/tickets/:ticketId
```

## Operator guidance

- Prefer Pending User only when truly waiting on the requester.
- Don’t park tickets On Hold to “game” SLA without justification (auditable).
- On breach: communicate ETA and escalate technically if needed.

## Related SOPs

- [09 Agent ticket handling](./09-agent-ticket-handling.md)
- [10 Manager operations](./10-manager-operations.md)
- [16 Notifications](./16-notifications.md)
