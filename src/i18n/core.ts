import type { Lang } from '@/types';

export type Dict = Record<string, unknown>;
export type Vars = Record<string, string | number>;
export type LangScope = 'client' | 'admin';

export const LANGUAGES: Array<{ code: Lang; label: string; flag: string }> = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
];
export const isLang = (v: unknown): v is Lang => v === 'fr' || v === 'en' || v === 'ar';
export const dirOf = (l: Lang): 'rtl' | 'ltr' => (l === 'ar' ? 'rtl' : 'ltr');

/** Lit une clé pointée ("admin.nav.orders") dans un dictionnaire imbriqué. */
export function dig(dict: Dict | undefined, key: string): unknown {
  let cur: unknown = dict;
  for (const part of key.split('.')) {
    if (cur && typeof cur === 'object' && part in (cur as Dict)) cur = (cur as Dict)[part];
    else return undefined;
  }
  return cur;
}
export const interpolate = (s: string, vars?: Vars) => (vars ? s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? '')) : s);
