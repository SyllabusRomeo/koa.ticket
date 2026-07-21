# SOP-13 — Knowledge Base & Service Catalog

## Purpose

Publish reusable guidance and present requestable IT services.

## Knowledge base

### For employees

1. Open **Knowledge** in the workspace.
2. Browse published articles.
3. Follow steps; open a ticket only if unresolved.

### For authors (agents / managers with `knowledge:write`)

Create via API:

```http
POST /api/v1/knowledge
{
  "title": "Connect to corporate VPN",
  "slug": "connect-vpn",
  "body": "Step-by-step...",
  "category": "Network",
  "publish": true
}
```

Drafts remain invisible to employees until published:

```http
POST /api/v1/knowledge/:id/publish
```

### Content standards

- Clear title; one topic per article
- Steps numbered; include screenshots where helpful
- Review dates / ownership (process) even if fields expand later
- Never put secrets in articles

Seed example: `reset-password-m365`.

## Service catalog

### For employees

1. Open **Catalog**.
2. Read available services (code, name, description).
3. Raise the matching request ticket type/category.

### For admins (`settings:manage`)

```http
POST /api/v1/catalog
{
  "code": "REQ-LAPTOP",
  "name": "Request Laptop",
  "description": "...",
  "ticketTypeCode": "service_request",
  "categoryCode": "HARDWARE",
  "teamId": "..."
}
```

Seed example: Request Laptop.

## Related SOPs

- [08 Employee self-service](./08-employee-self-service.md)
- [11 Admin configuration](./11-admin-configuration.md)
