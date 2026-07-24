'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Save, Trash2, KeyRound, UserPlus, Users } from 'lucide-react';
import {
  api,
  type AuthUser,
  type LocationRef,
} from '@/lib/api';
import { can } from '@/lib/access';
import { AppShell } from '@/components/AppShell';
import { Button, ButtonLink } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { SectionHeading } from '@/components/SectionHeading';
import { LocationSelect } from '@/components/LocationSelect';
import appStyles from '../../app.module.css';
import styles from './users.module.css';

type UserRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  departmentId?: string | null;
  locationId: string | null;
  lastLoginAt?: string | null;
  createdAt?: string;
  location?: {
    id: string;
    code: string;
    name: string;
    site: string | null;
  } | null;
  roles: Array<{ code: string; name: string }>;
  primaryRole: { code: string; name: string } | null;
};

type RoleOption = { code: string; name: string };
type DeptOption = { id: string; code: string; name: string; isActive?: boolean };

const EMPTY_CREATE = {
  email: '',
  firstName: '',
  lastName: '',
  password: '',
  roleCode: 'employee',
  locationId: '',
  departmentId: '',
};

export default function UsersAdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [locations, setLocations] = useState<LocationRef[]>([]);
  const [departments, setDepartments] = useState<DeptOption[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [query, setQuery] = useState('');
  const [showInactive, setShowInactive] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const [edit, setEdit] = useState({
    email: '',
    firstName: '',
    lastName: '',
    locationId: '',
    departmentId: '',
    isActive: true,
  });
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const canManage = !!user && can(user, 'users:manage');

  async function refresh() {
    const list = await api.listUsers();
    setUsers(list);
    return list;
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { user: me } = await api.me();
        if (!can(me, 'users:manage') && !can(me, 'users:read')) {
          router.replace('/app');
          return;
        }
        if (!cancelled) setUser(me);
        const [list, matrix] = await Promise.all([
          refresh(),
          api.rolesMatrix().catch(() => null),
        ]);
        if (cancelled) return;
        if (matrix) {
          setRoles(matrix.roles.map((r) => ({ code: r.code, name: r.name })));
          setCreateForm((f) => ({
            ...f,
            roleCode: matrix.roles.find((r) => r.code === 'employee')?.code
              ?? matrix.roles[0]?.code
              ?? 'employee',
          }));
        }
        setSelectedId((prev) => prev || list[0]?.id || '');
        if (can(me, 'org:read') || can(me, 'org:manage')) {
          const [locs, depts] = await Promise.all([
            api.listLocations().catch(() => [] as LocationRef[]),
            api.listDepartments().catch(() => [] as DeptOption[]),
          ]);
          if (!cancelled) {
            setLocations(locs);
            setDepartments(depts.filter((d) => d.isActive !== false));
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
  }, [router]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (!showInactive && !u.isActive) return false;
      if (!q) return true;
      return (
        u.email.toLowerCase().includes(q) ||
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
        (u.primaryRole?.name ?? '').toLowerCase().includes(q) ||
        (u.primaryRole?.code ?? '').toLowerCase().includes(q)
      );
    });
  }, [users, query, showInactive]);

  const selected = useMemo(
    () => users.find((u) => u.id === selectedId) ?? null,
    [users, selectedId],
  );

  useEffect(() => {
    if (!selected) return;
    setEdit({
      email: selected.email,
      firstName: selected.firstName,
      lastName: selected.lastName,
      locationId: selected.locationId ?? '',
      departmentId: selected.departmentId ?? '',
      isActive: selected.isActive,
    });
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
    setBusy(true);
    setError(null);
    setMessage(null);
    setTempPassword(null);
    try {
      const result = await api.createUser({
        email: createForm.email.trim(),
        firstName: createForm.firstName.trim(),
        lastName: createForm.lastName.trim(),
        password: createForm.password.trim() || undefined,
        roleCodes: createForm.roleCode ? [createForm.roleCode] : undefined,
        locationId: createForm.locationId || undefined,
        departmentId: createForm.departmentId || undefined,
      });
      const list = await refresh();
      setSelectedId(result.user.id);
      if (!list.some((u) => u.id === result.user.id)) {
        /* refresh should include them */
      }
      setCreateForm((f) => ({
        ...EMPTY_CREATE,
        roleCode: f.roleCode,
      }));
      setShowCreate(false);
      if (result.temporaryPassword) {
        setTempPassword(result.temporaryPassword);
        setMessage(
          `Created ${result.user.email}. Share the temporary password below — they must change it on first login.`,
        );
      } else {
        setMessage(`Created ${result.user.email}.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!canManage || !selected) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.updateUser(selected.id, {
        email: edit.email.trim(),
        firstName: edit.firstName.trim(),
        lastName: edit.lastName.trim(),
        locationId: edit.locationId || null,
        departmentId: edit.departmentId || null,
        isActive: edit.isActive,
      });
      await refresh();
      setMessage(`Updated ${edit.email.trim().toLowerCase()}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive() {
    if (!canManage || !selected) return;
    const next = !selected.isActive;
    if (
      !next &&
      !window.confirm(
        `Deactivate ${selected.email}? They will not be able to sign in.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    setTempPassword(null);
    try {
      await api.updateUser(selected.id, { isActive: next });
      await refresh();
      setMessage(next ? 'User activated.' : 'User deactivated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  async function onResetPassword() {
    if (!canManage || !selected) return;
    if (
      !window.confirm(
        `Reset password for ${selected.email}? They will be signed out and must change the temporary password on next login.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    setTempPassword(null);
    try {
      const result = await api.resetUserPassword(selected.id);
      setTempPassword(result.temporaryPassword);
      setMessage(
        `Password reset for ${result.user.email}. Share the temporary password below — they must change it on next login.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password reset failed');
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteUser() {
    if (!canManage || !selected || !user) return;
    if (selected.id === user.id) {
      setError('You cannot delete your own account.');
      return;
    }
    if (
      !window.confirm(
        `Permanently remove ${selected.email} from the user directory? Their tickets stay in the system; they will not be able to sign in. This cannot be undone from the UI.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    setTempPassword(null);
    try {
      const result = await api.deleteUser(selected.id);
      setSelectedId('');
      await refresh();
      setMessage(`Deleted ${result.formerEmail}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) {
    return (
      <main className={appStyles.page}>
        <p className={appStyles.muted}>Loading users…</p>
      </main>
    );
  }

  return (
    <AppShell user={user} onLogout={logout} title="Users">
      <div className={styles.layout}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>Administration</p>
          <p className={styles.lede}>
            Create accounts, set home location and department, reset passwords,
            deactivate or delete sign-in. Assign fine-grained permissions under{' '}
            <a href="/app/admin/roles">Roles &amp; Access</a>.
          </p>
        </header>

        {error ? (
          <p className={appStyles.error} role="alert">
            {error}
          </p>
        ) : null}
        {message ? <p className={styles.bannerOk}>{message}</p> : null}
        {tempPassword ? (
          <p className={styles.bannerOk} role="status">
            Temporary password:{' '}
            <code style={{ userSelect: 'all' }}>{tempPassword}</code>
          </p>
        ) : null}

        <div className={styles.toolbar}>
          <label className={styles.filterField}>
            Search
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, email, role…"
            />
          </label>
          <label className={styles.checkRow}>
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Show inactive
          </label>
          {canManage ? (
            <Button
              type="button"
              variant="primary"
              onClick={() => setShowCreate((v) => !v)}
            >
              <Icon icon={Plus} size="sm" />
              {showCreate ? 'Hide form' : 'Create user'}
            </Button>
          ) : null}
          <ButtonLink href="/app/admin/roles" variant="secondary">
            Roles &amp; Access
          </ButtonLink>
        </div>

        {canManage && showCreate ? (
          <section className={styles.panel}>
            <SectionHeading icon={UserPlus} className={styles.sectionTitle}>
              Create user
            </SectionHeading>
            <form onSubmit={onCreate} className={styles.formGrid}>
              <label className={styles.field}>
                Email
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, email: e.target.value }))
                  }
                />
              </label>
              <label className={styles.field}>
                First name
                <input
                  required
                  minLength={1}
                  value={createForm.firstName}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, firstName: e.target.value }))
                  }
                />
              </label>
              <label className={styles.field}>
                Last name
                <input
                  required
                  minLength={1}
                  value={createForm.lastName}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, lastName: e.target.value }))
                  }
                />
              </label>
              <label className={styles.field}>
                Primary role
                <select
                  value={createForm.roleCode}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, roleCode: e.target.value }))
                  }
                >
                  {roles.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                Temporary password (optional)
                <input
                  type="text"
                  autoComplete="new-password"
                  placeholder="Leave blank to auto-generate"
                  value={createForm.password}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, password: e.target.value }))
                  }
                />
              </label>
              {locations.length ? (
                <label className={styles.field}>
                  Home location
                  <LocationSelect
                    value={createForm.locationId}
                    onChange={(id) =>
                      setCreateForm((f) => ({ ...f, locationId: id }))
                    }
                    locations={locations}
                    allowEmpty
                    emptyLabel="None"
                  />
                </label>
              ) : null}
              {departments.length ? (
                <label className={styles.field}>
                  Department
                  <select
                    value={createForm.departmentId}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        departmentId: e.target.value,
                      }))
                    }
                  >
                    <option value="">None</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <div className={styles.actions}>
                <Button type="submit" disabled={busy}>
                  {busy ? 'Creating…' : 'Create user'}
                </Button>
              </div>
            </form>
          </section>
        ) : null}

        {filtered.length === 0 ? (
          <EmptyState icon={Users}>
            No users match. {canManage ? 'Create the first account above.' : null}
          </EmptyState>
        ) : (
          <div className={styles.split}>
            <section className={styles.panel}>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((u) => (
                      <tr
                        key={u.id}
                        className={
                          u.id === selectedId ? styles.selected : undefined
                        }
                        onClick={() => setSelectedId(u.id)}
                      >
                        <td>
                          {u.firstName} {u.lastName}
                        </td>
                        <td>{u.email}</td>
                        <td>{u.primaryRole?.name ?? '—'}</td>
                        <td>{u.isActive ? 'Active' : 'Inactive'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className={styles.panel}>
              {selected ? (
                canManage ? (
                  <form onSubmit={onSave}>
                    <h2 className={styles.sectionTitle}>
                      {selected.firstName} {selected.lastName}
                    </h2>
                    <div className={styles.formGrid}>
                      <label className={styles.field}>
                        Email
                        <input
                          required
                          type="email"
                          autoComplete="off"
                          value={edit.email}
                          onChange={(e) =>
                            setEdit((f) => ({
                              ...f,
                              email: e.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className={styles.field}>
                        First name
                        <input
                          required
                          value={edit.firstName}
                          onChange={(e) =>
                            setEdit((f) => ({
                              ...f,
                              firstName: e.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className={styles.field}>
                        Last name
                        <input
                          required
                          value={edit.lastName}
                          onChange={(e) =>
                            setEdit((f) => ({
                              ...f,
                              lastName: e.target.value,
                            }))
                          }
                        />
                      </label>
                      {locations.length ? (
                        <label className={styles.field}>
                          Home location
                          <LocationSelect
                            value={edit.locationId}
                            onChange={(id) =>
                              setEdit((f) => ({ ...f, locationId: id }))
                            }
                            locations={locations}
                            allowEmpty
                            emptyLabel="None"
                          />
                        </label>
                      ) : null}
                      {departments.length ? (
                        <label className={styles.field}>
                          Department
                          <select
                            value={edit.departmentId}
                            onChange={(e) =>
                              setEdit((f) => ({
                                ...f,
                                departmentId: e.target.value,
                              }))
                            }
                          >
                            <option value="">None</option>
                            {departments.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                      <label className={styles.checkRow}>
                        <input
                          type="checkbox"
                          checked={edit.isActive}
                          onChange={(e) =>
                            setEdit((f) => ({
                              ...f,
                              isActive: e.target.checked,
                            }))
                          }
                        />
                        Active (can sign in)
                      </label>
                    </div>
                    <div className={styles.actions}>
                      <Button type="submit" disabled={busy}>
                        <Icon icon={Save} size="sm" />
                        {busy ? 'Saving…' : 'Save'}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={busy}
                        onClick={toggleActive}
                      >
                        {selected.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={busy}
                        onClick={onResetPassword}
                      >
                        <Icon icon={KeyRound} size="sm" />
                        Reset password
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={busy || selected.id === user.id}
                        onClick={onDeleteUser}
                      >
                        <Icon icon={Trash2} size="sm" />
                        Delete
                      </Button>
                      <ButtonLink
                        href="/app/admin/roles"
                        variant="tertiary"
                      >
                        Set roles
                      </ButtonLink>
                    </div>
                  </form>
                ) : (
                  <div>
                    <h2 className={styles.sectionTitle}>
                      {selected.firstName} {selected.lastName}
                    </h2>
                    <p className={styles.hint}>{selected.email}</p>
                    <p>
                      Role: {selected.primaryRole?.name ?? '—'} ·{' '}
                      {selected.isActive ? 'Active' : 'Inactive'}
                    </p>
                  </div>
                )
              ) : (
                <p className={styles.hint}>Select a user to view details.</p>
              )}
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}
