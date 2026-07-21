'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function KnowledgePage() {
  const router = useRouter();
  const [items, setItems] = useState<
    Array<{ id: string; slug: string; title: string; category: string | null }>
  >([]);

  useEffect(() => {
    (async () => {
      try {
        await api.me();
        setItems(await api.knowledge());
      } catch {
        router.replace('/login');
      }
    })();
  }, [router]);

  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: '1.5rem' }}>
      <p>
        <a href="/app">← Workspace</a>
      </p>
      <h1 style={{ fontFamily: 'var(--font-display)' }}>Knowledge base</h1>
      {items.length === 0 ? (
        <p>No published articles.</p>
      ) : (
        <ul>
          {items.map((a) => (
            <li key={a.id} style={{ marginBottom: '0.75rem' }}>
              <strong>{a.title}</strong>
              {a.category ? ` · ${a.category}` : ''}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
