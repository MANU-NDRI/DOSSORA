import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Seo } from '@/components/Seo';
import { Icon } from '@/components/Icon';
import { EmptyState } from '@/components/ui';
import { useT } from '@/i18n';
import { useSettings } from '@/hooks/useData';
import { supabase } from '@/lib/supabase';
import { errorKey } from '@/lib/errors';
import { cartSubtotal, useCart } from '@/store/cart';
import { useAuth } from '@/store/auth';
import { formatMoney } from '@/lib/utils';

export default function CartPage() {
  const { t, lang } = useT();
  const { currency } = useSettings();
  const { items, setQuantity, remove, promoCode, setPromo } = useCart();
  const user = useAuth((s) => s.user);
  const subtotal = cartSubtotal(items);
  const [code, setCode] = useState(promoCode);
  const [discount, setDiscount] = useState<number | null>(promoCode ? null : 0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const applyPromo = async () => {
    if (!code.trim()) return;
    if (!user) {
      setMsg({ ok: false, text: t('cart.promo_login') });
      return;
    }
    setBusy(true);
    setMsg(null);
    const { data, error } = await supabase.rpc('validate_discount', { p_code: code.trim(), p_subtotal: subtotal });
    setBusy(false);
    if (error) {
      setPromo('');
      setDiscount(0);
      setMsg({ ok: false, text: t(errorKey(error)) });
      return;
    }
    const amount = Number((data as { amount: number }).amount);
    setPromo((data as { code: string }).code);
    setDiscount(amount);
    setMsg({ ok: true, text: t('cart.promo_applied', { amount: formatMoney(amount, currency, lang) }) });
  };
  const clearPromo = () => {
    setPromo('');
    setCode('');
    setDiscount(0);
    setMsg(null);
  };

  if (!items.length) {
    return (
      <div className="container-x py-10">
        <Seo title={t('nav.cart')} noindex />
        <EmptyState
          title={t('cart.empty_title')}
          text={t('cart.empty_text')}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link to="/shop" className="btn-primary">
                {t('cart.discover')}
              </Link>
              <Link to="/" className="btn-outline">
                {t('nav.back_home')}
              </Link>
            </div>
          }
        />
      </div>
    );
  }
  const disc = promoCode ? (discount ?? 0) : 0;
  return (
    <div className="container-x py-8 sm:py-12">
      <Seo title={t('nav.cart')} noindex />
      <h1 className="text-3xl sm:text-4xl">{t('nav.cart')}</h1>
      <div className="gold-rule mb-8 mt-3" />
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <ul className="space-y-4">
          <AnimatePresence initial={false}>
            {items.map((i) => (
              <motion.li
                key={i.variantId}
                layout="position"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: lang === 'ar' ? 40 : -40, transition: { duration: 0.2 } }}
                transition={{ duration: 0.25 }}
                className="card flex gap-4 p-3 sm:p-4"
              >
                <Link to={`/product/${i.slug}`} className="h-28 w-24 shrink-0 overflow-hidden rounded-xl bg-ivory-dark">
                  {i.image && <img src={i.image} alt="" loading="lazy" className="h-full w-full object-cover" />}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <Link to={`/product/${i.slug}`} className="line-clamp-2 font-semibold hover:text-bordeaux">
                    {i.names[lang]}
                  </Link>
                  <p className="mt-0.5 text-xs text-ink/60">{[i.color, i.size, i.shoeSize].filter(Boolean).join(' · ')}</p>
                  <p className="mt-1 text-sm font-semibold text-bordeaux" dir="ltr">
                    {formatMoney(i.price, currency, lang)}
                  </p>
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <div className="inline-flex items-center rounded-full border border-bordeaux/25">
                      <button
                        aria-label="-"
                        className="flex h-9 w-9 items-center justify-center text-bordeaux disabled:opacity-40"
                        disabled={i.quantity <= 1}
                        onClick={() => setQuantity(i.variantId, i.quantity - 1)}
                      >
                        <Icon name="minus" className="h-4 w-4" />
                      </button>
                      <span className="w-8 text-center text-sm font-semibold">{i.quantity}</span>
                      <button
                        aria-label="+"
                        className="flex h-9 w-9 items-center justify-center text-bordeaux disabled:opacity-40"
                        disabled={i.quantity >= i.maxStock}
                        onClick={() => setQuantity(i.variantId, i.quantity + 1)}
                      >
                        <Icon name="plus" className="h-4 w-4" />
                      </button>
                    </div>
                    <button
                      onClick={() => remove(i.variantId)}
                      className="flex items-center gap-1 text-xs text-red-700 hover:underline"
                      aria-label={t('common.remove')}
                    >
                      <Icon name="trash" className="h-4 w-4" />
                      {t('common.remove')}
                    </button>
                  </div>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        <aside className="card h-fit space-y-4 p-5 lg:sticky lg:top-28">
          <h2 className="text-2xl">{t('cart.summary')}</h2>
          <div>
            <label htmlFor="promo" className="label">
              {t('cart.promo_code')}
            </label>
            <div className="flex gap-2">
              <input
                id="promo"
                className="input uppercase"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="DOSSORA10"
                disabled={!!promoCode}
              />
              {promoCode ? (
                <button className="btn-outline btn-sm" onClick={clearPromo}>
                  {t('common.remove')}
                </button>
              ) : (
                <button className="btn-outline btn-sm" disabled={busy} onClick={() => void applyPromo()}>
                  {t('cart.apply')}
                </button>
              )}
            </div>
            {msg && (
              <p role="status" className={`mt-1 text-xs font-medium ${msg.ok ? 'text-emerald-700' : 'text-red-700'}`}>
                {msg.text}
              </p>
            )}
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt>{t('cart.subtotal')}</dt>
              <dd key={subtotal} className="animate-fade" dir="ltr">
                {formatMoney(subtotal, currency, lang)}
              </dd>
            </div>
            {disc > 0 && (
              <div className="flex justify-between text-emerald-700">
                <dt>{t('cart.discount')}</dt>
                <dd dir="ltr">-{formatMoney(disc, currency, lang)}</dd>
              </div>
            )}
            <div className="flex justify-between text-ink/60">
              <dt>{t('cart.shipping')}</dt>
              <dd>{t('cart.shipping_next')}</dd>
            </div>
            <div className="flex justify-between border-t border-bordeaux/10 pt-3 text-lg font-semibold text-bordeaux">
              <dt>{t('cart.total_estimate')}</dt>
              <dd key={subtotal - disc} className="animate-fade" dir="ltr">
                {formatMoney(Math.max(subtotal - disc, 0), currency, lang)}
              </dd>
            </div>
          </dl>
          <Link to={user ? '/checkout' : '/login'} state={{ from: '/checkout' }} className="btn-primary w-full">
            {user ? t('cart.checkout') : t('cart.login_to_order')}
          </Link>
          <Link to="/shop" className="btn-ghost w-full">
            {t('cart.continue')}
          </Link>
          <Link to="/" className="btn-ghost w-full">
            {t('nav.back_home')}
          </Link>
        </aside>
      </div>
    </div>
  );
}
