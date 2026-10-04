import { useEffect, useRef, useState } from 'react';
import { LANGUAGES, useT } from '@/i18n';
import { Icon } from './Icon';

/** Sélecteur de langue. Dans l'admin il agit sur la langue ADMIN, ailleurs sur la langue CLIENT (voir useT). */
export function LanguageSwitcher({ light = false }: { light?: boolean }) {
  const { lang, setLang, t, scope } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', h);
    document.addEventListener('touchstart', h);
    document.addEventListener('keydown', k);
    return () => {
      document.removeEventListener('mousedown', h);
      document.removeEventListener('touchstart', h);
      document.removeEventListener('keydown', k);
    };
  }, [open]);
  const cur = LANGUAGES.find((l) => l.code === lang);
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('nav.language')}
        className={`flex min-h-[40px] items-center gap-1.5 rounded-full px-3 text-xs font-semibold hover:bg-bordeaux/10 ${light ? 'text-ivory hover:bg-white/10' : 'text-bordeaux'}`}
      >
        <Icon name="globe" className="h-4 w-4" />
        <span>
          {cur?.flag} <span className={scope === 'admin' ? 'hidden sm:inline' : 'hidden'}>{cur?.label}</span>
          <span className={scope === 'admin' ? 'sm:hidden' : ''}>{cur?.code.toUpperCase()}</span>
        </span>
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={t('nav.language')}
          className="absolute end-0 z-50 mt-2 w-44 overflow-hidden rounded-2xl border border-bordeaux/10 bg-white py-1 shadow-soft"
        >
          {LANGUAGES.map((l) => (
            <li key={l.code}>
              <button
                role="option"
                aria-selected={l.code === lang}
                onClick={() => {
                  setOpen(false);
                  if (l.code !== lang) setLang(l.code);
                }}
                className={`flex min-h-[44px] w-full items-center gap-2 px-4 py-2.5 text-start text-sm hover:bg-ivory ${l.code === lang ? 'font-semibold text-bordeaux' : 'text-ink'}`}
              >
                <span>{l.flag}</span>
                <span className="flex-1">{l.label}</span>
                {l.code === lang && <Icon name="check" className="h-4 w-4 text-gold-dark" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
