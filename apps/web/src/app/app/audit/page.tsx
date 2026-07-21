'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type AuditEvent, type AuthUser } from '@/lib/api';
import { can } from '@/lib/access';
import { AppShell } from '@/components/AppShell';
import { Button, ButtonLink } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { Download, ScrollText, Search } from 'lucide-react';
import appStyles from '../app.module.css';
import styles from './audit.module.css';

type Filters = {
  action: string;
  actor: string;
  entityType: string;
  from: string;
  to: string;
  q: string;
};

const EMPTY_FILTERS: Filters = {
  action: '',
  actor: '',
  entityType: '',
  from: '',
  to: '',
  q: '',
};

function entityHref(row: AuditEvent): string | null {
  const t = row.entityType.toLowerCase();
  const after = row.after ?? {};
  const ticketNumber =
    typeof after.ticketNumber === 'string' ? after.ticketNumber : null;
  const ticketId =
    typeof after.ticketId === 'string' ? after.ticketId : null;

  if (t === 'ticket' || t === 'tickets') {
    const key =
      ticketNumber ||
      (typeof after.number === 'string' ? after.number : null) ||
      row.entityId;
    return key ? `/app/tickets/${encodeURIComponent(key)}` : null;
  }
  if (t === 'ticket_attachment') {
    const key = ticketNumber || ticketId;
    return key ? `/app/tickets/${encodeURIComponent(key)}` : null;
  }
  if (t === 'approval' || t === 'approvals') {
    if (ticketNumber || ticketId) {
      return `/app/tickets/${encodeURIComponent(ticketNumber || ticketId!)}`;
    }
    return '/app/approvals';
  }
  return null;
}

function entityLabel(row: AuditEvent): string {
  const after = row.after ?? {};
  if (typeof after.number === 'string') return after.number;
  if (typeof after.ticketNumber === 'string') return after.ticketNumber;
  if (row.entityId) {
    return row.entityId.length > 14
      ? `${row.entityId.slice(0, 10)}…`
      : row.entityId;
  }
  return '—';
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }),
    time: d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
  };
}

function actorLabel(actor: AuditEvent['actor']) {
  if (!actor) return 'System';
  return `${actor.firstName} ${actor.lastName}`;
}

