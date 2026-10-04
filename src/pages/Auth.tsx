import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Seo } from '@/components/Seo';
import { Logo } from '@/components/Brand';
import { Field, Spinner } from '@/components/ui';
import { useT } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { errorKey } from '@/lib/errors';
import { isEmail } from '@/lib/utils';
import { useAuth } from '@/store/auth';
import { useUI } from '@/store/ui';

function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  const { t } = useT();
  return (
    <div className="container-x flex justify-center py-10 sm:py-16">
      <Seo title={title} noindex />
      <div className="card w-full max-w-md p-6 sm:p-8">
        <div className="mb-5 flex justify-center">
          <Logo />
        </div>
        <h1 className="text-center text-3xl">{title}</h1>
        <div className="gold-rule mx-auto mb-4 mt-3" />
        {subtitle && <p className="mb-5 text-sm text-ink/70">{subtitle}</p>}
        {children}
        {footer && <div className="mt-6 border-t border-bordeaux/10 pt-4 text-center text-sm">{footer}</div>}
        <p className="mt-4 text-center text-sm">
          <Link to="/" className="link inline-flex items-center gap-1">
            <span aria-hidden className="rtl:rotate-180">
              ←
            </span>
            {t('nav.back_home')}
          </Link>
        </p>
      </div>
    </div>
  );
}
const Err = ({ text }: { text: string | null }) =>
  text ? (
    <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
      {text}
    </p>
  ) : null;

function safeReturnPath(value: unknown): string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : '/account';
}

function SocialAuthButtons({ nextPath, disabled, onError }: { nextPath: string; disabled: boolean; onError: (message: string | null) => void }) {
  const { t } = useT();
  const [pending, setPending] = useState(false);
  const start = async () => {
    if (pending || disabled) return;
    onError(null);
    setPending(true);
    try {
      try {
        sessionStorage.setItem('dossora_oauth_next', safeReturnPath(nextPath));
      } catch {
        // The callback falls back to /account if session storage is unavailable.
      }
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (oauthError) throw oauthError;
    } catch {
      try {
        sessionStorage.removeItem('dossora_oauth_next');
      } catch {
        // Ignore unavailable browser storage.
      }
      onError(t('auth.oauth_start_error'));
      setPending(false);
    }
  };
  return (
    <>
      <div className="space-y-3">
        <button type="button" className="btn-outline flex w-full items-center justify-center gap-3" disabled={disabled || pending} onClick={() => void start()}>
          {pending ? <Spinner className="h-4 w-4" /> : <GoogleMark />}
          {t('auth.continue_google')}
        </button>
      </div>
      <div className="my-5 flex items-center gap-3 text-xs text-ink/50" aria-hidden="true">
        <span className="h-px flex-1 bg-bordeaux/15" />
        <span>{t('auth.or')}</span>
        <span className="h-px flex-1 bg-bordeaux/15" />
      </div>
    </>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5">
      <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.7c3.9-3.6 6-8.8 6-15Z" />
      <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.7-5.1c-1.8 1.2-4 1.9-6.8 1.9-5.2 0-9.6-3.5-11.2-8.2H5.9v5.2A20 20 0 0 0 24 44Z" />
      <path fill="#FBBC05" d="M12.8 27.8a12 12 0 0 1 0-7.6V15H5.9a20 20 0 0 0 0 18Z" />
      <path fill="#EA4335" d="M24 12.1c3 0 5.7 1 7.8 3.1l5.8-5.8A19.4 19.4 0 0 0 24 4 20 20 0 0 0 5.9 15l6.9 5.2c1.6-4.7 6-8.1 11.2-8.1Z" />
    </svg>
  );
}

