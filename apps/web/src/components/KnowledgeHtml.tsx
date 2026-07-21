'use client';

import { useMemo } from 'react';
import DOMPurify from 'dompurify';
import styles from './KnowledgeHtml.module.css';

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

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100/api/v1';

/** Rewrite relative knowledge media paths to the API origin for <img src>. */
export function rewriteKnowledgeMediaUrls(html: string): string {
  if (!html) return '';
  return html
    .replace(
      /src=(["'])\/api\/v1\/knowledge\/attachments\//g,
      `src=$1${API_BASE}/knowledge/attachments/`,
    )
    .replace(
      /src=(["'])\/knowledge\/attachments\//g,
      `src=$1${API_BASE}/knowledge/attachments/`,
    );
}

export function sanitizeKnowledgeHtmlClient(dirty: string): string {
  if (typeof window === 'undefined') return '';
  return DOMPurify.sanitize(rewriteKnowledgeMediaUrls(dirty), {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'src', 'alt', 'width', 'height', 'class'],
    ALLOW_DATA_ATTR: false,
  });
}

export function KnowledgeHtml({ html }: { html: string }) {
  const clean = useMemo(() => sanitizeKnowledgeHtmlClient(html), [html]);
  const looksPlain =
    html &&
    !/<[a-z][\s\S]*>/i.test(html) &&
    !html.includes('&lt;');

  if (looksPlain) {
    return <article className={styles.body}>{html}</article>;
  }

  return (
    <article
      className={styles.body}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
