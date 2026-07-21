# SOP-00 — Glossary & Ticket Language

## Purpose

Define common LogIT terms so users share one vocabulary.

## Core terms

| Term | Meaning |
| --- | --- |
| **LogIT** | The IT Service Management (ITSM) platform |
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

## Ticket statuses (MVP)

New → Open → Assigned → In Progress → Pending User / Vendor / Approval → On Hold → Resolved → Closed  
Also: Cancelled

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
