# SOP-09 — Agent Ticket Handling

## Purpose

Standardize how IT agents triage, work, and close tickets in LogIT.

## Access

Agents need role `agent` or higher and queue/read permissions.

## Daily start

1. Sign in and open workspace.
2. Check **Notifications** for SLA warnings / new assignments.
3. Open **Tickets** (queue visibility depends on permissions).
4. Managers/agents with reports permission: review dashboard stats (open, unassigned, SLA breaches).

## Triage checklist

For each new ticket:

1. Open the ticket from **Tickets** (click the number) — detail page shows ownership and actions
2. **Confirm type** (incident vs request vs access vs security)
3. **Confirm category/subcategory**
4. **Confirm ticket origin site** (location) — correct if the requester picked the wrong site
5. **Validate priority** (impact × urgency). Override only with justification (logged)
6. **Assign team/agent** in the Assignment panel if not auto-routed (needs `tickets:assign`)
7. Use **Ticket actions** buttons for allowed status moves (e.g. Open → Assigned → In Progress → Resolve → Close). Reopen from Resolved/Closed when allowed. Soft-delete is for sysadmin / IT manager only.
8. Move status: New → Open/Assigned → In Progress
9. For **major incidents**, set `majorIncident` via API/PATCH (UI badge/filter pending). Link related work with **Related tickets** (`POST /tickets/:id/children`). Review **Stage duration** to see where time was spent. Problem/change-friendly statuses include Under investigation, Known error, Scheduled, Implementing.
10. For duplicates, use **Merge into this ticket** on the primary (`POST /tickets/:id/merge` with source numbers). Sources close as **Merged**, keep their numbers, and comments/attachments are copied onto the primary with attribution.

## Auto-routing

Assignment rules can send tickets to teams (seed example: Network category → Service Desk).  
Rules may also match **ticket origin location**.  
When a rule enables **auto-assign**, LogIT picks the least-loaded eligible agent on that team (optionally filtered by skill).  
Configure rules and skills in **Routing & SLA** (`/app/admin/routing`) or see the summary on ticket detail.  
If wrong queue or person, reassign and notify.

## Working the ticket

1. Investigate; document steps.
2. Use **public replies** for requester-visible updates.
3. Use **internal notes** for passwords, hypotheses, vendor threads — never in public replies.
4. **Watch** tickets you need updates on (`POST /tickets/:id/watch` — UI pending).
5. Log time with **work logs** (`POST /tickets/:id/work-logs` with `minutes` + optional `note` — UI pending).
6. Link related **assets** when hardware is involved.
7. Set pending statuses when waiting:
   - Pending User
   - Pending Vendor
   - Pending Approval
   - On Hold  
   These can **pause SLA** when configured.

## First response

First non-requester comment/response should set `firstResponseAt` and complete first-response SLA when applicable. Respond within SLA target.

## Resolve and close

1. Set status **Resolved** with clear resolution summary (public).
2. After requester confirmation (or policy timeout), set **Closed**.
3. Do not reopen casually — use allowed transition (Resolved/Closed → Open).

## Concurrency

If save fails with conflict (“modified by someone else”), reload ticket and re-apply changes. This is optimistic locking (`version`).

## Security incidents

Treat as sensitive. Limit discussion in public channels. Follow security team process; restricted visibility expands in later phases.

## Related SOPs

- [12 SLA and escalations](./12-sla-and-escalations.md)
- [14 Assets](./14-assets.md)
- [15 Attachments and audit](./15-attachments-and-audit.md)
