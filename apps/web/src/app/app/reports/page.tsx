'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
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
  BookOpen,
  CalendarClock,
  CircleDot,
  Download,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Ticket,
  Timer,
  UserX,
} from 'lucide-react';
import { SectionHeading } from '@/components/SectionHeading';
import appStyles from '../app.module.css';
import styles from './reports.module.css';

type Breakdown = { code: string; name: string; count: number };

type StageRow = {
  code: string;
  name: string;
  ticketCount: number;
  currentCount: number;
  avgMs: number;
  avgLabel: string;
  totalLabel: string;
  pctOfAll: number;
};

type StuckRow = {
  number: string;
  title: string;
  statusName: string;
  label: string;
};

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

type StageReport = {
  sampleSize: number;
  stuckThresholdHours: number;
  byStatus: StageRow[];
  stuckOpen: StuckRow[];
};

type HeatmapReport = {
  metric: 'created' | 'resolved';
  sampleSize: number;
  max: number;
  days: string[];
  cells: Array<{ dayOfWeek: number; hour: number; count: number }>;
};

type ReportSchedule = {
  id: string;
  cadence: 'daily' | 'weekly';
  format: 'csv' | 'pdf';
  email: string;
  filters: { rangeDays: number };
  lastRunAt: string | null;
  isActive: boolean;
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

function cellIntensity(count: number, max: number) {
  if (count <= 0 || max <= 0) return 0.06;
  const t = Math.sqrt(count / max);
  return 0.12 + t * 0.83;
}

export default function ReportsPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [stages, setStages] = useState<StageReport | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapReport | null>(null);
  const [heatmapMetric, setHeatmapMetric] = useState<'created' | 'resolved'>(
    'created',
  );
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);
  const [schedCadence, setSchedCadence] = useState<'daily' | 'weekly'>('weekly');
  const [schedFormat, setSchedFormat] = useState<'csv' | 'pdf'>('csv');
  const [schedEmail, setSchedEmail] = useState('');
  const [schedRangeDays, setSchedRangeDays] = useState(7);
  const [schedBusy, setSchedBusy] = useState(false);
  const [deflection, setDeflection] = useState<{
    totals: {
      views: number;
      helpful: number;
      notHelpful: number;
      deflected: number;
    };
    helpfulRate: number | null;
    deflectionRate: number | null;
    topArticles: Array<{
      slug: string;
      title: string;
      views: number;
      helpful: number;
      notHelpful: number;
      deflected: number;
    }>;
  } | null>(null);
  const [imsKpis, setImsKpis] = useState<{
    mttaMinutes: number | null;
    mttrMinutes: number | null;
    slaCompliancePercent: number | null;
    fcrPercent: number | null;
    reopenRatePercent: number | null;
    openP1P2: number;
    breachedOpen: number;
  } | null>(null);

  const cellMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of heatmap?.cells ?? []) {
      map.set(`${c.dayOfWeek}:${c.hour}`, c.count);
    }
    return map;
  }, [heatmap]);

  async function loadSchedules() {
    const rows = await api.listReportSchedules();
    setSchedules(rows);
  }

  async function load(
    range: { from?: string; to?: string } = {},
    metric: 'created' | 'resolved' = heatmapMetric,
  ) {
    const [summaryData, stagesData, heatmapData, deflectionData, imsData] =
      await Promise.all([
        api.reportSummary(range),
        api.reportStages(range),
        api.reportHeatmap({ ...range, metric }),
        api.knowledgeDeflectionAnalytics(30).catch(() => null),
        api.reportImsKpis(range).catch(() => null),
      ]);
    setSummary(summaryData);
    setStages(stagesData);
    setHeatmap(heatmapData);
    if (deflectionData) {
      setDeflection({
        totals: deflectionData.totals,
        helpfulRate: deflectionData.helpfulRate,
        deflectionRate: deflectionData.deflectionRate,
        topArticles: deflectionData.topArticles,
      });
    }
    setImsKpis(imsData);
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
        setSchedEmail(user.email);
        await Promise.all([load(), loadSchedules()]);
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

  async function onMetricChange(metric: 'created' | 'resolved') {
    setHeatmapMetric(metric);
    setRefreshing(true);
    setError(null);
    try {
      await load({ from: from || undefined, to: to || undefined }, metric);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not refresh heatmap');
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

  async function onCreateSchedule(e: FormEvent) {
    e.preventDefault();
    setSchedBusy(true);
    setError(null);
    try {
      await api.createReportSchedule({
        cadence: schedCadence,
        format: schedFormat,
        email: schedEmail.trim(),
        rangeDays: schedRangeDays,
      });
      await loadSchedules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create schedule');
    } finally {
      setSchedBusy(false);
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
          <p className={styles.eyebrow}>LogIt reporting hub</p>
          <p className={styles.lede}>
            Operational snapshot for IT managers — KPIs, heatmaps, breakdowns,
            and scheduled exports for leadership packs.
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

            {imsKpis ? (
              <section className={styles.breakdown} style={{ marginTop: '1.25rem' }}>
                <h2 className={styles.breakdownTitle}>IMS / ops KPIs</h2>
                <div className={appStyles.stats}>
                  <div>
                    <strong>
                      {imsKpis.mttaMinutes != null
                        ? `${imsKpis.mttaMinutes}m`
                        : '—'}
                    </strong>
                    <span>MTTA</span>
                  </div>
                  <div>
                    <strong>
                      {imsKpis.mttrMinutes != null
                        ? `${imsKpis.mttrMinutes}m`
                        : '—'}
                    </strong>
                    <span>MTTR</span>
                  </div>
                  <div>
                    <strong>
                      {imsKpis.slaCompliancePercent != null
                        ? `${imsKpis.slaCompliancePercent}%`
                        : '—'}
                    </strong>
                    <span>SLA compliance</span>
                  </div>
                  <div>
                    <strong>
                      {imsKpis.fcrPercent != null
                        ? `${imsKpis.fcrPercent}%`
                        : '—'}
                    </strong>
                    <span>FCR (coded)</span>
                  </div>
                  <div>
                    <strong>
                      {imsKpis.reopenRatePercent != null
                        ? `${imsKpis.reopenRatePercent}%`
                        : '—'}
                    </strong>
                    <span>Reopen rate</span>
                  </div>
                  <div>
                    <strong>{imsKpis.openP1P2}</strong>
                    <span>Open P1/P2</span>
                  </div>
                  <div>
                    <strong>{imsKpis.breachedOpen}</strong>
                    <span>Breached open</span>
                  </div>
                </div>
              </section>
            ) : null}

            {heatmap ? (
              <section className={styles.heatmapPanel}>
                <div className={styles.heatmapHead}>
                  <div>
                    <SectionHeading
                      icon={BarChart3}
                      className={styles.breakdownTitle}
                    >
                      Volume heatmap
                    </SectionHeading>
                    <p className={styles.muted}>
                      Ticket {heatmap.metric} volume by weekday × hour (
                      {heatmap.sampleSize} ticket
                      {heatmap.sampleSize === 1 ? '' : 's'} in sample).
                    </p>
                  </div>
                  <div className={styles.metricToggle}>
                    <Button
                      type="button"
                      variant={
                        heatmapMetric === 'created' ? 'primary' : 'secondary'
                      }
                      disabled={refreshing}
                      onClick={() => onMetricChange('created')}
                    >
                      Created
                    </Button>
                    <Button
                      type="button"
                      variant={
                        heatmapMetric === 'resolved' ? 'primary' : 'secondary'
                      }
                      disabled={refreshing}
                      onClick={() => onMetricChange('resolved')}
                    >
                      Resolved
                    </Button>
                  </div>
                </div>
                <div className={styles.heatmapScroll}>
                  <div
                    className={styles.heatmapGrid}
                    role="img"
                    aria-label={`Heatmap of tickets ${heatmap.metric} by day and hour`}
                  >
                    <div className={styles.heatmapCorner} />
                    {Array.from({ length: 24 }, (_, hour) => (
                      <div key={`h-${hour}`} className={styles.heatmapHour}>
                        {hour % 3 === 0 ? hour : ''}
                      </div>
                    ))}
                    {heatmap.days.map((day, dayOfWeek) => (
                      <div key={day} style={{ display: 'contents' }}>
                        <div className={styles.heatmapDay}>{day}</div>
                        {Array.from({ length: 24 }, (_, hour) => {
                          const count =
                            cellMap.get(`${dayOfWeek}:${hour}`) ?? 0;
                          const alpha = cellIntensity(count, heatmap.max);
                          return (
                            <div
                              key={`${day}-${hour}`}
                              className={styles.heatmapCell}
                              title={`${day} ${String(hour).padStart(2, '0')}:00 — ${count}`}
                              style={{
                                background: `rgba(15, 74, 64, ${alpha})`,
                              }}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
                <div className={styles.heatmapLegend}>
                  <span>Low</span>
                  <div className={styles.heatmapLegendSwatch} aria-hidden />
                  <span>High (max {heatmap.max})</span>
                </div>
              </section>
            ) : null}

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

            {deflection ? (
              <section className={styles.stagePanel}>
                <div className={styles.stageHead}>
                  <SectionHeading
                    icon={BookOpen}
                    className={styles.breakdownTitle}
                  >
                    Knowledge deflection (30 days)
                  </SectionHeading>
                  <p className={styles.muted}>
                    Views, helpful votes, and explicit “this solved my issue”
                    signals from the knowledge base.
                  </p>
                </div>
                <div className={appStyles.stats}>
                  <div>
                    <strong>{deflection.totals.views}</strong>
                    <span>Views</span>
                  </div>
                  <div>
                    <strong>
                      {deflection.helpfulRate == null
                        ? '—'
                        : `${Math.round(deflection.helpfulRate * 100)}%`}
                    </strong>
                    <span>Helpful rate</span>
                  </div>
                  <div>
                    <strong>{deflection.totals.deflected}</strong>
                    <span>Deflected</span>
                  </div>
                  <div>
                    <strong>
                      {deflection.deflectionRate == null
                        ? '—'
                        : `${Math.round(deflection.deflectionRate * 100)}%`}
                    </strong>
                    <span>Deflection rate</span>
                  </div>
                </div>
                {deflection.topArticles.length ? (
                  <ul className={styles.stuckList}>
                    {deflection.topArticles.slice(0, 8).map((a) => (
                      <li key={a.slug}>
                        <a
                          href={`/app/knowledge/${encodeURIComponent(a.slug)}`}
                        >
                          <strong>{a.title}</strong>
                        </a>
                        <span>
                          {a.views} views · {a.helpful} helpful ·{' '}
                          {a.deflected} deflected
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.muted}>
                    No knowledge engagement yet — open articles and use
                    feedback buttons to populate this.
                  </p>
                )}
              </section>
            ) : null}

            {stages ? (
              <section className={styles.stagePanel}>
                <div className={styles.stageHead}>
                  <SectionHeading
                    icon={Timer}
                    className={styles.breakdownTitle}
                  >
                    Stage duration bottlenecks
                  </SectionHeading>
                  <p className={styles.muted}>
                    Average time-in-status across {stages.sampleSize} ticket
                    {stages.sampleSize === 1 ? '' : 's'} (from status history).
                    Open tickets stuck ≥ {stages.stuckThresholdHours}h in the
                    current stage are listed below.
                  </p>
                </div>
                {stages.byStatus.length === 0 ? (
                  <p className={styles.muted}>No stage data in this range.</p>
                ) : (
                  <ul className={styles.barList}>
                    {stages.byStatus.map((row) => {
                      const maxAvg = Math.max(
                        1,
                        ...stages.byStatus.map((r) => r.avgMs),
                      );
                      return (
                        <li key={row.code}>
                          <div className={styles.barMeta}>
                            <span>
                              {row.name}{' '}
                              <em className={styles.stageMeta}>
                                · {row.ticketCount} ticket
                                {row.ticketCount === 1 ? '' : 's'}
                                {row.currentCount
                                  ? ` · ${row.currentCount} current`
                                  : ''}
                                · {row.pctOfAll}% of time
                              </em>
                            </span>
                            <strong title={`Total ${row.totalLabel}`}>
                              avg {row.avgLabel}
                            </strong>
                          </div>
                          <div className={styles.barTrack} aria-hidden>
                            <div
                              className={styles.barFillAccent}
                              style={{
                                width: `${Math.round((row.avgMs / maxAvg) * 100)}%`,
                              }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {stages.stuckOpen.length > 0 ? (
                  <div className={styles.stuckBlock}>
                    <h3 className={styles.stuckTitle}>Stuck open tickets</h3>
                    <ul className={styles.stuckList}>
                      {stages.stuckOpen.map((row) => (
                        <li key={row.number}>
                          <a
                            href={`/app/tickets/${encodeURIComponent(row.number)}`}
                          >
                            <strong>{row.number}</strong>
                          </a>
                          <span>
                            {row.statusName} · {row.label}
                          </span>
                          <em>{row.title}</em>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
            ) : null}

            <section className={styles.schedulePanel}>
              <div className={styles.scheduleHead}>
                <div>
                  <SectionHeading
                    icon={CalendarClock}
                    className={styles.breakdownTitle}
                  >
                    Scheduled exports
                  </SectionHeading>
                  <p className={styles.muted}>
                    Email a rolling CSV or PDF on a daily or weekly cadence.
                    Requires SMTP. Use Run now to test immediately.
                  </p>
                </div>
              </div>

              <form className={styles.scheduleForm} onSubmit={onCreateSchedule}>
                <label className={styles.field}>
                  <span>Cadence</span>
                  <select
                    value={schedCadence}
                    onChange={(e) =>
                      setSchedCadence(e.target.value as 'daily' | 'weekly')
                    }
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Format</span>
                  <select
                    value={schedFormat}
                    onChange={(e) =>
                      setSchedFormat(e.target.value as 'csv' | 'pdf')
                    }
                  >
                    <option value="csv">CSV</option>
                    <option value="pdf">PDF</option>
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Range (days)</span>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={schedRangeDays}
                    onChange={(e) =>
                      setSchedRangeDays(
                        Math.max(1, Math.min(365, Number(e.target.value) || 1)),
                      )
                    }
                  />
                </label>
                <label className={styles.field}>
                  <span>Email</span>
                  <input
                    type="email"
                    required
                    value={schedEmail}
                    onChange={(e) => setSchedEmail(e.target.value)}
                    style={{ minWidth: '14rem' }}
                  />
                </label>
                <Button type="submit" disabled={schedBusy}>
                  {schedBusy ? 'Saving…' : 'Add schedule'}
                </Button>
              </form>

              {schedules.length === 0 ? (
                <p className={styles.muted}>No schedules yet.</p>
              ) : (
                <ul className={styles.scheduleList}>
                  {schedules.map((s) => (
                    <li key={s.id} className={styles.scheduleItem}>
                      <div className={styles.scheduleMeta}>
                        <strong>
                          {s.cadence} · {s.format.toUpperCase()}
                          {!s.isActive ? (
                            <span className={styles.inactiveBadge}>
                              paused
                            </span>
                          ) : null}
                        </strong>
                        <span>
                          {s.email} · last {s.filters.rangeDays} day
                          {s.filters.rangeDays === 1 ? '' : 's'}
                          {s.lastRunAt
                            ? ` · last run ${new Date(s.lastRunAt).toLocaleString()}`
                            : ' · never run'}
                        </span>
                      </div>
                      <div className={styles.scheduleActions}>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={schedBusy}
                          onClick={async () => {
                            setSchedBusy(true);
                            setError(null);
                            try {
                              const res = await api.runReportSchedule(s.id);
                              await loadSchedules();
                              if (res.result === 'skipped') {
                                setError(
                                  'Export generated but email was skipped (SMTP not configured).',
                                );
                              }
                            } catch (err) {
                              setError(
                                err instanceof Error
                                  ? err.message
                                  : 'Run failed',
                              );
                            } finally {
                              setSchedBusy(false);
                            }
                          }}
                        >
                          Run now
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={schedBusy}
                          onClick={async () => {
                            setSchedBusy(true);
                            try {
                              await api.updateReportSchedule(s.id, {
                                isActive: !s.isActive,
                              });
                              await loadSchedules();
                            } catch (err) {
                              setError(
                                err instanceof Error
                                  ? err.message
                                  : 'Update failed',
                              );
                            } finally {
                              setSchedBusy(false);
                            }
                          }}
                        >
                          {s.isActive ? 'Pause' : 'Resume'}
                        </Button>
                        <Button
                          type="button"
                          variant="tertiary"
                          disabled={schedBusy}
                          onClick={async () => {
                            if (!confirm('Delete this schedule?')) return;
                            setSchedBusy(true);
                            try {
                              await api.deleteReportSchedule(s.id);
                              await loadSchedules();
                            } catch (err) {
                              setError(
                                err instanceof Error
                                  ? err.message
                                  : 'Delete failed',
                              );
                            } finally {
                              setSchedBusy(false);
                            }
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
