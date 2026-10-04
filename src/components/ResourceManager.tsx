import { useState, type FormEvent, type ReactNode } from 'react';
import { EmptyState, ErrorState, Field, Modal, PageHeader, Spinner } from './ui';
import { ImageUpload } from './ImageUpload';
import { Icon } from './Icon';
import { useAsync } from '@/hooks/useAsync';
import { untypedFrom } from '@/lib/supabase';
import { errorKey } from '@/lib/errors';
import { useT } from '@/i18n';
import { useUI } from '@/store/ui';
import { invalidateCache } from '@/hooks/useData';
import { removePublicImageByUrl } from '@/services/storage';
import { reportError } from '@/lib/diagnostics';

export interface FieldDef {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'bool' | 'select' | 'image' | 'datetime';
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
  lockOnEdit?: boolean;
  half?: boolean;
  hint?: string;
  aspect?: 'square' | 'wide' | 'tall';
}
type Row = Record<string, unknown>;
interface Props {
  title: string;
  table: string;
  pk?: string;
  fields: FieldDef[];
  defaults: Row;
  orderBy?: string;
  imageFolder?: string;
  cache?: string;
  renderRow: (r: Row) => ReactNode;
  beforeSave?: (r: Row) => Row;
  /** Aperçu en direct affiché en haut du formulaire (ex. rendu du Hero). */
  preview?: (form: Row) => ReactNode;
  savedMessage?: string;
  subtitle?: string;
  disableDelete?: boolean;
}

const toLocalInput = (v: unknown) => (v ? new Date(String(v)).toISOString().slice(0, 16) : '');

/** Gestionnaire CRUD générique (catégories, promotions, paiements, bannières). L'accès réel reste protégé par RLS (admin). */
export function ResourceManager({
  title,
  table,
  pk = 'id',
  fields,
  defaults,
  orderBy = 'created_at',
  imageFolder = 'misc',
  cache,
  renderRow,
  beforeSave,
  preview,
  savedMessage,
  subtitle,
  disableDelete = false,
}: Props) {
  const { t } = useT();
  const toast = useUI((s) => s.toast);
  const [form, setForm] = useState<Row | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [orig, setOrig] = useState<Row | null>(null);
  const { data, loading, error, reload } = useAsync(async () => {
    const { data: rows, error: e } = await untypedFrom(table)
      .select('*')
      .order(orderBy, { ascending: orderBy !== 'created_at' });
    if (e) throw e;
    return (rows ?? []) as Row[];
  }, [table]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    let row: Row = {};
    for (const f of fields) {
      const v = form[f.name];
      if (f.type === 'number') row[f.name] = v === '' || v === null || v === undefined ? null : Number(v);
      else if (f.type === 'datetime') row[f.name] = v ? new Date(String(v)).toISOString() : null;
      else if (f.type === 'bool') row[f.name] = !!v;
      else row[f.name] = typeof v === 'string' && v.trim() === '' && !f.required ? null : typeof v === 'string' ? v.trim() : v;
    }
    if (beforeSave) row = beforeSave(row);
    setBusy(true);
    const { error: err } = isNew
      ? await untypedFrom(table).insert(row)
      : await untypedFrom(table)
          .update(row)
          .eq(pk, form[pk] as string);
    setBusy(false);
    if (err) {
      reportError(`Enregistrement ${table}`, err);
      toast('error', t(errorKey(err)));
      return;
    }
    // Ancienne image remplacée ou retirée : on la supprime de Storage une fois la nouvelle version enregistrée.
    if (orig)
      for (const f of fields)
        if (f.type === 'image' && orig[f.name] && orig[f.name] !== row[f.name]) void removePublicImageByUrl(String(orig[f.name]));
    if (cache) invalidateCache(cache);
    toast('success', savedMessage ?? t('common.saved'));
    setForm(null);
    setOrig(null);
    reload();
  };
  const del = async (r: Row) => {
    if (!window.confirm(t('common.confirm_delete'))) return;
    const { error: err } = await untypedFrom(table)
      .delete()
      .eq(pk, r[pk] as string);
    if (err) {
      reportError(`Suppression ${table}`, err);
      toast('error', t(errorKey(err)));
      return;
    }
    for (const f of fields) if (f.type === 'image') void removePublicImageByUrl(r[f.name] as string | null);
    if (cache) invalidateCache(cache);
    reload();
  };

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <button
            className="btn-primary btn-sm"
            onClick={() => {
              setIsNew(true);
              setOrig(null);
              setForm({ ...defaults });
            }}
          >
            <Icon name="plus" className="h-4 w-4" />
            {t('common.add')}
          </button>
        }
      />
      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data?.length ? (
        <EmptyState title={t('admin.empty')} />
      ) : (
        <ul className="space-y-2">
          {data.map((r) => (
            <li key={String(r[pk])} className="card flex items-center justify-between gap-3 p-3 sm:p-4">
              <div className="min-w-0 flex-1">{renderRow(r)}</div>
              <div className="flex shrink-0 gap-1">
                <button
                  className="btn-outline btn-sm"
                  onClick={() => {
                    setIsNew(false);
                    setOrig({ ...r });
                    setForm({ ...r });
                  }}
                  aria-label={t('common.edit')}
                >
                  <Icon name="edit" className="h-4 w-4" />
                </button>
                {!disableDelete && (
                  <button className="btn-ghost btn-sm text-red-700" onClick={() => void del(r)} aria-label={t('common.delete')}>
                    <Icon name="trash" className="h-4 w-4" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Modal open={!!form} onClose={() => setForm(null)} title={title} wide>
        {form && (
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            {preview && <div className="sm:col-span-2">{preview(form)}</div>}
            {fields.map((f) => {
              const v = form[f.name];
              const set = (x: unknown) => setForm({ ...form, [f.name]: x });
              const wrap = (child: ReactNode) => (
                <div key={f.name} className={f.half ? '' : 'sm:col-span-2'}>
                  {child}
                </div>
              );
              if (f.type === 'bool')
                return wrap(
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="h-4 w-4 accent-[#7A1F3D]" checked={!!v} onChange={(e) => set(e.target.checked)} />
                    {f.label}
                  </label>,
                );
              if (f.type === 'image')
                return wrap(
                  <ImageUpload
                    folder={imageFolder}
                    label={f.label}
                    aspect={f.aspect}
                    hint={f.hint}
                    value={(v as string) ?? ''}
                    onChange={set}
                  />,
                );
              return wrap(
                <Field label={f.label + (f.required ? ' *' : '')} hint={f.hint}>
                  {f.type === 'textarea' ? (
                    <textarea
                      className="input min-h-[80px]"
                      value={(v as string) ?? ''}
                      onChange={(e) => set(e.target.value)}
                      required={f.required}
                    />
                  ) : f.type === 'select' ? (
                    <select className="input" value={(v as string) ?? ''} onChange={(e) => set(e.target.value)}>
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : f.type === 'datetime' ? (
                    <input type="datetime-local" className="input" value={toLocalInput(v)} onChange={(e) => set(e.target.value)} />
                  ) : (
                    <input
                      type={f.type === 'number' ? 'number' : 'text'}
                      step={f.type === 'number' ? 'any' : undefined}
                      className="input"
                      value={(v as string | number | null) ?? ''}
                      required={f.required}
                      disabled={f.lockOnEdit && !isNew}
                      onChange={(e) => set(e.target.value)}
                    />
                  )}
                </Field>,
              );
            })}
            <div className="sm:col-span-2">
              <button className="btn-primary w-full" disabled={busy}>
                {busy && <Spinner className="h-4 w-4" />}
                {t('common.save')}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
