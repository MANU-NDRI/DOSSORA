import { Link, useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { useT } from '@/i18n';
import { useRef } from 'react';
import { FadeImage } from './FadeImage';
import { FavoriteButton } from './FavoriteButton';
import { staggerDelay } from '@/lib/motion';
import { useAddToCart } from '@/hooks/useAddToCart';
import { useSettings } from '@/hooks/useData';
import { availableQty } from '@/services/catalog';
import { discountPct, effectivePrice, formatMoney, hasDiscount, loc, mainImage, cn } from '@/lib/utils';
import type { Product } from '@/types';

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const { t, lang } = useT();
  const nav = useNavigate();
  const { currency } = useSettings();
  const addToCart = useAddToCart();
  const mediaRef = useRef<HTMLDivElement>(null);
  const img = mainImage(product);
  const inStock = product.available_stock > 0;
  const name = loc(product, 'name', lang);
  const pct = discountPct(product);
  const single = product.product_variants.length === 1 ? product.product_variants[0] : null;
  const delay = staggerDelay(index);

  const onAdd = () => {
    if (single && availableQty(single) > 0) addToCart(product, single, 1, mediaRef.current);
    else nav(`/product/${product.slug}`);
  };

  return (
    // Cascade CSS (cheap) : chaque carte démarre légèrement après la précédente ; image → texte → bouton en fondu successif.
    <article className="group flex animate-rise flex-col" style={{ animationDelay: delay }}>
      <div ref={mediaRef} className="hover-lift relative aspect-[4/5] overflow-hidden rounded-2xl bg-ivory-dark">
        <Link to={`/product/${product.slug}`} aria-label={name} className="block h-full w-full">
          {img ? (
            <FadeImage
              src={img}
              alt={product.product_images[0]?.alt || name}
              loading="lazy"
              decoding="async"
              width={400}
              height={500}
              className="h-full w-full object-cover group-hover:scale-[1.04]"
            />
          ) : (
            <div className="flex h-full items-center justify-center font-display text-3xl tracking-widest text-gold">DOSSORA</div>
          )}
        </Link>
        <div className="absolute start-2 top-2 flex flex-col gap-1">
          {!inStock && <span className="badge bg-ink text-white">{t('product.out_of_stock')}</span>}
          {pct > 0 && <span className="badge bg-bordeaux text-ivory">-{pct}%</span>}
          {product.is_new && <span className="badge bg-gold text-bordeaux-dark">{t('product.new')}</span>}
        </div>
        <FavoriteButton productId={product.id} className="absolute end-2 top-2" />
      </div>
      <div className="mt-3 flex flex-1 animate-fade flex-col gap-1" style={{ animationDelay: `calc(${delay} + 140ms)` }}>
        {product.categories && <span className="text-[11px] text-gold-dark">{loc(product.categories, 'name', lang)}</span>}
        <Link
          to={`/product/${product.slug}`}
          className="line-clamp-2 text-sm font-semibold text-ink transition-colors duration-fast hover:text-bordeaux"
        >
          {name}
        </Link>
        <div className="flex items-baseline gap-2" dir="ltr">
          <span className={cn('text-base font-semibold', hasDiscount(product) ? 'text-bordeaux' : 'text-ink')}>
            {formatMoney(effectivePrice(product), currency, lang)}
          </span>
          {hasDiscount(product) && <span className="text-xs text-ink/50 line-through">{formatMoney(product.price, currency, lang)}</span>}
        </div>
        <button onClick={onAdd} disabled={!inStock} className="btn-outline btn-sm mt-2 w-full">
          <Icon name="bag" className="h-4 w-4" />
          {inStock ? (single ? t('product.add_to_cart') : t('product.choose_options')) : t('product.out_of_stock')}
        </button>
      </div>
    </article>
  );
}

/** Carte fantôme aux proportions exactes d'une carte produit (image 4:5, catégorie, nom, prix, bouton). */
export function ProductSkeleton() {
  return (
    <div aria-hidden>
      <div className="skeleton aspect-[4/5] rounded-2xl" />
      <div className="mt-3 flex flex-col gap-1.5">
        <div className="skeleton h-2.5 w-1/4 rounded" />
        <div className="skeleton h-3.5 w-4/5 rounded" />
        <div className="skeleton h-4 w-1/3 rounded" />
        <div className="skeleton mt-2 h-9 w-full rounded-full" />
      </div>
    </div>
  );
}

const GRID = 'grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4';
export function ProductGridSkeleton({ n = 8 }: { n?: number }) {
  const { t } = useT();
  return (
    <div className={GRID} role="status" aria-label={t('common.loading')}>
      {Array.from({ length: n }, (_, i) => (
        <ProductSkeleton key={i} />
      ))}
    </div>
  );
}
export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className={GRID}>
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} index={i} />
      ))}
    </div>
  );
}
