# SOP-14 — IT Asset Management

## Purpose

Maintain an asset register and relate assets to tickets.

## Concepts

- **Asset type** — Laptop, Desktop, Server, etc.
- **Asset tag** — Unique human identifier (e.g. `GH-IT-0001`)
- **Lifecycle status** — e.g. in_stock, in_use, under_repair, retired (extend as needed)
- **Ticket–asset link** — shows recurring hardware problems

## How to list assets

UI: **Assets** (requires `assets:read`)  
API: `GET /api/v1/assets`

## How to create an asset (`assets:write`)

```http
POST /api/v1/assets
{
  "assetTag": "GH-IT-0042",
  "typeCode": "LAPTOP",
  "serialNumber": "...",
  "manufacturer": "Dell",
  "model": "Latitude 5540",
  "status": "in_stock",
  "assignedUserId": "optional-user-id"
}
```

List types: `GET /api/v1/assets/types`

## Link asset to ticket

```http
POST /api/v1/assets/tickets/:ticketId/link
{ "assetId": "..." }
```

Agents should link the affected CI/device on hardware incidents.

## Operational tips

- Keep asset tags consistent by site/country prefix.
- Update status on assign/repair/retire — changes should be auditable as features expand.
- Use ticket history on an asset to spot “lemon” devices.

## Related SOPs

- [09 Agent ticket handling](./09-agent-ticket-handling.md)
- [15 Attachments and audit](./15-attachments-and-audit.md)
