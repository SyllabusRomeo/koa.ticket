'use client';

import {
  AlertTriangle,
  CalendarClock,
  CircleDot,
  ClipboardCheck,
  Columns3,
  FolderOpen,
  Inbox,
  PauseCircle,
  Plus,
  Plug,
  Ticket,
  UserRound,
  UserX,
} from 'lucide-react';
import { Icon } from '@/components/Icon';
import { EmptyState } from '@/components/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import { SlaTimer } from '@/components/SlaTimer';
import styles from './AgentWorkspace.module.css';

export type WorkspaceMetrics = {
  kpis: {
    overdue: number;
    dueToday: number;
    open: number;
    onHoldPending: number;
    unassigned: number;
    assignedToMe: number;
  };
  byPriority: Array<{ code: string; name: string; count: number }>;
  byStatus: Array<{
    code: string;
    name: string;
    count: number;
    isTerminal: boolean;
  }>;
  recent: Array<{
    id: string;
    number: string;
    title: string;
    assigneeId: string | null;
    status: { code: string; name: string; isTerminal?: boolean };
    priority?: { code: string; name: string } | null;
    dueAt?: string | null;
    slaDueAt?: string | null;
    slaRemainingMs?: number | null;
    slaBreached?: boolean;
    slaPaused?: boolean;
    slaCompleted?: boolean;
    timeToResolution?: string | null;
  }>;
};

type Props = {
  firstName: string;
  metrics: WorkspaceMetrics;
  pendingApprovals: number;
  canWrite: boolean;
  canApprovals: boolean;
  isSysadmin?: boolean;
};

