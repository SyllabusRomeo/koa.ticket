# SOP-06 — Roles & Permissions

## Purpose

Explain RBAC so admins assign the right access and users understand limits.

## Principle

**Frontend hiding is not security.** Every protected API action is enforced server-side with session + permission checks.

## Primary role + additional permissions

- Each user has **one primary role** (not multiple roles).
- Optionally grant **additional (extra) permissions** beyond that role.
- **Effective permissions** at session time = role permissions ∪ extras.
- Extras are **additive only** — they never remove grants from the role.
- Changing the primary role **keeps** extras that are still additive under the new role (permissions already covered by the new role are dropped from the stored extras set). Sending `extraPermissionCodes: []` clears all extras.
- UI: **Roles & Access** (`/app/admin/roles`) — radio for primary role, checkboxes for extras. Requires `roles:manage` / `users:manage`.

Existing users that previously had multiple `user_roles` rows keep their first listed role as primary until an admin saves access (which collapses to a single role).

## Roles (seeded)

| Role code | Name | Typical access |
| --- | --- | --- |
| `employee` | Employee | Own tickets, create tickets, read knowledge |
| `agent` | IT Support Agent | Queue tickets, assign, internal notes, org read, assets read |
| `senior_agent` | Senior IT Agent | Agent + broader knowledge/asset write |
| `it_manager` | IT Manager | All tickets, reports, audit read, org manage |
| `approver` | Approver | Approvals queue — decide on multi-step policy steps (service/access/change CAB) |
| `sysadmin` | Administrator | All permissions |
| `auditor` | Auditor | Audit/reports/assets/tickets read-only style access |

## Demo accounts (development only)

Use these after `npm run db:seed`. Passwords follow `LogIT-<Role>-2026!` (except admin/employee naming).

| Email | Role | Access summary |
| --- | --- | --- |
| `admin@logit.local` | `sysadmin` | **Superuser of this same app** — all permissions; configure users/org/SLA/routing |
| `employee@logit.local` | `employee` | Self-service only: own tickets, KB, catalog |
| `agent@logit.local` | `agent` | IT Service Desk: queue tickets, assign, internal notes, assets read |
| `senior@logit.local` | `senior_agent` | Tier 2/3: agent capabilities + knowledge/asset write |
| `manager@logit.local` | `it_manager` | Operational oversight: all tickets, reports, audit, org manage |
| `approver@logit.local` | `approver` | **Approvals** queue: approve/reject service & access requests |
| `auditor@logit.local` | `auditor` | Compliance/read: audit trails, reports, historical tickets/assets |

There is **no separate admin application** — elevated access is role-based inside LogIT.

Credentials table (with passwords): [SOP-03 Seed accounts](./03-technical-setup-local.md#seed-accounts-development-only).

## Key permissions

Examples from `@logit/shared`:

- `tickets:read_own` / `tickets:read_queue` / `tickets:read_all`
- `tickets:write` / `tickets:assign` / `tickets:internal_note`
- `users:read` / `users:manage`
- `org:read` / `org:manage`
- `audit:read` / `reports:read` / `settings:manage`
- `knowledge:read` / `knowledge:write`
- `assets:read` / `assets:write`

## How to assign access (admin)

1. Sign in as sysadmin.
2. Prefer **Roles & Access** in the app, or use the API:

Create user (exactly one primary role via `roleCodes` length 0 or 1; default `employee`):

```http
POST /api/v1/users
Authorization: session cookie
{
  "email": "agent@company.com",
  "firstName": "Kojo",
  "lastName": "Asante",
  "roleCodes": ["agent"],
  "departmentId": "...",
  "locationId": "..."
}
```

Update primary role + optional extras (example: employee who can also read all tickets):

```http
PATCH /api/v1/users/:id/roles
Authorization: session cookie
{
  "roleCode": "employee",
  "extraPermissionCodes": ["tickets:read_all"]
}
```

Legacy `roleCodes: ["employee"]` is still accepted (single element). Omit `extraPermissionCodes` to keep existing extras when only changing the role.

If password is omitted on create, a temporary password is generated and `mustChangePassword` is set. Ask the user to re-sign-in after access changes so the session picks up effective permissions.

## Visibility rules (tickets)

- Employees see **their own** tickets only.
- Agents with queue/all permissions see broader sets.
- Internal notes never return to users lacking `tickets:internal_note`.
- Search/list endpoints must not leak unauthorized records.

## Related SOPs

- [07 Sign-in and security](./07-sign-in-and-security.md)
- [11 Admin configuration](./11-admin-configuration.md)
