# SOP-10 — Manager Operations & Reporting

## Purpose

Help IT managers monitor service quality and act on SLA risk.

## What managers should watch

From workspace / reports (requires `reports:read`):

| Metric | Why it matters |
| --- | --- |
| Open tickets | Backlog size |
| Created today | Inflow |
| Resolved today | Throughput (`resolvedAt` today — not the same as Closed) |
| SLA breaches | Customer impact / process failure |
| Unassigned | Routing / staffing gap |
| Stage bottlenecks | Where tickets stall (Reports → Stage bottlenecks) |
| Active major incidents | `/app/major-incidents` KPIs + related work |

## Weekly operating rhythm (recommended)

1. Review SLA breaches and P1/P2 / major incidents.
2. Check unassigned older than triage SLA; use **Queue** workload strip.
3. Spot category hotspots (recurring issues → **Problems**).
4. Review agent workload on `/app/queue`.
5. Export CSV or PDF for leadership packs from **Reports** (`Download CSV` / `Download PDF`, or `GET /api/v1/reports/export.csv` · `export.pdf`). Exports are audited.
6. Review the **volume heatmap** (weekday × hour for created or resolved tickets) on Reports — useful for staffing / on-call patterns.
7. Optionally create a **scheduled export** (daily/weekly CSV or PDF emailed to you). Requires SMTP. Use **Run now** to test. API: `GET/POST /reports/schedules`, `POST /reports/schedules/:id/run`. Env: `REPORT_SCHEDULE_ENABLED`, `REPORT_SCHEDULE_POLL_MINUTES`.

## Escalation handling

When notifications show 75%/90%/100% SLA consumption:

1. Confirm ticket ownership.
2. Remove blockers (vendor, pending user).
3. Reassign senior help if needed.
4. Communicate to stakeholders for major incidents (`/app/major-incidents`).

## Approvals & CAB

- Approvers work the **Approvals** queue (`/app/approvals`).
- Sysadmins configure **multi-step policies** under Admin → Approval policies (`/app/admin/approvals`).
- Change tickets can **Submit to CAB**; policy steps drive pending rows until the change can move to Scheduled.

## Related SOPs

- [12 SLA and escalations](./12-sla-and-escalations.md)
- [11 Admin configuration](./11-admin-configuration.md)
