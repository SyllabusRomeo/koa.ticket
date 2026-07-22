/** Normalize RFC Message-ID values for storage and lookup. */
export function normalizeMessageId(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const cleaned = raw
    .trim()
    .replace(/^<|>$/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
  return cleaned || null;
}

/** Split a References header into normalized Message-IDs (newest last). */
export function parseReferencesHeader(
  raw: string | null | undefined,
): string[] {
  if (!raw) return [];
  const matches = raw.match(/<[^>]+>/g) ?? raw.split(/\s+/);
  const ids: string[] = [];
  for (const part of matches) {
    const id = normalizeMessageId(part);
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function formatMessageIdHeader(normalized: string): string {
  return normalized.startsWith('<') ? normalized : `<${normalized}>`;
}
