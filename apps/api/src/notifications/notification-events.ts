/** Canonical in-app / email notification event types for LogIt. */
export const NOTIFICATION_EVENTS = [
  {
    type: 'ticket.created',
    label: 'Ticket opened',
    description: 'When a ticket is created (requester and assigned team).',
  },
  {
    type: 'ticket.assigned',
    label: 'Ticket assigned',
    description: 'When you are assigned as the agent on a ticket.',
  },
  {
    type: 'ticket.opened',
    label: 'Ticket reopened / opened',
    description: 'When a ticket moves into an active working status.',
  },
  {
    type: 'ticket.resolved',
    label: 'Ticket resolved',
    description: 'When a ticket is marked resolved (awaiting close).',
  },
  {
    type: 'ticket.closed',
    label: 'Ticket closed / cancelled',
    description: 'When a ticket is closed, cancelled, or merged.',
  },
  {
    type: 'ticket.status',
    label: 'Other status changes',
    description: 'All other status transitions on tickets you own or watch.',
  },
  {
    type: 'ticket.comment',
    label: 'Comments',
    description: 'Public replies and (for staff) relevant discussion.',
  },
  {
    type: 'approval.required',
    label: 'Approval requested',
    description: 'When your approval is needed.',
  },
  {
    type: 'approval.completed',
    label: 'Approval decided',
    description: 'When a request you raised is approved or rejected.',
  },
  {
    type: 'sla.warning',
    label: 'SLA warnings',
    description: 'When an SLA threshold is approached or breached.',
  },
] as const;

export type NotificationEventType =
  (typeof NOTIFICATION_EVENTS)[number]['type'];

export function statusChangeEventType(
  statusCode: string,
): NotificationEventType {
  if (statusCode === 'resolved') return 'ticket.resolved';
  if (
    statusCode === 'closed' ||
    statusCode === 'cancelled' ||
    statusCode === 'merged'
  ) {
    return 'ticket.closed';
  }
  if (
    statusCode === 'open' ||
    statusCode === 'new' ||
    statusCode === 'assigned' ||
    statusCode === 'in_progress' ||
    statusCode === 'reopened'
  ) {
    return 'ticket.opened';
  }
  return 'ticket.status';
}

export function statusChangeLabel(statusCode: string): string {
  switch (statusCode) {
    case 'resolved':
      return 'Resolved';
    case 'closed':
      return 'Closed';
    case 'cancelled':
      return 'Cancelled';
    case 'merged':
      return 'Merged';
    case 'open':
    case 'new':
    case 'assigned':
    case 'in_progress':
      return 'Opened / active';
    default:
      return `Status: ${statusCode}`;
  }
}
