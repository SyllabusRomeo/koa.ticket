# Part III — Operations playbook

← [Setup](./02-setup-configuration.md) · [Book home](../USER_AND_DEVELOPER_GUIDE.md) · Next: [Developer guide](./04-developer-guide.md)

This part is the **how-to book** for daily work. Each section: what it is → who → steps → flow → tips. Longer field manuals: [sops/](../sops/README.md).

---

## 11. Tickets, queue & major incidents

### What it is

The core case record for incidents, service/access requests, security incidents, problems, changes, and tasks. Staff work them from **Tickets** (list) or **Queue** (Kanban + workload).

### Who

| Role | Typical actions |
| --- | --- |
| Employee | Create, comment, track own |
| Agent+ | Triage, assign, internal notes, resolve |
| Manager | Oversight, MI, soft-delete |

### Employee — create a ticket

1. **Tickets** → create (or Home shortcut).
2. Choose type, title, description, category, impact/urgency, origin site.
3. Optional: AI classify / related KB suggestions before submit.
4. Attach files if needed; submit.
5. Track status; reply on the public thread.

Employee SOP: [SOP-08](../sops/08-employee-self-service.md).

### Agent — work a ticket

1. Open **Queue** or **Tickets**; check notification bell.
2. Triage: type, category, origin site, priority, assignment.
3. Public reply vs **internal note**; **Watch** if needed; **Work logs** for time.
4. Link assets; set pending_* when waiting (may pause SLA).
5. Resolve with a clear public summary → Close after confirmation/policy.
6. On conflict (“modified by someone else”), reload and re-apply (`version` lock).

Agent SOP: [SOP-09](../sops/09-agent-ticket-handling.md).

### Ticket lifecycle flow

```mermaid
flowchart TD
  A[Intake: web / email / Slack / Teams / chat / API] --> B[New]
  B --> C[Open]
  C --> D[Assigned]
  D --> E[In progress]
  E --> F{Waiting?}
  F -->|User| G[Pending user]
  F -->|Vendor| H[Pending vendor]
  F -->|Approval| I[Pending approval]
  F -->|Hold| J[On hold]
  F -->|No| K[Resolved]
  G --> E
  H --> E
  I --> E
  J --> E
  K --> L[Closed]
  K --> C
  L --> C
  E --> M[Cancelled]
```

### Major incidents

1. Toggle **Major incident** on ticket detail (badge + list/queue filter).
2. Ops view: `/app/major-incidents` — KPIs + related work cards.
3. Link related tickets; watch closely; prefer clear public status updates.

### Merge & relationships

- **Merge into this ticket** — sources become merged; comments/attachments copied with attribution.
- Parent/child links for related work without merge.

---

## 12. Service catalog & requests

### What it is

Published offerings (e.g. laptop request, access package) with optional **dynamic forms** (`formSchema`). Submitting creates a structured ticket with persisted answers.

### Who

Everyone can browse (per nav). Fulfillment = agents/approvers depending on policy.

### How-to (requester)

1. Open **Catalog**.
2. Pick an item; complete required fields.
3. Submit → land on the created ticket.
4. If approval is required, status moves toward pending approval; watch notifications.

### Flow

```mermaid
flowchart LR
  A[Browse catalog] --> B[Fill dynamic form]
  B --> C[Validate formSchema]
  C --> D[Create ticket + answers]
  D --> E{Approval policy?}
  E -->|Yes| F[Approvals queue]
  E -->|No| G[Route / assign]
  F -->|Approved| G
  F -->|Rejected| H[Cancelled / rejected path]
  G --> I[Fulfill & resolve]
```

Catalog SOP: [SOP-13](../sops/13-knowledge-and-catalog.md).

---

## 13. Knowledge base & deflection

### What it is

Searchable articles (rich HTML). Views + helpful / not helpful / “solved my issue” feed **deflection analytics** on Reports.

### Who

| Action | Permission |
| --- | --- |
| Read | `knowledge:read` |
| Create/edit | `knowledge:write` |

### How-to

**Reader:** Knowledge → open article → use feedback buttons if the article helped (or didn’t).

**Author:** Knowledge → New / Edit → publish clear title, category tags, steps. Prefer articles that answer the top ticket categories.

**Analyst:** Reports → deflection panel — views, helpful rates, solved events.

Tip: Put KB search **before** ticket create in training — deflection only works if people look first.

---

## 14. Assets / CMDB

### What it is

IT asset / CI register: tag, type, status, assignee, location, serial/manufacturer/model, warranty; **relationships** for impact analysis; **discovery CSV** import.

Statuses: `in_stock` · `in_service` · `in_repair` · `retired` · `disposed`.

Relation types: depends_on, runs_on, hosted_by, connected_to, uses, backs_up, member_of.

### Who

Read: `assets:read`. Write: `assets:write`.

### How-to

1. **Assets** — select a row → edit detail panel → **Save** / **Retire**.
2. **Relationships** — pick related asset + type → **Add link**; remove with trash.
3. Review **Impact preview** (BFS hops) before changes/outages.
4. Link assets on ticket detail when hardware is involved.
5. Import discovery CSV when bulk-loading CIs / relations.

### Relationship / impact flow

