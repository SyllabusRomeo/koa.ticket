# SOP-21 — Incident Management System (IMS)

**Audience:** IT managers, incident commanders, senior agents with `im:*`, sysadmins  
**Related:** [Book §11A](../guide/03-operations-use-cases.md#11a-incident-management-system-ims) · [Roles](./06-roles-and-permissions.md) · [API](./19-api-reference-quick.md)

---

## Purpose

Run a **dedicated command record** for business-critical incidents: severities, war-room timeline, status workflow, and a post-incident review (PIR) draft.

IMS does **not** replace the service desk queue. Use tickets for volume work; use IMS when leadership needs one command thread and a PIR artifact.

---

## Why we have IMS

| Need | How IMS helps |
| --- | --- |
| Separate command from ticket noise | Own numbers (`IM-YYYY-…`) and board at `/app/im` |
| Shared timeline | Public + internal updates with authors and timestamps |
| Clear lifecycle | Status: declared → active → mitigated → resolved → closed |
| Named war-room roles | commander / scribe / comms / responder (API assign) |
| Post-incident write-up | **Export PIR** builds markdown from the timeline |
| Bridge to ITSM | Optional link to a ticket (`ticketId`) |

**Major incidents** (`/app/major-incidents`) remain the ITSM “heighten this ticket” view. Prefer **IMS** when you need command roles, a PIR export, and a status that is independent of ticket resolve/close.

---

## Access setup (admin)

### Permissions

| Code | Meaning |
| --- | --- |
| `im:read` | Board, detail, PIR export |
| `im:write` | Declare, updates, status changes |
| `im:command` | Assign roles (with write) |
| `im:postmortem` | PIR (also allowed with `im:read` in current API) |

**Seeded on:** `sysadmin`, `it_manager`.

### Grant an agent IM access

1. **Admin → Roles & Access**.
2. Select the user → add extras `im:read` and `im:write` (add `im:command` for role assignment via API).
3. Ask them to **sign out and back in** so nav shows **IM**.

There is **no** separate “IMS Admin” page. Access is entirely via roles/permissions.

---

## Operator workflow

### 1. Declare

1. Open **IM** (`/app/im`).
2. Title (required), severity SEV1–SEV4, optional summary.
3. **Declare** → detail page opens.

### 2. Activate and communicate

1. Set status to **active** when response begins.
2. Post short stakeholder updates on the timeline.
3. Use **Internal only** for working notes that should stay out of the public PIR section.

### 3. Mitigate → resolve → close

1. **mitigated** when customer impact is reduced.
2. **resolved** when service is restored; `resolvedAt` is set.
3. **Export PIR** → download `IM-…-PIR.md`.
4. **closed** when command stands down; track follow-ups as Problem/Change tickets.

### Status diagram

```text
declared → active → mitigated → resolved → closed
                ↑__________________|  (can reopen to active/declared; clears resolvedAt)
```

---

## UI vs API (gaps for admins)

| Feature | UI | API / config |
| --- | --- | --- |
| Board + declare + timeline + status + PIR | `/app/im` | `/api/v1/im/*` |
| Assign commander/scribe/comms/responder | List only | `POST /im/:id/roles` |
| Create with `ticketId` / `commanderId` | Not on form | `POST /im` body |
| Ticket automation rules | **None** | `/automation/rules` |
| Monitoring ingest secret | **None** on Integrations | `MONITORING_INGEST_SECRET` + `POST /integrations/monitoring/alerts` |

Monitoring ingest creates a normal **ticket**, not an `ImIncident`. Promote to IMS manually when needed.

---

## API map

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/im` | `im:read` |
| POST | `/im` | `im:write` |
| GET | `/im/:id` | `im:read` |
| GET | `/im/:id/pir` | `im:read` (or `im:postmortem`) |
| PATCH | `/im/:id/status` | `im:write` |
| POST | `/im/:id/updates` | `im:write` |
| POST | `/im/:id/roles` | `im:write` or `im:command` |

---

## Troubleshooting

| Symptom | Check |
| --- | --- |
| No **IM** in nav | Session lacks `im:read`; re-login after grant |
| Cannot declare | Need `im:write` |
| Failed to fetch on login | API not running (local: port 4100) |
| PIR empty timeline | Post updates before export |
| Agent expects Queue in top nav | Queue is on **Home** cards only |

---

## Document control

| Version | Date | Notes |
| --- | --- | --- |
| 1.0 | 2026-07-24 | IMS MVP + PIR export documented |
