# SOP-09 — Agent Ticket Handling

## Purpose

Standardize how IT agents triage, work, and close tickets in LogIt.

## Access

Agents need role `agent` or higher and queue/read permissions.

## Daily start

1. Sign in and open workspace.
2. Check the **notification bell** for SLA warnings / new assignments (or `/app/notifications`).
3. Open **Queue** (`/app/queue`) for Kanban + workload, or **Tickets** for the list.
4. Managers/agents with reports permission: review Home / Reports KPIs (open, unassigned, SLA breaches). **Resolved today** = tickets with `resolvedAt` today (not Closed).
5. Review **Major incidents** (`/app/major-incidents`) when on call for P1/MI.

## Triage checklist

For each new ticket:

1. Open the ticket from **Tickets** or **Queue** — detail shows ownership, channel badge, and actions
2. **Confirm type** (incident vs request vs access vs security vs problem vs change)
3. **Confirm category/subcategory**
4. **Confirm ticket origin site** (location) — correct if the requester picked the wrong site
5. **Validate priority** (impact × urgency). Override only with justification (logged)
6. **Assign team/agent** in the Assignment panel if not auto-routed (needs `tickets:assign`)
7. Use **Ticket actions** for allowed status moves (e.g. Open → Assigned → In Progress → Resolve → Close). Reopen from Resolved/Closed when allowed. Soft-delete is for sysadmin / IT manager only.
8. On **Queue**, drag cards between columns when the transition is allowed
9. For **major incidents**, toggle **Major incident** on detail (badge + list filter + MI queue). Link related work with **Related tickets**. Review **Stage duration** on detail / Reports → Stage bottlenecks.
10. For duplicates, use **Merge into this ticket** on the primary. Sources close as **Merged**; comments/attachments are copied onto the primary with attribution.
11. Note **intake channel** (web / email / slack / teams / chat) — filter on the ticket list when investigating channel-specific issues.

## Auto-routing

Assignment rules can send tickets to teams (seed example: Network category → Service Desk).  
Rules may also match **ticket origin location**.  
When a rule enables **auto-assign**, LogIt picks the least-loaded eligible agent on that team (optionally filtered by skill).  
Configure rules and skills in **Routing & SLA** (`/app/admin/routing`) or see the summary on ticket detail.  
If wrong queue or person, reassign and notify.

## Working the ticket

1. Investigate; document steps.
2. Use **public replies** for requester-visible updates.
3. Use **internal notes** for passwords, hypotheses, vendor threads — never in public replies.
4. Click **Watch** / **Watching** on detail when you need updates without ownership (watchers get comment + status notifications).
5. Log time in the **Work logs** panel (`minutes` + optional note).
6. Link related **assets** when hardware is involved.
7. Set pending statuses when waiting:
   - Pending User
   - Pending Vendor
   - Pending Approval
   - On Hold  
   These can **pause SLA** when configured.
8. Respect **presence** banners — if another agent is viewing/composing, coordinate to avoid collisions (optimistic locking still applies on save).

## Problems & changes

- **Problems** (`/app/problems`): raise / list problems; use RCA-oriented statuses (Under investigation, Known error). From an incident, use **Raise problem** (`POST /tickets/:id/promote-problem`).
- **Changes** (`/app/changes`): plan / rollback / schedule fields; **Submit to CAB** (`POST /tickets/:id/request-cab`) starts the approval policy path toward Scheduled / Implementing.

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

- [10 Manager operations](./10-manager-operations.md)
- [12 SLA and escalations](./12-sla-and-escalations.md)
- [14 Assets](./14-assets.md)
- [15 Attachments and audit](./15-attachments-and-audit.md)
