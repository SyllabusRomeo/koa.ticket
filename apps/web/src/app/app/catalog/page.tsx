'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  api,
  type AuthUser,
  type CatalogFormField,
  type CatalogFormFieldType,
} from '@/lib/api';
import { can } from '@/lib/access';
import { AppShell } from '@/components/AppShell';
import styles from '../app.module.css';
import catalogStyles from './catalog.module.css';
import { Home, LayoutGrid, Plus, Search, Send, Ticket, Trash2, X } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { Button, ButtonLink } from '@/components/Button';
import { SectionHeading } from '@/components/SectionHeading';

type CatalogItem = {
  id: string;
  code: string;
  name: string;
  description: string;
  ticketTypeCode: string;
  formSchema?: CatalogFormField[] | null;
};

type DraftField = {
  key: string;
  name: string;
  label: string;
  type: CatalogFormFieldType;
  required: boolean;
  placeholder: string;
  helpText: string;
  optionsText: string;
  min: string;
  max: string;
};

function typeLabel(code: string) {
  return code.replace(/_/g, ' ');
}

function optionValue(opt: string | { value: string; label: string }) {
  return typeof opt === 'string' ? opt : opt.value;
}

function optionLabel(opt: string | { value: string; label: string }) {
  return typeof opt === 'string' ? opt : opt.label;
}

function normalizeSchema(
  raw: CatalogFormField[] | null | undefined,
): CatalogFormField[] {
  return Array.isArray(raw) ? raw : [];
}

function defaultAnswers(schema: CatalogFormField[]) {
  const out: Record<string, string | number | boolean> = {};
  for (const f of schema) {
    if (f.type === 'checkbox') {
      out[f.name] = f.defaultValue === true;
    } else if (f.defaultValue != null && f.defaultValue !== '') {
      out[f.name] = f.defaultValue as string | number | boolean;
    } else if (f.type === 'number') {
      out[f.name] = '';
    } else {
      out[f.name] = '';
    }
  }
  return out;
}

function emptyDraftField(): DraftField {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: '',
    label: '',
    type: 'text',
    required: false,
    placeholder: '',
    helpText: '',
    optionsText: '',
    min: '',
    max: '',
  };
}

function draftFieldsToSchema(drafts: DraftField[]): CatalogFormField[] {
  const fields: CatalogFormField[] = [];
  for (const d of drafts) {
    const name = d.name.trim();
    const label = d.label.trim();
    if (!name && !label) continue;
    if (!name || !label) {
      throw new Error('Each form field needs both a name and a label');
    }
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) {
      throw new Error(
        `Field name "${name}" must start with a letter and use only letters, numbers, or _`,
      );
    }
    const field: CatalogFormField = {
      name,
      label,
      type: d.type,
      required: d.required || undefined,
      placeholder: d.placeholder.trim() || undefined,
      helpText: d.helpText.trim() || undefined,
    };
    if (d.min.trim() !== '') {
      const min = Number(d.min);
      if (!Number.isFinite(min)) throw new Error(`Invalid min for ${label}`);
      field.min = min;
    }
    if (d.max.trim() !== '') {
      const max = Number(d.max);
      if (!Number.isFinite(max)) throw new Error(`Invalid max for ${label}`);
      field.max = max;
    }
    if (d.type === 'select') {
      const options = d.optionsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const pipe = line.indexOf('|');
          if (pipe === -1) return line;
          return {
            value: line.slice(0, pipe).trim(),
            label: line.slice(pipe + 1).trim() || line.slice(0, pipe).trim(),
          };
        });
      if (!options.length) {
        throw new Error(`Select field "${label}" needs at least one option`);
      }
      field.options = options;
    }
    fields.push(field);
  }
  return fields;
}

