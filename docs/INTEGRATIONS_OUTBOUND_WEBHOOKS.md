# Outbound webhooks (signed)

LogIt can POST JSON payloads to your HTTPS endpoints when tickets change. Each delivery is signed with HMAC-SHA256 so receivers can verify authenticity.

**Admin UI:** `/app/admin/integrations` → Outbound webhooks (sysadmin)  
**API:** `GET/POST/PATCH/DELETE /api/v1/webhooks/endpoints` (`settings:manage`)

## Enable / disable

| Env | Default | Notes |
| --- | --- | --- |
| `WEBHOOKS_ENABLED` | `true` | Set `false` to skip all outbound deliveries (endpoints remain in DB) |

Secrets are **per endpoint** (stored in the database), not in env.

## Events

| Event | When |
| --- | --- |
| `ticket.created` | Ticket created |
| `ticket.updated` | Ticket fields changed (includes status) |
| `ticket.assigned` | Assignee set or changed |
| `ticket.commented` | Public comment added |
| `webhook.ping` | Admin “Test ping” only |

## Delivery

- Async fire-and-forget (does not block ticket create/update)
- HTTP POST, `Content-Type: application/json`, ~10s timeout
- Recent deliveries logged (last 50 per endpoint)
- Failures logged; no automatic retry worker in MVP

### Headers

| Header | Value |
| --- | --- |
| `X-LogIt-Signature` | `sha256=<hex>` HMAC-SHA256 of the **raw request body** using the endpoint secret |
| `X-LogIt-Event` | Event type (e.g. `ticket.created`) |
| `X-LogIt-Delivery-Id` | UUID for this attempt |
| `X-LogIt-Timestamp` | Unix seconds |

### Verify (Node.js)

```js
const crypto = require('crypto');

function verify(rawBody, signatureHeader, secret) {
  const expected =
    'sha256=' +
    crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader || '');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Express: use express.raw({ type: 'application/json' }) or capture raw body
app.post('/logit-hooks', (req, res) => {
  const ok = verify(req.body, req.get('X-LogIt-Signature'), process.env.LOGIT_SECRET);
  if (!ok) return res.status(401).send('bad signature');
  res.sendStatus(204);
});
```

Use the **exact bytes** of the body LogIt sent — do not re-serialize JSON before verifying.

## Configure

1. Admin → Integrations → add endpoint URL + event checkboxes.
2. Copy the signing secret shown once (or rotate via `PATCH` with `rotateSecret: true`).
3. Leave inactive until your receiver is ready; use **Test ping**.
4. Enable the endpoint; create/update a ticket and confirm delivery.

Seed includes an **inactive** example endpoint (`https://example.com/logit-hooks`) so the table is discoverable after `prisma:seed`.
