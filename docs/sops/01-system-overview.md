# SOP-01 — System Overview

## Purpose

Explain what LogIt does, who it is for, and the expected support journey.

## What LogIt is

LogIt is an enterprise IT Service Management platform — not a simple ticket CRUD tool. It centralizes:

- Incident and service-request reporting (web, email, Slack/Teams)
- Assignment, prioritization, and SLA tracking
- Agent collaboration (public replies vs internal notes, watchers, work logs, presence)
- Problem / Change / CAB and major-incident operations
- **Incident Management System (IMS)** — command board at `/app/im`, war-room timeline, PIR export
- Knowledge articles and a service catalog with dynamic forms
- Asset register linked to tickets
- Dashboards, reporting (heatmaps, scheduled exports), and audit trails

## Who uses it

| Persona | Primary job in LogIt |
| --- | --- |
| Employee / Requester | Report issues, request services, track own tickets, read knowledge |
| IT Agent | Work queue/Kanban, update status, respond, link assets, log time |
| Senior Agent | Escalations, richer technical work, raise problems |
| IT Manager | Oversight, SLA performance, reports, MI dashboard, **IMS command**, team/config |
| Approver | Approve/reject multi-step approval policies (service/access/change) |
| Administrator | Users, roles, org, SLA, routing, integrations, branding |
| Auditor | Read-only audit / historical / compliance views |

## Expected operating model

```
Employee / channel intake
  → Self-service portal or email/Slack/Teams
  → Incident / Service / Access / Problem / Change
  → Categorization + routing (skills/workload) + priority + SLA
  → Support queue / Kanban / agent
  → Investigation / fulfillment / CAB when required
  → Escalation / approval where required
  → Resolution → user confirmation → closure
  → Feedback / reporting / improvement
```

## What is shipped vs later

**Shipped (through L5):** auth/RBAC + MFA/SSO, org (**Locations** + **Departments** + Teams + Users admin), core tickets (parent/child, merge, origin location, channel metadata), watchers/worklogs UI, MI badge + dashboard, presence, queue/Kanban, Problem/Change/CAB, attachments, audit + immutable export schedules, SLA worker + admin UI, skills/workload assignment, notifications (in-app + email + digests), dashboards, knowledge + deflection analytics, catalog dynamic forms, assets/CMDB relations + discovery + impact, reports (heatmap + schedules + stage bottlenecks), Slack/Teams + email/IMAP, signed outbound webhooks, AI assists, portal themes, Docker/Hetzner + CI/TLS.

**Optional polish:** webhook retry worker, SAML / more IdPs, bot outbound replies, board presets. Full book: [USER_AND_DEVELOPER_GUIDE.md](../USER_AND_DEVELOPER_GUIDE.md).

## Brand

LogIt uses brand colors: primary `#0F4A40`, light `#EDF4AC`, secondary `#456433`, warm background `#FBF1DA`.

## Related SOPs

- [02 System architecture](./02-system-architecture.md)
- [08 Employee self-service](./08-employee-self-service.md)
- [09 Agent ticket handling](./09-agent-ticket-handling.md)