export default function AuditPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [rows, setRows] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<{
    actions: string[];
    entityTypes: string[];
  }>({ actions: [], entityTypes: [] });
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async (f: Filters) => {
    const data = await api.audit({
      limit: 150,
      action: f.action || undefined,
      actor: f.actor || undefined,
      entityType: f.entityType || undefined,
      from: f.from || undefined,
      to: f.to || undefined,
      q: f.q || undefined,
    });
    setRows(data.rows);
    setTotal(data.total);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { user } = await api.me();
        if (!can(user, 'audit:read')) {
          router.replace('/app');
          return;
        }
        if (!cancelled) setUser(user);
        const [facetData] = await Promise.all([
          api.auditFacets(),
          load(EMPTY_FILTERS),
        ]);
        if (!cancelled) setFacets(facetData);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed');
          router.replace('/login');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, load]);

  async function applyFilters(e?: FormEvent) {
    e?.preventDefault();
    setRefreshing(true);
    setError(null);
    try {
      setFilters(draft);
      await load(draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit');
    } finally {
      setRefreshing(false);
    }
  }

  async function clearFilters() {
    setDraft(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    setRefreshing(true);
    setError(null);
    try {
      await load(EMPTY_FILTERS);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit');
    } finally {
      setRefreshing(false);
    }
  }

  async function onExportCsv() {
    setExporting(true);
    setError(null);
    try {
      await api.downloadAuditCsv({
        limit: 5000,
        action: filters.action || undefined,
        actor: filters.actor || undefined,
        entityType: filters.entityType || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
        q: filters.q || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
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
        <div className={styles.skeleton}>
          <div className={styles.skeletonBar} />
          <div className={styles.skeletonPanel} />
          <p className={appStyles.muted}>Loading audit trail…</p>
        </div>
      </main>
    );
  }

  const activeFilterCount = [
    filters.action,
    filters.actor,
    filters.entityType,
    filters.from,
    filters.to,
    filters.q,
  ].filter(Boolean).length;

  return (
    <AppShell user={user} onLogout={logout} title="Audit trail">
      <div className={styles.layout}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>Compliance · Immutable events</p>
          <p className={styles.lede}>
            Who did what, to which record, and when. Events are append-only —
            filter to investigate incidents, exports, and configuration changes.
          </p>
        </header>

        <form className={styles.filters} onSubmit={applyFilters}>
          <div className={styles.filterGrid}>
            <label className={styles.field}>
              <span>Action</span>
              <select
                value={draft.action}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, action: e.target.value }))
                }
              >
                <option value="">All actions</option>
                {facets.actions.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Entity type</span>
              <select
                value={draft.entityType}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, entityType: e.target.value }))
                }
              >
                <option value="">All entities</option>
                {facets.entityTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Actor</span>
              <input
                type="search"
                placeholder="Name or email"
                value={draft.actor}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, actor: e.target.value }))
                }
              />
            </label>
            <label className={styles.field}>
              <span>From</span>
              <input
                type="date"
                value={draft.from}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, from: e.target.value }))
                }
              />
            </label>
            <label className={styles.field}>
              <span>To</span>
              <input
                type="date"
                value={draft.to}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, to: e.target.value }))
                }
              />
            </label>
            <label className={`${styles.field} ${styles.fieldWide}`}>
              <span>Search</span>
              <input
                type="search"
                placeholder="Action, entity id, actor…"
                value={draft.q}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, q: e.target.value }))
                }
              />
            </label>
          </div>
          <div className={styles.filterActions}>
            <Button type="submit" disabled={refreshing}>
              <Icon icon={Search} size="sm" />
              {refreshing ? 'Applying…' : 'Apply filters'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={clearFilters}
              disabled={refreshing || activeFilterCount === 0}
            >
              Clear
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={onExportCsv}
              disabled={exporting || refreshing}
            >
              <Icon icon={Download} size="sm" />
              {exporting ? 'Exporting…' : 'Export CSV'}
            </Button>
            {can(user, 'reports:read') ? (
              <ButtonLink href="/app/reports" variant="tertiary">
                Open Reports
              </ButtonLink>
            ) : (
              <ButtonLink href="/app" variant="tertiary">
                Back to Home
              </ButtonLink>
            )}
          </div>
        </form>

        {error ? <p className={appStyles.error}>{error}</p> : null}

        <section className={styles.results} aria-live="polite">
          <div className={styles.resultsHead}>
            <h2 className={styles.resultsTitle}>Events</h2>
            <p className={styles.resultsMeta}>
              Showing {rows.length}
              {total > rows.length ? ` of ${total}` : ''}
              {activeFilterCount > 0
                ? ` · ${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'} active`
                : ''}
            </p>
          </div>

          {refreshing && rows.length === 0 ? (
            <p className={styles.empty}>Refreshing…</p>
          ) : rows.length === 0 ? (
            <EmptyState icon={ScrollText} className={styles.empty}>
              <strong>No audit events match</strong>
              <p>
                {activeFilterCount > 0
                  ? 'Try clearing filters or widening the date range.'
                  : 'Events appear when tickets, attachments, approvals, and exports are recorded.'}
              </p>
              {activeFilterCount > 0 ? (
                <Button type="button" variant="secondary" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : null}
            </EmptyState>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">When</th>
                    <th scope="col">Actor</th>
                    <th scope="col">Action</th>
                    <th scope="col">Entity</th>
                    <th scope="col">Record</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const when = formatWhen(r.createdAt);
                    const href = entityHref(r);
                    const label = entityLabel(r);
                    return (
                      <tr key={r.id}>
                        <td className={styles.when}>
                          <span className={styles.whenDate}>{when.date}</span>
                          <span className={styles.whenTime}>{when.time}</span>
                        </td>
                        <td>
                          <span className={styles.actorName}>
                            {actorLabel(r.actor)}
                          </span>
                          {r.actor ? (
                            <span className={styles.actorEmail}>
                              {r.actor.email}
                            </span>
                          ) : (
                            <span className={styles.actorEmail}>
                              Automated / no session
                            </span>
                          )}
                        </td>
                        <td>
                          <code className={styles.actionChip}>{r.action}</code>
                        </td>
                        <td>
                          <span className={styles.entityType}>
                            {r.entityType}
                          </span>
                        </td>
                        <td>
                          {label !== '—' ? (
                            href ? (
                              <a
                                className={styles.entityLink}
                                href={href}
                                title={r.entityId ?? label}
                              >
                                {label}
                              </a>
                            ) : (
                              <span
                                className={styles.entityId}
                                title={r.entityId ?? undefined}
                              >
                                {label}
                              </span>
                            )
                          ) : (
                            <span className={styles.mutedDash}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
