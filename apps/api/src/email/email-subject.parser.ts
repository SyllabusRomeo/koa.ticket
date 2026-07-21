/**
 * Extract LogIT ticket numbers from inbound email subjects.
 * Prefers bracket tokens like [INC-2026-000123], else bare INC-2026-000123.
 */
const BRACKETED =
  /\[([A-Z][A-Z0-9_]*-\d{4}-\d{1,8})\]/i;
const BARE = /\b([A-Z][A-Z0-9_]*-\d{4}-\d{1,8})\b/i;

export function extractTicketNumberFromSubject(
  subject: string | null | undefined,
): string | null {
  const text = (subject ?? '').trim();
  if (!text) return null;
  const bracket = text.match(BRACKETED);
  if (bracket?.[1]) return bracket[1].toUpperCase();
  const bare = text.match(BARE);
  return bare?.[1] ? bare[1].toUpperCase() : null;
}

/** Strip Re:/Fwd: noise for new-ticket titles when no token is present. */
export function cleanEmailSubjectTitle(subject: string | null | undefined): string {
  let text = (subject ?? '').trim();
  text = text.replace(/^(?:(?:re|fw|fwd|aw|sv)\s*:\s*)+/i, '').trim();
  return text || 'Email ticket';
}