```mermaid
flowchart TD
  A[Select CI] --> B[Add relation to neighbor]
  B --> C[Graph of depends_on / uses / ...]
  C --> D[Impact BFS preview]
  D --> E[Change / MI planning]
  E --> F[Notify owners of hop-1 / hop-2 CIs]
```

Assets SOP: [SOP-14](../sops/14-assets.md).

---

## 15. Approvals & CAB

### What it is

Multi-step **approval policies** (sequential steps). Used for access/service requests and **Change → Submit to CAB**.

### Who

| Action | Permission |
| --- | --- |
| View queue | `approvals:read` |
| Approve/reject | `approvals:decide` |
| Configure policies | `settings:manage` |

### How-to (approver)

1. Open **Approvals**.
2. Review request context / linked ticket.
3. Approve or reject with a comment.
4. Next step unlocks until policy completes; ticket advances (e.g. change → Scheduled).

### CAB flow

```mermaid
flowchart TD
  A[Create / open Change] --> B[Fill plan / rollback / schedule]
  B --> C[Submit to CAB]
  C --> D[Approval policy steps]
  D -->|All approved| E[Scheduled / Implementing]
  D -->|Rejected| F[Rejected / revise]
  E --> G[Implement]
  G --> H[Close change]
```

---

## 16. SLA, routing & assignment

### What it is

- **SLA policies** attach targets (first response / resolve); worker ticks instances; escalations notify.
- **Assignment rules** match category/location → team; optional **auto-assign** least-open agent filtered by **skills**.
- Pending statuses can **pause** clocks when configured.

### Who configures

Admins / managers with `settings:manage` or `org:manage` → **Routing & SLA**.

### Agent tips

- First non-requester response should satisfy first-response SLA.
- Wrong queue? Reassign and leave a note.
- Watch bell for SLA warnings.

Detail: [SOP-12](../sops/12-sla-and-escalations.md).

---

## 17. Problems & changes

### Problems (`/app/problems`)

- Raise from an incident (**Raise problem**) or create dedicated PRB.
- Statuses oriented to investigation / known error.
- Link related incidents; capture RCA fields.

### Changes (`/app/changes`)

- Capture plan, rollback, schedule windows.
- **Submit to CAB** → Approvals → scheduled implementation.
- Coordinate with Assets impact preview for CI-touching changes.

Manager view: [SOP-10](../sops/10-manager-operations.md) · Change SOP: [SOP-20](../sops/20-change-and-release.md) (release process; product change UI as above).

---

## 18. Reports, audit & notifications

### Reports (`/app/reports`)

- Summary KPIs (open, unassigned, breaches, by location, etc.)
- Heatmap (day-of-week × hour)
- Stage bottlenecks / stuck list
- CSV / PDF export
- Scheduled email exports (when SMTP + schedules enabled)
- Knowledge deflection panel

### Audit (`/app/audit`)

- Filtered trail of sensitive/business events
- CSV export
- **Immutable export schedules** — emailed CSV with **SHA-256** run history (L5)

### Notifications

- Bell + `/app/notifications` inbox
- Profile: digest daily/weekly, quiet hours
- Watchers get comment/status fan-out

SOPs: [SOP-15](../sops/15-attachments-and-audit.md), [SOP-16](../sops/16-notifications.md), [NOTIFICATIONS.md](../NOTIFICATIONS.md).

---

## 19. Integrations

### Email

- Outbound SMTP for notifications/digests/exports
- Inbound + **IMAP UNSEEN** poller creates/comments tickets with threading (Message-ID / In-Reply-To)
- Tickets stamped `channel=email`

### Slack / Teams

- Signed intake (Slack HMAC; Teams Bot Framework JWT + shared-secret fallback)
- Channel stamp + deep links via `APP_PUBLIC_URL`

### Outbound webhooks

- HMAC-signed endpoints configured in Admin → Integrations
- Delivery log; rotate secrets
- **Note:** deliveries are logged; automatic retry worker is polish/backlog

Admin hub: `/app/admin/integrations`. Docs: email / Slack-Teams / webhooks under `docs/`.

---

## 20. Quick reference by role

### Employee

| Task | Where |
| --- | --- |
| Get help without a ticket | Knowledge |
| Request a service | Catalog |
| Report an issue | Tickets → create |
| Track / reply | My tickets |
| MFA / digests | Profile |

### Agent

| Task | Where |
| --- | --- |
| Board + workload | Queue |
| Triage list | Tickets |
| P1 ops | Major |
| Known errors | Problems |
| Planned work | Changes |
| Hardware context | Assets |
| Decisions waiting | Approvals |

### Approver

| Task | Where |
| --- | --- |
| Decide requests / CAB | Approvals |

### Manager / Admin

| Task | Where |
| --- | --- |
| People | Users, Roles & Access |
| Org | Locations, Departments, Teams |
| Policy | Routing & SLA, Approval policies |
| Look & feel | Branding |
| Channels | Integrations |
| Compliance | Audit, Reports |

### Auditor

| Task | Where |
| --- | --- |
| Evidence | Audit (+ scheduled checksummed exports) |
| Trends | Reports |

---

← [Setup](./02-setup-configuration.md) · [Book home](../USER_AND_DEVELOPER_GUIDE.md) · Next: [Developer guide](./04-developer-guide.md)
