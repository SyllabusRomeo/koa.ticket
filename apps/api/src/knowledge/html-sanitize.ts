import sanitizeHtml from 'sanitize-html';

/** Allowlist for knowledge article rich-text bodies (help-center style). */
const ALLOWED_TAGS = [
  'p',
  'h1',
  'h2',
  'h3',
  'strong',
  'em',
  'ul',
  'ol',
  'li',
  'a',
  'img',
  'br',
  'code',
  'pre',
  'blockquote',
];

export function sanitizeKnowledgeHtml(dirty: string): string {
  return sanitizeHtml(dirty ?? '', {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      code: ['class'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: {
      img: ['http', 'https'],
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', {
        rel: 'noopener noreferrer',
        target: '_blank',
      }),
    },
    // Keep relative API paths for inline knowledge media
    allowProtocolRelative: false,
  });
}

/** Extract knowledge attachment ids referenced in img src / links. */
export function extractKnowledgeAttachmentIds(html: string): string[] {
  const ids = new Set<string>();
  const re =
    /\/knowledge\/attachments\/([a-z0-9]+)\/(?:content|download)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    ids.add(m[1]);
  }
  return [...ids];
}
