import type { ComponentType, SVGProps } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Icon } from '@/components/Icon';
import styles from './integration-glyphs.module.css';

type GlyphProps = SVGProps<SVGSVGElement> & { size?: number | string };

/** Monochrome Slack mark (industry glyph, currentColor). */
export function SlackGlyph({ size = 24, className, ...rest }: GlyphProps) {
  const px = typeof size === 'number' ? size : Number(size) || 24;
  return (
    <svg
      viewBox="0 0 24 24"
      width={px}
      height={px}
      className={className}
      fill="currentColor"
      aria-hidden
      focusable="false"
      {...rest}
    >
      <path d="M6.2 14.4a1.8 1.8 0 1 1-1.8-1.8h1.8v1.8Zm.9 0a1.8 1.8 0 1 1 3.6 0v4.5a1.8 1.8 0 1 1-3.6 0v-4.5Z" />
      <path d="M9.7 6.2a1.8 1.8 0 1 1 1.8-1.8v1.8H9.7Zm0 .9a1.8 1.8 0 1 1 0 3.6H5.2a1.8 1.8 0 1 1 0-3.6h4.5Z" />
      <path d="M17.8 9.6a1.8 1.8 0 1 1 1.8 1.8h-1.8V9.6Zm-.9 0a1.8 1.8 0 1 1-3.6 0V5.1a1.8 1.8 0 1 1 3.6 0v4.5Z" />
      <path d="M14.3 17.8a1.8 1.8 0 1 1-1.8 1.8v-1.8h1.8Zm0-.9a1.8 1.8 0 1 1 0-3.6h4.5a1.8 1.8 0 1 1 0 3.6h-4.5Z" />
    </svg>
  );
}

/** Monochrome Microsoft Teams mark (industry glyph, currentColor). */
export function TeamsGlyph({ size = 24, className, ...rest }: GlyphProps) {
  const px = typeof size === 'number' ? size : Number(size) || 24;
  return (
    <svg
      viewBox="0 0 24 24"
      width={px}
      height={px}
      className={className}
      fill="currentColor"
      aria-hidden
      focusable="false"
      {...rest}
    >
      <path d="M20.25 8.25h-4.5a1.5 1.5 0 0 0-1.5 1.5v6.75a2.25 2.25 0 0 0 2.25 2.25h2.25a2.25 2.25 0 0 0 2.25-2.25v-6a2.25 2.25 0 0 0-2.25-2.25h1.5Z" />
      <circle cx="17.25" cy="5.25" r="2.25" />
      <path d="M14.25 7.5H5.25A2.25 2.25 0 0 0 3 9.75v8.25A2.25 2.25 0 0 0 5.25 20.25h7.5A2.25 2.25 0 0 0 15 18V9.75A2.25 2.25 0 0 0 12.75 7.5h1.5Z" />
      <circle cx="9.75" cy="4.5" r="2.625" />
    </svg>
  );
}

export function IntegrationStatusCard({
  title,
  status,
  detail,
  ready,
  glyph,
  lucide,
}: {
  title: string;
  status: string;
  detail: string;
  ready?: boolean;
  glyph?: ComponentType<GlyphProps>;
  lucide?: LucideIcon;
}) {
  const Glyph = glyph;
  return (
    <article
      className={`${styles.card} ${ready ? styles.ready : styles.pending}`}
    >
      <div className={styles.cardTop}>
        <span className={styles.glyph} aria-hidden>
          {Glyph ? (
            <Glyph size={26} />
          ) : lucide ? (
            <Icon icon={lucide} size={26} strokeWidth={1.6} />
          ) : null}
        </span>
        <div className={styles.cardCopy}>
          <strong>{title}</strong>
          <span>{status}</span>
        </div>
      </div>
      <em className={styles.cardDetail}>{detail}</em>
    </article>
  );
}
