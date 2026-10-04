import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from './Icon';
import { FadeImage } from './FadeImage';
import { useUI } from '@/store/ui';
import { useT } from '@/i18n';
import { useCategories, useSettings } from '@/hooks/useData';
import { fetchProducts } from '@/services/catalog';
import { reportError } from '@/lib/diagnostics';
import { staggerDelay } from '@/lib/motion';
import { effectivePrice, formatMoney, loc, mainImage } from '@/lib/utils';
import type { Product } from '@/types';

const MIN_CHARS = 2;
const DEBOUNCE_MS = 300;

/** Recherche : la barre s'ouvre en douceur, le champ prend le focus, les résultats arrivent progressivement (skeleton pendant le chargement). */
export function SearchOverlay() {
  const open = useUI((s) => s.searchOpen);
  const setOpen = useUI((s) => s.setSearch);
  const { t, lang } = useT();
  const { currency } = useSettings();
  const nav = useNavigate();
  const cats = useCategories();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Product[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const term = q.trim();

  useEffect(() => {
    if (open) {
      const id = setTimeout(() => ref.current?.focus(), 60);
      return () => clearTimeout(id);
    }
  }, [open]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [setOpen]);

  // Recherche différée ; une réponse tardive d'une ancienne saisie est ignorée (pas de requêtes en boucle ni de résultats périmés).
  useEffect(() => {
    if (term.length < MIN_CHARS) {
      setResults(null);
      setLoading(false);
      setFailed(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setFailed(false);
    const id = setTimeout(() => {
      fetchProducts({ q: term, pageSize: 6, sort: 'popular' })
        .then((r) => {
          if (alive) {
            setResults(r.items);
            setLoading(false);
          }
        })
        .catch((e) => {
          reportError('Recherche', e);
          if (alive) {
            setFailed(true);
            setLoading(false);
          }
        });
    }, DEBOUNCE_MS);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [term]);

  const close = () => setOpen(false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!term) return;
    close();
    nav(`/shop?q=${encodeURIComponent(term)}`);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] bg-ink/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <motion.div
            initial={{ y: -24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -24, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 0.61, 0.36, 1] }}
            className="max-h-[92vh] overflow-y-auto bg-ivory px-4 pb-6 pt-5 shadow-soft"
            role="dialog"
            aria-modal="true"
            aria-label={t('nav.search')}
          >
            <form onSubmit={submit} role="search" className="container-x flex max-w-3xl items-center gap-3">
              <button
                type="button"
                onClick={close}
                aria-label={t('common.back')}
                className="rounded-full p-2 text-bordeaux hover:bg-bordeaux/10 sm:hidden"
              >
                <Icon name="left" className="h-5 w-5 rtl:rotate-180" />
              </button>
              <Icon name="search" className="hidden h-5 w-5 text-bordeaux sm:block" />
              <input
                ref={ref}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="input flex-1"
                placeholder={t('nav.search_placeholder')}
                aria-label={t('nav.search')}
                maxLength={80}
                enterKeyHint="search"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={close}
                aria-label={t('common.close')}
                className="hidden rounded-full p-2 text-bordeaux hover:bg-bordeaux/10 sm:block"
              >
                <Icon name="x" />
              </button>
            </form>

            <div className="container-x mt-4 max-w-3xl" aria-live="polite">
              {term.length < MIN_CHARS ? (
                <div className="flex flex-wrap gap-2">
                  {cats.data
                    .filter((c) => !c.parent_id)
                    .map((c, i) => (
                      <button
                        key={c.id}
                        className="btn-outline btn-sm animate-rise"
                        style={{ animationDelay: staggerDelay(i) }}
                        onClick={() => {
                          close();
                          nav(`/shop?category=${c.slug}`);
                        }}
                      >
                        {loc(c, 'name', lang)}
                      </button>
                    ))}
                </div>
              ) : loading ? (
                <ul aria-busy="true" className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <li key={i} className="flex items-center gap-3">
                      <div className="skeleton h-16 w-14 shrink-0 rounded-xl" />
                      <div className="flex-1 space-y-2">
                        <div className="skeleton h-3.5 w-2/3 rounded" />
                        <div className="skeleton h-3 w-1/4 rounded" />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : failed ? (
                <p role="alert" className="py-6 text-center text-sm text-ink/70">
                  {t('errors.network')}
                </p>
              ) : results && results.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="font-semibold">{t('search.no_results', { q: term })}</p>
                  <p className="mt-1 text-sm text-ink/70">{t('search.no_results_hint')}</p>
                </div>
              ) : results ? (
                <>
                  <ul className="space-y-1">
                    {results.map((p, i) => (
                      <li key={p.id} className="animate-rise" style={{ animationDelay: staggerDelay(i) }}>
                        <Link
                          to={`/product/${p.slug}`}
                          onClick={close}
                          className="flex items-center gap-3 rounded-xl p-2 transition-colors duration-fast hover:bg-white"
                        >
                          <div className="h-16 w-14 shrink-0 overflow-hidden rounded-lg bg-ivory-dark">
                            {mainImage(p) && <FadeImage src={mainImage(p) as string} alt="" className="h-full w-full object-cover" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-1 text-sm font-semibold">{loc(p, 'name', lang)}</p>
                            <p className="text-sm text-bordeaux" dir="ltr">
                              {formatMoney(effectivePrice(p), currency, lang)}
                            </p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <button type="button" onClick={submit as unknown as () => void} className="btn-primary btn-sm mt-3 w-full">
                    {t('search.see_all', { q: term })}
                  </button>
                </>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
