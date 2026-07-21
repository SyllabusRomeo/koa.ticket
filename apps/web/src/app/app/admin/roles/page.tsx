'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type AuthUser } from '@/lib/api';
import { can } from '@/lib/access';
import { AppShell } from '@/components/AppShell';
import styles from '../../app.module.css';

type RoleRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  userCount: number;
  permissions: string[];
};

type UserRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  roles: Array<{ code: string; name: string }>;
};

export default function RolesAccessPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const [matrix, userList] = await Promise.all([
      api.rolesMatrix(),
      api.listUsers(),
    ]);
    setRoles(matrix);
    setUsers(userList);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { user } = await api.me();
        if (!can(user, 'roles:manage') && !can(user, 'users:manage')) {
          router.replace('/app');
          return;
        }
        if (!cancelled) setUser(user);
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
  }, [router]);

  function onPickUser(id: string) {
    setSelectedUserId(id);
    const u = users.find((x) => x.id === id);
    setSelectedRoles(u ? u.roles.map((r) => r.code) : []);
    setMessage(null);
  }

  function toggleRole(code: string) {
    setSelectedRoles((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  async function saveRoles() {
    if (!selectedUserId) return;
    setError(null);
    setMessage(null);
    try {
      await api.setUserRoles(selectedUserId, selectedRoles);
      await load();
      setMessage('Roles updated. User must re-login for session permissions refresh if already signed in elsewhere.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
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
      <main className={styles.page}>
        <p className={styles.muted}>Loading roles…</p>
      </main>
    );
  }

  return (
    <AppShell user={user} onLogout={logout} title="Roles & Access">
      <section className={styles.panel}>
        <p className={styles.mission}>
          Super-admin control for RBAC. One LogIT app — elevated access is by
          role, not a separate portal.
        </p>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        {message ? <p>{message}</p> : null}

        <h2 className={styles.sectionTitle}>Role permission matrix</h2>
        <ul className={styles.ticketList}>
          {roles.map((r) => (
            <li key={r.id}>
              <strong>
                {r.name} ({r.code})
              </strong>
              <em>
                {r.userCount} user{r.userCount === 1 ? '' : 's'} ·{' '}
                {r.permissions.length} permissions
              </em>
              <span style={{ fontSize: '0.85rem', opacity: 0.85 }}>
                {r.permissions.join(', ')}
              </span>
            </li>
          ))}
        </ul>

        <h2 className={styles.sectionTitle}>Assign roles to user</h2>
        <label>
          User{' '}
          <select
            value={selectedUserId}
            onChange={(e) => onPickUser(e.target.value)}
          >
            <option value="">Select…</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.firstName} {u.lastName} — {u.email}
              </option>
            ))}
          </select>
        </label>

        {selectedUserId ? (
          <>
            <div style={{ marginTop: '0.75rem' }}>
              {roles.map((r) => (
                <label
                  key={r.code}
                  style={{ display: 'block', marginBottom: '0.35rem' }}
                >
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(r.code)}
                    onChange={() => toggleRole(r.code)}
                  />{' '}
                  {r.name} ({r.code})
                </label>
              ))}
            </div>
            <div className={styles.actions}>
              <button type="button" className={styles.btn} onClick={saveRoles}>
                Save roles
              </button>
            </div>
          </>
        ) : null}
      </section>
    </AppShell>
  );
}
