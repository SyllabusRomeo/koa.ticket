'use client';

import { useRef, useState } from 'react';
import {
  api,
  type KnowledgeAttachment,
  formatBytes,
} from '@/lib/api';
import styles from './attachments.module.css';
import { Download, Paperclip } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';

const ACCEPT =
  '.pdf,.png,.jpg,.jpeg,.gif,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip';

type Props = {
  articleId: string;
  canUpload: boolean;
  attachments: KnowledgeAttachment[];
  onChanged: () => void | Promise<void>;
};

export function KnowledgeAttachments({
  articleId,
  canUpload,
  attachments,
  onChanged,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  async function onPick(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    setHint(null);
    try {
      for (const file of Array.from(files)) {
        await api.uploadKnowledgeAttachment(articleId, file);
      }
      setHint(
        files.length === 1
          ? `Attached ${files[0].name}`
          : `Attached ${files.length} files`,
      );
      await onChanged();
      if (inputRef.current) inputRef.current.value = '';
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function onDownload(att: KnowledgeAttachment) {
    try {
      await api.downloadKnowledgeAttachment(att.id, att.originalName);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed');
    }
  }

  return (
    <section
      className={styles.panel}
      aria-labelledby="kb-attachments-heading"
    >
      <div className={styles.head}>
        <h3 id="kb-attachments-heading">Attachments</h3>
        {canUpload ? (
          <div className={styles.uploadRow}>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPT}
              className={styles.fileInput}
              id={`kb-attach-${articleId}`}
              disabled={busy}
              onChange={(e) => onPick(e.target.files)}
            />
            <label
              htmlFor={`kb-attach-${articleId}`}
              className={styles.uploadBtn}
            >
              <Icon icon={Paperclip} size="sm" />
              {busy ? 'Uploading…' : 'Attach files'}
            </label>
          </div>
        ) : null}
      </div>

      <p className={styles.hint}>
        Supporting files (PDF, Office docs, images, ZIP). Screenshots in the
        article body use Insert image in the editor.
      </p>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {hint ? <p className={styles.ok}>{hint}</p> : null}

      {attachments.length === 0 ? (
        <EmptyState icon={Paperclip}>
          {canUpload
            ? 'No files yet — use Attach files to add downloads for readers.'
            : 'No attachments on this article.'}
        </EmptyState>
      ) : (
        <ul className={styles.list}>
          {attachments.map((a) => (
            <li key={a.id}>
              <div>
                <strong>{a.originalName}</strong>
                <em>
                  {formatBytes(a.sizeBytes)}
                  {a.uploadedBy
                    ? ` · ${a.uploadedBy.firstName} ${a.uploadedBy.lastName}`
                    : ''}
                  {a.createdAt
                    ? ` · ${new Date(a.createdAt).toLocaleString()}`
                    : ''}
                </em>
              </div>
              <button
                type="button"
                className={styles.download}
                onClick={() => onDownload(a)}
              >
                <Icon icon={Download} size="sm" />
                Download
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
