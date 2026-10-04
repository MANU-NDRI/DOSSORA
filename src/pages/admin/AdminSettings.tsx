import { useEffect, useState, type FormEvent } from 'react';
import { Field, PageHeader, Spinner } from '@/components/ui';
import { LANGUAGES, useT } from '@/i18n';
import { Icon } from '@/components/Icon';
import { DEFAULT_SETTINGS, invalidateCache, useSettings } from '@/hooks/useData';
import { supabase } from '@/lib/supabase';
import { errorKey } from '@/lib/errors';
import { useUI } from '@/store/ui';
import type { ShopSettings } from '@/types';

export default function AdminSettings() {
  const { t, lang, setLang } = useT();
  const toast = useUI((s) => s.toast);
  const current = useSettings();
  const [f, setF] = useState<ShopSettings>(DEFAULT_SETTINGS);
  const [busy, setBusy] = useState(false);
  useEffect(() => setF(current), [current]);
  const set = (k: keyof ShopSettings) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from('shop_settings').upsert({ key: 'general', value: { ...f, currency: f.currency.toUpperCase() } });
    setBusy(false);
    if (error) toast('error', t(errorKey(error)));
    else {
      invalidateCache('settings');
      toast('success', t('common.saved'));
    }
  };
  return (
    <div>
      <PageHeader title={t('admin.nav.settings')} />
      <section className="card mb-6 max-w-2xl p-5 sm:p-6" aria-labelledby="lang-region">
        <h2 id="lang-region" className="text-2xl">
          {t('settings.region')}
        </h2>
        <p className="mt-1 text-sm text-ink/70">{t('settings.language_hint')}</p>
        <p className="label mt-4">🌐 {t('settings.admin_language')}</p>
        <div role="radiogroup" aria-label={t('settings.admin_language')} className="grid gap-2 sm:grid-cols-3">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              role="radio"
              aria-checked={lang === l.code}
              onClick={() => {
                if (l.code !== lang) setLang(l.code);
              }}
              className={`flex min-h-[48px] items-center gap-2 rounded-2xl border-2 px-4 text-start text-sm font-medium transition ${lang === l.code ? 'border-bordeaux bg-bordeaux/5 text-bordeaux' : 'border-bordeaux/15 hover:border-bordeaux/40'}`}
            >
              <span className="text-lg">{l.flag}</span>
              <span className="flex-1">{l.label}</span>
              {lang === l.code && <Icon name="check" className="h-4 w-4 text-gold-dark" />}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink/60">{t('settings.language_independent')}</p>
      </section>
      <h2 className="mb-3 text-2xl">{t('settings.shop_section')}</h2>
      <form onSubmit={save} className="card grid max-w-2xl gap-4 p-5 sm:grid-cols-2 sm:p-6">
        <Field label={t('settings.shop_name')}>
          <input className="input" value={f.shop_name} onChange={set('shop_name')} />
        </Field>
        <Field label={t('settings.slogan')}>
          <input className="input" value={f.slogan} onChange={set('slogan')} />
        </Field>
        <Field label={t('settings.currency')} hint={t('settings.currency_hint')}>
          <input className="input" maxLength={3} value={f.currency} onChange={set('currency')} />
        </Field>
        <Field label={t('auth.email')}>
          <input type="email" className="input" value={f.email} onChange={set('email')} />
        </Field>
        <Field label="WhatsApp">
          <input className="input" dir="ltr" value={f.whatsapp} onChange={set('whatsapp')} />
        </Field>
        <div className="sm:col-span-2">
          <Field label={t('settings.sender_address')} hint={t('settings.sender_hint')}>
            <input className="input" autoComplete="street-address" value={f.sender_address ?? ''} onChange={set('sender_address')} />
          </Field>
        </div>
        <Field label={t('settings.sender_city')}>
          <input className="input" autoComplete="address-level2" value={f.sender_city ?? ''} onChange={set('sender_city')} />
        </Field>
        <Field label={t('settings.sender_country')}>
          <input className="input" autoComplete="country-name" value={f.sender_country ?? ''} onChange={set('sender_country')} />
        </Field>
        <div className="hidden sm:block" />
        <div className="sm:col-span-2">
          <Field label={`${t('settings.announcement')} (FR)`}>
            <input className="input" value={f.announcement_fr ?? ''} onChange={set('announcement_fr')} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label={`${t('settings.announcement')} (EN)`}>
            <input className="input" value={f.announcement_en ?? ''} onChange={set('announcement_en')} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label={`${t('settings.announcement')} (AR)`}>
            <input className="input" value={f.announcement_ar ?? ''} onChange={set('announcement_ar')} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <button className="btn-primary" disabled={busy}>
            {busy && <Spinner className="h-4 w-4" />}
            {t('common.save')}
          </button>
        </div>
      </form>
    </div>
  );
}
