'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type AuthUser } from '@/lib/api';
import { can } from '@/lib/access';
import { AppShell } from '@/components/AppShell';
import { Button, ButtonLink } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import {
  AlertTriangle,
  BarChart3,
  CircleDot,
  Download,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Ticket,
  UserX,
} from 'lucide-react';
import appStyles from '../app.module.css';
import styles from './reports.module.css';

type Breakdown = { code: string; name: string; count: number };

type ReportSummary = {
  openTickets: number;
  createdToday: number;
  resolvedToday: number;
  slaBreaches: number;
  unassigned: number;
  totalInRange: number;
  from: string | null;
  to: string | null;
  byStatus: Breakdown[];
  byPriority: Breakdown[];
  byType: Breakdown[];
  byTeam: Breakdown[];
  byAssignee: Breakdown[];
  byLocation?: Breakdown[];
  generatedAt: string;
};

function BreakdownList({
  title,
  rows,
}: {
  title: string;
  rows: Breakdown[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <section className={styles.breakdown}>
      <h2 className={styles.breakdownTitle}>{title}</h2>
      {rows.length === 0 ? (
        <p className={styles.muted}>No data in this range.</p>
      ) : (
        <ul className={styles.barList}>
          {rows.map((row) => (
            <li key={row.code}>
              <div className={styles.barMeta}>
                <span>{row.name}</span>
                <strong>{row.count}</strong>
              </div>
              <div className={styles.barTrack} aria-hidden>
                <div
                  className={styles.barFill}
                  style={{ width: `${Math.round((row.count / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function ReportsPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);

  async function load(range: { from?: string; to?: string } = {}) {
    const data = await api.reportSummary(range);
    setSummary(data);
  }

  useEffect(() => {
    (async () => {
      try {
        const { user } = await api.me();
        if (!can(user, 'reports:read')) {
          router.replace('/app');
          return;
        }
        setUser(user);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed');
        router.replace('/login');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function onApply(e: FormEvent) {
    e.preventDefault();
    setRefreshing(true);
    setError(null);
    try {
      await load({ from: from || undefined, to: to || undefined });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not refresh report');
    } finally {
      setRefreshing(false);
    }
  }

  async function onExport(format: 'csv' | 'pdf') {
    setExporting(format);
    setError(null);
    try {
      const range = { from: from || undefined, to: to || undefined };
      if (format === 'csv') await api.downloadReportCsv(range);
      else await api.downloadReportPdf(range);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(null);
    }
  }

  async function logout() {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    router.replace('/login');
  }

  if (loading || !user) {
    return (
      <main className={appStyles.page}>
        <p className={appStyles.muted}>Loading reports…</p>
      </main>
    );
  }

  return (
    <AppShell user={user} onLogout={logout} title="Reports">
      <div className={styles.layout}>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>LogIT reporting hub</p>
          <p className={styles.lede}>
            Operational snapshot for IT managers — KPIs, breakdowns, and
            exports for leadership packs.
          </p>
        </section>

        <form className={styles.filters} onSubmit={onApply}>
          <div className={styles.filterRow}>
            <label className={styles.field}>
              <span>From</span>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span>To</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
            <div className={styles.filterActions}>
              <Button type="submit" disabled={refreshing}>
                {refreshing ? 'Applying…' : 'Apply range'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={refreshing || (!from && !to)}
                onClick={async () => {
                  setFrom('');
                  setTo('');
                  setRefreshing(true);
                  try {
                    await load({});
                  } finally {
                    setRefreshing(false);
                  }
                }}
              >
                Clear
              </Button>
            </div>
          </div>
          <div className={styles.exportRow}>
            <Button
              type="button"
              variant="secondary"
              disabled={!!exporting}
              onClick={() => onExport('csv')}
            >
              <Icon icon={FileSpreadsheet} size="sm" />
              {exporting === 'csv' ? 'Downloading…' : 'Download CSV'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!!exporting}
              onClick={() => onExport('pdf')}
            >
              <Icon icon={FileText} size="sm" />
              {exporting === 'pdf' ? 'Downloading…' : 'Download PDF'}
            </Button>
            <ButtonLink href="/app/tickets" variant="tertiary">
              <Icon icon={Ticket} size="sm" />
              Open ticket queue
            </ButtonLink>
          </div>
        </form>

        {error ? <p className={appStyles.error}>{error}</p> : null}

        {!summary ? (
          <EmptyState icon={BarChart3}>
            Summary unavailable. <a href="/app/tickets">Open Tickets</a>
          </EmptyState>
        ) : (
          <>
            <p className={styles.meta}>
              {summary.totalInRange} tickets in range
              {summary.from || summary.to
                ? ` · created ${summary.from ?? '…'} → ${summary.to ?? '…'}`
                : ' · all time'}
              {' · '}
              generated {new Date(summary.generatedAt).toLocaleString()}
            </p>

            <div className={appStyles.stats}>
              <div>
                <span className={appStyles.statsIcon}>
                  <Icon icon={FolderOpen} size="sm" />
                </span>
                <strong>{summary.openTickets}</strong>
                <span>Open</span>
              </div>
              <div>
                <span className={appStyles.statsIcon}>
                  <Icon icon={Ticket} size="sm" />
                </span>
                <strong>{summary.createdToday}</strong>
                <span>Created today</span>
              </div>
              <div>
                <span className={appStyles.statsIcon}>
                  <Icon icon={CircleDot} size="sm" />
                </span>
                <strong>{summary.resolvedToday}</strong>
                <span>Resolved today</span>
              </div>
              <div>
                <span className={appStyles.statsIcon}>
                  <Icon icon={AlertTriangle} size="sm" />
                </span>
                <strong>{summary.slaBreaches}</strong>
                <span>SLA breaches</span>
              </div>
              <div>
                <span className={appStyles.statsIcon}>
                  <Icon icon={UserX} size="sm" />
                </span>
                <strong>{summary.unassigned}</strong>
                <span>Unassigned</span>
              </div>
              <div>
                <span className={appStyles.statsIcon}>
                  <Icon icon={Download} size="sm" />
                </span>
                <strong>{summary.totalInRange}</strong>
                <span>In range</span>
              </div>
            </div>

            <div className={styles.grid}>
              <BreakdownList title="By status" rows={summary.byStatus} />
              <BreakdownList title="By priority" rows={summary.byPriority} />
              <BreakdownList title="By type" rows={summary.byType} />
              <BreakdownList title="By team" rows={summary.byTeam} />
              <BreakdownList
                title="By location"
                rows={summary.byLocation ?? []}
              />
              <BreakdownList title="By assignee" rows={summary.byAssignee} />
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