export default function CatalogPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [types, setTypes] = useState<Array<{ code: string; name: string }>>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ticketTypeCode, setTicketTypeCode] = useState('service_request');
  const [draftFields, setDraftFields] = useState<DraftField[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [answers, setAnswers] = useState<
    Record<string, string | number | boolean>
  >({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editTypeCode, setEditTypeCode] = useState('');
  const [editFields, setEditFields] = useState<DraftField[]>([]);

  async function load() {
    setItems(await api.catalog());
  }

  useEffect(() => {
    (async () => {
      try {
        const { user } = await api.me();
        setUser(user);
        await load();
        try {
          const meta = await api.ticketMeta();
          setTypes(meta.types);
          if (meta.types[0]) setTicketTypeCode(meta.types[0].code);
        } catch {
          /* optional */
        }
      } catch {
        router.replace('/login');
      }
    })();
  }, [router]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (typeFilter && i.ticketTypeCode !== typeFilter) return false;
      if (!q) return true;
      return (
        i.name.toLowerCase().includes(q) ||
        i.code.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.ticketTypeCode.toLowerCase().includes(q)
      );
    });
  }, [items, query, typeFilter]);

  const selected = useMemo(
    () => items.find((i) => i.id === selectedId) ?? null,
    [items, selectedId],
  );

  const selectedSchema = useMemo(
    () => normalizeSchema(selected?.formSchema),
    [selected],
  );

  const typeOptions = useMemo(() => {
    const codes = [...new Set(items.map((i) => i.ticketTypeCode))].sort();
    return codes;
  }, [items]);

  async function logout() {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    router.replace('/login');
  }

  function selectItem(item: CatalogItem) {
    setError(null);
    setMessage(null);
    setEditingId(null);
    if (selectedId === item.id) {
      setSelectedId(null);
      setNotes('');
      setAnswers({});
      return;
    }
    setSelectedId(item.id);
    setNotes('');
    setAnswers(defaultAnswers(normalizeSchema(item.formSchema)));
  }

  function schemaToDrafts(schema: CatalogFormField[]): DraftField[] {
    return schema.map((f) => ({
      key: `${f.name}-${Math.random().toString(36).slice(2, 6)}`,
      name: f.name,
      label: f.label,
      type: f.type,
      required: Boolean(f.required),
      placeholder: f.placeholder ?? '',
      helpText: f.helpText ?? '',
      optionsText: (f.options ?? [])
        .map((o) =>
          typeof o === 'string' ? o : `${o.value}|${o.label}`,
        )
        .join('\n'),
      min: f.min != null ? String(f.min) : '',
      max: f.max != null ? String(f.max) : '',
    }));
  }

  function startEdit(item: CatalogItem) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditDescription(item.description);
    setEditTypeCode(item.ticketTypeCode);
    setEditFields(schemaToDrafts(normalizeSchema(item.formSchema)));
    setError(null);
    setMessage(null);
  }

  function updateDraft(
    list: DraftField[],
    setList: (next: DraftField[]) => void,
    key: string,
    patch: Partial<DraftField>,
  ) {
    setList(list.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  }

  function renderFieldBuilder(
    list: DraftField[],
    setList: (next: DraftField[]) => void,
  ) {
    return (
      <div className={catalogStyles.fieldBuilder}>
        <div className={catalogStyles.fieldBuilderHead}>
          <span>Request form fields</span>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => setList([...list, emptyDraftField()])}
          >
            <Icon icon={Plus} size="sm" />
            Add field
          </button>
        </div>
        {list.length === 0 ? (
          <p className={styles.muted}>
            No fields — requesters get notes-only one-click request.
          </p>
        ) : (
          list.map((f, idx) => (
            <div key={f.key} className={catalogStyles.fieldRow}>
              <p className={catalogStyles.fieldRowTitle}>Field {idx + 1}</p>
              <div className={catalogStyles.fieldRowGrid}>
                <label>
                  Name
                  <input
                    value={f.name}
                    onChange={(e) =>
                      updateDraft(list, setList, f.key, {
                        name: e.target.value,
                      })
                    }
                    placeholder="justification"
                  />
                </label>
                <label>
                  Label
                  <input
                    value={f.label}
                    onChange={(e) =>
                      updateDraft(list, setList, f.key, {
                        label: e.target.value,
                      })
                    }
                    placeholder="Business justification"
                  />
                </label>
                <label>
                  Type
                  <select
                    value={f.type}
                    onChange={(e) =>
                      updateDraft(list, setList, f.key, {
                        type: e.target.value as CatalogFormFieldType,
                      })
                    }
                  >
                    <option value="text">Text</option>
                    <option value="textarea">Textarea</option>
                    <option value="select">Select</option>
                    <option value="number">Number</option>
                    <option value="checkbox">Checkbox</option>
                  </select>
                </label>
                <label className={catalogStyles.checkLabel}>
                  <input
                    type="checkbox"
                    checked={f.required}
                    onChange={(e) =>
                      updateDraft(list, setList, f.key, {
                        required: e.target.checked,
                      })
                    }
                  />
                  Required
                </label>
              </div>
              <label>
                Placeholder
                <input
                  value={f.placeholder}
                  onChange={(e) =>
                    updateDraft(list, setList, f.key, {
                      placeholder: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                Help text
                <input
                  value={f.helpText}
                  onChange={(e) =>
                    updateDraft(list, setList, f.key, {
                      helpText: e.target.value,
                    })
                  }
                />
              </label>
              {f.type === 'select' ? (
                <label>
                  Options (one per line; use value|label)
                  <textarea
                    value={f.optionsText}
                    onChange={(e) =>
                      updateDraft(list, setList, f.key, {
                        optionsText: e.target.value,
                      })
                    }
                    rows={3}
                    placeholder={'laptop_14|14" laptop'}
                  />
                </label>
              ) : null}
              {f.type === 'number' || f.type === 'text' || f.type === 'textarea' ? (
                <div className={catalogStyles.fieldRowGrid}>
                  <label>
                    Min
                    <input
                      value={f.min}
                      onChange={(e) =>
                        updateDraft(list, setList, f.key, { min: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Max
                    <input
                      value={f.max}
                      onChange={(e) =>
                        updateDraft(list, setList, f.key, { max: e.target.value })
                      }
                    />
                  </label>
                </div>
              ) : null}
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setList(list.filter((x) => x.key !== f.key))}
              >
                <Icon icon={Trash2} size="sm" />
                Remove field
              </button>
            </div>
          ))
        )}
      </div>
    );
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const formSchema = draftFieldsToSchema(draftFields);
      await api.createCatalogItem({
        code,
        name,
        description,
        ticketTypeCode,
        formSchema: formSchema.length ? formSchema : undefined,
      });
      setCode('');
      setName('');
      setDescription('');
      setDraftFields([]);
      setShowCreate(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setSaving(true);
    setError(null);
    try {
      const formSchema = draftFieldsToSchema(editFields);
      await api.updateCatalogItem(editingId, {
        name: editName,
        description: editDescription,
        ticketTypeCode: editTypeCode,
        formSchema,
      });
      setEditingId(null);
      setMessage('Catalog item updated.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  async function onRequest(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    if (!can(user, 'tickets:write')) {
      setError('You do not have permission to create tickets.');
      return;
    }
    setRequesting(true);
    setError(null);
    setMessage(null);
    try {
      const payloadAnswers: Record<string, unknown> = {};
      for (const field of selectedSchema) {
        payloadAnswers[field.name] = answers[field.name];
      }
      const { ticket } = await api.requestCatalogItem(selected.id, {
        notes,
        answers: selectedSchema.length ? payloadAnswers : undefined,
      });
      setMessage(`Created ${ticket.number} from ${selected.code}.`);
      router.push(`/app/tickets/${encodeURIComponent(ticket.number)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setRequesting(false);
    }
  }

  if (!user) {
    return (
      <main className={styles.page}>
        <p className={styles.muted}>Loading…</p>
      </main>
    );
  }

  const canManage = can(user, 'settings:manage');
  const canRequest = can(user, 'tickets:write');

  return (
    <AppShell user={user} onLogout={logout} title="Service catalog">
      <section className={styles.panel}>
        <p className={catalogStyles.intro}>
          Find a service, open it, then submit. Only the service you select
          shows the request form.
          {canManage
            ? ' As sysadmin you can also add catalog items below.'
            : ''}
        </p>

        <div className={styles.ctaRow} style={{ marginBottom: '1rem' }}>
          <ButtonLink href="/app/tickets">
            <Icon icon={Ticket} size="sm" />
            Open tickets
          </ButtonLink>
          {canManage ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowCreate((v) => !v)}
            >
              <Icon icon={Plus} size="sm" />
              {showCreate ? 'Hide create form' : 'Add catalog item'}
            </Button>
          ) : null}
          <ButtonLink href="/app" variant="secondary">
            <Icon icon={Home} size="sm" />
            Back to Home
          </ButtonLink>
        </div>

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        {message ? <p className={styles.ok}>{message}</p> : null}

        {canManage && showCreate ? (
          <div className={catalogStyles.createBox}>
            <form className={catalogStyles.createForm} onSubmit={onCreate}>
              <SectionHeading icon={LayoutGrid} className={styles.sectionTitle}>
                New catalog item
              </SectionHeading>
              <label>
                Code
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  minLength={2}
                />
              </label>
              <label>
                Name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={2}
                />
              </label>
              <label>
                Description
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  minLength={3}
                  rows={3}
                />
              </label>
              <label>
                Ticket type
                <select
                  value={ticketTypeCode}
                  onChange={(e) => setTicketTypeCode(e.target.value)}
                >
                  {types.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              {renderFieldBuilder(draftFields, setDraftFields)}
              <button type="submit" className={styles.btn} disabled={saving}>
                {saving ? 'Saving…' : 'Create catalog item'}
              </button>
            </form>
          </div>
        ) : null}

        {items.length === 0 ? (
          <EmptyState icon={LayoutGrid}>
            No catalog items yet.{' '}
            {canManage ? (
              <button
                type="button"
                className={styles.btn}
                onClick={() => setShowCreate(true)}
              >
                <Icon icon={Plus} size="sm" />
                Add the first item
              </button>
            ) : (
              <>
                You can still <a href="/app/tickets">create a ticket</a>.
              </>
            )}
          </EmptyState>
        ) : (
          <>
            <div className={catalogStyles.toolbar}>
              <label className={catalogStyles.searchWrap}>
                <input
                  className={catalogStyles.search}
                  type="search"
                  placeholder="Search by name, code, or description…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Search catalog"
                />
              </label>
              <select
                className={catalogStyles.typeFilter}
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                aria-label="Filter by type"
              >
                <option value="">All types</option>
                {typeOptions.map((code) => (
                  <option key={code} value={code}>
                    {typeLabel(code)}
                  </option>
                ))}
              </select>
            </div>

            <p className={catalogStyles.resultCount}>
              {filtered.length === items.length
                ? `${items.length} service${items.length === 1 ? '' : 's'}`
                : `${filtered.length} of ${items.length} services`}
              {selected ? ' · 1 selected' : ''}
            </p>

            <div
              className={`${catalogStyles.layout}${selected ? ` ${catalogStyles.layoutSplit}` : ''}`}
            >
              <ul className={catalogStyles.browse}>
                {filtered.length === 0 ? (
                  <li>
                    <EmptyState icon={Search}>
                      No services match your search.
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        onClick={() => {
                          setQuery('');
                          setTypeFilter('');
                        }}
                      >
                        Clear filters
                      </button>
                    </EmptyState>
                  </li>
                ) : (
                  filtered.map((i) => {
                    const active = selectedId === i.id;
                    const hasForm = normalizeSchema(i.formSchema).length > 0;
                    return (
                      <li key={i.id}>
                        <button
                          type="button"
                          className={`${catalogStyles.item}${active ? ` ${catalogStyles.itemActive}` : ''}`}
                          onClick={() => selectItem(i)}
                          aria-pressed={active}
                        >
                          <span>
                            <p className={catalogStyles.itemTitle}>{i.name}</p>
                            <p className={catalogStyles.itemMeta}>
                              {i.description}
                            </p>
                            <span className={catalogStyles.typeChip}>
                              {typeLabel(i.ticketTypeCode)}
                              {hasForm ? ' · form' : ''}
                            </span>
                          </span>
                          <span className={catalogStyles.itemCode}>{i.code}</span>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>

              {selected ? (
                <aside className={catalogStyles.detail} aria-live="polite">
                  <p className={catalogStyles.detailEyebrow}>Selected service</p>
                  <h2 className={catalogStyles.detailTitle}>{selected.name}</h2>
                  <p className={catalogStyles.detailDesc}>
                    {selected.description}
                  </p>
                  <span className={catalogStyles.typeChip}>
                    {typeLabel(selected.ticketTypeCode)} · {selected.code}
                  </span>

                  {canManage ? (
                    <div className={catalogStyles.detailActions} style={{ marginTop: '0.75rem' }}>
                      {editingId === selected.id ? (
                        <button
                          type="button"
                          className={styles.btnSecondary}
                          onClick={() => setEditingId(null)}
                        >
                          Cancel edit
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={styles.btnSecondary}
                          onClick={() => startEdit(selected)}
                        >
                          Edit form / details
                        </button>
                      )}
                    </div>
                  ) : null}

                  {canManage && editingId === selected.id ? (
                    <form
                      className={catalogStyles.createForm}
                      onSubmit={onSaveEdit}
                      style={{ marginTop: '1rem' }}
                    >
                      <label>
                        Name
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          required
                          minLength={2}
                        />
                      </label>
                      <label>
                        Description
                        <textarea
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          required
                          minLength={3}
                          rows={3}
                        />
                      </label>
                      <label>
                        Ticket type
                        <select
                          value={editTypeCode}
                          onChange={(e) => setEditTypeCode(e.target.value)}
                        >
                          {types.map((t) => (
                            <option key={t.code} value={t.code}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      {renderFieldBuilder(editFields, setEditFields)}
                      <button type="submit" className={styles.btn} disabled={saving}>
                        {saving ? 'Saving…' : 'Save catalog item'}
                      </button>
                    </form>
                  ) : null}

                  {canRequest && editingId !== selected.id ? (
                    <form
                      className={catalogStyles.detailForm}
                      onSubmit={onRequest}
                      style={{ marginTop: '1rem' }}
                    >
                      {selectedSchema.map((field) => {
                        const value = answers[field.name];
                        const help = field.helpText ? (
                          <span className={catalogStyles.helpText}>
                            {field.helpText}
                          </span>
                        ) : null;

                        if (field.type === 'checkbox') {
                          return (
                            <label
                              key={field.name}
                              className={catalogStyles.checkLabel}
                            >
                              <input
                                type="checkbox"
                                checked={Boolean(value)}
                                onChange={(e) =>
                                  setAnswers((prev) => ({
                                    ...prev,
                                    [field.name]: e.target.checked,
                                  }))
                                }
                              />
                              <span>
                                {field.label}
                                {field.required ? ' *' : ''}
                                {help}
                              </span>
                            </label>
                          );
                        }

                        if (field.type === 'textarea') {
                          return (
                            <label key={field.name}>
                              {field.label}
                              {field.required ? ' *' : ''}
                              <textarea
                                value={String(value ?? '')}
                                onChange={(e) =>
                                  setAnswers((prev) => ({
                                    ...prev,
                                    [field.name]: e.target.value,
                                  }))
                                }
                                placeholder={field.placeholder}
                                required={field.required}
                                rows={3}
                              />
                              {help}
                            </label>
                          );
                        }

                        if (field.type === 'select') {
                          return (
                            <label key={field.name}>
                              {field.label}
                              {field.required ? ' *' : ''}
                              <select
                                value={String(value ?? '')}
                                onChange={(e) =>
                                  setAnswers((prev) => ({
                                    ...prev,
                                    [field.name]: e.target.value,
                                  }))
                                }
                                required={field.required}
                              >
                                <option value="">Select…</option>
                                {(field.options ?? []).map((opt) => {
                                  const v = optionValue(opt);
                                  return (
                                    <option key={v} value={v}>
                                      {optionLabel(opt)}
                                    </option>
                                  );
                                })}
                              </select>
                              {help}
                            </label>
                          );
                        }

                        return (
                          <label key={field.name}>
                            {field.label}
                            {field.required ? ' *' : ''}
                            <input
                              type={field.type === 'number' ? 'number' : 'text'}
                              value={
                                value === undefined || value === null
                                  ? ''
                                  : String(value)
                              }
                              onChange={(e) =>
                                setAnswers((prev) => ({
                                  ...prev,
                                  [field.name]:
                                    field.type === 'number'
                                      ? e.target.value === ''
                                        ? ''
                                        : Number(e.target.value)
                                      : e.target.value,
                                }))
                              }
                              placeholder={field.placeholder}
                              required={field.required}
                              min={field.min}
                              max={field.max}
                            />
                            {help}
                          </label>
                        );
                      })}

                      <label>
                        {selectedSchema.length
                          ? 'Additional notes (optional)'
                          : 'Optional notes'}
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Add context for IT (optional)"
                          rows={4}
                        />
                      </label>
                      <div className={catalogStyles.detailActions}>
                        <button
                          type="submit"
                          className={styles.btn}
                          disabled={requesting}
                        >
                          <Icon icon={Send} size="sm" />
                          {requesting ? 'Submitting…' : 'Request this service'}
                        </button>
                        <button
                          type="button"
                          className={styles.btnSecondary}
                          onClick={() => {
                            setSelectedId(null);
                            setNotes('');
                            setAnswers({});
                          }}
                        >
                          <Icon icon={X} size="sm" />
                          Clear
                        </button>
                      </div>
                    </form>
                  ) : !canRequest ? (
                    <p className={styles.muted} style={{ marginTop: '1rem' }}>
                      You can browse the catalog, but your role cannot submit
                      requests.
                    </p>
                  ) : null}
                </aside>
              ) : null}
            </div>
          </>
        )}
      </section>
    </AppShell>
  );
}
