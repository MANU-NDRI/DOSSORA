import { useEffect, useState, type FormEvent } from 'react';
import { CountryCitySelect } from '@/components/CountryCitySelect';
import { Field, PageHeader, Spinner } from '@/components/ui';
import { useT } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { errorKey } from '@/lib/errors';
import { useAuth } from '@/store/auth';
import { useUI } from '@/store/ui';

export default function Profile() {
  const { t } = useT();
  const { user, profile, refreshProfile } = useAuth();
  const toast = useUI((s) => s.toast);
  const [f, setF] = useState({ first_name: '', last_name: '', phone: '', country_code: '', city: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (profile)
      setF({
        first_name: profile.first_name,
        last_name: profile.last_name,
        phone: profile.phone ?? '',
        country_code: profile.country_code ?? '',
        city: profile.city ?? '',
      });
  }, [profile]);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: f.first_name.trim(),
        last_name: f.last_name.trim(),
        phone: f.phone.trim() || null,
        country_code: f.country_code || null,
        city: f.city || null,
      })
      .eq('id', user.id);
    setBusy(false);
    if (error) toast('error', t(errorKey(error)));
    else {
      toast('success', t('common.saved'));
      void refreshProfile();
    }
  };
  return (
    <div>
      <PageHeader title={t('account.profile')} />
      <form onSubmit={save} className="card max-w-xl space-y-4 p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('auth.first_name')}>
            <input className="input" value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} required />
          </Field>
          <Field label={t('auth.last_name')}>
            <input className="input" value={f.last_name} onChange={(e) => setF({ ...f, last_name: e.target.value })} required />
          </Field>
        </div>
        <Field label={t('auth.email')}>
          <input className="input" value={profile?.email ?? user?.email ?? ''} disabled />
        </Field>
        <Field label={t('auth.phone')}>
          <input type="tel" dir="ltr" className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </Field>
        <CountryCitySelect country={f.country_code} city={f.city} onChange={(v) => setF({ ...f, country_code: v.country, city: v.city })} />
        <button className="btn-primary" disabled={busy}>
          {busy && <Spinner className="h-4 w-4" />}
          {t('common.save')}
        </button>
      </form>
    </div>
  );
}
