import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Icon } from './Icon';
import styles from './EmptyState.module.css';

export function EmptyState({
  icon,
  children,
  className,
}: {
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')}>
      <span className={styles.glyph}>
        <Icon icon={icon} size="lg" />
      </span>
      <div className={styles.body}>{children}</div>
    </div>
  );
}
