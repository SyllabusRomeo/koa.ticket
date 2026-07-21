# SOP-06 — Roles & Permissions

## Purpose

Explain RBAC so admins assign the right access and users understand limits.

## Principle

**Frontend hiding is not security.** Every protected API action is enforced server-side with session + permission checks.

## Roles (seeded)

| Role code | Name | Typical access |
| --- | --- | --- |
| `employee` | Employee | Own tickets, create tickets, read knowledge |
| `agent` | IT Support Agent | Queue tickets, assign, internal notes, org read, assets read |
| `senior_agent` | Senior IT Agent | Agent + broader knowledge/asset write |
| `it_manager` | IT Manager | All tickets, reports, audit read, org manage |
| `approver` | Approver | Own tickets + knowledge (approval workflows expand later) |
| `sysadmin` | System Administrator | All permissions |
| `auditor` | Auditor | Audit/reports/assets/tickets read-only style access |

## Key permissions

Examples from `@logit/shared`:

- `tickets:read_own` / `tickets:read_queue` / `tickets:read_all`
- `tickets:write` / `tickets:assign` / `tickets:internal_note`
- `users:read` / `users:manage`
- `org:read` / `org:manage`
- `audit:read` / `reports:read` / `settings:manage`
- `knowledge:read` / `knowledge:write`
- `assets:read` / `assets:write`

## How to assign roles (admin)

1. Sign in as sysadmin.
2. Use Users API (UI admin screens expand over time):

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

If password omitted, a temporary password is generated and `mustChangePassword` is set.

## Visibility rules (tickets)

- Employees see **their own** tickets only.
- Agents with queue/all permissions see broader sets.
- Internal notes never return to users lacking `tickets:internal_note`.
- Search/list endpoints must not leak unauthorized records.

## Related SOPs

- [07 Sign-in and security](./07-sign-in-and-security.md)
- [11 Admin configuration](./11-admin-configuration.md)
