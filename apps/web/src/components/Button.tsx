import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'danger'
  | 'dangerOutline'
  | 'success'
  | 'successSoft';

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: styles.primary,
  secondary: styles.secondary,
  tertiary: styles.tertiary,
  danger: styles.danger,
  dangerOutline: styles.dangerOutline,
  success: styles.success,
  successSoft: styles.successSoft,
};

/** Shared class string for buttons and button-styled links. */
export function buttonClass(
  variant: ButtonVariant = 'primary',
  className?: string,
) {
  return [styles.root, VARIANT_CLASS[variant], className]
    .filter(Boolean)
    .join(' ');
}

export function Button({
  variant = 'primary',
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
}) {
  return (
    <button
      type={type}
      className={buttonClass(variant, className)}
      {...props}
    />
  );
}

export function ButtonLink({
  variant = 'primary',
  className,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: ButtonVariant;
  children: ReactNode;
}) {
  return (
    <a className={buttonClass(variant, className)} {...props}>
      {children}
    </a>
  );
}

export const btnStyles = styles;