function BarList({
  items,
  accent,
}: {
  items: Array<{ name: string; count: number }>;
  accent: 'priority' | 'status';
}) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <ul className={styles.barList}>
      {items.map((item) => (
        <li key={item.name}>
          <div className={styles.barMeta}>
            <span>{item.name}</span>
            <strong>{item.count}</strong>
          </div>
          <div className={styles.barTrack}>
            <div
              className={
                accent === 'priority' ? styles.barFillPriority : styles.barFillStatus
              }
              style={{ width: `${Math.round((item.count / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function AgentWorkspace({
  firstName,
  metrics,
  pendingApprovals,
  canWrite,
  canApprovals,
  isSysadmin,
}: Props) {
  const { kpis } = metrics;
  const activeStatus = metrics.byStatus.filter((s) => !s.isTerminal);
  const closedish = metrics.byStatus.filter((s) => s.isTerminal);

  return (
    <div className={styles.workspace}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>IT workspace</p>
          <h1>Service desk, {firstName}</h1>
          <p className={styles.lede}>
            Queue health at a glance — overdue and unassigned need attention
            first.
          </p>
        </div>
        <div className={styles.ctaRow}>
          {canWrite ? (
            <a href="/app/tickets" className={styles.ctaPrimary}>
              <Icon icon={Plus} size="sm" />
              New ticket
            </a>
          ) : null}
          <a href="/app/queue" className={styles.ctaSecondary}>
            <Icon icon={Columns3} size="sm" />
            Queue board
          </a>
          <a href="/app/major-incidents" className={styles.ctaSecondary}>
            <Icon icon={AlertTriangle} size="sm" />
            Major ops
          </a>
          <a href="/app/queue?scope=unassigned" className={styles.ctaSecondary}>
            <Icon icon={UserX} size="sm" />
            Unassigned ({kpis.unassigned})
          </a>
          {canApprovals ? (
            <a href="/app/approvals" className={styles.ctaSecondary}>
              <Icon icon={ClipboardCheck} size="sm" />
              Approvals
              {pendingApprovals > 0 ? ` (${pendingApprovals})` : ''}
            </a>
          ) : null}
          {isSysadmin ? (
            <a href="/app/admin/integrations" className={styles.ctaSecondary}>
              <Icon icon={Plug} size="sm" />
              Integrations
            </a>
          ) : null}
        </div>
      </header>

      <section className={styles.kpiRow} aria-label="Queue KPIs">
        <a
          href="/app/queue"
          className={`${styles.kpi} ${kpis.overdue > 0 ? styles.kpiAlert : ''}`}
        >
          <span className={styles.kpiIcon}>
            <Icon icon={AlertTriangle} size="sm" />
          </span>
          <strong>{kpis.overdue}</strong>
          <span>Overdue</span>
        </a>
        <a href="/app/queue" className={styles.kpi}>
          <span className={styles.kpiIcon}>
            <Icon icon={CalendarClock} size="sm" />
          </span>
          <strong>{kpis.dueToday}</strong>
          <span>Due today</span>
        </a>
        <a href="/app/queue" className={styles.kpi}>
          <span className={styles.kpiIcon}>
            <Icon icon={FolderOpen} size="sm" />
          </span>
          <strong>{kpis.open}</strong>
          <span>Open</span>
        </a>
        <a
          href="/app/queue"
          className={`${styles.kpi} ${
            kpis.onHoldPending > 0 ? styles.kpiWarn : ''
          }`}
        >
          <span className={styles.kpiIcon}>
            <Icon icon={PauseCircle} size="sm" />
          </span>
          <strong>{kpis.onHoldPending}</strong>
          <span>On hold / pending</span>
        </a>
        <a
          href="/app/queue?scope=unassigned"
          className={`${styles.kpi} ${
            kpis.unassigned > 0 ? styles.kpiAlert : ''
          }`}
        >
          <span className={styles.kpiIcon}>
            <Icon icon={UserX} size="sm" />
          </span>
          <strong>{kpis.unassigned}</strong>
          <span>Unassigned</span>
        </a>
        <a href="/app/queue?scope=mine" className={styles.kpi}>
          <span className={styles.kpiIcon}>
            <Icon icon={UserRound} size="sm" />
          </span>
          <strong>{kpis.assignedToMe}</strong>
          <span>Assigned to me</span>
        </a>
      </section>

      <section className={styles.charts}>
        <div className={styles.chartPanel}>
          <h2>
            <Icon icon={AlertTriangle} size="sm" />
            Active by priority
          </h2>
          {metrics.byPriority.length === 0 ? (
            <EmptyState icon={Inbox}>No active tickets.</EmptyState>
          ) : (
            <BarList items={metrics.byPriority} accent="priority" />
          )}
        </div>
        <div className={styles.chartPanel}>
          <h2>
            <Icon icon={CircleDot} size="sm" />
            By status (active)
          </h2>
          {activeStatus.length === 0 ? (
            <EmptyState icon={Inbox}>No active statuses.</EmptyState>
          ) : (
            <BarList items={activeStatus} accent="status" />
          )}
        </div>
        <div className={styles.chartPanel}>
          <h2>
            <Icon icon={Ticket} size="sm" />
            Closed / cancelled
          </h2>
          {closedish.length === 0 ? (
            <EmptyState icon={Inbox}>None yet.</EmptyState>
          ) : (
            <BarList items={closedish} accent="status" />
          )}
        </div>
      </section>

      <section className={styles.queuePanel}>
        <div className={styles.queueHead}>
          <h2>
            <Icon icon={Ticket} size="sm" />
            Recent queue activity
          </h2>
          <a href="/app/queue">Open queue board →</a>
        </div>
        {metrics.recent.length === 0 ? (
          <EmptyState icon={Inbox}>Queue is empty.</EmptyState>
        ) : (
          <ul className={styles.queueList}>
            {metrics.recent.map((t) => {
              const metaParts = [
                t.priority?.name,
                !t.assigneeId ? 'Unassigned' : null,
              ].filter(Boolean);
              return (
                <li key={t.id}>
                  <a href={`/app/tickets/${t.number}`}>
                    <div className={styles.ticketRowTop}>
                      <strong>{t.number}</strong>
                      <div className={styles.ticketRowBadges}>
                        <SlaTimer
                          dueAt={t.dueAt}
                          slaDueAt={t.slaDueAt}
                          slaRemainingMs={t.slaRemainingMs}
                          slaBreached={t.slaBreached}
                          slaPaused={t.slaPaused}
                          slaCompleted={t.slaCompleted}
                          timeToResolution={t.timeToResolution}
                        />
                        <StatusBadge
                          code={t.status.code}
                          name={t.status.name}
                        />
                      </div>
                    </div>
                    <span>{t.title}</span>
                    {metaParts.length > 0 ? (
                      <em>{metaParts.join(' · ')}</em>
                    ) : null}
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
