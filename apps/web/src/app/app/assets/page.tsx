'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function AssetsPage() {
  const router = useRouter();
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
        await api.me();
        setItems(await api.assets());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed');
        if (String(e).includes('authenticated')) router.replace('/login');
      }
    })();
  }, [router]);

  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: '1.5rem' }}>
      <p>
        <a href="/app">← Workspace</a>
      </p>
      <h1 style={{ fontFamily: 'var(--font-display)' }}>Assets</h1>
      {error ? <p style={{ color: 'var(--color-danger)' }}>{error}</p> : null}
      <ul>
        {items.map((a) => (
          <li key={a.id}>
            <strong>{a.assetTag}</strong> · {a.type.name} · {a.status}
          </li>
        ))}
      </ul>
    </main>
  );
}
