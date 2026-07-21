'use client';

import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
} from 'react';
import {
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  type LucideIcon,
} from 'lucide-react';
import { Icon } from '@/components/Icon';
import styles from './RichTextEditor.module.css';

type Props = {
  value: string;
  onChange: (html: string) => void;
  onUploadImage: (file: File) => Promise<{ url: string; alt?: string }>;
  minHeight?: number;
  disabled?: boolean;
};

function ToolbarButton({
  onClick,
  title,
  icon,
  label,
}: {
  onClick: () => void;
  title: string;
  icon: LucideIcon;
  /** Optional visible text beside the icon (headings). */
  label?: string;
}) {
  return (
    <button
      type="button"
      className={styles.tool}
      title={title}
      aria-label={title}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
    >
      <Icon icon={icon} size="sm" />
      {label ? <span>{label}</span> : null}
    </button>
  );
}

export function RichTextEditor({
  value,
  onChange,
  onUploadImage,
  minHeight = 220,
  disabled,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const synced = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!synced.current || document.activeElement !== el) {
      if (el.innerHTML !== value) el.innerHTML = value || '';
      synced.current = true;
    }
  }, [value]);

  function emit() {
    const html = ref.current?.innerHTML ?? '';
    onChange(html);
  }

  function run(cmd: string, arg?: string) {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    emit();
  }

  function formatBlock(tag: string) {
    ref.current?.focus();
    document.execCommand('formatBlock', false, tag);
    emit();
  }

  function insertLink() {
    const url = window.prompt('Link URL (https://…)');
    if (!url?.trim()) return;
    run('createLink', url.trim());
  }

  async function onPickImage(files: FileList | null) {
    if (!files?.[0]) return;
    setBusy(true);
    setError(null);
    try {
      const { url, alt } = await onUploadImage(files[0]);
      ref.current?.focus();
      const safeAlt = (alt ?? files[0].name).replace(/"/g, '');
      document.execCommand(
        'insertHTML',
        false,
        `<img src="${url}" alt="${safeAlt}" />`,
      );
      emit();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Image upload failed');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function onInput() {
    emit();
  }

  function onPaste(e: ClipboardEvent) {
    // Prefer plain text paste to avoid dumping unsafe HTML from Word, etc.
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
    emit();
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar} role="toolbar" aria-label="Formatting">
        <ToolbarButton title="Bold" icon={Bold} onClick={() => run('bold')} />
        <ToolbarButton title="Italic" icon={Italic} onClick={() => run('italic')} />
        <span className={styles.sep} />
        <ToolbarButton
          title="Heading 2"
          icon={Heading2}
          label="H2"
          onClick={() => formatBlock('h2')}
        />
        <ToolbarButton
          title="Heading 3"
          icon={Heading3}
          label="H3"
          onClick={() => formatBlock('h3')}
        />
        <span className={styles.sep} />
        <ToolbarButton
          title="Bulleted list"
          icon={List}
          onClick={() => run('insertUnorderedList')}
        />
        <ToolbarButton
          title="Numbered list"
          icon={ListOrdered}
          onClick={() => run('insertOrderedList')}
        />
        <span className={styles.sep} />
        <ToolbarButton title="Insert link" icon={Link2} onClick={insertLink} />
        <ToolbarButton
          title={busy ? 'Uploading image…' : 'Insert image'}
          icon={ImagePlus}
          onClick={() => fileRef.current?.click()}
        />
        <input
          ref={fileRef}
          type="file"
          accept=".png,.jpg,.jpeg,.gif,.webp,image/*"
          className={styles.fileInput}
          disabled={disabled || busy}
          onChange={(e) => onPickImage(e.target.files)}
        />
      </div>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <div
        ref={ref}
        className={styles.editor}
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline
        aria-label="Article body"
        style={{ minHeight }}
        onInput={onInput}
        onBlur={emit}
        onPaste={onPaste}
      />
      <p className={styles.hint}>
        Format with the toolbar. Images upload to LogIT and embed inline.
      </p>
    </div>
  );
}

/** Hidden submit helper so forms still validate non-empty body. */
export function RichTextHiddenField({
  name,
  value,
  required,
}: {
  name?: string;
  value: string;
  required?: boolean;
}) {
  const text = value.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
  return (
    <input
      type="text"
      name={name}
      value={text}
      required={required}
      readOnly
      tabIndex={-1}
      aria-hidden
      style={{
        position: 'absolute',
        width: 1,
        height: 1,
        opacity: 0,
        pointerEvents: 'none',
      }}
      onChange={() => undefined}
      onInvalid={(e: FormEvent<HTMLInputElement>) => {
        e.preventDefault();
      }}
    />
  );
}
