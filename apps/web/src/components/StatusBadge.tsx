import {
  Ban,
  CheckCircle2,
  CircleDot,
  Clock3,
  LoaderCircle,
  PauseCircle,
  type LucideIcon,
} from 'lucide-react';
import { Icon } from '@/components/Icon';
import styles from './StatusBadge.module.css';

export type StatusTone =
  | 'open'
  | 'progress'
  | 'pending'
  | 'resolved'
  | 'closed'
  | 'cancelled';

const TONE_BY_CODE: Record<string, StatusTone> = {
  new: 'open',
  open: 'open',
  assigned: 'open',
  in_progress: 'progress',
  under_investigation: 'progress',
  scheduled: 'pending',
  implementing: 'progress',
  pending_user: 'pending',
  pending_vendor: 'pending',
  pending_approval: 'pending',
  known_error: 'pending',
  on_hold: 'pending',
  resolved: 'resolved',
  closed: 'closed',
  cancelled: 'cancelled',
  merged: 'cancelled',
  // Asset register lifecycle
  in_stock: 'open',
  in_service: 'progress',
  in_use: 'progress',
  in_repair: 'pending',
  under_repair: 'pending',
  retired: 'closed',
  disposed: 'cancelled',
};

const ICON_BY_TONE: Record<StatusTone, LucideIcon> = {
  open: CircleDot,
  progress: LoaderCircle,
  pending: Clock3,
  resolved: CheckCircle2,
  closed: PauseCircle,
  cancelled: Ban,
};

const CLASS_BY_TONE: Record<StatusTone, string> = {
  open: styles.open,
  progress: styles.progress,
  pending: styles.pending,
  resolved: styles.resolved,
  closed: styles.closed,
  cancelled: styles.cancelled,
};

export function statusTone(code: string): StatusTone {
  return TONE_BY_CODE[code] ?? 'open';
}

type Props = {
  code: string;
  name: string;
  className?: string;
  /** Hide the small lucide glyph (text-only pill). */
  hideIcon?: boolean;
};

/**
 * Compact help-desk status pill — colored by workflow family.
 * Shared across Tickets list, Home recent tickets, and agent queue.
 */
export function StatusBadge({ code, name, className, hideIcon }: Props) {
  const tone = statusTone(code);
  const IconGlyph = ICON_BY_TONE[tone];
  const classes = [styles.badge, CLASS_BY_TONE[tone], className]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes} title={name}>
      {hideIcon ? null : <Icon icon={IconGlyph} size={12} />}
      <span className={styles.label}>{name}</span>
    </span>
  );
}
