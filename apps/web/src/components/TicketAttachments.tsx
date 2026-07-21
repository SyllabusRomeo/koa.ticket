'use client';

import { useRef, useState } from 'react';
import {
  api,
  type TicketAttachment,
  formatBytes,
} from '@/lib/api';
import styles from './attachments.module.css';
import { Download, Paperclip, Trash2 } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';

const ACCEPT =
  '.pdf,.png,.jpg,.jpeg,.gif,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip';

type Props = {
  ticketIdOrNumber: string;
  canUpload: boolean;
  attachments: TicketAttachment[];
  onChanged: () => void | Promise<void>;
  compact?: boolean;
};

export function TicketAttachments({
  ticketIdOrNumber,
  canUpload,
  attachments,
  onChanged,
  compact,
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
        await api.uploadAttachment(ticketIdOrNumber, file);
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

  async function onDownload(att: TicketAttachment) {
    try {
      await api.downloadAttachment(att.id, att.originalName);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed');
    }
  }

  return (
    <section
      className={compact ? styles.compact : styles.panel}
      aria-labelledby="attachments-heading"
    >
      <div className={styles.head}>
        <h3 id="attachments-heading">Attachments</h3>
        {canUpload ? (
          <div className={styles.uploadRow}>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPT}
              className={styles.fileInput}
              id={`attach-${ticketIdOrNumber}`}
              disabled={busy}
              onChange={(e) => onPick(e.target.files)}
            />
            <label
              htmlFor={`attach-${ticketIdOrNumber}`}
              className={styles.uploadBtn}
            >
              <Icon icon={Paperclip} size="sm" />
              {busy ? 'Uploading…' : 'Attach files'}
            </label>
          </div>
        ) : null}
      </div>

      <p className={styles.hint}>
        Images and documents (PDF, PNG, JPG, DOCX, XLSX, ZIP, …). Max ~10&nbsp;MB
        each.
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
            ? 'No files yet — use Attach files to add screenshots or documents.'
            : 'No attachments on this ticket.'}
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

/** Pending files before ticket/article exists (create form). */
export function PendingAttachments({
  files,
  onChange,
  hint = 'Optional — uploaded right after the ticket is created (PDF, images, Office docs, ZIP).',
  label = 'Attach files',
}: {
  files: File[];
  onChange: (files: File[]) => void;
  hint?: string;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function add(list: FileList | null) {
    if (!list?.length) return;
    onChange([...files, ...Array.from(list)]);
    if (inputRef.current) inputRef.current.value = '';
  }

  function remove(idx: number) {
    onChange(files.filter((_, i) => i !== idx));
  }

  return (
    <div className={styles.pending}>
      <div className={styles.head}>
        <span className={styles.pendingLabel}>{label}</span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className={styles.fileInput}
          id="create-attach"
          onChange={(e) => add(e.target.files)}
        />
        <label htmlFor="create-attach" className={styles.uploadBtn}>
          <Icon icon={Paperclip} size="sm" />
          Choose files
        </label>
      </div>
      <p className={styles.hint}>{hint}</p>
      {files.length > 0 ? (
        <ul className={styles.pendingList}>
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`}>
              <span>
                {f.name}{' '}
                <em>({formatBytes(f.size)})</em>
              </span>
              <button
                type="button"
                className={styles.removeBtn}
                onClick={() => remove(i)}
                aria-label={`Remove ${f.name}`}
              >
                <Icon icon={Trash2} size="sm" />
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
