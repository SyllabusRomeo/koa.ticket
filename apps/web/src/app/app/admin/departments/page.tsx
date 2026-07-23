'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Plus, Save } from 'lucide-react';
import { api, type AuthUser, type LocationRef } from '@/lib/api';
import { can } from '@/lib/access';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { SectionHeading } from '@/components/SectionHeading';
import { LocationSelect } from '@/components/LocationSelect';
import appStyles from '../../app.module.css';
import styles from '../teams/teams.module.css';

type DepartmentRow = {
  id: string;
  code: string;
  name: string;
  locationId: string | null;
  isActive?: boolean;
  location?: { id: string; code: string; name: string } | null;
};

const EMPTY_FORM = { code: '', name: '', locationId: '' };

export default function DepartmentsAdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [locations, setLocations] = useState<LocationRef[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editName, setEditName] = useState('');
  const [editLocationId, setEditLocationId] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  const canManage = !!user && can(user, 'org:manage');

  async function refresh() {
    const list = await api.listDepartments();
    setDepartments(list);
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
        const [list, locs] = await Promise.all([
          refresh(),
          api.listLocations().catch(() => [] as LocationRef[]),
        ]);
        if (!cancelled) {
          setLocations(locs);
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
    () => departments.find((d) => d.id === selectedId) ?? null,
    [departments, selectedId],
  );

  useEffect(() => {
    if (!selected) return;
    setEditName(selected.name);
    setEditLocationId(selected.locationId ?? '');
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
      const created = await api.createDepartment({
        code: form.code.trim(),
        name: form.name.trim(),
        locationId: form.locationId || undefined,
      });
      setForm(EMPTY_FORM);
      setShowCreate(false);
      await refresh();
      setSelectedId(created.id);
      setMessage(`Created department ${created.code}.`);
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
      await api.updateDepartment(selected.id, {
        name: editName.trim(),
        locationId: editLocationId || null,
        isActive: editActive,
      });
      await refresh();
      setMessage('Department saved.');
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
        `Soft-deactivate ${selected.code}? It will leave department pickers.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.deactivateDepartment(selected.id);
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
        <p>Loading departments…</p>
      </main>
    );
  }

  return (
    <AppShell user={user} onLogout={logout} title="Departments">
      <div className={styles.layout}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>Administration · Org</p>
          <p className={styles.lede}>
            Business units used on user profiles and when creating service
            teams. Seed includes <strong>Information Technology</strong> and{' '}
            <strong>Operations</strong> — add more here.
          </p>
        </header>

        {error ? <p className={appStyles.error}>{error}</p> : null}
        {message ? <p className={styles.bannerOk}>{message}</p> : null}

        <div className={styles.split}>
          <section className={styles.panel}>
            <div className={styles.sectionHead}>
              <div>
                <SectionHeading
                  icon={Building2}
                  className={styles.sectionTitle}
                >
                  Departments
                </SectionHeading>
                <p className={styles.sectionHint}>
                  {departments.length} department
                  {departments.length === 1 ? '' : 's'}
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
                  {showCreate ? 'Cancel' : 'New department'}
                </Button>
              ) : null}
            </div>

            {showCreate && canManage ? (
              <form
                className={`${styles.createForm} ${styles.createFormStack}`}
                onSubmit={onCreate}
              >
                <label className={styles.field}>
                  <span>Code</span>
                  <input
                    required
                    minLength={2}
                    maxLength={32}
                    placeholder="e.g. FIN"
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
                  <span>Primary location (optional)</span>
                  <LocationSelect
                    value={form.locationId}
                    locations={locations}
                    allowEmpty
                    emptyLabel="No location"
                    onChange={(id) =>
                      setForm((f) => ({ ...f, locationId: id }))
                    }
                  />
                </label>
                <div className={styles.formActions}>
                  <Button type="submit" disabled={creating}>
                    {creating ? 'Creating…' : 'Create department'}
                  </Button>
                </div>
              </form>
            ) : null}

            {departments.length === 0 ? (
              <EmptyState icon={Building2}>
                No departments yet. Create one to organize teams and users.
              </EmptyState>
            ) : (
              <ul className={styles.teamList}>
                {departments.map((d) => {
                  const active = selectedId === d.id;
                  return (
                    <li key={d.id}>
                      <button
                        type="button"
                        className={`${styles.teamItem} ${
                          active ? styles.teamItemActive : ''
                        }`}
                        onClick={() => setSelectedId(d.id)}
                      >
                        <strong>
                          {d.name}
                          {d.isActive === false ? ' · inactive' : ''}
                        </strong>
                        <span>
                          {d.code}
                          {d.location ? ` · ${d.location.name}` : ''}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className={styles.panel}>
            {!selected ? (
              <EmptyState icon={Building2}>Select a department</EmptyState>
            ) : (
              <>
                <div className={styles.sectionHead}>
                  <div>
                    <h2 className={styles.sectionTitle}>{selected.code}</h2>
                    <p className={styles.sectionHint}>{selected.name}</p>
                  </div>
                </div>
                <form className={styles.editForm} onSubmit={onSave}>
                  <label className={styles.field}>
                    <span>Name</span>
                    <input
                      required
                      disabled={!canManage || busy}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </label>
                  <label className={`${styles.field} ${styles.fieldFull}`}>
                    <span>Primary location</span>
                    <LocationSelect
                      value={editLocationId}
                      locations={locations}
                      includeInactive
                      allowEmpty
                      emptyLabel="No location"
                      disabled={!canManage || busy}
                      onChange={setEditLocationId}
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
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
