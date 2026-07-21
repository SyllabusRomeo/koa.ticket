import type { LucideIcon } from 'lucide-react';

const SIZES = { sm: 16, md: 20, lg: 24 } as const;

export type IconSize = keyof typeof SIZES;

type Props = {
  icon: LucideIcon;
  /** Named size or pixel override. */
  size?: IconSize | number;
  className?: string;
  /** Override stroke width (lucide default is 2). */
  strokeWidth?: number;
};

/**
 * Lucide line-icon wrapper — currentColor, decorative by default.
 * Icon-only controls must put aria-label on the button/link, not here.
 */
export function Icon({
  icon: Lucide,
  size = 'md',
  className,
  strokeWidth = 1.75,
}: Props) {
  const px = typeof size === 'number' ? size : SIZES[size];
  return (
    <Lucide
      className={className}
      width={px}
      height={px}
      size={px}
      strokeWidth={strokeWidth}
      aria-hidden
      focusable="false"
    />
  );
}
