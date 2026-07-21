'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  api,
  type AssetRow,
  type AuthUser,
  type PersonRef,
} from '@/lib/api';
import { can } from '@/lib/access';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { StatusBadge } from '@/components/StatusBadge';
import {
  Download,
  Monitor,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import appStyles from '../app.module.css';
import styles from './assets.module.css';

type LocationRow = { id: string; code: string; name: string };
type TypeRow = { id: string; code: string; name: string };
type StatusRow = { code: string; name: string };

const EMPTY_CREATE = {
  assetTag: '',
  name: '',
  typeCode: '',
  status: 'in_stock',
  serialNumber: '',
  manufacturer: '',
  model: '',
  assignedUserId: '',
  locationId: '',
  purchaseDate: '',
  warrantyExpiresAt: '',
  notes: '',
};

function personLabel(p?: PersonRef | null) {
  if (!p) return '—';
  const name = `${p.firstName} ${p.lastName}`.trim();
  return name || p.email;
}

function toDateInput(value?: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}

export default function AssetsPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [items, setItems] = useState<AssetRow[]>([]);
  const [types, setTypes] = useState<TypeRow[]>([]);
  const [statuses, setStatuses] = useState<StatusRow[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [assignees, setAssignees] = useState<PersonRef[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const [edit, setEdit] = useState({
    name: '',
    status: 'in_stock',
    assignedUserId: '',
    locationId: '',
    serialNumber: '',
    manufacturer: '',
    model: '',
    purchaseDate: '',
    warrantyExpiresAt: '',
    notes: '',
    typeCode: '',
  });
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterQ, setFilterQ] = useState('');
  const [appliedQ, setAppliedQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const canWrite = !!user && can(user, 'assets:write');
  const canOrgRead = !!user && can(user, 'org:read');

  const selected = useMemo(
    () => items.find((a) => a.id === selectedId) ?? null,
    [items, selectedId],
  );

  async function loadList(params?: {
    status?: string;
    typeCode?: string;
    locationId?: string;
    q?: string;
  }) {
    const status = params?.status ?? filterStatus;
    const typeCode = params?.typeCode ?? filterType;
    const locationId = params?.locationId ?? filterLocation;
    const q = params?.q ?? appliedQ;
    const list = await api.assets({
      status: status || undefined,
      typeCode: typeCode || undefined,
      locationId: locationId || undefined,
      q: q || undefined,
    });
    setItems(list);
    setSelectedId((prev) =>
      prev && list.some((a) => a.id === prev) ? prev : list[0]?.id ?? '',
    );
    return list;
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { user: me } = await api.me();
        if (!can(me, 'assets:read')) {
          router.replace('/app');
          return;
        }
        if (!cancelled) setUser(me);

        const [typeList, statusList, list] = await Promise.all([
          api.assetTypes(),
          api.assetStatuses(),
          api.assets(),
        ]);
        if (cancelled) return;
        setTypes(typeList);
        setStatuses(statusList);
        setItems(list);
        setSelectedId(list[0]?.id ?? '');
        setCreateForm((f) => ({
          ...f,
          typeCode: typeList[0]?.code ?? '',
        }));

        if (can(me, 'org:read')) {
          const locs = await api.listLocations();
          if (!cancelled) setLocations(locs);
        }
        if (can(me, 'assets:write')) {
          const people = await api.assetAssignees();
          if (!cancelled) setAssignees(people);
        }
      } catch {
        if (!cancelled) router.replace('/login');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!selected) {
      setEdit({
        name: '',
        status: 'in_stock',
        assignedUserId: '',
        locationId: '',
        serialNumber: '',
        manufacturer: '',
        model: '',
        purchaseDate: '',
        warrantyExpiresAt: '',
        notes: '',
        typeCode: '',
      });
      return;
    }
    setEdit({
      name: selected.name ?? selected.displayName ?? '',
      status: selected.status,
      assignedUserId: selected.assignedUser?.id ?? '',
      locationId: selected.location?.id ?? selected.locationId ?? '',
      serialNumber: selected.serialNumber ?? '',
      manufacturer: selected.manufacturer ?? '',
      model: selected.model ?? '',
      purchaseDate: toDateInput(selected.purchaseDate),
      warrantyExpiresAt: toDateInput(selected.warrantyExpiresAt),
      notes: selected.notes ?? '',
      typeCode: selected.type.code ?? '',
    });
  }, [selected]);

  async function applyFilters(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    setAppliedQ(filterQ);
    try {
      await loadList({
        status: filterStatus || undefined,
        typeCode: filterType || undefined,
        locationId: filterLocation || undefined,
        q: filterQ || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Filter failed');
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!canWrite) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const created = await api.createAsset({
        assetTag: createForm.assetTag,
        typeCode: createForm.typeCode,
        name: createForm.name || undefined,
        status: createForm.status || undefined,
        serialNumber: createForm.serialNumber || undefined,
        manufacturer: createForm.manufacturer || undefined,
        model: createForm.model || undefined,
        assignedUserId: createForm.assignedUserId || undefined,
        locationId: createForm.locationId || undefined,
        purchaseDate: createForm.purchaseDate || undefined,
        warrantyExpiresAt: createForm.warrantyExpiresAt || undefined,
        notes: createForm.notes || undefined,
      });
      setCreateForm({
        ...EMPTY_CREATE,
        typeCode: types[0]?.code ?? '',
        status: 'in_stock',
      });
      setShowCreate(false);
      setMessage(`Registered ${created.assetTag}.`);
      const list = await loadList();
      setSelectedId(created.id);
      if (!list.some((a) => a.id === created.id)) {
        setItems((prev) => [created, ...prev]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!canWrite || !selected) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await api.updateAsset(selected.id, {
        name: edit.name || null,
        status: edit.status,
        typeCode: edit.typeCode || undefined,
        serialNumber: edit.serialNumber || null,
        manufacturer: edit.manufacturer || null,
        model: edit.model || null,
        assignedUserId: edit.assignedUserId || null,
        locationId: edit.locationId || null,
        purchaseDate: edit.purchaseDate || null,
        warrantyExpiresAt: edit.warrantyExpiresAt || null,
        notes: edit.notes || null,
      });
      setMessage(`Updated ${updated.assetTag}.`);
      await loadList();
      setSelectedId(updated.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  async function onRetire() {
    if (!canWrite || !selected) return;
    if (
      !window.confirm(
        `Retire and remove ${selected.assetTag} from the active register?`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.deleteAsset(selected.id);
      setMessage(`Retired ${selected.assetTag}.`);
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retire failed');
    } finally {
      setBusy(false);
    }
  }

  async function onExport() {
    setError(null);
    try {
      await api.downloadAssetsCsv({
        status: filterStatus || undefined,
        typeCode: filterType || undefined,
        locationId: filterLocation || undefined,
        q: appliedQ || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    }
  }

  async function logout() {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    router.replace('/login');
  }

  if (!user || loading) {
    return (
      <main className={appStyles.page}>
        <p className={appStyles.muted}>Loading…</p>
      </main>
    );
  }

  return (
    <AppShell user={user} onLogout={logout} title="Assets">
      <div className={styles.layout}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>CMDB-lite · Asset register</p>
          <p className={styles.lede}>
            Track IT hardware and devices: tag, type, status, assignee, and
            location. Link assets to tickets from the API when investigating
            hardware incidents.
          </p>
        </header>

        <form className={styles.toolbar} onSubmit={applyFilters}>
          <div className={styles.filters}>
            <div className={`${styles.filterField} ${styles.searchGrow}`}>
              <label htmlFor="asset-q">Search</label>
              <input
                id="asset-q"
                value={filterQ}
                onChange={(e) => setFilterQ(e.target.value)}
                placeholder="Tag, serial, name, assignee…"
              />
            </div>
            <div className={styles.filterField}>
              <label htmlFor="asset-status">Status</label>
              <select
                id="asset-status"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">All</option>
                {statuses.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.filterField}>
              <label htmlFor="asset-type">Type</label>
              <select
                id="asset-type"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="">All</option>
                {types.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            {canOrgRead ? (
              <div className={styles.filterField}>
                <label htmlFor="asset-loc">Location</label>
                <select
                  id="asset-loc"
                  value={filterLocation}
                  onChange={(e) => setFilterLocation(e.target.value)}
                >
                  <option value="">All</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <Button type="submit" variant="secondary">
              <Icon icon={Search} size="sm" />
              Filter
            </Button>
          </div>
          <div className={styles.actions}>
            <Button type="button" variant="tertiary" onClick={onExport}>
              <Icon icon={Download} size="sm" />
              Export CSV
            </Button>
            {canWrite ? (
              <Button
                type="button"
                variant="primary"
                onClick={() => setShowCreate((v) => !v)}
              >
                <Icon icon={Plus} size="sm" />
                {showCreate ? 'Hide form' : 'Register asset'}
              </Button>
            ) : null}
          </div>
        </form>

        {message ? <p className={styles.bannerOk}>{message}</p> : null}
        {error ? (
          <p className={appStyles.error} role="alert">
            {error}
          </p>
        ) : null}

        {canWrite && showCreate ? (
          <section className={styles.panel}>
            <div className={styles.sectionHead}>
              <div>
                <h2 className={styles.sectionTitle}>Register asset</h2>
                <p className={styles.sectionHint}>
                  Requires <code>assets:write</code>
                </p>
              </div>
            </div>
            <form onSubmit={onCreate}>
              <div className={styles.createGrid}>
                <label className={styles.field}>
                  Asset tag
                  <input
                    value={createForm.assetTag}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        assetTag: e.target.value,
                      }))
                    }
                    required
                    minLength={2}
                    placeholder="GH-IT-0042"
                  />
                </label>
                <label className={styles.field}>
                  Display name
                  <input
                    value={createForm.name}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, name: e.target.value }))
                    }
                    placeholder="Optional friendly name"
                  />
                </label>
                <label className={styles.field}>
                  Type
                  <select
                    value={createForm.typeCode}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        typeCode: e.target.value,
                      }))
                    }
                    required
                  >
                    {types.map((t) => (
                      <option key={t.code} value={t.code}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  Status
                  <select
                    value={createForm.status}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, status: e.target.value }))
                    }
                  >
                    {statuses.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  Manufacturer
                  <input
                    value={createForm.manufacturer}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        manufacturer: e.target.value,
                      }))
                    }
                  />
                </label>
                <label className={styles.field}>
                  Model
                  <input
                    value={createForm.model}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, model: e.target.value }))
                    }
                  />
                </label>
                <label className={styles.field}>
                  Serial number
                  <input
                    value={createForm.serialNumber}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        serialNumber: e.target.value,
                      }))
                    }
                  />
                </label>
                <label className={styles.field}>
                  Assignee
                  <select
                    value={createForm.assignedUserId}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        assignedUserId: e.target.value,
                      }))
                    }
                  >
                    <option value="">Unassigned</option>
                    {assignees.map((a) => (
                      <option key={a.id} value={a.id}>
                        {personLabel(a)}
                      </option>
                    ))}
                  </select>
                </label>
                {canOrgRead ? (
                  <label className={styles.field}>
                    Location
                    <select
                      value={createForm.locationId}
                      onChange={(e) =>
                        setCreateForm((f) => ({
                          ...f,
                          locationId: e.target.value,
                        }))
                      }
                    >
                      <option value="">None</option>
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label className={styles.field}>
                  Purchase date
                  <input
                    type="date"
                    value={createForm.purchaseDate}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        purchaseDate: e.target.value,
                      }))
                    }
                  />
                </label>
                <label className={styles.field}>
                  Warranty expires
                  <input
                    type="date"
                    value={createForm.warrantyExpiresAt}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        warrantyExpiresAt: e.target.value,
                      }))
                    }
                  />
                </label>
                <label className={`${styles.field} ${styles.span2}`}>
                  Notes
                  <textarea
                    value={createForm.notes}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, notes: e.target.value }))
                    }
                  />
                </label>
              </div>
              <div className={styles.detailActions}>
                <Button type="submit" disabled={busy}>
                  {busy ? 'Saving…' : 'Create asset'}
                </Button>
              </div>
            </form>
          </section>
        ) : null}

        {items.length === 0 ? (
          <section className={styles.panel}>
            <EmptyState icon={Monitor}>
              No assets match this view.
              {canWrite ? (
                <Button type="button" onClick={() => setShowCreate(true)}>
                  <Icon icon={Plus} size="sm" />
                  Register the first asset
                </Button>
              ) : (
                <a href="/app">Back to Home</a>
              )}
            </EmptyState>
          </section>
        ) : (
          <div className={styles.split}>
            <section className={styles.panel}>
              <div className={styles.sectionHead}>
                <div>
                  <h2 className={styles.sectionTitle}>Register</h2>
                  <p className={styles.sectionHint}>
                    {items.length} asset{items.length === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Tag</th>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Assignee</th>
                      <th>Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((a) => (
                      <tr
                        key={a.id}
                        className={
                          a.id === selectedId ? styles.selected : undefined
                        }
                        onClick={() => setSelectedId(a.id)}
                      >
                        <td className={styles.tag}>{a.assetTag}</td>
                        <td>{a.displayName}</td>
                        <td>{a.type.name}</td>
                        <td>
                          <StatusBadge
                            code={a.status}
                            name={a.statusName}
                          />
                        </td>
                        <td>{personLabel(a.assignedUser)}</td>
                        <td className={styles.muted}>
                          {a.location?.name ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className={styles.panel}>
              {selected ? (
                <>
                  <div className={styles.sectionHead}>
                    <div>
                      <h2 className={styles.sectionTitle}>
                        {selected.assetTag}
                      </h2>
                      <p className={styles.sectionHint}>
                        {selected.displayName}
                      </p>
                    </div>
                    <StatusBadge
                      code={selected.status}
                      name={selected.statusName}
                    />
                  </div>

                  {canWrite ? (
                    <form onSubmit={onSaveEdit}>
                      <div className={styles.detailGrid}>
                        <label className={styles.field}>
                          Name
                          <input
                            value={edit.name}
                            onChange={(e) =>
                              setEdit((f) => ({ ...f, name: e.target.value }))
                            }
                          />
                        </label>
                        <label className={styles.field}>
                          Status
                          <select
                            value={edit.status}
                            onChange={(e) =>
                              setEdit((f) => ({
                                ...f,
                                status: e.target.value,
                              }))
                            }
                          >
                            {statuses.map((s) => (
                              <option key={s.code} value={s.code}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className={styles.field}>
                          Type
                          <select
                            value={edit.typeCode}
                            onChange={(e) =>
                              setEdit((f) => ({
                                ...f,
                                typeCode: e.target.value,
                              }))
                            }
                          >
                            {types.map((t) => (
                              <option key={t.code} value={t.code}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className={styles.field}>
                          Assignee
                          <select
                            value={edit.assignedUserId}
                            onChange={(e) =>
                              setEdit((f) => ({
                                ...f,
                                assignedUserId: e.target.value,
                              }))
                            }
                          >
                            <option value="">Unassigned</option>
                            {assignees.map((a) => (
                              <option key={a.id} value={a.id}>
                                {personLabel(a)}
                              </option>
                            ))}
                          </select>
                        </label>
                        {canOrgRead ? (
                          <label className={styles.field}>
                            Location
                            <select
                              value={edit.locationId}
                              onChange={(e) =>
                                setEdit((f) => ({
                                  ...f,
                                  locationId: e.target.value,
                                }))
                              }
                            >
                              <option value="">None</option>
                              {locations.map((l) => (
                                <option key={l.id} value={l.id}>
                                  {l.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : null}
                        <label className={styles.field}>
                          Serial
                          <input
                            value={edit.serialNumber}
                            onChange={(e) =>
                              setEdit((f) => ({
                                ...f,
                                serialNumber: e.target.value,
                              }))
                            }
                          />
                        </label>
                        <label className={styles.field}>
                          Manufacturer
                          <input
                            value={edit.manufacturer}
                            onChange={(e) =>
                              setEdit((f) => ({
                                ...f,
                                manufacturer: e.target.value,
                              }))
                            }
                          />
                        </label>
                        <label className={styles.field}>
                          Model
                          <input
                            value={edit.model}
                            onChange={(e) =>
                              setEdit((f) => ({
                                ...f,
                                model: e.target.value,
                              }))
                            }
                          />
                        </label>
                        <label className={styles.field}>
                          Purchase date
                          <input
                            type="date"
                            value={edit.purchaseDate}
                            onChange={(e) =>
                              setEdit((f) => ({
                                ...f,
                                purchaseDate: e.target.value,
                              }))
                            }
                          />
                        </label>
                        <label className={styles.field}>
                          Warranty expires
                          <input
                            type="date"
                            value={edit.warrantyExpiresAt}
                            onChange={(e) =>
                              setEdit((f) => ({
                                ...f,
                                warrantyExpiresAt: e.target.value,
                              }))
                            }
                          />
                        </label>
                        <label
                          className={styles.field}
                          style={{ gridColumn: '1 / -1' }}
                        >
                          Notes
                          <textarea
                            value={edit.notes}
                            onChange={(e) =>
                              setEdit((f) => ({
                                ...f,
                                notes: e.target.value,
                              }))
                            }
                          />
                        </label>
                      </div>
                      <div className={styles.detailActions}>
                        <Button type="submit" disabled={busy}>
                          {busy ? 'Saving…' : 'Save changes'}
                        </Button>
                        <Button
                          type="button"
                          variant="dangerOutline"
                          disabled={busy}
                          onClick={onRetire}
                        >
                          <Icon icon={Trash2} size="sm" />
                          Retire
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className={styles.detailGrid}>
                      <div>
                        <div className={styles.muted}>Type</div>
                        <strong>{selected.type.name}</strong>
                      </div>
                      <div>
                        <div className={styles.muted}>Assignee</div>
                        <strong>{personLabel(selected.assignedUser)}</strong>
                      </div>
                      <div>
                        <div className={styles.muted}>Location</div>
                        <strong>{selected.location?.name ?? '—'}</strong>
                      </div>
                      <div>
                        <div className={styles.muted}>Serial</div>
                        <strong>{selected.serialNumber ?? '—'}</strong>
                      </div>
                      {selected.notes ? (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <div className={styles.muted}>Notes</div>
                          <p style={{ margin: '0.25rem 0 0' }}>
                            {selected.notes}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  )}
                </>
              ) : (
                <p className={styles.muted}>Select an asset to view details.</p>
              )}
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}
