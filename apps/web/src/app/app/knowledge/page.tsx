'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type AuthUser, type KnowledgeArticle } from '@/lib/api';
import { can } from '@/lib/access';
import { AppShell } from '@/components/AppShell';
import styles from '../app.module.css';
import { BookOpen, Home, Plus, Send } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { ButtonLink } from '@/components/Button';

export default function KnowledgePage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [items, setItems] = useState<KnowledgeArticle[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { user } = await api.me();
        if (!can(user, 'knowledge:read') && !can(user, 'knowledge:write')) {
          router.replace('/app');
          return;
        }
        setUser(user);
      } catch {
        router.replace('/login');
        return;
      }
      try {
        setItems(await api.knowledge());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load knowledge');
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

  async function publish(id: string) {
    setError(null);
    try {
      await api.publishKnowledge(id);
      setItems(await api.knowledge());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Publish failed');
    }
  }

  if (!user) {
    return (
      <main className={styles.page}>
        <p className={styles.muted}>Loading…</p>
      </main>
    );
  }

  const canWrite = can(user, 'knowledge:write');

  return (
    <AppShell user={user} onLogout={logout} title="Knowledge base">
      <section className={styles.panel}>
        <p className={styles.mission}>
          {canWrite
            ? 'Browse published and draft articles. Create and publish how-to content for the service desk and employees.'
            : 'Browse published help articles. Authors with knowledge write access create and publish content.'}
        </p>
        <div className={styles.ctaRow} style={{ marginBottom: '1rem' }}>
          {canWrite ? (
            <ButtonLink href="/app/knowledge/new">
              <Icon icon={Plus} size="sm" />
              Create article
            </ButtonLink>
          ) : null}
          <ButtonLink href="/app" variant="secondary">
            <Icon icon={Home} size="sm" />
            Back to Home
          </ButtonLink>
        </div>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        {items.length === 0 ? (
          <EmptyState icon={BookOpen}>
            No articles yet.{' '}
            {canWrite ? (
              <a href="/app/knowledge/new">Create the first article</a>
            ) : (
              <a href="/app">Back to Home</a>
            )}
          </EmptyState>
        ) : (
          <ul className={styles.ticketList}>
            {items.map((a) => (
              <li key={a.id}>
                <a className={styles.rowLink} href={`/app/knowledge/${a.slug}`}>
                  <strong>{a.title}</strong>
                  <em>
                    {a.category ?? 'General'}
                    {a.status ? ` · ${a.status}` : ''}
                  </em>
                </a>
                {canWrite && a.status === 'draft' ? (
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.btn}
                      onClick={() => publish(a.id)}
                    >
                      <Icon icon={Send} size="sm" />
                      Publish
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
