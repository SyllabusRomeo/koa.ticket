'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type AuthUser } from '@/lib/api';
import { can } from '@/lib/access';
import { AppShell } from '@/components/AppShell';
import styles from '../app.module.css';

export default function AssetsPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [items, setItems] = useState<
    Array<{
      id: string;
      assetTag: string;
      status: string;
      type: { name: string };
    }>
  >([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { user } = await api.me();
        if (!can(user, 'assets:read')) {
          router.replace('/app');
          return;
        }
        setUser(user);
        setItems(await api.assets());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed');
        router.replace('/login');
      }
    })();
  }, [router]);

  async function logout() {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    router.replace('/login');
  }

  if (!user) {
    return (
      <main className={styles.page}>
        <p className={styles.muted}>Loading…</p>
      </main>
    );
  }

  return (
    <AppShell user={user} onLogout={logout} title="Assets">
      <section className={styles.panel}>
        {error ? <p className={styles.error}>{error}</p> : null}
        <ul className={styles.ticketList}>
          {items.map((a) => (
            <li key={a.id}>
              <strong>{a.assetTag}</strong>
              <em>
                {a.type.name} · {a.status}
              </em>
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}
