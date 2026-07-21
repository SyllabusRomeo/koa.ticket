/**
 * Shared chat → ticket field extraction for Slack / Teams / simulate.
 */
export type ParsedChatTicket = {
  title: string;
  description: string;
  typeCode: string;
  impact?: 'high' | 'medium' | 'low';
  urgency?: 'high' | 'medium' | 'low';
};

const PRIORITY_MAP: Record<
  string,
  { impact: 'high' | 'medium' | 'low'; urgency: 'high' | 'medium' | 'low' }
> = {
  p1: { impact: 'high', urgency: 'high' },
  critical: { impact: 'high', urgency: 'high' },
  p2: { impact: 'high', urgency: 'medium' },
  high: { impact: 'high', urgency: 'medium' },
  p3: { impact: 'medium', urgency: 'medium' },
  medium: { impact: 'medium', urgency: 'medium' },
  p4: { impact: 'low', urgency: 'medium' },
  low: { impact: 'low', urgency: 'low' },
  p5: { impact: 'low', urgency: 'low' },
};

function takeToken(
  text: string,
  key: string,
): { value: string | undefined; rest: string } {
  const re = new RegExp(`\\b${key}:\\s*([^\\s]+)`, 'i');
  const m = text.match(re);
  if (!m) return { value: undefined, rest: text };
  return {
    value: m[1],
    rest: text.replace(re, ' ').replace(/\s+/g, ' ').trim(),
  };
}

export function parseChatTicketMessage(raw: string): ParsedChatTicket {
  let text = (raw ?? '').trim();
  if (!text) {
    return {
      title: 'Chat ticket',
      description: '(empty message)',
      typeCode: 'incident',
    };
  }

  text = text
    .replace(/^\/logit\s+/i, '')
    .replace(/^@logit\b\s*/i, '')
    .replace(/^logit\b\s*/i, '')
    .replace(/^create:\s*/i, '')
    .trim();

  let typeCode = 'incident';
  const typeTaken = takeToken(text, 'type');
  if (typeTaken.value) {
    const t = typeTaken.value.toLowerCase().replace(/-/g, '_');
    const allowed = new Set([
      'incident',
      'service_request',
      'access_request',
      'security_incident',
      'problem',
      'change',
      'task',
    ]);
    if (allowed.has(t)) typeCode = t;
    text = typeTaken.rest;
  }

  let impact: ParsedChatTicket['impact'];
  let urgency: ParsedChatTicket['urgency'];

  const pri = takeToken(text, 'priority');
  if (pri.value) {
    const mapped = PRIORITY_MAP[pri.value.toLowerCase()];
    if (mapped) {
      impact = mapped.impact;
      urgency = mapped.urgency;
    }
    text = pri.rest;
  }

  const impactTaken = takeToken(text, 'impact');
  if (impactTaken.value) {
    const v = impactTaken.value.toLowerCase();
    if (v === 'high' || v === 'medium' || v === 'low') impact = v;
    text = impactTaken.rest;
  }

  const urgencyTaken = takeToken(text, 'urgency');
  if (urgencyTaken.value) {
    const v = urgencyTaken.value.toLowerCase();
    if (v === 'high' || v === 'medium' || v === 'low') urgency = v;
    text = urgencyTaken.rest;
  }

  const firstLine = text.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? '';
  const title =
    firstLine.length > 200
      ? `${firstLine.slice(0, 197)}...`
      : firstLine || 'Chat ticket';
  const description =
    text.length >= 3 ? text : `${text}\n\n(Created from chat integration)`;

  return { title, description, typeCode, impact, urgency };
}
