import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Seo } from '@/components/Seo';
import { Field, Spinner } from '@/components/ui';
import { useT } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { errorKey } from '@/lib/errors';
import { useAuth } from '@/store/auth';

export default function AdminLogin() {
  const { t } = useT();
  const nav = useNavigate();
  const { profile, refreshProfile, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (profile?.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (err || !data.user) {
      setBusy(false);
      setError(t(errorKey(err)));
      return;
    }
    const { data: p } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
    if ((p as { role?: string } | null)?.role !== 'admin') {
      await signOut();
      setBusy(false);
      setError(t('admin.not_admin'));
      return;
    }
    await refreshProfile();
    setBusy(false);
    nav('/admin/dashboard', { replace: true });
  };
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-bordeaux p-4">
      <Seo title={t('admin.login_title')} noindex />
      <div className="absolute end-3 top-3">
        <LanguageSwitcher light />
      </div>
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-3xl bg-ivory p-7 shadow-2xl">
        <p className="text-center font-display text-3xl font-bold tracking-[0.25em] text-bordeaux" dir="ltr">
          DOSSORA
        </p>
        <div className="gold-rule mx-auto" />
        <p className="text-center text-sm text-ink/70">{t('admin.login_title')}</p>
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
            {error}
          </p>
        )}
        <Field label={t('auth.email')}>
          <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
        </Field>
        <Field label={t('auth.password')}>
          <input
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </Field>
        <button className="btn-primary w-full" disabled={busy}>
          {busy && <Spinner className="h-4 w-4" />}
          {t('auth.login')}
        </button>
        <p className="text-center text-sm">
          <Link to="/" className="link inline-flex items-center gap-1">
            <span aria-hidden className="rtl:rotate-180">
              ←
            </span>
            {t('admin.view_shop')}
          </Link>
        </p>
      </form>
    </div>
  );
}
