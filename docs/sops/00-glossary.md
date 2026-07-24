# SOP-00 — Glossary & Ticket Language

## Purpose

Define common LogIt terms so users share one vocabulary.

## Core terms

| Term | Meaning |
| --- | --- |
| **LogIt** | The IT Service Management (ITSM) platform |
| **Requester / Employee** | Person who opens a ticket |
| **Agent** | IT staff who works tickets |
| **Queue / Team** | Support group that owns tickets (e.g. Service Desk) |
| **Incident** | Unexpected interruption of an IT service (`INC-…`) |
| **Service request** | Standard request for something (laptop, access) (`REQ-…`) |
| **Access request** | Request for system/application access (`ACC-…`) |
| **Security incident** | Potential cybersecurity issue (`SEC-…`) — restricted visibility planned |
| **Problem** | Underlying cause of recurring incidents (`PRB-…`) |
| **Change** | Formal change to IT systems (`CHG-…`) |
| **Task** | Child work item under another record (`TSK-…`) |
| **Impact** | How widely/badly the issue affects the business (high/medium/low) |
| **Urgency** | How quickly a response is needed (high/medium/low) |
| **Priority** | Calculated from impact × urgency (P1–P5), overridable by agents |
| **SLA** | Service Level Agreement — time targets for first response and resolution |
| **Internal note** | Comment visible only to IT staff — never to the requester |
| **Public reply** | Comment visible to the requester |
| **Soft delete** | Record marked deleted/archived, not permanently erased via normal UI |
| **Optimistic locking** | Ticket `version` prevents silent overwrite when two people edit |
| **RBAC** | Role-Based Access Control — server enforces who can see/do what |
| **Audit log** | Immutable record of who did what, when |
| **Watcher** | User subscribed to ticket updates (comment + status) without owning it |
| **Work log** | Time entry (minutes + note) recorded on a ticket |
| **Major incident (MI)** | High-impact **ITSM ticket** flagged for ops dashboards (`/app/major-incidents`) |
| **IMS / IM** | Incident Management System — command module at `/app/im` (`IM-…` records) |
| **PIR** | Post-incident review — markdown draft exported from an IM timeline |
| **Channel** | Intake source stamped on the ticket: `web`, `email`, `slack`, `teams`, `chat`, `api` |
| **Presence** | Signal that another agent is viewing or composing on a ticket |
| **CAB** | Change Advisory Board path — approvals before a change is scheduled |
| **Digest** | Optional daily/weekly email rollup of unread in-app notifications |

## Ticket statuses (MVP)

New → Open → Assigned → In Progress → Pending User / Vendor / Approval → On Hold → Resolved → Closed  
Also: Cancelled, Merged, and problem/change statuses (Under investigation, Known error, Scheduled, Implementing, …).

**Resolved ≠ Closed** — Resolved means the fix is proposed; Closed is the terminal confirmation.

Invalid jumps (e.g. Closed → In Progress without reopen path) are blocked.

## Priority matrix (default)

| Impact \ Urgency | High | Medium | Low |
| --- | --- | --- | --- |
| High | P1 Critical | P2 High | P3 Medium |
| Medium | P2 High | P3 Medium | P4 Low |
| Low | P3 Medium | P4 Low | P5 Planning |

## Related SOPs

- [01 System overview](./01-system-overview.md)
- [12 SLA and escalations](./12-sla-and-escalations.md)
