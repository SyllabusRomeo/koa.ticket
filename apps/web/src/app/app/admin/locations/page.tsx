'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type AuthUser, type LocationRef } from '@/lib/api';
import { can } from '@/lib/access';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { MapPin, Plus, Save } from 'lucide-react';
import appStyles from '../../app.module.css';
import styles from '../teams/teams.module.css';

const EMPTY_FORM = {
  code: '',
  name: '',
  country: '',
  site: '',
  timezone: 'Africa/Accra',
};

export default function LocationsAdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [locations, setLocations] = useState<LocationRef[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editName, setEditName] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [editSite, setEditSite] = useState('');
  const [editTimezone, setEditTimezone] = useState('Africa/Accra');
  const [editActive, setEditActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  const canManage = !!user && can(user, 'org:manage');

  async function refresh() {
    const list = await api.listLocations();
    setLocations(list);
    return list;
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { user } = await api.me();
        if (!can(user, 'org:read') && !can(user, 'org:manage')) {
          router.replace('/app');
          return;
        }
        if (!cancelled) setUser(user);
        const list = await refresh();
        if (!cancelled) {
          setSelectedId((prev) => prev || list[0]?.id || '');
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
  }, [router]);

  const selected = useMemo(
    () => locations.find((l) => l.id === selectedId) ?? null,
    [locations, selectedId],
  );

  useEffect(() => {
    if (!selected) return;
    setEditName(selected.name);
    setEditCountry(selected.country ?? '');
    setEditSite(selected.site ?? '');
    setEditTimezone(selected.timezone ?? 'Africa/Accra');
    setEditActive(selected.isActive !== false);
  }, [selected]);

  async function logout() {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    router.replace('/login');
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setCreating(true);
    setError(null);
    setMessage(null);
    try {
      const created = await api.createLocation({
        code: form.code.trim(),
        name: form.name.trim(),
        country: form.country.trim() || undefined,
        site: form.site.trim() || undefined,
        timezone: form.timezone.trim() || 'Africa/Accra',
      });
      setForm(EMPTY_FORM);
      setShowCreate(false);
      await refresh();
      setSelectedId(created.id);
      setMessage(`Created location ${created.code}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setCreating(false);
    }
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!canManage || !selected) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.updateLocation(selected.id, {
        name: editName.trim(),
        country: editCountry.trim() || null,
        site: editSite.trim() || null,
        timezone: editTimezone.trim() || 'Africa/Accra',
        isActive: editActive,
      });
      await refresh();
      setMessage('Location saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function onDeactivate() {
    if (!canManage || !selected) return;
    if (
      !window.confirm(
        `Soft-deactivate ${selected.code}? It will leave location pickers.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.deactivateLocation(selected.id);
      const list = await refresh();
      setSelectedId(list[0]?.id || '');
      setMessage(`Deactivated ${selected.code}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deactivate failed');
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) {
    return (
      <main className={appStyles.page}>
        <p>Loading locations…</p>
      </main>
    );
  }

  return (
    <AppShell user={user} onLogout={logout} title="Locations">
      <div className={styles.layout}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>Administration · Org</p>
          <p className={styles.lede}>
            Sites and offices used as <strong>ticket origin</strong>, user home
            location, team/asset placement, and routing filters.
          </p>
        </header>

        {error ? <p className={appStyles.error}>{error}</p> : null}
        {message ? <p className={styles.bannerOk}>{message}</p> : null}

        <div className={styles.split}>
          <section className={styles.panel}>
            <div className={styles.sectionHead}>
              <div>
                <h2 className={styles.sectionTitle}>Locations</h2>
                <p className={styles.sectionHint}>
                  {locations.length} site{locations.length === 1 ? '' : 's'}
                </p>
              </div>
              {canManage ? (
                <Button
                  type="button"
                  variant={showCreate ? 'secondary' : 'primary'}
                  onClick={() => {
                    setShowCreate((v) => !v);
                    setError(null);
                    setMessage(null);
                  }}
                >
                  <Icon icon={Plus} size="sm" />
                  {showCreate ? 'Cancel' : 'New location'}
                </Button>
              ) : null}
            </div>

            {showCreate && canManage ? (
              <form className={styles.createForm} onSubmit={onCreate}>
                <label className={styles.field}>
                  <span>Code</span>
                  <input
                    required
                    minLength={2}
                    maxLength={32}
                    placeholder="e.g. ACC-HQ"
                    value={form.code}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, code: e.target.value }))
                    }
                  />
                </label>
                <label className={styles.field}>
                  <span>Name</span>
                  <input
                    required
                    minLength={2}
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                  />
                </label>
                <label className={styles.field}>
                  <span>Country</span>
                  <input
                    value={form.country}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, country: e.target.value }))
                    }
                  />
                </label>
                <label className={styles.field}>
                  <span>Site</span>
                  <input
                    value={form.site}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, site: e.target.value }))
                    }
                    placeholder="e.g. Accra HQ"
                  />
                </label>
                <label className={`${styles.field} ${styles.fieldFull}`}>
                  <span>Timezone</span>
                  <input
                    value={form.timezone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, timezone: e.target.value }))
                    }
                    placeholder="Africa/Accra"
                  />
                </label>
                <div className={`${styles.formActions} ${styles.fieldFull}`}>
                  <Button type="submit" disabled={creating}>
                    {creating ? 'Creating…' : 'Create location'}
                  </Button>
                </div>
              </form>
            ) : null}

            {locations.length === 0 ? (
              <EmptyState icon={MapPin} className={styles.empty}>
                No locations yet.
              </EmptyState>
            ) : (
              <ul className={styles.teamList}>
                {locations.map((l) => {
                  const active = selectedId === l.id;
                  return (
                    <li key={l.id}>
                      <button
                        type="button"
                        className={`${styles.teamItem} ${
                          active ? styles.teamItemActive : ''
                        }`}
                        onClick={() => setSelectedId(l.id)}
                      >
                        <strong>
                          {l.name}
                          {l.isActive === false ? ' · inactive' : ''}
                        </strong>
                        <span>
                          {l.code}
                          {l.site ? ` · ${l.site}` : ''}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className={styles.panel}>
            {selected ? (
              <>
                <div className={styles.sectionHead}>
                  <div>
                    <h2 className={styles.sectionTitle}>{selected.code}</h2>
                    <p className={styles.sectionHint}>
                      Ticket origin site details for pickers and reports.
                    </p>
                  </div>
                </div>
                <form className={styles.editForm} onSubmit={onSave}>
                  <label className={styles.field}>
                    <span>Name</span>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      disabled={!canManage || busy}
                      required
                      minLength={2}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Country</span>
                    <input
                      value={editCountry}
                      onChange={(e) => setEditCountry(e.target.value)}
                      disabled={!canManage || busy}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Site</span>
                    <input
                      value={editSite}
                      onChange={(e) => setEditSite(e.target.value)}
                      disabled={!canManage || busy}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Timezone</span>
                    <input
                      value={editTimezone}
                      onChange={(e) => setEditTimezone(e.target.value)}
                      disabled={!canManage || busy}
                    />
                  </label>
                  {canManage ? (
                    <label className={`${styles.check} ${styles.fieldFull}`}>
                      <input
                        type="checkbox"
                        checked={editActive}
                        onChange={(e) => setEditActive(e.target.checked)}
                        disabled={busy}
                      />
                      Active (available in pickers)
                    </label>
                  ) : null}
                  {canManage ? (
                    <div className={`${styles.formActions} ${styles.fieldFull}`}>
                      <Button
                        type="button"
                        variant="dangerOutline"
                        disabled={busy}
                        onClick={onDeactivate}
                      >
                        Deactivate
                      </Button>
                      <Button type="submit" disabled={busy}>
                        <Icon icon={Save} size="sm" />
                        {busy ? 'Saving…' : 'Save'}
                      </Button>
                    </div>
                  ) : null}
                </form>
              </>
            ) : (
              <EmptyState icon={MapPin} className={styles.empty}>
                Select a location.
              </EmptyState>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
