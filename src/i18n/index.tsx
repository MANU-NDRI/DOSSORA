import { createContext, useCallback, useContext } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Lang } from '@/types';
import { dig, dirOf, interpolate, LANGUAGES, type Dict, type LangScope, type Vars } from './core';
import { setAdminLanguage, useAdminLanguage } from './adminLanguage';
import fr from './client/fr.json';
import en from './client/en.json';
import ar from './client/ar.json';

export { LANGUAGES };
export type { LangScope };
const clientDictionaries: Record<Lang, Dict> = { fr, en, ar };

function detectLang(): Lang {
  const n = (typeof navigator !== 'undefined' ? navigator.language : 'fr').toLowerCase();
  if (n.startsWith('ar')) return 'ar';
  if (n.startsWith('en')) return 'en';
  return 'fr';
}
interface LangState {
  lang: Lang;
  setLang: (l: Lang) => void;
}
/** Langue des CLIENTS (persistée dans localStorage). Ne concerne jamais l'administration. */
export const useLangStore = create<LangState>()(
  persist((set) => ({ lang: detectLang(), setLang: (lang) => set({ lang }) }), { name: 'dossora-lang' }),
);

/** Périmètre de traduction : déterminé par la route (/admin/* = admin) dans App.tsx. */
export const LangScopeContext = createContext<LangScope>('client');

function sources(lang: Lang, scope: LangScope): Array<Dict | undefined> {
  if (scope === 'admin') {
    const { dicts } = useAdminLanguage.getState();
    return [dicts[lang], dicts.fr, clientDictionaries.fr]; // langue admin → français → dernier recours
  }
  return [clientDictionaries[lang], clientDictionaries.fr];
}
function lookup(lang: Lang, key: string, scope: LangScope): unknown {
  for (const d of sources(lang, scope)) {
    const v = dig(d, key);
    if (v !== undefined) return v;
  }
  return undefined;
}
export function translate(lang: Lang, key: string, vars?: Vars, scope: LangScope = 'client'): string {
  const v = lookup(lang, key, scope);
  return typeof v === 'string' ? interpolate(v, vars) : key;
}

export function useT() {
  const scope = useContext(LangScopeContext);
  // Sélecteurs constants hors périmètre : un changement de langue client ne re-rend pas l'admin, et inversement.
  const clientLang = useLangStore((s) => (scope === 'client' ? s.lang : 'fr'));
  const adminLang = useAdminLanguage((s) => (scope === 'admin' ? s.lang : 'fr'));
  const adminDict = useAdminLanguage((s) => (scope === 'admin' ? s.dicts[s.lang] : undefined));
  const adminFr = useAdminLanguage((s) => (scope === 'admin' ? s.dicts.fr : undefined));
  const lang: Lang = scope === 'admin' ? adminLang : clientLang;
  const setLang = useCallback(
    (l: Lang) => {
      if (scope === 'admin') void setAdminLanguage(l);
      else useLangStore.getState().setLang(l);
    },
    [scope],
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const t = useCallback((key: string, vars?: Vars) => translate(lang, key, vars, scope), [lang, scope, adminDict, adminFr]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tr = useCallback(<T,>(key: string): T | undefined => lookup(lang, key, scope) as T | undefined, [lang, scope, adminDict, adminFr]);
  return { t, tr, lang, setLang, dir: dirOf(lang), scope };
}
