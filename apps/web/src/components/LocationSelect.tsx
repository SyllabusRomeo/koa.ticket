'use client';

export type LocationOption = {
  id: string;
  code: string;
  name: string;
  site?: string | null;
  country?: string | null;
  timezone?: string;
  isActive?: boolean;
};

type Props = {
  id?: string;
  value: string;
  onChange: (locationId: string) => void;
  locations: LocationOption[];
  /** Include inactive locations (admin edit). Default: active only. */
  includeInactive?: boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  'aria-label'?: string;
};

function labelFor(loc: LocationOption) {
  const site = loc.site?.trim();
  const base = site ? `${loc.name} · ${site}` : loc.name;
  if (loc.isActive === false) return `${base} (inactive)`;
  return base;
}

/** Shared location / ticket-origin site picker used across Tickets, Teams, Assets, Routing. */
export function LocationSelect({
  id,
  value,
  onChange,
  locations,
  includeInactive = false,
  allowEmpty = true,
  emptyLabel = 'No location',
  disabled,
  required,
  className,
  'aria-label': ariaLabel,
}: Props) {
  const options = includeInactive
    ? locations
    : locations.filter((l) => l.isActive !== false);

  return (
    <select
      id={id}
      className={className}
      value={value}
      disabled={disabled}
      required={required}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
    >
      {allowEmpty ? <option value="">{emptyLabel}</option> : null}
      {options.map((l) => (
        <option key={l.id} value={l.id}>
          {labelFor(l)}
        </option>
      ))}
    </select>
  );
}
