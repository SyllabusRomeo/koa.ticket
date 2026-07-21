'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type AuthUser } from '@/lib/api';
import { can } from '@/lib/access';
import { AppShell } from '@/components/AppShell';
import { PendingAttachments } from '@/components/TicketAttachments';
import { RichTextEditor, RichTextHiddenField } from '@/components/RichTextEditor';
import styles from '../../app.module.css';
import { Save, Send } from 'lucide-react';
import { Icon } from '@/components/Icon';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100/api/v1';

function slugify(title: string) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function bodyText(html: string) {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
}

export default function NewKnowledgePage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [category, setCategory] = useState('How-to');
  const [body, setBody] = useState('<p></p>');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [publish, setPublish] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { user } = await api.me();
        if (!can(user, 'knowledge:write')) {
          router.replace('/app/knowledge');
          return;
        }
        setUser(user);
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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (bodyText(body).length < 3) {
      setError('Body must include at least a few characters of text.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const article = await api.createKnowledge({
        title,
        body,
        slug: slug || slugify(title),
        category: category || undefined,
        publish,
      });
      for (const file of pendingFiles) {
        await api.uploadKnowledgeAttachment(article.id, file);
      }
      router.replace(`/app/knowledge/${article.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
      setSaving(false);
    }
  }

  if (!user) {
    return (
      <main className={styles.page}>
        <p className={styles.muted}>Loading…</p>
      </main>
    );
  }

  return (
    <AppShell user={user} onLogout={logout} title="Create article">
      <section className={styles.panel}>
        <p className={styles.mission}>
          Authors with <code>knowledge:write</code> write help-center articles
          with rich text, inline images, and downloadable attachments.
        </p>
        <form
          onSubmit={onSubmit}
          style={{ display: 'grid', gap: '0.85rem', maxWidth: 720 }}
        >
          <label>
            Title
            <input
              value={title}
              onChange={(e) => {
                const v = e.target.value;
                setTitle(v);
                if (!slugTouched) setSlug(slugify(v));
              }}
              required
              minLength={3}
              style={{ display: 'block', width: '100%', marginTop: 4 }}
            />
          </label>
          <label>
            Slug (URL)
            <input
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              required
              minLength={2}
              style={{ display: 'block', width: '100%', marginTop: 4 }}
            />
          </label>
          <label>
            Category
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: 4 }}
            />
          </label>
          <div>
            <span style={{ display: 'block', marginBottom: 4 }}>Body</span>
            <RichTextHiddenField value={body} required />
            <RichTextEditor
              value={body}
              onChange={setBody}
              disabled={saving}
              onUploadImage={async (file) => {
                const att = await api.uploadKnowledgeMedia(file);
                return {
                  url: `${API_BASE}/knowledge/attachments/${att.id}/content`,
                  alt: att.originalName,
                };
              }}
            />
          </div>
          <PendingAttachments
            files={pendingFiles}
            onChange={setPendingFiles}
            label="Article attachments"
            hint="Optional downloads for readers (PDF, Office docs, ZIP). Use Insert image in the editor for screenshots in the body."
          />
          <label>
            <input
              type="checkbox"
              checked={publish}
              onChange={(e) => setPublish(e.target.checked)}
            />{' '}
            Publish immediately
          </label>
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
          <div className={styles.actions}>
            <button type="submit" className={styles.btn} disabled={saving}>
              <Icon icon={publish ? Send : Save} size="sm" />
              {saving ? 'Saving…' : publish ? 'Publish article' : 'Save draft'}
            </button>
            <a
              href="/app/knowledge"
              className={`${styles.btn} ${styles.btnSecondary}`}
            >
              Cancel
            </a>
          </div>
        </form>
      </section>
    </AppShell>
  );
}
