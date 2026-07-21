'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type AuthUser } from '@/lib/api';
import { can } from '@/lib/access';
import { AppShell } from '@/components/AppShell';
import styles from '../app.module.css';

export default function KnowledgePage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [items, setItems] = useState<
    Array<{ id: string; slug: string; title: string; category: string | null }>
  >([]);

  useEffect(() => {
    (async () => {
      try {
        const { user } = await api.me();
        setUser(user);
        setItems(await api.knowledge());
      } catch {
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
    <AppShell user={user} onLogout={logout} title="Knowledge base">
      <section className={styles.panel}>
        {!can(user, 'knowledge:read') ? (
          <p className={styles.error}>No knowledge access.</p>
        ) : items.length === 0 ? (
          <p className={styles.muted}>No published articles.</p>
        ) : (
          <ul className={styles.ticketList}>
            {items.map((a) => (
              <li key={a.id}>
                <strong>{a.title}</strong>
                <em>{a.category ?? 'General'}</em>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
