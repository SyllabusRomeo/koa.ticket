# SOP-14 — IT Asset Management

## Purpose

Maintain an asset register and relate assets to tickets.

## Concepts

- **Asset type** — Laptop, Desktop, Server, Monitor, etc.
- **Asset tag** — Unique human identifier (e.g. `GH-IT-0001`)
- **Display name** — Optional friendly name (falls back to manufacturer + model)
- **Lifecycle status** — `in_stock`, `in_service`, `in_repair`, `retired`, `disposed` (aliases `in_use` → `in_service`, `under_repair` → `in_repair`)
- **Location / assignee** — Where it lives and who has it
- **Ticket–asset link** — shows recurring hardware problems

## How to list assets

UI: **Assets** (`/app/assets`, requires `assets:read`)  
API: `GET /api/v1/assets?status=&typeCode=&locationId=&q=`

Statuses: `GET /api/v1/assets/statuses`  
Types: `GET /api/v1/assets/types`  
CSV: `GET /api/v1/assets/export.csv` (same filters)

## How to create / update (`assets:write`)

```http
POST /api/v1/assets
{
  "assetTag": "GH-IT-0042",
  "typeCode": "LAPTOP",
  "name": "Finance laptop",
  "serialNumber": "...",
  "manufacturer": "Dell",
  "model": "Latitude 5540",
  "status": "in_stock",
  "assignedUserId": "optional-user-id",
  "locationId": "optional-location-id",
  "purchaseDate": "2026-01-15",
  "warrantyExpiresAt": "2029-01-15",
  "notes": "optional"
}
```

```http
PATCH /api/v1/assets/:id
{ "status": "in_service", "assignedUserId": "...", "notes": "..." }
```

Assignees for the form: `GET /api/v1/assets/assignees` (`assets:write`)

## Soft-retire

```http
DELETE /api/v1/assets/:id
```

Sets status to `retired`, clears assignee, and soft-deletes (`deletedAt`) so it leaves the active register.

## Link asset to ticket

```http
POST /api/v1/assets/tickets/:ticketId/link
{ "assetId": "..." }
```

Agents should link the affected CI/device on hardware incidents. (Ticket detail UI for linking is still thin — API is ready.)

## Operational tips

- Keep asset tags consistent by site/country prefix.
- Update status on assign/repair/retire.
- Use ticket history on an asset to spot “lemon” devices.
- Export CSV from the Assets page when auditing inventory.

## Related SOPs

- [09 Agent ticket handling](./09-agent-ticket-handling.md)
- [15 Attachments and audit](./15-attachments-and-audit.md)
