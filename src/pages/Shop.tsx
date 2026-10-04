import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Seo } from '@/components/Seo';
import { Icon } from '@/components/Icon';
import { ProductGrid, ProductGridSkeleton } from '@/components/ProductCard';
import { EmptyState, ErrorState, Modal, Spinner } from '@/components/ui';
import { useT } from '@/i18n';
import { reportError } from '@/lib/diagnostics';
import { useCategories } from '@/hooks/useData';
import { categoryIdsWithChildren, fetchProducts } from '@/services/catalog';
import { loc } from '@/lib/utils';
import type { Product } from '@/types';

const PAGE = 12;

export default function Shop() {
  const { t, lang } = useT();
  const [params, setParams] = useSearchParams();
  const cats = useCategories();
  const [items, setItems] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const q = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  const flag = (params.get('flag') ?? '') as '' | 'new' | 'sale' | 'popular' | 'featured';
  const sort = (params.get('sort') ?? 'newest') as 'newest' | 'price_asc' | 'price_desc' | 'popular';
  const min = params.get('min') ?? '';
  const max = params.get('max') ?? '';
  const stock = params.get('stock') === '1';
  const [minIn, setMinIn] = useState(min);
  const [maxIn, setMaxIn] = useState(max);
  useEffect(() => {
    setMinIn(min);
    setMaxIn(max);
  }, [min, max]);

  const set = useCallback(
    (patch: Record<string, string>) => {
      const next = new URLSearchParams(params);
      Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  const ids = useMemo(() => (category ? categoryIdsWithChildren(cats.data, category) : undefined), [cats.data, category]);

  const load = useCallback(
    async (pageNo: number, reset: boolean) => {
      if (reset) setLoading(true);
      else setMore(true);
      setError(false);
      try {
        const r = await fetchProducts({
          q,
          categoryIds: category ? (ids?.length ? ids : ['00000000-0000-0000-0000-000000000000']) : undefined,
          flag,
          sort,
          inStock: stock,
          page: pageNo,
          pageSize: PAGE,
          min: min ? Number(min) : undefined,
          max: max ? Number(max) : undefined,
        });
        setItems((prev) => (reset ? r.items : [...prev, ...r.items]));
        setTotal(r.total);
        setPage(pageNo);
      } catch (e) {
        reportError('Boutique : chargement des produits', e);
        setError(true);
      } finally {
        setLoading(false);
        setMore(false);
      }
    },
    [q, category, ids, flag, sort, stock, min, max],
  );

  useEffect(() => {
    if (category && cats.loading) return;
    void load(0, true);
  }, [load, category, cats.loading]);

  const tops = cats.data.filter((c) => !c.parent_id);
  const activeCat = cats.data.find((c) => c.slug === category);
  const title = activeCat ? loc(activeCat, 'name', lang) : flag ? t(`shop.flag_${flag}`) : q ? `“${q}”` : t('nav.shop');

  const Filters = (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 font-sans text-sm font-semibold text-bordeaux">{t('shop.categories')}</h3>
        <ul className="space-y-1 text-sm">
          <li>
            <button
              className={`w-full rounded-lg px-2 py-1.5 text-start ${!category ? 'bg-bordeaux text-ivory' : 'hover:bg-bordeaux/5'}`}
              onClick={() => set({ category: '' })}
            >
              {t('common.all')}
            </button>
          </li>
          {tops.map((c) => (
            <li key={c.id}>
              <button
                className={`w-full rounded-lg px-2 py-1.5 text-start ${category === c.slug ? 'bg-bordeaux text-ivory' : 'hover:bg-bordeaux/5'}`}
                onClick={() => set({ category: c.slug })}
              >
                {loc(c, 'name', lang)}
              </button>
              <ul className="ms-3">
                {cats.data
                  .filter((s) => s.parent_id === c.id)
                  .map((s) => (
                    <li key={s.id}>
                      <button
                        className={`w-full rounded-lg px-2 py-1 text-start text-xs ${category === s.slug ? 'bg-gold/40 font-semibold' : 'text-ink/70 hover:bg-bordeaux/5'}`}
                        onClick={() => set({ category: s.slug })}
                      >
                        {loc(s, 'name', lang)}
                      </button>
                    </li>
                  ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          set({ min: minIn, max: maxIn });
          setFiltersOpen(false);
        }}
      >
        <h3 className="mb-2 font-sans text-sm font-semibold text-bordeaux">{t('shop.price')}</h3>
        <div className="flex items-center gap-2" dir="ltr">
          <input
            className="input"
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="Min"
            aria-label="Min"
            value={minIn}
            onChange={(e) => setMinIn(e.target.value)}
          />
          <span>–</span>
          <input
            className="input"
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="Max"
            aria-label="Max"
            value={maxIn}
            onChange={(e) => setMaxIn(e.target.value)}
          />
        </div>
        <button className="btn-outline btn-sm mt-2 w-full">{t('shop.apply')}</button>
      </form>
      <div>
        <h3 className="mb-2 font-sans text-sm font-semibold text-bordeaux">{t('shop.collections')}</h3>
        <div className="flex flex-wrap gap-2">
          {(['new', 'sale', 'popular', 'featured'] as const).map((f) => (
            <button
              key={f}
              aria-pressed={flag === f}
              className={`badge !px-3 !py-1.5 ${flag === f ? 'bg-bordeaux text-ivory' : 'bg-gold/25 text-bordeaux'}`}
              onClick={() => set({ flag: flag === f ? '' : f })}
            >
              {t(`shop.flag_${f}`)}
            </button>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 accent-bordeaux"
          checked={stock}
          onChange={(e) => set({ stock: e.target.checked ? '1' : '' })}
        />
        {t('shop.in_stock_only')}
      </label>
    </div>
  );

  return (
    <div className="container-x py-8 sm:py-12">
      <Seo title={title} description={t('seo.shop_description')} />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl sm:text-5xl">{title}</h1>
          <p className="mt-1 text-sm text-ink/65">{t('shop.results', { n: total })}</p>
          <div className="gold-rule mt-3" />
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-outline btn-sm lg:hidden" onClick={() => setFiltersOpen(true)}>
            <Icon name="filter" className="h-4 w-4" />
            {t('shop.filters')}
          </button>
          <select
            className="input !w-auto !py-2"
            aria-label={t('shop.sort')}
            value={sort}
            onChange={(e) => set({ sort: e.target.value === 'newest' ? '' : e.target.value })}
          >
            <option value="newest">{t('shop.sort_newest')}</option>
            <option value="popular">{t('shop.sort_popular')}</option>
            <option value="price_asc">{t('shop.sort_price_asc')}</option>
            <option value="price_desc">{t('shop.sort_price_desc')}</option>
          </select>
        </div>
      </div>
      <div className="grid gap-8 lg:grid-cols-[250px_1fr]">
        <aside className="hidden lg:block" aria-label={t('shop.filters')}>
          {Filters}
        </aside>
        <div>
          {loading ? (
            <ProductGridSkeleton n={8} />
          ) : error ? (
            <ErrorState onRetry={() => void load(0, true)} />
          ) : items.length === 0 ? (
            <EmptyState
              title={t('shop.empty_title')}
              text={t('shop.empty_text')}
              action={
                <button className="btn-primary" onClick={() => setParams({})}>
                  {t('shop.reset')}
                </button>
              }
            />
          ) : (
            <>
              <ProductGrid products={items} />
              {items.length < total && (
                <div className="mt-10 text-center">
                  <button className="btn-outline" disabled={more} onClick={() => void load(page + 1, false)}>
                    {more ? <Spinner className="h-4 w-4" /> : t('shop.load_more')}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <Modal open={filtersOpen} onClose={() => setFiltersOpen(false)} title={t('shop.filters')}>
        {Filters}
      </Modal>
    </div>
  );
}
