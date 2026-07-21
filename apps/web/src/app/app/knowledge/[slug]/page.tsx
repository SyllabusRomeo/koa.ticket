'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  api,
  type AuthUser,
  type KnowledgeArticle,
  type KnowledgeAttachment,
} from '@/lib/api';
import { can } from '@/lib/access';
import { AppShell } from '@/components/AppShell';
import { KnowledgeAttachments } from '@/components/KnowledgeAttachments';
import { KnowledgeHtml } from '@/components/KnowledgeHtml';
import { RichTextEditor, RichTextHiddenField } from '@/components/RichTextEditor';
import styles from '../../app.module.css';
import { Plus, Save } from 'lucide-react';
import { Icon } from '@/components/Icon';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100/api/v1';

function bodyText(html: string) {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
}

export default function KnowledgeArticlePage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = decodeURIComponent(params.slug ?? '');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [article, setArticle] = useState<KnowledgeArticle | null>(null);
  const [attachments, setAttachments] = useState<KnowledgeAttachment[]>([]);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadArticle(s: string) {
    const a = await api.getKnowledge(s);
    setArticle(a);
    setTitle(a.title);
    setCategory(a.category ?? '');
    setBody(a.body ?? '<p></p>');
    setAttachments(a.attachments ?? []);
  }

  useEffect(() => {
    (async () => {
      try {
        const { user } = await api.me();
        setUser(user);
        await loadArticle(slug);
      } catch {
        router.replace('/app/knowledge');
      }
    })();
  }, [router, slug]);

  async function logout() {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    router.replace('/login');
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!article) return;
    if (bodyText(body).length < 3) {
      setError('Body must include at least a few characters of text.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateKnowledge(article.id, {
        title,
        body,
        category: category || undefined,
      });
      setArticle(updated);
      setAttachments(updated.attachments ?? []);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function onPublish() {
    if (!article) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.publishKnowledge(article.id);
      setArticle(updated);
      setAttachments(updated.attachments ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setSaving(false);
    }
  }

  if (!user || !article) {
    return (
      <main className={styles.page}>
        <p className={styles.muted}>Loading article…</p>
      </main>
    );
  }

  const canWrite = can(user, 'knowledge:write');

  return (
    <AppShell user={user} onLogout={logout} title={article.title}>
      <section className={styles.panel}>
        <p className={styles.muted} style={{ marginBottom: '0.75rem' }}>
          <a href="/app/knowledge">Back to Knowledge</a>
          {article.status ? ` · ${article.status}` : ''}
          {article.category ? ` · ${article.category}` : ''}
        </p>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        {canWrite ? (
          <div className={styles.ctaRow} style={{ marginBottom: '1rem' }}>
            <button
              type="button"
              className={styles.btn}
              onClick={() => setEditing((v) => !v)}
            >
              {editing ? 'Cancel edit' : 'Edit article'}
            </button>
            {article.status !== 'published' ? (
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                disabled={saving}
                onClick={onPublish}
              >
                Publish
              </button>
            ) : null}
            <a
              href="/app/knowledge/new"
              className={`${styles.btn} ${styles.btnSecondary}`}
            >
              <Icon icon={Plus} size="sm" />
              Create another
            </a>
          </div>
        ) : null}

        {editing && canWrite ? (
          <form
            onSubmit={onSave}
            style={{ display: 'grid', gap: '0.85rem', maxWidth: 720 }}
          >
            <label>
              Title
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                minLength={3}
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
                  const att = await api.uploadKnowledgeMedia(file, article.id);
                  return {
                    url: `${API_BASE}/knowledge/attachments/${att.id}/content`,
                    alt: att.originalName,
                  };
                }}
              />
            </div>
            <KnowledgeAttachments
              articleId={article.id}
              canUpload
              attachments={attachments}
              onChanged={async () => {
                const list = await api.listKnowledgeAttachments(article.id);
                setAttachments(list);
              }}
            />
            <button type="submit" className={styles.btn} disabled={saving}>
              <Icon icon={Save} size="sm" />
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        ) : (
          <>
            <KnowledgeHtml html={article.body ?? ''} />
            <div style={{ marginTop: '1.25rem' }}>
              <KnowledgeAttachments
                articleId={article.id}
                canUpload={canWrite}
                attachments={attachments}
                onChanged={async () => {
                  const list = await api.listKnowledgeAttachments(article.id);
                  setAttachments(list);
                }}
              />
            </div>
          </>
        )}
      </section>
    </AppShell>
  );
}
