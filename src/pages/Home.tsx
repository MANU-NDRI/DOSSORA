import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Seo } from '@/components/Seo';
import { Icon, type IconName } from '@/components/Icon';
import { ProductGrid, ProductGridSkeleton } from '@/components/ProductCard';
import { ErrorState } from '@/components/ui';
import { useT } from '@/i18n';
import { useAsync } from '@/hooks/useAsync';
import { useCategories, useCountries } from '@/hooks/useData';
import { fetchBanners, fetchProducts, type ProductQuery } from '@/services/catalog';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/store/auth';
import { reportError } from '@/lib/diagnostics';
import { errorKey } from '@/lib/errors';
import { useUI } from '@/store/ui';
import { isEmail, loc } from '@/lib/utils';
import type { Banner } from '@/types';

function Hero() {
  const { t, lang } = useT();
  const user = useAuth((s) => s.user);
  const { data, loading } = useAsync(fetchBanners, []);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  // Contenu par défaut (aucune bannière publiée ou base indisponible) : l'erreur éventuelle est déjà journalisée par useAsync.
  const banners: Banner[] =
    data && data.length
      ? data
      : [
          {
            id: 'default',
            title_fr: t('home.hero_title'),
            title_en: t('home.hero_title'),
            title_ar: t('home.hero_title'),
            subtitle_fr: t('home.hero_subtitle'),
            subtitle_en: t('home.hero_subtitle'),
            subtitle_ar: t('home.hero_subtitle'),
            button_label_fr: t('home.hero_cta'),
            button_label_en: t('home.hero_cta'),
            button_label_ar: t('home.hero_cta'),
            link_url: '/shop',
            image_desktop_url: '/demo/banner-1.svg',
            image_mobile_url: '/demo/banner-1-m.svg',
            sort_order: 0,
            is_active: true,
          },
        ];
  useEffect(() => {
    if (paused || banners.length < 2) return;
    const id = setInterval(() => setI((x) => (x + 1) % banners.length), 6500);
    return () => clearInterval(id);
  }, [paused, banners.length]);
  if (loading)
    return (
      <section
        className="h-[68vh] min-h-[440px] max-h-[720px] animate-pulse bg-bordeaux"
        aria-busy="true"
        aria-label={t('common.loading')}
      />
    );
  const b = banners[i % banners.length];
  const light = !(b.image_desktop_url ?? '').includes('banner-3');
  const primary = { to: b.link_url || '/shop', label: loc(b, 'button_label', lang) || t('home.hero_cta') };
  const secondary = { to: b.link2_url || '/shop?flag=new', label: loc(b, 'button2_label', lang) || t('home.hero_cta2') };
  const text = loc(b, 'text', lang);
  return (
    <section
      className="relative overflow-hidden bg-bordeaux"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="DOSSORA"
    >
      <div className="relative h-[72vh] min-h-[480px] max-h-[760px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={b.id}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <picture>
              {b.image_mobile_url && <source media="(max-width: 767px)" srcSet={b.image_mobile_url} />}
              <img
                src={b.image_desktop_url || b.image_mobile_url || ''}
                alt=""
                decoding="async"
                className="h-full w-full object-cover"
                {...{ fetchpriority: 'high' }}
              />
            </picture>
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `linear-gradient(to ${lang === 'ar' ? 'left' : 'right'}, ${light ? 'rgba(92,23,48,.88), rgba(92,23,48,.4), rgba(92,23,48,.1)' : 'rgba(248,243,234,.88), rgba(248,243,234,.35), transparent'})`,
              }}
            />
            <div className="container-x relative flex h-full items-center py-10">
              <div className="max-w-xl">
                <p className={`font-display text-sm font-bold tracking-[0.5em] ${light ? 'text-gold-light' : 'text-bordeaux'}`} dir="ltr">
                  DOSSORA
                </p>
                <div className="mb-4 mt-2 h-px w-16 bg-gold" />
                <h1 className={`text-4xl font-semibold leading-[1.08] sm:text-6xl lg:text-7xl ${light ? '!text-ivory' : ''}`}>
                  {loc(b, 'title', lang)}
                </h1>
                {loc(b, 'subtitle', lang) && (
                  <p className={`mt-4 max-w-md text-base sm:text-lg ${light ? 'text-ivory/90' : 'text-ink/80'}`}>
                    {loc(b, 'subtitle', lang)}
                  </p>
                )}
                {text && <p className={`mt-2 max-w-md text-sm ${light ? 'text-ivory/80' : 'text-ink/70'}`}>{text}</p>}
                <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Link to={primary.to} className="btn-gold px-7">
                    {primary.label}
                  </Link>
                  <Link
                    to={secondary.to}
                    className={`btn px-7 ${light ? 'border border-ivory/70 text-ivory hover:bg-white/10' : 'border border-bordeaux text-bordeaux hover:bg-bordeaux/10'}`}
                  >
                    {secondary.label}
                  </Link>
                </div>
                {!user && (
                  <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-semibold">
                    <Link to="/register" className={`underline-offset-4 hover:underline ${light ? 'text-ivory' : 'text-bordeaux'}`}>
                      {t('auth.register_cta')}
                    </Link>
                    <Link to="/login" className={`underline-offset-4 hover:underline ${light ? 'text-ivory' : 'text-bordeaux'}`}>
                      {t('auth.login_cta')}
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
      {banners.length > 1 && (
        <div className="absolute inset-x-0 bottom-4 flex justify-center gap-2">
          {banners.map((x, n) => (
            <button
              key={x.id}
              onClick={() => setI(n)}
              aria-label={`${n + 1}`}
              aria-current={n === i % banners.length}
              className={`h-2 rounded-full transition-all ${n === i % banners.length ? 'w-8 bg-gold' : 'w-2 bg-ivory/60'}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function SectionTitle({ title, sub, to }: { title: string; sub?: string; to?: string }) {
  const { t } = useT();
  return (
    <div className="mb-7 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-3xl sm:text-4xl">{title}</h2>
        {sub && <p className="mt-1 text-sm text-ink/65">{sub}</p>}
        <div className="gold-rule mt-3" />
      </div>
      {to && (
        <Link to={to} className="link shrink-0 text-sm">
          {t('common.see_all')}
        </Link>
      )}
    </div>
  );
}

function ProductSection({ title, sub, query, to, band }: { title: string; sub?: string; query: ProductQuery; to: string; band?: boolean }) {
  const { t } = useT();
  const { data, loading, error, reload } = useAsync(() => fetchProducts(query), [JSON.stringify(query)]);
  if (!loading && !error && (data?.items.length ?? 0) === 0) return null;
  return (
    <section className={band ? 'mt-16 bg-bordeaux/[0.06] py-14' : 'mt-16'}>
      <div className="container-x">
        <SectionTitle title={title} sub={sub} to={to} />
        {loading ? (
          <ProductGridSkeleton n={query.pageSize ?? 4} />
        ) : error ? (
          <ErrorState onRetry={reload} text={t('errors.network')} />
        ) : (
          <ProductGrid products={data?.items ?? []} />
        )}
      </div>
    </section>
  );
}

function Newsletter() {
  const { t } = useT();
  const toast = useUI((s) => s.toast);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isEmail(email)) {
      toast('error', t('errors.invalid_email'));
      return;
    }
    setBusy(true);
    const { error } = await supabase.from('newsletter_subscribers').insert({ email: email.trim().toLowerCase() });
    setBusy(false);
    if (error && !/duplicate|23505/.test(`${error.code} ${error.message}`)) {
      reportError('Newsletter', error);
      toast('error', t(errorKey(error)));
    } else {
      toast('success', t('home.newsletter_ok'));
      setEmail('');
    }
  };
  return (
    <section className="mt-16">
      <div className="container-x">
        <div className="rounded-3xl bg-bordeaux px-6 py-12 text-center sm:px-12">
          <h2 className="!text-ivory text-3xl sm:text-4xl">{t('home.newsletter_title')}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ivory/75">{t('home.newsletter_text')}</p>
          <form onSubmit={submit} className="mx-auto mt-6 flex max-w-md flex-col gap-2 sm:flex-row">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label={t('auth.email')}
              placeholder={t('auth.email')}
              className="input flex-1 !border-transparent"
              dir="ltr"
            />
            <button className="btn-gold" disabled={busy}>
              {t('home.newsletter_cta')}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { t, tr, lang } = useT();
  const cats = useCategories();
  const countries = useCountries();
  const advantages: Array<[IconName, string, string]> = [
    ['truck', t('home.adv1_title'), t('home.adv1_text')],
    ['shield', t('home.adv2_title'), t('home.adv2_text')],
    ['box', t('home.adv3_title'), t('home.adv3_text')],
    ['whatsapp', t('home.adv4_title'), t('home.adv4_text')],
  ];
  const testimonials = tr<Array<{ name: string; text: string }>>('home.testimonials') ?? [];
  return (
    <>
      <Seo
        title={t('brand.slogan')}
        description={t('seo.home_description')}
        image="/demo/banner-1.svg"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'DOSSORA',
          slogan: t('brand.slogan'),
          email: 'dossorashop@gmail.com',
          url: typeof window !== 'undefined' ? window.location.origin : '',
        }}
      />
      <Hero />
      <section className="container-x mt-14">
        <SectionTitle title={t('home.categories')} to="/shop" />
        <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-5">
          {cats.data
            .filter((c) => !c.parent_id)
            .map((c) => (
              <Link
                key={c.id}
                to={`/shop?category=${c.slug}`}
                className="group relative aspect-[4/5] overflow-hidden rounded-2xl bg-ivory-dark"
              >
                {c.image_url && (
                  <img
                    src={c.image_url}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-bordeaux-dark/90 to-transparent p-4 pt-12">
                  <span className="font-display text-2xl text-ivory">{loc(c, 'name', lang)}</span>
                </div>
              </Link>
            ))}
        </div>
      </section>
      <ProductSection
        title={t('home.new_arrivals')}
        sub={t('home.new_arrivals_sub')}
        query={{ flag: 'new', pageSize: 4 }}
        to="/shop?flag=new"
      />
      <ProductSection title={t('home.popular')} query={{ flag: 'popular', pageSize: 4, sort: 'popular' }} to="/shop?flag=popular" />
      <ProductSection
        title={t('home.promotions')}
        sub={t('home.promotions_sub')}
        query={{ flag: 'sale', pageSize: 4 }}
        to="/shop?flag=sale"
        band
      />
      <ProductSection
        title={t('home.collections')}
        sub={t('home.collections_sub')}
        query={{ flag: 'featured', pageSize: 4 }}
        to="/shop?flag=featured"
      />
      <section className="container-x mt-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {advantages.map(([icon, title, text]) => (
            <div key={title} className="card flex gap-4 p-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold/25 text-bordeaux">
                <Icon name={icon} />
              </span>
              <div>
                <h3 className="font-sans text-sm font-semibold text-bordeaux">{title}</h3>
                <p className="mt-1 text-xs text-ink/70">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="container-x mt-16">
        <SectionTitle title={t('home.delivery_title')} sub={t('home.delivery_sub')} />
        <div className="flex flex-wrap gap-2">
          {countries.data.map((c) => (
            <span key={c.code} className="rounded-full border border-bordeaux/20 bg-white px-4 py-2 text-sm text-bordeaux">
              {loc(c, 'name', lang)}
              {c.eta_min_days ? (
                <span className="text-ink/55">
                  {' '}
                  · {c.eta_min_days}-{c.eta_max_days ?? c.eta_min_days} {t('common.days')}
                </span>
              ) : null}
            </span>
          ))}
        </div>
        <h3 className="mt-10 font-sans text-sm font-semibold text-bordeaux">{t('home.payment_title')}</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {['CIH Bank', 'Wafacash', 'Western Union', 'MoneyGram', 'Wave', t('home.bank_transfer'), t('home.cod_morocco')].map((m) => (
            <span key={m} className="rounded-full bg-gold/25 px-4 py-2 text-xs font-semibold text-bordeaux">
              {m}
            </span>
          ))}
        </div>
      </section>
      {testimonials.length > 0 && (
        <section className="container-x mt-16">
          <SectionTitle title={t('home.testimonials_title')} />
          <div className="grid gap-4 md:grid-cols-3">
            {testimonials.map((x) => (
              <figure key={x.name} className="card p-6">
                <div className="mb-3 flex gap-0.5 text-gold">
                  {[0, 1, 2, 3, 4].map((n) => (
                    <Icon key={n} name="star" filled className="h-4 w-4" />
                  ))}
                </div>
                <blockquote className="text-sm leading-relaxed text-ink/80">{x.text}</blockquote>
                <figcaption className="mt-4 text-sm font-semibold text-bordeaux">{x.name}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
      <Newsletter />
    </>
  );
}
