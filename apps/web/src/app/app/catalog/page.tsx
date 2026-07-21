'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function CatalogPage() {
  const router = useRouter();
  const [items, setItems] = useState<
    Array<{ id: string; code: string; name: string; description: string }>
  >([]);

  useEffect(() => {
    (async () => {
      try {
        await api.me();
        setItems(await api.catalog());
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
      <h1 style={{ fontFamily: 'var(--font-display)' }}>Service catalog</h1>
      <ul>
        {items.map((i) => (
          <li key={i.id} style={{ marginBottom: '1rem' }}>
            <strong>{i.name}</strong> ({i.code})
            <div>{i.description}</div>
          </li>
        ))}
      </ul>
    </main>
  );
}
