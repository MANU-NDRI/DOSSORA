import { useState, type FormEvent } from 'react';
import { Field, PageHeader, Spinner } from '@/components/ui';
import { useT } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { errorKey } from '@/lib/errors';
import { useAuth } from '@/store/auth';
import { useUI } from '@/store/ui';

export default function Security() {
  const { t } = useT();
  const { user, signOut } = useAuth();
  const toast = useUI((s) => s.toast);
  const [cur, setCur] = useState('');
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (p1.length < 8) {
      toast('error', t('auth.password_short'));
      return;
    }
    if (p1 !== p2) {
      toast('error', t('auth.password_mismatch'));
      return;
    }
    setBusy(true);
    // Vérifie l'ancien mot de passe avant de le changer.
    const { error: e1 } = await supabase.auth.signInWithPassword({ email: user?.email ?? '', password: cur });
    if (e1) {
      setBusy(false);
      toast('error', t('security.current_wrong'));
      return;
    }
    const { error: e2 } = await supabase.auth.updateUser({ password: p1 });
    setBusy(false);
    if (e2) toast('error', t(errorKey(e2)));
    else {
      toast('success', t('auth.password_updated'));
      setCur('');
      setP1('');
      setP2('');
    }
  };
  return (
    <div className="space-y-6">
      <PageHeader title={t('account.security')} />
      <form onSubmit={submit} className="card max-w-md space-y-4 p-5 sm:p-6">
        <h2 className="text-2xl">{t('security.change_password')}</h2>
        <Field label={t('security.current_password')}>
          <input
            type="password"
            className="input"
            value={cur}
            onChange={(e) => setCur(e.target.value)}
            autoComplete="current-password"
            required
          />
        </Field>
        <Field label={t('auth.new_password')} hint={t('auth.password_hint')}>
          <input
            type="password"
            className="input"
            value={p1}
            onChange={(e) => setP1(e.target.value)}
            autoComplete="new-password"
            required
          />
        </Field>
        <Field label={t('auth.confirm_password')}>
          <input
            type="password"
            className="input"
            value={p2}
            onChange={(e) => setP2(e.target.value)}
            autoComplete="new-password"
            required
          />
        </Field>
        <button className="btn-primary" disabled={busy}>
          {busy && <Spinner className="h-4 w-4" />}
          {t('common.save')}
        </button>
      </form>
      <div className="card max-w-md p-5 sm:p-6">
        <h2 className="mb-2 text-2xl">{t('security.sessions')}</h2>
        <p className="mb-3 text-sm text-ink/70">{t('security.sessions_text')}</p>
        <button className="btn-outline" onClick={() => void supabase.auth.signOut({ scope: 'global' }).then(() => signOut())}>
          {t('security.logout_all')}
        </button>
      </div>
    </div>
  );
}
