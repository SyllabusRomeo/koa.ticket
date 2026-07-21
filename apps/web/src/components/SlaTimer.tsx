'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { Icon } from '@/components/Icon';
import {
  formatSlaDuration,
  liveSlaRemainingMs,
  type SlaTimerFields,
} from '@/lib/sla-time';
import styles from './SlaTimer.module.css';

type Props = SlaTimerFields & {
  /** Compact badge (list/queue) vs panel rows (detail). */
  variant?: 'badge' | 'panel';
  className?: string;
};

function useNow(tickMs = 30_000, enabled = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setNow(Date.now()), tickMs);
    return () => window.clearInterval(id);
  }, [tickMs, enabled]);
  return now;
}

export function SlaTimer({
  variant = 'badge',
  className,
  ...fields
}: Props) {
  const ticking = !fields.slaCompleted && !fields.slaPaused;
  const now = useNow(30_000, ticking);
  const remainingMs = liveSlaRemainingMs(fields, now);

  if (variant === 'panel') {
    const due = fields.slaDueAt ?? fields.dueAt;
    const overdue = remainingMs != null && remainingMs < 0;
    const breached = Boolean(fields.slaBreached) || overdue;

    return (
      <div className={`${styles.panel} ${className ?? ''}`.trim()}>
        <div className={styles.panelRow}>
          <span>Target due</span>
          <strong>
            {due
              ? new Date(due).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })
              : '—'}
          </strong>
        </div>
        <div className={styles.panelRow}>
          <span>Time to resolution</span>
          <strong>
            {fields.slaCompleted ? (
              <span className={styles.muted}>Completed</span>
            ) : remainingMs == null ? (
              <span className={styles.muted}>No SLA</span>
            ) : (
              <span
                className={`${styles.timer} ${
                  overdue || breached ? styles.overdue : ''
                } ${fields.slaPaused ? styles.paused : ''}`.trim()}
              >
                <Icon icon={Clock} size="sm" />
                {formatSlaDuration(remainingMs)}
                {fields.slaPaused ? ' · paused' : ''}
              </span>
            )}
          </strong>
        </div>
        <div className={styles.panelRow}>
          <span>Breached</span>
          <strong className={breached ? styles.breachedYes : styles.breachedNo}>
            {breached ? 'Yes' : 'No'}
          </strong>
        </div>
      </div>
    );
  }

  if (fields.slaCompleted || remainingMs == null) {
    return (
      <span
        className={`${styles.timer} ${styles.muted} ${className ?? ''}`.trim()}
        title="Time to resolution"
      >
        <Icon icon={Clock} size="sm" />
        —
      </span>
    );
  }

  const overdue = remainingMs < 0 || Boolean(fields.slaBreached);
  const label = formatSlaDuration(remainingMs);

  return (
    <span
      className={`${styles.timer} ${overdue ? styles.overdue : ''} ${
        fields.slaPaused ? styles.paused : ''
      } ${className ?? ''}`.trim()}
      title={
        overdue
          ? `Overdue by ${label.replace(/^-/, '')}`
          : `Time to resolution: ${label}`
      }
    >
      <Icon icon={Clock} size="sm" />
      {label}
      {fields.slaPaused ? ' · paused' : ''}
    </span>
  );
}
