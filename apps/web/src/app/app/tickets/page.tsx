'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, type AuthUser, type LocationRef, type TicketSummary } from '@/lib/api';
import { can, canSeeOrgTickets, canWorkTicketQueue } from '@/lib/access';
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

const CHANNEL_OPTIONS = [
  { value: '', label: 'All channels' },
  { value: 'web', label: 'Web' },
  { value: 'email', label: 'Email' },
  { value: 'slack', label: 'Slack' },
  { value: 'teams', label: 'Teams' },
  { value: 'chat', label: 'Chat' },
  { value: 'api', label: 'API' },
] as const;

function channelLabel(channel?: string | null) {
  const code = (channel ?? 'web').toLowerCase();
  const match = CHANNEL_OPTIONS.find((o) => o.value === code);
  return match?.label ?? code;
}

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
  const [filterChannel, setFilterChannel] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [impact, setImpact] = useState('medium');
  const [urgency, setUrgency] = useState('medium');
  const [savedViews, setSavedViews] = useState<
    Array<{ id: string; name: string; queryJson: Record<string, unknown> }>
  >([]);
  const [viewName, setViewName] = useState('');
  const [queueFilter, setQueueFilterState] = useState<QueueFilter>(() =>
    parseQueue(searchParams.get('queue')),
  );
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [dupes, setDupes] = useState<
    Array<{ number: string; title: string; score: number }>
  >([]);
  const [kbHints, setKbHints] = useState<
    Array<{ slug: string; title: string; score: number }>
  >([]);

  function setQueueFilter(next: QueueFilter) {
    setQueueFilterState(next);
    const qs = next === 'all' ? '' : `?queue=${next}`;
    router.replace(`/app/tickets${qs}`);
  }

  useEffect(() => {
    setQueueFilterState(parseQueue(searchParams.get('queue')));
  }, [searchParams]);

  async function load(
    locFilter?: string,
    channelFilter?: string,
    qFilter?: string,
  ) {
    const locationFilter = locFilter ?? filterLocation;
    const channel = channelFilter ?? filterChannel;
    const q = (qFilter ?? searchQ).trim();
    const [list, meta] = await Promise.all([
      api.listTickets({
        ...(locationFilter ? { locationId: locationFilter } : {}),
        ...(channel ? { channel } : {}),
        ...(q ? { q } : {}),
      }),
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

  async function applySearch(e?: FormEvent) {
    e?.preventDefault();
    const next = searchInput.trim();
    setSearchQ(next);
    setLoading(true);
    try {
      await load(undefined, undefined, next);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let sessionUser: AuthUser | null = null;
      try {
        const { user } = await api.me();
        if (cancelled) return;
        sessionUser = user;
        setUser(user);
        setLocationId(user.locationId ?? '');
      } catch {
        if (!cancelled) router.replace('/login');
        return;
      }
      try {
        await load();
        const views = await api.listSavedViews().catch(() => []);
        if (!cancelled) setSavedViews(views);
        if (!cancelled && sessionUser && can(sessionUser, 'org:read')) {
          try {
            const locs = await api.listLocations();
            if (!cancelled) setLocations(locs);
          } catch {
            /* meta locations already loaded */
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Could not load tickets',
          );
        }
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
        impact,
        urgency,
      });
      if (pendingFiles.length) {
        for (const file of pendingFiles) {
          await api.uploadAttachment(created.number, file);
        }
      }
      setTitle('');
      setDescription('');
      setImpact('medium');
      setUrgency('medium');
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

  async function onAiAssist() {
    if (title.trim().length < 3) {
      setError('Enter a title first, then run AI assist.');
      return;
    }
    setAiBusy(true);
    setError(null);
    setAiNote(null);
    try {
      const [classified, duplicates, knowledge] = await Promise.all([
        api.aiClassify({ title, description }),
        api.aiDuplicates({ title, description }),
        api.aiSuggestKnowledge({ title, description }),
      ]);
      if (classified.typeCode) setTypeCode(classified.typeCode);
      if (classified.categoryCode) setCategoryCode(classified.categoryCode);
      setDupes(
        duplicates.matches.map((m) => ({
          number: m.number,
          title: m.title,
          score: m.score,
        })),
      );
      setKbHints(
        knowledge.matches.map((m) => ({
          slug: m.slug,
          title: m.title,
          score: m.score,
        })),
      );
      setAiNote(
        `${classified.rationale} · Suggested ${classified.typeName}${
          classified.categoryName ? ` / ${classified.categoryName}` : ''
        } (${Math.round(classified.confidence * 100)}% confidence, ${classified.provider}).`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI assist failed');
    } finally {
      setAiBusy(false);
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
  const showQueueChips = canSeeOrgTickets(user);
  const isAgentScoped =
    canWorkTicketQueue(user) && !canSeeOrgTickets(user);
  const unassignedCount = tickets.filter((t) => !t.assignee).length;
  const mineCount = tickets.filter((t) => t.assignee?.id === user.id).length;

  return (
    <AppShell
      user={user}
      onLogout={logout}
      title={
        showQueueChips
          ? 'Tickets'
          : isAgentScoped
            ? 'My assignments'
            : 'My tickets'
      }
    >
      <section className={styles.grid}>
        {canWrite ? (
          <form className={styles.form} onSubmit={onCreate}>
            <h2>
              {showQueueChips || isAgentScoped
                ? 'Create ticket'
                : 'Report an issue'}
            </h2>
            <p className={styles.hint}>
              {showQueueChips ? (
                <>
                  Service and access requests go to{' '}
                  <strong>Pending Approval</strong> for approvers. Prefer
                  browsing first? <a href="/app/catalog">Open Catalog</a>
                </>
              ) : isAgentScoped ? (
                <>
                  You see tickets <strong>assigned to you</strong>. Managers
                  with org-wide access can view the full queue.
                </>
              ) : (
                <>
                  You only see tickets you opened (or watch). Prefer a catalog
                  item? <a href="/app/catalog">Browse the catalog</a>
                </>
              )}
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
              Impact
              <select
                value={impact}
                onChange={(e) => setImpact(e.target.value)}
                aria-label="Impact"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>
            <label>
              Urgency
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value)}
                aria-label="Urgency"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
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
            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.btnSecondary}
                disabled={aiBusy || saving}
                onClick={onAiAssist}
              >
                {aiBusy ? 'Analyzing…' : 'AI assist'}
              </button>
            </div>
            {aiNote ? <p className={styles.hint}>{aiNote}</p> : null}
            {dupes.length ? (
              <div className={styles.hint}>
                <strong>Possible duplicates:</strong>
                <ul>
                  {dupes.map((d) => (
                    <li key={d.number}>
                      <a href={`/app/tickets/${encodeURIComponent(d.number)}`}>
                        {d.number}
                      </a>{' '}
                      — {d.title} ({Math.round(d.score * 100)}%)
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {kbHints.length ? (
              <div className={styles.hint}>
                <strong>Related knowledge:</strong>
                <ul>
                  {kbHints.map((k) => (
                    <li key={k.slug}>
                      <a href={`/app/knowledge/${encodeURIComponent(k.slug)}`}>
                        {k.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
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
            <h2>
              {showQueueChips
                ? 'Ticket queue'
                : isAgentScoped
                  ? 'Assigned to you'
                  : 'Your requests'}
            </h2>
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
          {!showQueueChips ? (
            <p className={styles.hint} style={{ marginTop: 0 }}>
              {isAgentScoped
                ? 'Showing only tickets currently assigned to you — not the full organization queue.'
                : 'Showing only tickets you requested, are assigned, or watch — not the full organization queue.'}
            </p>
          ) : null}
          <form className={styles.searchBar} onSubmit={applySearch}>
            <label className={styles.searchField} htmlFor="ticket-q">
              Search tickets
              <input
                id="ticket-q"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Number, title, keywords, requester…"
                aria-label="Search tickets by number, title, or keywords"
              />
            </label>
            <Button type="submit" variant="secondary" disabled={loading}>
              Search
            </Button>
            {searchQ ? (
              <Button
                type="button"
                variant="secondary"
                disabled={loading}
                onClick={async () => {
                  setSearchInput('');
                  setSearchQ('');
                  setLoading(true);
                  try {
                    await load(undefined, undefined, '');
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                Clear
              </Button>
            ) : null}
          </form>
          <div className={styles.searchBar} style={{ marginTop: '0.5rem' }}>
            <label className={styles.searchField} htmlFor="save-view-name">
              Save view
              <input
                id="save-view-name"
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                placeholder="Name for current filters…"
                aria-label="Saved view name"
              />
            </label>
            <Button
              type="button"
              variant="secondary"
              disabled={!viewName.trim() || loading}
              onClick={async () => {
                try {
                  const created = await api.createSavedView({
                    name: viewName.trim(),
                    queryJson: {
                      q: searchQ || undefined,
                      locationId: filterLocation || undefined,
                      channel: filterChannel || undefined,
                      queue: queueFilter !== 'all' ? queueFilter : undefined,
                    },
                  });
                  setSavedViews((prev) =>
                    [...prev.filter((v) => v.id !== created.id), created].sort(
                      (a, b) => a.name.localeCompare(b.name),
                    ),
                  );
                  setViewName('');
                } catch (err) {
                  setError(
                    err instanceof Error ? err.message : 'Could not save view',
                  );
                }
              }}
            >
              Save
            </Button>
            {savedViews.length ? (
              <label className={styles.searchField} htmlFor="load-view">
                Load view
                <select
                  id="load-view"
                  defaultValue=""
                  aria-label="Load saved view"
                  onChange={async (e) => {
                    const id = e.target.value;
                    e.target.value = '';
                    const view = savedViews.find((v) => v.id === id);
                    if (!view) return;
                    const qj = view.queryJson ?? {};
                    const nextQ = typeof qj.q === 'string' ? qj.q : '';
                    const nextLoc =
                      typeof qj.locationId === 'string' ? qj.locationId : '';
                    const nextCh =
                      typeof qj.channel === 'string' ? qj.channel : '';
                    setSearchInput(nextQ);
                    setSearchQ(nextQ);
                    setFilterLocation(nextLoc);
                    setFilterChannel(nextCh);
                    if (
                      qj.queue === 'unassigned' ||
                      qj.queue === 'mine' ||
                      qj.queue === 'major'
                    ) {
                      setQueueFilter(qj.queue);
                    }
                    setLoading(true);
                    try {
                      await load(nextLoc, nextCh, nextQ);
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  <option value="">Select…</option>
                  {savedViews.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          {searchQ ? (
            <p className={styles.hint} style={{ marginTop: 0 }}>
              Results for “{searchQ}” ({filteredTickets.length}
              {filteredTickets.length === 200 ? '+' : ''})
            </p>
          ) : null}
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
          {showQueueChips ? (
            <label className={styles.locationFilter}>
              Channel
              <select
                value={filterChannel}
                aria-label="Filter tickets by intake channel"
                onChange={async (e) => {
                  const next = e.target.value;
                  setFilterChannel(next);
                  setLoading(true);
                  try {
                    await load(undefined, next);
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                {CHANNEL_OPTIONS.map((o) => (
                  <option key={o.value || 'all'} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {filteredTickets.length === 0 ? (
            <EmptyState icon={Ticket} className={styles.empty}>
              {tickets.length === 0 ? (
                searchQ ? (
                  <>
                    No tickets match “{searchQ}”. Try another number or keyword, or{' '}
                    <button
                      type="button"
                      className={styles.linkish}
                      onClick={async () => {
                        setSearchInput('');
                        setSearchQ('');
                        setLoading(true);
                        try {
                          await load(undefined, undefined, '');
                        } finally {
                          setLoading(false);
                        }
                      }}
                    >
                      clear search
                    </button>
                    .
                  </>
                ) : (
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
                )
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
                          <span
                            className={styles.channelBadge}
                            title="Intake channel"
                          >
                            {channelLabel(t.channel)}
                          </span>
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
