import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Icon } from '@/components/Icon';
import styles from './SectionHeading.module.css';

/** Consistent admin/workspace section title with glyph chip. */
export function SectionHeading({
  icon,
  children,
  id,
  className,
}: {
  icon: LucideIcon;
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <h2 id={id} className={[styles.root, className].filter(Boolean).join(' ')}>
      <span className={styles.icon} aria-hidden>
        <Icon icon={icon} size="sm" />
      </span>
      {children}
    </h2>
  );
}
