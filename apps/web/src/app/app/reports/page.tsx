'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type AuthUser } from '@/lib/api';
import { can } from '@/lib/access';
import { AppShell } from '@/components/AppShell';
import styles from '../app.module.css';

export default function ReportsPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { user } = await api.me();
        if (!can(user, 'reports:read')) {
          router.replace('/app');
          return;
        }
        setUser(user);
        setSummary(await api.reportSummary());
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
    <AppShell user={user} onLogout={logout} title="Reports">
      <section className={styles.panel}>
        {error ? <p className={styles.error}>{error}</p> : null}
        {summary ? (
          <div className={styles.stats}>
            {Object.entries(summary).map(([k, v]) =>
              typeof v === 'number' ? (
                <div key={k}>
                  <strong>{v}</strong>
                  <span>{k}</span>
                </div>
              ) : null,
            )}
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}
