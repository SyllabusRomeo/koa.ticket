# SOP-10 — Manager Operations & Reporting

## Purpose

Help IT managers monitor service quality and act on SLA risk.

## What managers should watch

From workspace / reports (requires `reports:read`):

| Metric | Why it matters |
| --- | --- |
| Open tickets | Backlog size |
| Created today | Inflow |
| Resolved today | Throughput |
| SLA breaches | Customer impact / process failure |
| Unassigned | Routing / staffing gap |

## Weekly operating rhythm (recommended)

1. Review SLA breaches and P1/P2 incidents.
2. Check unassigned older than triage SLA.
3. Spot category hotspots (recurring issues → problem candidates).
4. Review agent workload distribution.
5. Export CSV or PDF for leadership packs from **Reports** (`Download CSV` / `Download PDF`, or `GET /api/v1/reports/export.csv` · `export.pdf`). Exports are audited.

## Escalation handling

When notifications show 75%/90%/100% SLA consumption:

1. Confirm ticket ownership.
2. Remove blockers (vendor, pending user).
3. Reassign senior help if needed.
4. Communicate to stakeholders for major incidents.

## Approvals

Approver role exists; advanced multi-step approval UX expands later. Until then, managers may track pending_approval status tickets manually.

## Related SOPs

- [12 SLA and escalations](./12-sla-and-escalations.md)
- [11 Admin configuration](./11-admin-configuration.md)
