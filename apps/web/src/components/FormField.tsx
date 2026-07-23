import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import styles from './FormField.module.css';

type Common = {
  label: ReactNode;
  hint?: ReactNode;
  className?: string;
};

export function FormField({
  label,
  hint,
  className,
  children,
}: Common & { children: ReactNode }) {
  return (
    <label className={[styles.field, className].filter(Boolean).join(' ')}>
      <span className={styles.label}>{label}</span>
      {children}
      {hint ? <em className={styles.hint}>{hint}</em> : null}
    </label>
  );
}

export function TextInput({
  label,
  hint,
  className,
  ...props
}: Common & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FormField label={label} hint={hint} className={className}>
      <input className={styles.control} {...props} />
    </FormField>
  );
}

export function TextTextarea({
  label,
  hint,
  className,
  ...props
}: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FormField label={label} hint={hint} className={className}>
      <textarea className={styles.control} {...props} />
    </FormField>
  );
}

export function TextSelect({
  label,
  hint,
  className,
  children,
  ...props
}: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <FormField label={label} hint={hint} className={className}>
      <select className={styles.control} {...props}>
        {children}
      </select>
    </FormField>
  );
}

export function FormStack({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={[styles.stack, className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}
