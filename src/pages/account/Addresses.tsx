import { useState, type FormEvent } from 'react';
import { CountryCitySelect } from '@/components/CountryCitySelect';
import { EmptyState, ErrorState, Field, Modal, PageHeader, Spinner } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useT } from '@/i18n';
import { useAsync } from '@/hooks/useAsync';
import { supabase } from '@/lib/supabase';
import { errorKey } from '@/lib/errors';
import { useAuth } from '@/store/auth';
import { useUI } from '@/store/ui';
import type { Address } from '@/types';

const EMPTY = { id: '', label: '', country_code: '', city: '', address: '', postal_code: '', phone: '', is_default: false };

export default function Addresses() {
  const { t } = useT();
  const user = useAuth((s) => s.user);
  const toast = useUI((s) => s.toast);
  const { data, loading, error, reload } = useAsync(async () => {
    const { data: rows, error: e } = await supabase
      .from('addresses')
      .select('*')
      .order('is_default', { ascending: false })
      .order('created_at');
    if (e) throw e;
    return (rows ?? []) as Address[];
  }, []);
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form || !user) return;
    if (!form.country_code || !form.city || form.address.trim().length < 5) {
      toast('error', t('checkout.address_short'));
      return;
    }
    setBusy(true);
    const row = {
      user_id: user.id,
      label: form.label.trim() || null,
      country_code: form.country_code,
      city: form.city,
      address: form.address.trim(),
      postal_code: form.postal_code.trim() || null,
      phone: form.phone.trim() || null,
      is_default: form.is_default,
    };
    if (row.is_default) await supabase.from('addresses').update({ is_default: false }).eq('user_id', user.id);
    const { error: err } = form.id
      ? await supabase.from('addresses').update(row).eq('id', form.id)
      : await supabase.from('addresses').insert(row);
    setBusy(false);
    if (err) {
      toast('error', t(errorKey(err)));
      return;
    }
    setForm(null);
    reload();
  };
  const del = async (id: string) => {
    if (!window.confirm(t('common.confirm_delete'))) return;
    const { error: err } = await supabase.from('addresses').delete().eq('id', id);
    if (err) toast('error', t(errorKey(err)));
    else reload();
  };
  return (
    <div>
      <PageHeader
        title={t('account.addresses')}
        actions={
          <button className="btn-primary btn-sm" onClick={() => setForm({ ...EMPTY })}>
            <Icon name="plus" className="h-4 w-4" />
            {t('addr.add')}
          </button>
        }
      />
      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : error ? (
        <ErrorState onRetry={reload} />
      ) : !data?.length ? (
        <EmptyState title={t('addr.empty')} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {data.map((a) => (
            <li key={a.id} className="card p-4 text-sm">
              <div className="mb-1 flex items-center gap-2">
                <span className="font-semibold">{a.label || t('addr.address')}</span>
                {a.is_default && <span className="badge bg-gold/30 text-bordeaux-dark">{t('addr.default')}</span>}
              </div>
              <p className="whitespace-pre-line">{a.address}</p>
              <p>
                {a.city}
                {a.postal_code ? `, ${a.postal_code}` : ''} ({a.country_code})
              </p>
              {a.phone && <p dir="ltr">{a.phone}</p>}
              <div className="mt-3 flex gap-2">
                <button
                  className="btn-outline btn-sm"
                  onClick={() =>
                    setForm({
                      id: a.id,
                      label: a.label ?? '',
                      country_code: a.country_code,
                      city: a.city,
                      address: a.address,
                      postal_code: a.postal_code ?? '',
                      phone: a.phone ?? '',
                      is_default: a.is_default,
                    })
                  }
                >
                  <Icon name="edit" className="h-4 w-4" />
                  {t('common.edit')}
                </button>
                <button className="btn-ghost btn-sm text-red-700" onClick={() => void del(a.id)}>
                  <Icon name="trash" className="h-4 w-4" />
                  {t('common.delete')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? t('common.edit') : t('addr.add')}>
        {form && (
          <form onSubmit={save} className="space-y-4">
            <Field label={t('addr.label')}>
              <input className="input" maxLength={40} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
            </Field>
            <CountryCitySelect
              country={form.country_code}
              city={form.city}
              onChange={(v) => setForm({ ...form, country_code: v.country, city: v.city })}
            />
            <Field label={`${t('checkout.address')} *`}>
              <textarea
                className="input"
                maxLength={300}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('checkout.postal_code')}>
                <input className="input" value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} />
              </Field>
              <Field label={t('auth.phone')}>
                <input
                  className="input"
                  dir="ltr"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#7A1F3D]"
                checked={form.is_default}
                onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
              />
              {t('addr.set_default')}
            </label>
            <button className="btn-primary w-full" disabled={busy}>
              {busy && <Spinner className="h-4 w-4" />}
              {t('common.save')}
            </button>
          </form>
        )}
      </Modal>
    </div>
  );
}
