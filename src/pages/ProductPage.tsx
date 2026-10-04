import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Seo } from '@/components/Seo';
import { Icon } from '@/components/Icon';
import { FadeImage } from '@/components/FadeImage';
import { FavoriteButton } from '@/components/FavoriteButton';
import { ProductGrid } from '@/components/ProductCard';
import { ErrorState, NotFound, PageSpinner } from '@/components/ui';
import { useT } from '@/i18n';
import { useAsync } from '@/hooks/useAsync';
import { useSettings } from '@/hooks/useData';
import { useAddToCart } from '@/hooks/useAddToCart';
import { availableQty, fetchProductBySlug, fetchProducts } from '@/services/catalog';
import { useUI } from '@/store/ui';
import { cn, discountPct, effectivePrice, formatMoney, hasDiscount, loc, waLink } from '@/lib/utils';
import type { Product, Variant } from '@/types';

const uniq = (a: Array<string | null>) => [...new Set(a.filter((x): x is string => !!x))];

export default function ProductPage() {
  const { slug = '' } = useParams();
  const { data: product, loading, error, reload } = useAsync(() => fetchProductBySlug(slug), [slug]);
  if (loading) return <PageSpinner />;
  if (error) return <ErrorState onRetry={reload} />;
  if (!product) return <NotFound />;
  return <ProductView key={product.id} product={product} />;
}

