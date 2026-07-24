'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type AuthUser } from '@/lib/api';
import { can } from '@/lib/access';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { RefreshCw, Siren } from 'lucide-react';
import styles from './im.module.css';

type ImRow = {
  id: string;
  number: string;
  title: string;
  severity: string;
  status: string;
  startedAt: string;
  commander?: { firstName: string; lastName: string } | null;
  ticket?: { number: string } | null;
  _count?: { updates: number };
};

type Dashboard = Awaited<ReturnType<typeof api.getImDashboard>>;

function formatMttr(minutes: number | null) {
  if (minutes == null) return '—';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export default function ImBoardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [rows, setRows] = useState<ImRow[]>([]);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [severity, setSeverity] = useState('sev2');
  const [ticketNumber, setTicketNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [list, board] = await Promise.all([
      api.listImIncidents(),
      api.getImDashboard(),
    ]);
    setRows(list);
    setDash(board);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { user } = await api.me();
        if (cancelled) return;
        if (!can(user, 'im:read')) {
          router.replace('/app');
          return;
        }
        setUser(user);
        await load();
      } catch {
        if (!cancelled) router.replace('/login');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load, router]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!can(user, 'im:write')) return;
    setSaving(true);
    setError(null);
    try {
      let ticketId: string | undefined;
      const link = ticketNumber.trim();
      if (link) {
        const ticket = await api.getTicket(link);
        ticketId = ticket.id;
      }
      const created = await api.createImIncident({
        title,
        summary: summary || undefined,
        severity,
        ticketId,
      });
      setTitle('');
      setSummary('');
      setTicketNumber('');
      router.push(`/app/im/${encodeURIComponent(created.number)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not declare incident');
    } finally {
      setSaving(false);
    }
  }

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed');
    } finally {
      setLoading(false);
    }
  }

  if (loading && !user) {
    return (
      <main className={styles.page}>
        <p>Loading incident command…</p>
      </main>
    );
  }

  if (!user) return null;

  const kpis = dash?.kpis;
  const sevMax = Math.max(
    1,
    ...(dash ? Object.values(dash.bySeverity) : [1]),
  );
  const statusMax = Math.max(
    1,
    ...(dash ? Object.values(dash.byStatus) : [1]),
  );

  return (
    <AppShell
      user={user}
      onLogout={() => api.logout().then(() => router.replace('/login'))}
      title="Incident Management"
    >
      <div className={styles.page}>
        <header className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>Incident command</p>
            <h1>IMS dashboard</h1>
            <p className={styles.lede}>
              Live SEV command metrics — open load, severity mix, MTTR, and
              war-room gaps. Declare below; open a record for timeline, roles,
              and PIR export.
            </p>
          </div>
          <div className={styles.ctaRow}>
            <a href="/app/reports" className={styles.cta}>
              ITSM KPIs
            </a>
            <a href="/app/major-incidents" className={styles.cta}>
              Major ops
            </a>
            <button
              type="button"
              className={`${styles.cta} ${styles.ctaSolid}`}
              onClick={() => void refresh()}
            >
              <Icon icon={RefreshCw} size="sm" />
              Refresh
            </button>
          </div>
        </header>

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        {kpis ? (
          <section className={styles.kpiRow} aria-label="IMS KPIs">
            <div
              className={`${styles.kpi} ${kpis.open > 0 ? styles.kpiAlert : ''}`}
            >
              <strong>{kpis.open}</strong>
              <span>Open</span>
            </div>
            <div
              className={`${styles.kpi} ${
                kpis.openSev1 > 0 ? styles.kpiAlert : ''
              }`}
            >
              <strong>{kpis.openSev1}</strong>
              <span>Open SEV1</span>
            </div>
            <div className={styles.kpi}>
              <strong>{kpis.openSev2}</strong>
              <span>Open SEV2</span>
            </div>
            <div
              className={`${styles.kpi} ${
                kpis.noCommander > 0 ? styles.kpiAlert : ''
              }`}
            >
              <strong>{kpis.noCommander}</strong>
              <span>No commander</span>
            </div>
            <div className={styles.kpi}>
              <strong>{kpis.linkedItsm}</strong>
              <span>Linked ITSM</span>
            </div>
            <div className={styles.kpi}>
              <strong>{formatMttr(kpis.mttrMinutes)}</strong>
              <span>MTTR</span>
            </div>
            <div className={styles.kpi}>
              <strong>{kpis.resolvedLast7d}</strong>
              <span>Resolved 7d</span>
            </div>
            <div className={styles.kpi}>
              <strong>
                {kpis.oldestOpenHours != null ? `${kpis.oldestOpenHours}h` : '—'}
              </strong>
              <span>Oldest open</span>
            </div>
          </section>
        ) : null}

        {dash ? (
          <section className={styles.charts} aria-label="IMS breakdowns">
            <div className={styles.panel}>
              <h2>By severity (all)</h2>
              <ul className={styles.barList}>
                {(
                  [
                    ['sev1', 'SEV1', styles.barFillSev1],
                    ['sev2', 'SEV2', styles.barFillSev2],
                    ['sev3', 'SEV3', styles.barFillSev3],
                    ['sev4', 'SEV4', styles.barFillSev4],
                  ] as const
                ).map(([key, label, fill]) => (
                  <li key={key}>
                    <div className={styles.barMeta}>
                      <span>{label}</span>
                      <strong>{dash.bySeverity[key]}</strong>
                    </div>
                    <div className={styles.barTrack}>
                      <div
                        className={`${styles.barFill} ${fill}`}
                        style={{
                          width: `${(dash.bySeverity[key] / sevMax) * 100}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className={styles.panel}>
              <h2>By status (all)</h2>
              <ul className={styles.barList}>
                {(
                  [
                    ['declared', 'Declared'],
                    ['active', 'Active'],
                    ['mitigated', 'Mitigated'],
                    ['resolved', 'Resolved'],
                    ['closed', 'Closed'],
                  ] as const
                ).map(([key, label]) => (
                  <li key={key}>
                    <div className={styles.barMeta}>
                      <span>{label}</span>
                      <strong>{dash.byStatus[key]}</strong>
                    </div>
                    <div className={styles.barTrack}>
                      <div
                        className={styles.barFill}
                        style={{
                          width: `${(dash.byStatus[key] / statusMax) * 100}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        <div className={styles.grid}>
          {can(user, 'im:write') ? (
            <form className={styles.form} onSubmit={onCreate}>
              <h2>Declare incident</h2>
              <p className={styles.hint}>
                Opens a command record for SEV events. Timeline, roles, and
                Export PIR are on the detail page.
              </p>
              <label>
                Title
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  minLength={3}
                />
              </label>
              <label>
                Severity
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                >
                  <option value="sev1">SEV1</option>
                  <option value="sev2">SEV2</option>
                  <option value="sev3">SEV3</option>
                  <option value="sev4">SEV4</option>
                </select>
              </label>
              <label>
                Summary
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={3}
                />
              </label>
              <label>
                Link ITSM ticket (optional)
                <input
                  value={ticketNumber}
                  onChange={(e) => setTicketNumber(e.target.value)}
                  placeholder="INC-2026-…"
                />
              </label>
              <Button type="submit" disabled={saving}>
                {saving ? 'Declaring…' : 'Declare'}
              </Button>
            </form>
          ) : null}

          <div className={styles.panel}>
            <div className={styles.listHead}>
              <h2>Active & recent</h2>
              <p className={styles.meta}>
                {dash ? `${dash.kpis.total} total` : null}
              </p>
            </div>
            {rows.length === 0 ? (
              <EmptyState icon={Siren}>No IM incidents yet.</EmptyState>
            ) : (
              <ul className={styles.incidentList}>
                {rows.map((r) => (
                  <li key={r.id}>
                    <a href={`/app/im/${encodeURIComponent(r.number)}`}>
                      <strong>{r.number}</strong> · {r.title}
                      <div className={styles.meta}>
                        {r.severity.toUpperCase()} · {r.status}
                        {r.commander
                          ? ` · ${r.commander.firstName} ${r.commander.lastName}`
                          : ''}
                        {r.ticket ? ` · ITSM ${r.ticket.number}` : ''}
                        {r._count?.updates != null
                          ? ` · ${r._count.updates} updates`
                          : ''}
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
