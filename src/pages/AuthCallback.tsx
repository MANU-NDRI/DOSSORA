import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Logo } from '@/components/Brand';
import { Spinner } from '@/components/ui';
import { useT } from '@/i18n';
import { reportError } from '@/lib/diagnostics';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/store/auth';

function safeNext(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/account';
  try {
    const parsed = new URL(value, window.location.origin);
    return parsed.origin === window.location.origin ? `${parsed.pathname}${parsed.search}${parsed.hash}` : '/account';
  } catch {
    return '/account';
  }
}

export default function AuthCallback() {
  const { t } = useT();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, ready, profileReady, refreshProfile } = useAuth();
  const [profileError, setProfileError] = useState(false);
  const ensureStarted = useRef(false);
  const providerError = useMemo(() => {
    const search = new URLSearchParams(location.search);
    const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
    const error = search.get('error') ?? hash.get('error');
    const description = (search.get('error_description') ?? hash.get('error_description') ?? '').toLowerCase();
    if (!error) return null;
    return error === 'access_denied' || /cancel|denied|declined/.test(description) ? 'auth.oauth_cancelled' : 'auth.oauth_failed';
  }, [location.hash, location.search]);

  useEffect(() => {
    if (providerError || profileError || !ready) return;
    if (!user) return;
    if (!profileReady) return;

    if (profile) {
      let storedNext: string | null = null;
      try {
        storedNext = sessionStorage.getItem('dossora_oauth_next');
        sessionStorage.removeItem('dossora_oauth_next');
      } catch {
        // The default destination is used when browser storage is unavailable.
      }
      const next = safeNext(storedNext);
      navigate(profile.role === 'admin' && next === '/account' ? '/admin/dashboard' : next, { replace: true });
      return;
    }

    if (ensureStarted.current) return;
    ensureStarted.current = true;
    void (async () => {
      const { error } = await supabase.rpc('ensure_profile');
      if (error) throw error;
      await refreshProfile();
      if (!useAuth.getState().profile) throw new Error('PROFILE_NOT_CREATED');
    })()
      .catch((error: unknown) => {
        reportError('Création/récupération du profil OAuth', error);
        setProfileError(true);
      });
  }, [navigate, profile, profileError, profileReady, providerError, ready, refreshProfile, user]);

  if (providerError) {
    return (
      <CallbackShell>
        <p role="alert" className="text-sm text-red-800">{t(providerError)}</p>
        <Link to="/login" className="btn-primary mt-5 w-full">{t('auth.login')}</Link>
      </CallbackShell>
    );
  }

  if (profileError) {
    return (
      <CallbackShell>
        <p role="alert" className="text-sm text-red-800">{t('auth.oauth_profile_error')}</p>
        <button type="button" className="btn-outline mt-5 w-full" onClick={() => window.location.reload()}>{t('common.retry')}</button>
      </CallbackShell>
    );
  }

  if (ready && !user) {
    return (
      <CallbackShell>
        <p role="alert" className="text-sm text-red-800">{t('auth.oauth_session_error')}</p>
        <Link to="/login" className="btn-primary mt-5 w-full">{t('auth.login')}</Link>
      </CallbackShell>
    );
  }

  return (
    <CallbackShell>
      <Spinner className="h-8 w-8" />
      <p className="mt-4 text-sm text-ink/70">{t('auth.oauth_completing')}</p>
    </CallbackShell>
  );
}

function CallbackShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="container-x flex min-h-[60vh] items-center justify-center py-10">
      <section className="card w-full max-w-md p-6 text-center sm:p-8">
        <div className="mb-5 flex justify-center"><Logo /></div>
        {children}
      </section>
    </main>
  );
}