function ProductView({ product }: { product: Product }) {
  const { t, lang } = useT();
  const nav = useNavigate();
  const { currency } = useSettings();
  const toast = useUI((s) => s.toast);
  const mediaRef = useRef<HTMLDivElement>(null);
  const addToCart = useAddToCart();
  const images = useMemo(() => [...product.product_images].sort((a, b) => a.sort_order - b.sort_order), [product]);
  const variants = product.product_variants;
  const [imgIdx, setImgIdx] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const colors = uniq(variants.map((v) => v.color));
  const sizes = uniq(variants.map((v) => v.size));
  const shoes = uniq(variants.map((v) => v.shoe_size));
  const [color, setColor] = useState(colors[0] ?? '');
  const [size, setSize] = useState(sizes[0] ?? '');
  const [shoe, setShoe] = useState(shoes[0] ?? '');
  const [qty, setQty] = useState(1);

  const variant: Variant | undefined = variants.find(
    (v) => (!colors.length || v.color === color) && (!sizes.length || v.size === size) && (!shoes.length || v.shoe_size === shoe),
  );
  const max = variant ? availableQty(variant) : 0;
  useEffect(() => {
    setQty((q) => Math.max(1, Math.min(q, Math.max(max, 1))));
  }, [max]);
  const price = variant?.price_override ?? effectivePrice(product);
  const name = loc(product, 'name', lang);
  const description = loc(product, 'description', lang);
  const url = typeof window !== 'undefined' ? window.location.href : '';

  const similar = useAsync(
    () =>
      product.category_id
        ? fetchProducts({ categoryIds: [product.category_id], pageSize: 5 }).then((r) =>
            r.items.filter((p) => p.id !== product.id).slice(0, 4),
          )
        : Promise.resolve([] as Product[]),
    [product.id],
  );

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: name, url });
      else {
        await navigator.clipboard.writeText(url);
        toast('success', t('product.link_copied'));
      }
    } catch {
      /* annulé */
    }
  };
  const onAdd = () => {
    if (variant) addToCart(product, variant, qty, mediaRef.current);
  };
  const onBuy = () => {
    if (variant && addToCart(product, variant, qty)) nav('/checkout');
  };

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description,
    sku: product.sku ?? undefined,
    image: images.map((i) => i.url),
    offers: {
      '@type': 'Offer',
      priceCurrency: currency,
      price,
      availability: product.available_stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url,
    },
  };

  const Chip = ({
    active,
    disabled,
    onClick,
    children,
  }: {
    active: boolean;
    disabled?: boolean;
    onClick: () => void;
    children: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        'min-h-[40px] rounded-full border px-4 text-sm font-medium transition',
        active ? 'border-bordeaux bg-bordeaux text-ivory' : 'border-bordeaux/25 bg-white text-ink hover:border-bordeaux',
        disabled && 'opacity-40 line-through',
      )}
    >
      {children}
    </button>
  );
  const stockLeft = (c: { color?: string; size?: string; shoe?: string }) =>
    variants.some(
      (v) =>
        (c.color === undefined || v.color === c.color) &&
        (c.size === undefined || v.size === c.size) &&
        (c.shoe === undefined || v.shoe_size === c.shoe) &&
        availableQty(v) > 0,
    );

  return (
    <div className="container-x py-6 sm:py-10">
      <Seo title={name} description={description.slice(0, 160)} image={images[0]?.url} jsonLd={jsonLd} />
      <nav aria-label="breadcrumb" className="mb-5 text-xs text-ink/60">
        <Link to="/" className="hover:text-bordeaux">
          {t('nav.home')}
        </Link>{' '}
        /{' '}
        <Link to="/shop" className="hover:text-bordeaux">
          {t('nav.shop')}
        </Link>
        {product.categories && (
          <>
            {' '}
            /{' '}
            <Link to={`/shop?category=${product.categories.slug}`} className="hover:text-bordeaux">
              {loc(product.categories, 'name', lang)}
            </Link>
          </>
        )}
      </nav>
      <div className="grid gap-8 md:grid-cols-2 lg:gap-12">
        <div>
          <div
            ref={mediaRef}
            className="relative aspect-[4/5] cursor-zoom-in overflow-hidden rounded-3xl bg-ivory-dark"
            onMouseMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
            }}
            onMouseLeave={() => setZoom(null)}
          >
            {images[imgIdx] ? (
              <FadeImage
                key={images[imgIdx].url}
                src={images[imgIdx].url}
                alt={images[imgIdx].alt || name}
                className="h-full w-full object-cover"
                style={zoom ? { transform: 'scale(1.8)', transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
              />
            ) : (
              <div className="flex h-full items-center justify-center font-display text-4xl tracking-widest text-gold">DOSSORA</div>
            )}
            {images.length > 1 && (
              <>
                <button
                  aria-label={t('common.prev')}
                  onClick={() => setImgIdx((i) => (i - 1 + images.length) % images.length)}
                  className="absolute start-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-bordeaux shadow-soft rtl:rotate-180"
                >
                  <Icon name="left" />
                </button>
                <button
                  aria-label={t('common.next')}
                  onClick={() => setImgIdx((i) => (i + 1) % images.length)}
                  className="absolute end-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-bordeaux shadow-soft rtl:rotate-180"
                >
                  <Icon name="right" />
                </button>
              </>
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {images.map((im, i) => (
                <button
                  key={im.url}
                  onClick={() => setImgIdx(i)}
                  aria-label={`${i + 1}`}
                  className={cn(
                    'h-20 w-16 shrink-0 overflow-hidden rounded-xl border-2',
                    i === imgIdx ? 'border-bordeaux' : 'border-transparent',
                  )}
                >
                  <FadeImage src={im.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          {product.categories && (
            <p className="text-xs font-semibold uppercase tracking-widest text-gold-dark">{loc(product.categories, 'name', lang)}</p>
          )}
          <h1 className="mt-1 text-3xl sm:text-4xl">{name}</h1>
          <div className="mt-3 flex flex-wrap items-baseline gap-3" dir="ltr">
            <span className="text-3xl font-semibold text-bordeaux">{formatMoney(price, currency, lang)}</span>
            {hasDiscount(product) && !variant?.price_override && (
              <>
                <span className="text-lg text-ink/50 line-through">{formatMoney(product.price, currency, lang)}</span>
                <span className="badge bg-bordeaux text-ivory">-{discountPct(product)}%</span>
              </>
            )}
          </div>
          {product.sku && <p className="mt-1 text-xs text-ink/50">SKU : {variant?.sku || product.sku}</p>}
          {description && <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-ink/80">{description}</p>}

          <div className="mt-6 space-y-5">
            {colors.length > 0 && (
              <div>
                <div className="label">
                  {t('product.color')} : <span className="font-normal text-ink">{color}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {colors.map((c) => (
                    <Chip key={c} active={c === color} disabled={!stockLeft({ color: c })} onClick={() => setColor(c)}>
                      {c}
                    </Chip>
                  ))}
                </div>
              </div>
            )}
            {sizes.length > 0 && (
              <div>
                <div className="label">{t('product.size')}</div>
                <div className="flex flex-wrap gap-2">
                  {sizes.map((s) => (
                    <Chip
                      key={s}
                      active={s === size}
                      disabled={!stockLeft({ color: colors.length ? color : undefined, size: s })}
                      onClick={() => setSize(s)}
                    >
                      {s}
                    </Chip>
                  ))}
                </div>
              </div>
            )}
            {shoes.length > 0 && (
              <div>
                <div className="label">{t('product.shoe_size')}</div>
                <div className="flex flex-wrap gap-2">
                  {shoes.map((s) => (
                    <Chip
                      key={s}
                      active={s === shoe}
                      disabled={!stockLeft({ color: colors.length ? color : undefined, shoe: s })}
                      onClick={() => setShoe(s)}
                    >
                      {s}
                    </Chip>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center gap-4">
              <div>
                <div className="label">{t('product.quantity')}</div>
                <div className="inline-flex items-center rounded-full border border-bordeaux/25 bg-white">
                  <button
                    aria-label="-"
                    className="flex h-11 w-11 items-center justify-center text-bordeaux disabled:opacity-40"
                    disabled={qty <= 1}
                    onClick={() => setQty(qty - 1)}
                  >
                    <Icon name="minus" className="h-4 w-4" />
                  </button>
                  <span className="w-10 text-center text-sm font-semibold" aria-live="polite">
                    {qty}
                  </span>
                  <button
                    aria-label="+"
                    className="flex h-11 w-11 items-center justify-center text-bordeaux disabled:opacity-40"
                    disabled={qty >= max}
                    onClick={() => setQty(qty + 1)}
                  >
                    <Icon name="plus" className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <p className={cn('mt-5 text-sm font-medium', max === 0 ? 'text-red-700' : max <= 3 ? 'text-amber-700' : 'text-emerald-700')}>
                {max === 0 ? t('product.out_of_stock') : max <= 3 ? t('product.only_n_left', { n: max }) : t('product.in_stock')}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button className="btn-primary flex-1" disabled={!variant || max < 1} onClick={onAdd}>
              <Icon name="bag" className="h-4 w-4" />
              {t('product.add_to_cart')}
            </button>
            <button className="btn-gold flex-1" disabled={!variant || max < 1} onClick={onBuy}>
              {t('product.order_now')}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <FavoriteButton productId={product.id} variant="labeled" />
            <button className="btn-outline btn-sm" onClick={() => void share()}>
              <Icon name="share" className="h-4 w-4" />
              {t('product.share')}
            </button>
            <a className="btn-outline btn-sm" target="_blank" rel="noopener noreferrer" href={waLink(t('wa.product', { name, url }))}>
              <Icon name="whatsapp" className="h-4 w-4" />
              {t('product.ask_whatsapp')}
            </a>
          </div>
          <ul className="mt-6 grid gap-2 rounded-2xl bg-ivory-dark/60 p-4 text-xs text-ink/75">
            <li className="flex items-center gap-2">
              <Icon name="truck" className="h-4 w-4 text-bordeaux" />
              {t('product.perk_delivery')}
            </li>
            <li className="flex items-center gap-2">
              <Icon name="shield" className="h-4 w-4 text-bordeaux" />
              {t('product.perk_payment')}
            </li>
            <li className="flex items-center gap-2">
              <Icon name="box" className="h-4 w-4 text-bordeaux" />
              {t('product.perk_returns')}
            </li>
          </ul>
        </div>
      </div>

      {(similar.data?.length ?? 0) > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 text-3xl">{t('product.similar')}</h2>
          <ProductGrid products={similar.data as Product[]} />
        </section>
      )}
    </div>
  );
}
