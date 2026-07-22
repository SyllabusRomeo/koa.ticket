'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, type AuthUser, type LocationRef, type TicketSummary } from '@/lib/api';
import { can } from '@/lib/access';
import { AppShell } from '@/components/AppShell';
import { PendingAttachments } from '@/components/TicketAttachments';
import { LocationSelect } from '@/components/LocationSelect';
import styles from './tickets.module.css';
import { Plus, Download, Ticket, UserRound, UserX, MapPin, AlertTriangle } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { Button } from '@/components/Button';
import { StatusBadge } from '@/components/StatusBadge';
import { SlaTimer } from '@/components/SlaTimer';
import { Suspense } from 'react';

type QueueFilter = 'all' | 'unassigned' | 'mine' | 'major';

function parseQueue(raw: string | null): QueueFilter {
  if (raw === 'unassigned' || raw === 'mine' || raw === 'major') return raw;
  return 'all';
}

function TicketsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [locations, setLocations] = useState<LocationRef[]>([]);
  const [types, setTypes] = useState<Array<{ code: string; name: string }>>([]);
  const [categories, setCategories] = useState<
    Array<{ code: string; name: string }>
  >([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [typeCode, setTypeCode] = useState('incident');
  const [categoryCode, setCategoryCode] = useState('');
  const [locationId, setLocationId] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [queueFilter, setQueueFilterState] = useState<QueueFilter>(() =>
    parseQueue(searchParams.get('queue')),
  );

  function setQueueFilter(next: QueueFilter) {
    setQueueFilterState(next);
    const qs = next === 'all' ? '' : `?queue=${next}`;
    router.replace(`/app/tickets${qs}`);
  }

  useEffect(() => {
    setQueueFilterState(parseQueue(searchParams.get('queue')));
  }, [searchParams]);

  async function load(locFilter?: string) {
    const locationFilter = locFilter ?? filterLocation;
    const [list, meta] = await Promise.all([
      api.listTickets(
        locationFilter ? { locationId: locationFilter } : undefined,
      ),
      api.ticketMeta(),
    ]);
    setTickets(list);
    setTypes(meta.types);
    setCategories(meta.categories);
    if (meta.locations?.length) {
      setLocations(meta.locations);
    }
    if (!categoryCode && meta.categories[0]) {
      setCategoryCode(meta.categories[0].code);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { user } = await api.me();
        if (cancelled) return;
        setUser(user);
        setLocationId(user.locationId ?? '');
        await load();
        if (!cancelled && can(user, 'org:read')) {
          try {
            const locs = await api.listLocations();
            if (!cancelled) setLocations(locs);
          } catch {
            /* meta locations already loaded */
          }
        }
      } catch {
        if (!cancelled) router.replace('/login');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const filteredTickets = useMemo(() => {
    if (!user || queueFilter === 'all') return tickets;
    if (queueFilter === 'major') {
      return tickets.filter((t) => !!t.majorIncident);
    }
    if (queueFilter === 'unassigned') {
      return tickets.filter((t) => !t.assignee);
    }
    return tickets.filter((t) => t.assignee?.id === user.id);
  }, [tickets, queueFilter, user]);

  const majorCount = tickets.filter((t) => t.majorIncident).length;

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await api.createTicket({
        title,
        description,
        typeCode,
        categoryCode: categoryCode || undefined,
        locationId: locationId || undefined,
        impact: 'medium',
        urgency: 'medium',
      });
      if (pendingFiles.length) {
        for (const file of pendingFiles) {
          await api.uploadAttachment(created.number, file);
        }
      }
      setTitle('');
      setDescription('');
      setLocationId(user?.locationId ?? '');
      setPendingFiles([]);
      await load();
      router.push(`/app/tickets/${encodeURIComponent(created.number)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create ticket');
    } finally {
      setSaving(false);
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

  async function onExportCsv() {
    setExporting(true);
    setError(null);
    try {
      await api.downloadTicketsCsv();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  if (loading || !user) {
    return (
      <main className={styles.page}>
        <p>Loading tickets…</p>
      </main>
    );
  }

  const canWrite = can(user, 'tickets:write');
  const showQueueChips =
    can(user, 'tickets:read_all') || can(user, 'tickets:read_queue');
  const unassignedCount = tickets.filter((t) => !t.assignee).length;
  const mineCount = tickets.filter((t) => t.assignee?.id === user.id).length;

  return (
    <AppShell user={user} onLogout={logout} title="Tickets">
      <section className={styles.grid}>
        {canWrite ? (
          <form className={styles.form} onSubmit={onCreate}>
            <h2>Create ticket</h2>
            <p className={styles.hint}>
              Service and access requests go to <strong>Pending Approval</strong>{' '}
              for approvers. Prefer browsing first?{' '}
              <a href="/app/catalog">Open Catalog</a>
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
              Type
              <select
                value={typeCode}
                onChange={(e) => setTypeCode(e.target.value)}
              >
                {types.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Category
              <select
                value={categoryCode}
                onChange={(e) => setCategoryCode(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Location — where is this issue located?
              <LocationSelect
                value={locationId}
                onChange={setLocationId}
                locations={locations}
                allowEmpty
                emptyLabel="Use my home location"
                aria-label="Ticket origin location"
              />
            </label>
            <label>
              Description
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                minLength={3}
                rows={5}
              />
            </label>
            <PendingAttachments
              files={pendingFiles}
              onChange={setPendingFiles}
            />
            {error ? (
              <p className={styles.error} role="alert">
                {error}
              </p>
            ) : null}
            <div className={styles.formActions}>
              <button type="submit" className={styles.btn} disabled={saving}>
                <Icon icon={Plus} size="sm" />
                {saving ? 'Submitting…' : 'Submit ticket'}
              </button>
            </div>
          </form>
        ) : (
          <div className={styles.form}>
            <h2>View only</h2>
            <p>
              Your role can view tickets but cannot create them. Work items in
              the list on the right.
            </p>
            <p className={styles.hint}>
              Need help articles? <a href="/app/knowledge">Open Knowledge</a>
            </p>
          </div>
        )}

        <div className={styles.list}>
          <div className={styles.listHead}>
            <h2>Your ticket view</h2>
            <Button
              type="button"
              variant="secondary"
              disabled={exporting || tickets.length === 0}
              onClick={onExportCsv}
            >
              <Icon icon={Download} size="sm" />
              {exporting ? 'Exporting…' : 'Export CSV'}
            </Button>
          </div>
          {showQueueChips ? (
            <div
              className={styles.filterChips}
              role="tablist"
              aria-label="Queue filters"
            >
              <button
                type="button"
                role="tab"
                aria-selected={queueFilter === 'all'}
                className={
                  queueFilter === 'all' ? styles.chipActive : styles.chip
                }
                onClick={() => setQueueFilter('all')}
              >
                All ({tickets.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={queueFilter === 'unassigned'}
                className={
                  queueFilter === 'unassigned' ? styles.chipActive : styles.chip
                }
                onClick={() => setQueueFilter('unassigned')}
              >
                <Icon icon={UserX} size="sm" />
                Unassigned ({unassignedCount})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={queueFilter === 'mine'}
                className={
                  queueFilter === 'mine' ? styles.chipActive : styles.chip
                }
                onClick={() => setQueueFilter('mine')}
              >
                <Icon icon={UserRound} size="sm" />
                Assigned to me ({mineCount})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={queueFilter === 'major'}
                className={
                  queueFilter === 'major' ? styles.chipActive : styles.chip
                }
                onClick={() => setQueueFilter('major')}
              >
                <Icon icon={AlertTriangle} size="sm" />
                Major ({majorCount})
              </button>
            </div>
          ) : null}
          {showQueueChips && locations.length > 0 ? (
            <label className={styles.locationFilter}>
              <Icon icon={MapPin} size="sm" />
              Filter by location
              <LocationSelect
                value={filterLocation}
                onChange={async (id) => {
                  setFilterLocation(id);
                  setLoading(true);
                  try {
                    await load(id);
                  } finally {
                    setLoading(false);
                  }
                }}
                locations={locations}
                allowEmpty
                emptyLabel="All locations"
                aria-label="Filter tickets by location"
              />
            </label>
          ) : null}
          {filteredTickets.length === 0 ? (
            <EmptyState icon={Ticket} className={styles.empty}>
              {tickets.length === 0 ? (
                <>
                  No tickets yet.
                  {canWrite ? (
                    <>
                      {' '}
                      Use the form to submit one, or{' '}
                      <a href="/app/catalog">browse the catalog</a>.
                    </>
                  ) : (
                    <>
                      {' '}
                      <a href="/app">Back to Home</a>
                    </>
                  )}
                </>
              ) : (
                <>No tickets match this filter.</>
              )}
            </EmptyState>
          ) : (
            <ul>
              {filteredTickets.map((t) => {
                const metaParts = [
                  t.location
                    ? t.location.site
                      ? `${t.location.name} (${t.location.site})`
                      : t.location.name
                    : null,
                  t.priority?.name,
                  t.type.name,
                  t.assignee
                    ? `${t.assignee.firstName} ${t.assignee.lastName}`
                    : 'Unassigned',
                  t.team?.name,
                ].filter(Boolean);
                return (
                  <li key={t.id}>
                    <a
                      className={styles.ticketLink}
                      href={`/app/tickets/${t.number}`}
                    >
                      <div className={styles.ticketRowTop}>
                        <strong>{t.number}</strong>
                        <div className={styles.ticketRowBadges}>
                          {t.majorIncident ? (
                            <span className={styles.miBadge}>
                              <Icon icon={AlertTriangle} size="sm" />
                              Major
                            </span>
                          ) : null}
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
                      <em>{metaParts.join(' · ')}</em>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </AppShell>
  );
}

export default function TicketsPage() {
  return (
    <Suspense
      fallback={
        <main className={styles.page}>
          <p>Loading tickets…</p>
        </main>
      }
    >
      <TicketsPageInner />
    </Suspense>
  );
}