export function Login() {
  const { t } = useT();
  const nav = useNavigate();
  const loc = useLocation();
  const user = useAuth((s) => s.user);
  const from = safeReturnPath((loc.state as { from?: string } | null)?.from);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={from} replace />;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isEmail(email)) {
      setError(t('errors.invalid_email'));
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) setError(t(errorKey(err)));
    else nav(from, { replace: true });
  };
  return (
    <AuthShell
      title={t('auth.login')}
      footer={
        <>
          {t('auth.no_account')}{' '}
          <Link className="link" to="/register" state={loc.state}>
            {t('auth.register')}
          </Link>
        </>
      }
    >
      <Err text={error} />
      <SocialAuthButtons nextPath={from} disabled={busy} onError={setError} />
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label={t('auth.email')}>
          <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
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
          <Link className="link" to="/forgot-password">
            {t('auth.forgot')}
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

export function Register() {
  const { t } = useT();
  const nav = useNavigate();
  const loc = useLocation();
  const from = safeReturnPath((loc.state as { from?: string } | null)?.from);
  const toast = useUI((s) => s.toast);
  const user = useAuth((s) => s.user);
  const [f, setF] = useState({ first_name: '', last_name: '', email: '', phone: '', password: '', confirm: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  if (user) return <Navigate to="/account" replace />;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!f.first_name.trim() || !f.last_name.trim()) {
      setError(t('checkout.required'));
      return;
    }
    if (!isEmail(f.email)) {
      setError(t('errors.invalid_email'));
      return;
    }
    if (f.password.length < 8) {
      setError(t('auth.password_short'));
      return;
    }
    if (f.password !== f.confirm) {
      setError(t('auth.password_mismatch'));
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.auth.signUp({
      email: f.email.trim(),
      password: f.password,
      options: {
        data: { first_name: f.first_name.trim(), last_name: f.last_name.trim(), phone: f.phone.trim() },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    setBusy(false);
    if (err) {
      setError(t(errorKey(err)));
      return;
    }
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setError(t('errors.email_taken'));
      return;
    }
    if (data.session) {
      toast('success', t('auth.welcome'));
      nav(from, { replace: true });
    } else setSent(true);
  };
  if (sent)
    return (
      <AuthShell title={t('auth.check_email_title')}>
        <p className="text-sm text-ink/80">{t('auth.check_email_text', { email: f.email })}</p>
        <Link to="/login" className="btn-primary mt-5 w-full">
          {t('auth.login')}
        </Link>
      </AuthShell>
    );
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <AuthShell
      title={t('auth.register')}
      subtitle={t('auth.register_hint')}
      footer={
        <>
          {t('auth.have_account')}{' '}
          <Link className="link" to="/login" state={loc.state}>
            {t('auth.login')}
          </Link>
        </>
      }
    >
      <Err text={error} />
      <SocialAuthButtons nextPath={from} disabled={busy} onError={setError} />
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`${t('auth.first_name')} *`}>
            <input className="input" value={f.first_name} onChange={set('first_name')} autoComplete="given-name" />
          </Field>
          <Field label={`${t('auth.last_name')} *`}>
            <input className="input" value={f.last_name} onChange={set('last_name')} autoComplete="family-name" />
          </Field>
        </div>
        <Field label={`${t('auth.email')} *`}>
          <input type="email" className="input" value={f.email} onChange={set('email')} autoComplete="email" />
        </Field>
        <Field label={t('auth.phone')}>
          <input type="tel" dir="ltr" className="input" value={f.phone} onChange={set('phone')} autoComplete="tel" />
        </Field>
        <Field label={`${t('auth.password')} *`} hint={t('auth.password_hint')}>
          <input type="password" className="input" value={f.password} onChange={set('password')} autoComplete="new-password" />
        </Field>
        <Field label={`${t('auth.confirm_password')} *`}>
          <input type="password" className="input" value={f.confirm} onChange={set('confirm')} autoComplete="new-password" />
        </Field>
        <button className="btn-primary w-full" disabled={busy}>
          {busy && <Spinner className="h-4 w-4" />}
          {t('auth.register')}
        </button>
      </form>
    </AuthShell>
  );
}

export function ForgotPassword() {
  const { t } = useT();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isEmail(email)) {
      setError(t('errors.invalid_email'));
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (err) setError(t(errorKey(err)));
    else setDone(true);
  };
  return (
    <AuthShell
      title={t('auth.forgot')}
      subtitle={t('auth.forgot_hint')}
      footer={
        <Link className="link" to="/login">
          {t('auth.login')}
        </Link>
      }
    >
      {done ? (
        <p role="status" className="text-sm text-emerald-800">
          {t('auth.reset_sent')}
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Err text={error} />
          <Field label={t('auth.email')}>
            <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </Field>
          <button className="btn-primary w-full" disabled={busy}>
            {busy && <Spinner className="h-4 w-4" />}
            {t('auth.send_link')}
          </button>
        </form>
      )}
    </AuthShell>
  );
}

export function ResetPassword() {
  const { t } = useT();
  const nav = useNavigate();
  const toast = useUI((s) => s.toast);
  const [ready, setReady] = useState(false);
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setReady(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((ev, s) => {
      if (ev === 'PASSWORD_RECOVERY' || s) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (p1.length < 8) {
      setError(t('auth.password_short'));
      return;
    }
    if (p1 !== p2) {
      setError(t('auth.password_mismatch'));
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password: p1 });
    setBusy(false);
    if (err) setError(t(errorKey(err)));
    else {
      toast('success', t('auth.password_updated'));
      nav('/account', { replace: true });
    }
  };
  return (
    <AuthShell title={t('auth.reset_title')}>
      {!ready ? (
        <p className="text-sm text-ink/70">
          {t('auth.reset_invalid')}{' '}
          <Link className="link" to="/forgot-password">
            {t('auth.forgot')}
          </Link>
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Err text={error} />
          <Field label={t('auth.new_password')} hint={t('auth.password_hint')}>
            <input type="password" className="input" value={p1} onChange={(e) => setP1(e.target.value)} autoComplete="new-password" />
          </Field>
          <Field label={t('auth.confirm_password')}>
            <input type="password" className="input" value={p2} onChange={(e) => setP2(e.target.value)} autoComplete="new-password" />
          </Field>
          <button className="btn-primary w-full" disabled={busy}>
            {busy && <Spinner className="h-4 w-4" />}
            {t('common.save')}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
