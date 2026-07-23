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
import { BookmarkCheck, Pencil, Plus, Save, ThumbsDown, ThumbsUp } from 'lucide-react';
import { Icon } from '@/components/Icon';
import { Button, ButtonLink } from '@/components/Button';
import { FormStack, TextInput } from '@/components/FormField';

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
  const [feedbackNote, setFeedbackNote] = useState<string | null>(null);
  const [feedbackBusy, setFeedbackBusy] = useState(false);

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

  async function onFeedback(eventType: 'helpful' | 'not_helpful' | 'deflected') {
    if (!article) return;
    setFeedbackBusy(true);
    setFeedbackNote(null);
    setError(null);
    try {
      await api.knowledgeFeedback(article.id, eventType);
      setFeedbackNote(
        eventType === 'deflected'
          ? 'Thanks — marked as solved.'
          : eventType === 'helpful'
            ? 'Thanks for the feedback.'
            : 'Thanks — we will improve this article.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Feedback failed');
    } finally {
      setFeedbackBusy(false);
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
            <Button type="button" onClick={() => setEditing((v) => !v)}>
              <Icon icon={Pencil} size="sm" />
              {editing ? 'Cancel edit' : 'Edit article'}
            </Button>
            {article.status !== 'published' ? (
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={onPublish}
              >
                Publish
              </Button>
            ) : null}
            <ButtonLink href="/app/knowledge/new" variant="secondary">
              <Icon icon={Plus} size="sm" />
              Create another
            </ButtonLink>
          </div>
        ) : null}

        {editing && canWrite ? (
          <form onSubmit={onSave}>
            <FormStack>
              <TextInput
                label="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                minLength={3}
              />
              <TextInput
                label="Category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Network, Access, Hardware"
              />
              <div>
                <span className={styles.fieldLabel}>Body</span>
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
              <Button type="submit" disabled={saving}>
                <Icon icon={Save} size="sm" />
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </FormStack>
          </form>
        ) : (
          <>
            <KnowledgeHtml html={article.body ?? ''} />
            {article.status === 'published' ? (
              <div
                className={styles.ctaRow}
                style={{
                  marginTop: '1.25rem',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  alignItems: 'center',
                }}
                role="group"
                aria-label="Article feedback"
              >
                <span className={styles.muted}>Was this helpful?</span>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={feedbackBusy}
                  onClick={() => onFeedback('helpful')}
                  aria-label="Helpful"
                >
                  <Icon icon={ThumbsUp} size="sm" />
                  Helpful
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={feedbackBusy}
                  onClick={() => onFeedback('not_helpful')}
                  aria-label="Not helpful"
                >
                  <Icon icon={ThumbsDown} size="sm" />
                  Not helpful
                </Button>
                <Button
                  type="button"
                  variant="success"
                  disabled={feedbackBusy}
                  onClick={() => onFeedback('deflected')}
                  aria-label="This solved my issue"
                >
                  <Icon icon={BookmarkCheck} size="sm" />
                  Solved
                </Button>
                {feedbackNote ? (
                  <span className={styles.muted}>{feedbackNote}</span>
                ) : null}
              </div>
            ) : null}
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
