'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type AuthUser } from '@/lib/api';
import { AppShell } from '@/components/AppShell';
import styles from '../app.module.css';

export default function CatalogPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [items, setItems] = useState<
    Array<{ id: string; code: string; name: string; description: string }>
  >([]);

  useEffect(() => {
    (async () => {
      try {
        const { user } = await api.me();
        setUser(user);
        setItems(await api.catalog());
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
    <AppShell user={user} onLogout={logout} title="Service catalog">
      <section className={styles.panel}>
        <p className={styles.mission}>
          Browse requestable services. To order one, open Tickets and create a
          Service Request or Access Request (goes to Approvals).
        </p>
        <ul className={styles.ticketList}>
          {items.map((i) => (
            <li key={i.id}>
              <strong>
                {i.name} ({i.code})
              </strong>
              <em>{i.description}</em>
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}
