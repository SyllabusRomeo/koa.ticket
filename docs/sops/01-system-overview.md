# SOP-01 — System Overview

## Purpose

Explain what LogIT does, who it is for, and the expected support journey.

## What LogIT is

LogIT is an enterprise IT Service Management platform — not a simple ticket CRUD tool. It centralizes:

- Incident and service-request reporting
- Assignment, prioritization, and SLA tracking
- Agent collaboration (public replies vs internal notes)
- Knowledge articles and a basic service catalog
- Asset register linked to tickets
- Dashboards, reporting, and audit trails

## Who uses it

| Persona | Primary job in LogIT |
| --- | --- |
| Employee / Requester | Report issues, request services, track own tickets, read knowledge |
| IT Agent | Work assigned/queue tickets, update status, respond, link assets |
| Senior Agent | Escalations, richer technical work |
| IT Manager | Oversight, SLA performance, reports, team/config oversight |
| Approver | Approve/reject selected requests (workflow expansion planned) |
| System Administrator | Users, roles, org structure, SLA, routing, system settings |
| Auditor | Read-only audit / historical / compliance views |

## Expected operating model

```
Employee
  → Self-service portal
  → Incident / Service / Access request
  → Categorization + routing + priority + SLA
  → Support queue / agent
  → Investigation / fulfillment
  → Escalation / approval where required
  → Resolution → user confirmation → closure
  → Feedback / reporting / improvement
```

## What is in MVP vs later

**In MVP today:** auth/RBAC, org structure, core tickets, attachments, audit, SLA worker, assignment rules, notifications (in-app), dashboards, knowledge, catalog, assets, reports, Docker/Hetzner scaffolding.

**Later (planned):** advanced dynamic forms, full approval engines, problem/change depth, email-to-ticket, Microsoft Entra SSO, Teams, CMDB, AI assists.

## Brand

LogIT uses brand colors: primary `#0F4A40`, light `#EDF4AC`, secondary `#456433`, warm background `#FBF1DA`.

## Related SOPs

- [02 System architecture](./02-system-architecture.md)
- [08 Employee self-service](./08-employee-self-service.md)
- [09 Agent ticket handling](./09-agent-ticket-handling.md)
