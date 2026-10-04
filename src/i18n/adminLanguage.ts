import { create } from 'zustand';
import type { Lang, Profile } from '@/types';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/store/auth';
import { useUI } from '@/store/ui';
import { dig, interpolate, isLang, type Dict } from './core';

/**
 * Langue de l'ADMINISTRATION — totalement indépendante de la langue des clients (useLangStore).
 *  - cache local : localStorage['dossora_admin_language'] (affichage immédiat au prochain chargement)
 *  - référence   : profiles.admin_language (Supabase), appliquée à chaque connexion admin
 * Les dictionnaires admin sont chargés à la demande (code splitting) : un client ne les télécharge jamais.
 */
export const ADMIN_LANG_KEY = 'dossora_admin_language';

const loaders: Record<Lang, () => Promise<{ default: Dict }>> = {
  fr: () => import('./admin/fr.json'),
  en: () => import('./admin/en.json'),
  ar: () => import('./admin/ar.json'),
};

function readCache(): Lang {
  try {
    const v = localStorage.getItem(ADMIN_LANG_KEY);
    return isLang(v) ? v : 'fr';
  } catch {
    return 'fr';
  }
}
function writeCache(l: Lang) {
  try {
    localStorage.setItem(ADMIN_LANG_KEY, l);
  } catch {
    /* stockage indisponible */
  }
}

interface AdminLangState {
  lang: Lang;
  dicts: Partial<Record<Lang, Dict>>;
}
export const useAdminLanguage = create<AdminLangState>(() => ({ lang: readCache(), dicts: {} }));

const pending = new Map<Lang, Promise<void>>();
export function loadAdminDict(lang: Lang): Promise<void> {
  if (useAdminLanguage.getState().dicts[lang]) return Promise.resolve();
  let p = pending.get(lang);
  if (!p) {
    p = loaders[lang]()
      .then((m) => {
        useAdminLanguage.setState((s) => ({ dicts: { ...s.dicts, [lang]: m.default } }));
      })
      .finally(() => pending.delete(lang));
    pending.set(lang, p);
  }
  return p;
}

/** Applique la langue à l'interface (sans toucher à Supabase). */
export async function applyAdminLanguage(lang: Lang): Promise<void> {
  await loadAdminDict(lang);
  writeCache(lang);
  useAdminLanguage.setState({ lang });
}

function adminText(lang: Lang, key: string): string {
  const { dicts } = useAdminLanguage.getState();
  const v = dig(dicts[lang], key) ?? dig(dicts.fr, key);
  return typeof v === 'string' ? interpolate(v) : key;
}

/** Changement de langue demandé par l'admin : interface immédiate → cache local → Supabase. */
export async function setAdminLanguage(lang: Lang): Promise<void> {
  const toast = useUI.getState().toast;
  try {
    await applyAdminLanguage(lang);
  } catch (e) {
    console.error('[DOSSORA] Chargement de la langue admin impossible', e);
    toast('error', adminText(useAdminLanguage.getState().lang, 'errors.generic'));
    return;
  }
  const { user, profile } = useAuth.getState();
  if (!user || profile?.role !== 'admin') {
    toast('success', adminText(lang, 'settings.language_changed'));
    return;
  }
  // Mise à jour optimiste du profil en mémoire pour éviter qu'une resynchronisation ne ramène l'ancienne valeur.
  useAuth.setState((s) => ({ profile: s.profile ? { ...s.profile, admin_language: lang } : s.profile }));
  const { error } = await supabase.from('profiles').update({ admin_language: lang }).eq('id', user.id);
  if (error) {
    console.error(
      '[DOSSORA] Enregistrement de la langue admin impossible (migration supabase/migrations/001_admin_language_and_hero.sql exécutée ?)',
      error,
    );
    toast('error', adminText(lang, 'settings.language_sync_failed'));
    return;
  }
  toast('success', adminText(lang, 'settings.language_changed'));
}

/** À chaque (re)connexion admin : la préférence du compte fait foi ; sinon on enregistre celle du cache local. */
export async function syncAdminLanguageFromProfile(profile: Profile | null): Promise<void> {
  if (!profile || profile.role !== 'admin') return;
  const current = useAdminLanguage.getState().lang;
  if (isLang(profile.admin_language)) {
    if (profile.admin_language !== current) await applyAdminLanguage(profile.admin_language);
    return;
  }
  const { error } = await supabase.from('profiles').update({ admin_language: current }).eq('id', profile.id);
  if (error)
    console.error('[DOSSORA] profiles.admin_language indisponible : exécutez supabase/migrations/001_admin_language_and_hero.sql', error);
  else useAuth.setState((s) => ({ profile: s.profile ? { ...s.profile, admin_language: current } : s.profile }));
}
