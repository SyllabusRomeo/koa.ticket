/** Canonical outbound webhook event types (M5). */
export const WEBHOOK_EVENT_TYPES = [
  'ticket.created',
  'ticket.updated',
  'ticket.assigned',
  'ticket.commented',
  'webhook.ping',
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export function isWebhookEventType(value: string): value is WebhookEventType {
  return (WEBHOOK_EVENT_TYPES as readonly string[]).includes(value);
}
