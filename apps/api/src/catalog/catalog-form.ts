export const CATALOG_FORM_FIELD_TYPES = [
  'text',
  'textarea',
  'select',
  'number',
  'checkbox',
] as const;

export type CatalogFormFieldType = (typeof CATALOG_FORM_FIELD_TYPES)[number];

export type CatalogFormFieldOption =
  | string
  | { value: string; label: string };

export type CatalogFormField = {
  name: string;
  label: string;
  type: CatalogFormFieldType;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: CatalogFormFieldOption[];
  min?: number;
  max?: number;
  defaultValue?: string | number | boolean;
};

export type CatalogAnswers = Record<string, string | number | boolean | null>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionValue(opt: CatalogFormFieldOption): string {
  return typeof opt === 'string' ? opt : String(opt.value);
}

function optionLabel(opt: CatalogFormFieldOption): string {
  return typeof opt === 'string' ? opt : String(opt.label ?? opt.value);
}

/** Parse + normalize a stored/posted form schema. Empty/null → []. */
export function parseFormSchema(raw: unknown): CatalogFormField[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    throw new Error('formSchema must be an array of fields');
  }

  const seen = new Set<string>();
  const fields: CatalogFormField[] = [];

  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    if (!isPlainObject(row)) {
      throw new Error(`formSchema[${i}] must be an object`);
    }

    const name = typeof row.name === 'string' ? row.name.trim() : '';
    const label = typeof row.label === 'string' ? row.label.trim() : '';
    const type = row.type;

    if (!name) throw new Error(`formSchema[${i}].name is required`);
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) {
      throw new Error(
        `formSchema[${i}].name must be a letter-starting identifier`,
      );
    }
    if (seen.has(name)) {
      throw new Error(`Duplicate form field name: ${name}`);
    }
    seen.add(name);

    if (!label) throw new Error(`formSchema[${i}].label is required`);
    if (
      typeof type !== 'string' ||
      !CATALOG_FORM_FIELD_TYPES.includes(type as CatalogFormFieldType)
    ) {
      throw new Error(
        `formSchema[${i}].type must be one of: ${CATALOG_FORM_FIELD_TYPES.join(', ')}`,
      );
    }

    const field: CatalogFormField = {
      name,
      label,
      type: type as CatalogFormFieldType,
    };

    if (row.required != null) field.required = Boolean(row.required);
    if (typeof row.placeholder === 'string') field.placeholder = row.placeholder;
    if (typeof row.helpText === 'string') field.helpText = row.helpText;
    if (typeof row.min === 'number' && Number.isFinite(row.min)) {
      field.min = row.min;
    }
    if (typeof row.max === 'number' && Number.isFinite(row.max)) {
      field.max = row.max;
    }
    if (
      typeof row.defaultValue === 'string' ||
      typeof row.defaultValue === 'number' ||
      typeof row.defaultValue === 'boolean'
    ) {
      field.defaultValue = row.defaultValue;
    }

    if (field.type === 'select') {
      if (!Array.isArray(row.options) || row.options.length === 0) {
        throw new Error(`formSchema[${i}].options is required for select`);
      }
      field.options = row.options.map((opt, j) => {
        if (typeof opt === 'string') return opt;
        if (isPlainObject(opt) && opt.value != null) {
          return {
            value: String(opt.value),
            label: String(opt.label ?? opt.value),
          };
        }
        throw new Error(`formSchema[${i}].options[${j}] is invalid`);
      });
    }

    fields.push(field);
  }

  return fields;
}

export function validateAnswers(
  schema: CatalogFormField[],
  answers: unknown,
): { answers: CatalogAnswers; errors: string[] } {
  const errors: string[] = [];
  const input = isPlainObject(answers) ? answers : {};
  const out: CatalogAnswers = {};

  for (const field of schema) {
    const raw = input[field.name];
    const missing =
      raw === undefined ||
      raw === null ||
      (typeof raw === 'string' && raw.trim() === '');

    if (field.type === 'checkbox') {
      const value = raw === true || raw === 'true' || raw === 1 || raw === '1';
      if (field.required && !value) {
        errors.push(`${field.label} is required`);
      }
      out[field.name] = Boolean(value);
      continue;
    }

    if (missing) {
      if (field.required) errors.push(`${field.label} is required`);
      out[field.name] = null;
      continue;
    }

    if (field.type === 'number') {
      const num =
        typeof raw === 'number' ? raw : Number(String(raw).trim());
      if (!Number.isFinite(num)) {
        errors.push(`${field.label} must be a number`);
        out[field.name] = null;
        continue;
      }
      if (field.min != null && num < field.min) {
        errors.push(`${field.label} must be at least ${field.min}`);
      }
      if (field.max != null && num > field.max) {
        errors.push(`${field.label} must be at most ${field.max}`);
      }
      out[field.name] = num;
      continue;
    }

    if (field.type === 'select') {
      const value = String(raw).trim();
      const allowed = (field.options ?? []).map(optionValue);
      if (!allowed.includes(value)) {
        errors.push(`${field.label} has an invalid option`);
        out[field.name] = null;
        continue;
      }
      out[field.name] = value;
      continue;
    }

    // text | textarea
    const text = String(raw).trim();
    if (field.min != null && text.length < field.min) {
      errors.push(`${field.label} must be at least ${field.min} characters`);
    }
    if (field.max != null && text.length > field.max) {
      errors.push(`${field.label} must be at most ${field.max} characters`);
    }
    out[field.name] = text;
  }

  return { answers: out, errors };
}

export function formatAnswersBlock(
  schema: CatalogFormField[],
  answers: CatalogAnswers,
): string {
  if (schema.length === 0) return '';

  const lines = schema.map((field) => {
    const raw = answers[field.name];
    let display: string;
    if (field.type === 'checkbox') {
      display = raw === true ? 'Yes' : 'No';
    } else if (raw == null || raw === '') {
      display = '—';
    } else if (field.type === 'select') {
      const opt = (field.options ?? []).find(
        (o) => optionValue(o) === String(raw),
      );
      display = opt ? optionLabel(opt) : String(raw);
    } else {
      display = String(raw);
    }
    return `${field.label}: ${display}`;
  });

  return `Catalog form answers\n${lines.join('\n')}`;
}

export function buildTicketDescription(parts: {
  base: string;
  answersBlock?: string;
  notes?: string;
}): string {
  const chunks = [parts.base.trim()];
  if (parts.answersBlock?.trim()) {
    chunks.push(`---\n${parts.answersBlock.trim()}`);
  }
  const notes = parts.notes?.trim();
  if (notes) {
    chunks.push(`---\nRequester notes:\n${notes}`);
  }
  return chunks.join('\n\n');
}
