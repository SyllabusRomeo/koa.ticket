'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function ReportsPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await api.me();
        setSummary(await api.reportSummary());
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
      <h1 style={{ fontFamily: 'var(--font-display)' }}>Reports</h1>
      {error ? <p style={{ color: 'var(--color-danger)' }}>{error}</p> : null}
      {summary ? (
        <ul>
          {Object.entries(summary).map(([k, v]) =>
            typeof v === 'number' ? (
              <li key={k}>
                <strong>{k}</strong>: {v}
              </li>
            ) : null,
          )}
        </ul>
      ) : null}
      <p>
        <a href={`${process.env.NEXT_PUBLIC_API_URL}/reports/export.csv`}>
          Export CSV
        </a>{' '}
        (sign-in cookie required — use API client / browser session)
      </p>
    </main>
  );
}
