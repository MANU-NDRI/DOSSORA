import { useState, type FormEvent } from 'react';
import { ResourceManager, type FieldDef } from '@/components/ResourceManager';
import { Field, Spinner } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { useT } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { useUI } from '@/store/ui';

interface Recipient {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
}

export default function AdminPromotions() {
  const { t } = useT();
  const toast = useUI((s) => s.toast);
  const [all, setAll] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const { data, loading } = useAsync(async () => {
    const recipients: Recipient[] = [];
    for (let from = 0; ; from += 500) {
      const { data: page, error } = await supabase
        .from('customers')
        .select('id,first_name,last_name,email,phone')
        .order('created_at', { ascending: false })
        .range(from, from + 499);
      if (error) throw error;
      recipients.push(...((page ?? []) as Recipient[]));
      if (!page || page.length < 500) break;
    }
    const { data: codes, error } = await supabase.from('discount_codes').select('code').eq('is_active', true).order('code');
    if (error) throw error;
    return { recipients, codes: (codes ?? []) as Array<{ code: string }> };
  }, []);

  const sendCampaign = async (e: FormEvent) => {
    e.preventDefault();
    const recipients = data?.recipients.filter((c) => all || selected.includes(c.id)) ?? [];
    if (!recipients.length || !title.trim() || !message.trim()) return;
    if (!window.confirm(t('promo.confirm_recipients', { n: String(recipients.length) }))) return;
    setBusy(true);
    try {
      const { data: sent, error } = await supabase.rpc('admin_send_promotion', {
        p_user_ids: all ? [] : recipients.map((c) => c.id),
        p_all: all,
        p_title: title.trim(),
        p_message: message.trim(),
        p_code: code || null,
      });
      if (error) throw error;
      toast('success', t('promo.sent', { n: String(sent) }));
      setTitle('');
      setMessage('');
      setCode('');
      setSelected([]);
      setAll(false);
    } catch {
      toast('error', t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };
  const fields: FieldDef[] = [
    { name: 'code', label: t('promo.code'), type: 'text', required: true, half: true },
    { name: 'percent', label: t('promo.percent'), type: 'number', half: true, hint: t('promo.either') },
    { name: 'fixed_amount', label: t('promo.fixed'), type: 'number', half: true },
    { name: 'min_order', label: t('promo.min_order'), type: 'number', half: true },
    { name: 'max_uses', label: t('promo.max_uses'), type: 'number', half: true },
    { name: 'starts_at', label: t('promo.starts'), type: 'datetime', half: true },
    { name: 'expires_at', label: t('promo.expires'), type: 'datetime', half: true },
    { name: 'is_active', label: t('admin.active'), type: 'bool' },
  ];
  return (
    <div className="space-y-6">
      <section className="card p-5">
        <h2 className="mb-3 text-xl">{t('promo.send_campaign')}</h2>
        {loading ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : (
          <form onSubmit={sendCampaign} className="space-y-4">
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" checked={all} onChange={() => setAll(true)} />
                {t('promo.all_customers')}
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={!all} onChange={() => setAll(false)} />
                {t('promo.selected_customers')}
              </label>
            </div>
            {!all && (
              <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-bordeaux/10 p-3">
                {data?.recipients.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 py-1 text-sm">
                    <input
                      type="checkbox"
                      checked={selected.includes(c.id)}
                      onChange={(e) => setSelected((s) => (e.target.checked ? [...s, c.id] : s.filter((id) => id !== c.id)))}
                    />
                    <span>
                      {c.first_name} {c.last_name} · {c.email ?? '—'}
                      {c.phone ? ` · ${c.phone}` : ''}
                    </span>
                  </label>
                ))}
                {!data?.recipients.length && <p className="text-sm text-ink/60">{t('admin.empty')}</p>}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('customer.title')}>
                <input className="input" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} required />
              </Field>
              <Field label={t('promo.code_optional')}>
                <select className="input" value={code} onChange={(e) => setCode(e.target.value)}>
                  <option value="">—</option>
                  {data?.codes.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('customer.message')}>
                <textarea
                  className="input min-h-24"
                  maxLength={1000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                />
              </Field>
            </div>
            <button className="btn-primary" disabled={busy || loading}>
              {busy ? <Spinner className="h-4 w-4" /> : t('promo.send_campaign')}
            </button>
          </form>
        )}
      </section>
      <ResourceManager
        title={t('admin.nav.promotions')}
        table="discount_codes"
        fields={fields}
        defaults={{ code: '', percent: 10, fixed_amount: '', min_order: 0, max_uses: '', starts_at: '', expires_at: '', is_active: true }}
        beforeSave={(r) => ({ ...r, code: String(r.code).toUpperCase().replace(/\s/g, ''), percent: r.fixed_amount ? null : r.percent })}
        renderRow={(r) => (
          <div>
            <p className="font-semibold">
              {String(r.code)}{' '}
              <span className="font-normal text-ink/70">— {r.percent ? `${String(r.percent)}%` : String(r.fixed_amount)}</span>
            </p>
            <p className="text-xs text-ink/60">
              {t('promo.used', { n: String(r.uses_count ?? 0) })}
              {r.max_uses ? ` / ${String(r.max_uses)}` : ''} · {r.is_active ? t('admin.active') : t('admin.hidden')}
            </p>
          </div>
        )}
      />
    </div>
  );
}
