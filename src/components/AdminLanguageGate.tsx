import { useEffect, useState, type ReactNode } from 'react';
import { loadAdminDict, syncAdminLanguageFromProfile, useAdminLanguage } from '@/i18n/adminLanguage';
import { useAuth } from '@/store/auth';
import { translate } from '@/i18n';
import { PageSpinner } from './ui';

/** Charge les traductions admin à la demande et applique la langue enregistrée sur le compte admin. */
export function AdminLanguageGate({ children }: { children: ReactNode }) {
  const lang = useAdminLanguage((s) => s.lang);
  const loaded = useAdminLanguage((s) => !!s.dicts[s.lang] && !!s.dicts.fr);
  const profile = useAuth((s) => s.profile);
  const [failed, setFailed] = useState(false);
  const [syncedFor, setSyncedFor] = useState<string | null>(null);
  useEffect(() => {
    Promise.all([loadAdminDict(lang), loadAdminDict('fr')]).catch((e) => {
      console.error('[DOSSORA] Traductions admin indisponibles', e);
      setFailed(true);
    });
  }, [lang]);
  useEffect(() => {
    const id = profile?.id ?? null;
    syncAdminLanguageFromProfile(profile)
      .catch((e) => {
        console.error('[DOSSORA] Langue admin', e);
        setFailed(true);
      })
      .finally(() => setSyncedFor(id));
  }, [profile?.id, profile?.role, profile?.admin_language]); // eslint-disable-line react-hooks/exhaustive-deps
  // Une seule fois par connexion : on attend que la préférence du compte soit appliquée pour ne pas afficher la mauvaise langue.
  const stale = profile?.role === 'admin' && syncedFor !== profile.id && !failed;
  if (failed)
    return (
      <div className="p-10 text-center text-sm text-red-800" role="alert">
        {translate(lang, 'errors.network')}{' '}
        <button className="underline" onClick={() => window.location.reload()}>
          {translate(lang, 'common.retry')}
        </button>
      </div>
    );
  if (!loaded || stale) return <PageSpinner />;
  return <>{children}</>;
}
