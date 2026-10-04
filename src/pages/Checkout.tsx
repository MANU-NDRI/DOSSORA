import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Seo } from '@/components/Seo';
import { Icon } from '@/components/Icon';
import { CountryCitySelect } from '@/components/CountryCitySelect';
import { LocationConsent } from '@/components/LocationConsent';
import { useGeolocation } from '@/hooks/useGeolocation';
import { attachOrderLocation } from '@/services/geolocation';
import { reportError } from '@/lib/diagnostics';
import { EmptyState, Field, Spinner } from '@/components/ui';
import { useT } from '@/i18n';
import { useCities, useCountries, usePaymentMethods, useSettings } from '@/hooks/useData';
import { fetchShippingPricing, quoteShipping } from '@/services/shipping';
import { supabase } from '@/lib/supabase';
import { errorKey } from '@/lib/errors';
import { cartSubtotal, useCart } from '@/store/cart';
import { useAuth } from '@/store/auth';
import { useUI } from '@/store/ui';
import { cn, formatMoney, isEmail, loc } from '@/lib/utils';
import type { Address } from '@/types';

const STEPS = ['country', 'city', 'address', 'info', 'delivery', 'payment', 'summary'] as const;
type Step = (typeof STEPS)[number];

export default function Checkout() {
  const { t, lang } = useT();
  const nav = useNavigate();
  const toast = useUI((s) => s.toast);
  const { currency } = useSettings();
  const { items, promoCode, clear, setPromo } = useCart();
  const { user, profile } = useAuth();
  const countries = useCountries();
  const methods = usePaymentMethods();
  const [step, setStep] = useState(0);
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const cities = useCities(country);
  const [address, setAddress] = useState('');
  const [postal, setPostal] = useState('');
  const [f, setF] = useState({ first_name: '', last_name: '', email: '', phone: '', notes: '' });
  const [payment, setPayment] = useState('');
  const [saved, setSaved] = useState<Address[]>([]);
  const [cityFeeState, setCityFeeState] = useState<{
    key: string;
    loading: boolean;
    error: boolean;
    country: (typeof countries.data)[number] | null;
    cityFee: number | null;
  }>({ key: '', loading: false, error: false, country: null, cityFee: null });
  const [cityFeeRetry, setCityFeeRetry] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const geo = useGeolocation();

  const subtotal = cartSubtotal(items);
  const listedCountry = countries.data.find((x) => x.code === country);
  const cityFeeKey = country && city ? `${country}:${city}` : '';
  const cityFeeLoading = Boolean(cityFeeKey) && (cityFeeState.key !== cityFeeKey || cityFeeState.loading);
  const cityFeeError = Boolean(cityFeeKey) && cityFeeState.key === cityFeeKey && cityFeeState.error;
  const pricing = cityFeeState.key === cityFeeKey && !cityFeeLoading && !cityFeeError ? cityFeeState : null;
  const c = pricing?.country ?? listedCountry;

  useEffect(() => {
    setF((p) => ({
      ...p,
      first_name: p.first_name || profile?.first_name || '',
      last_name: p.last_name || profile?.last_name || '',
      email: p.email || profile?.email || user?.email || '',
      phone: p.phone || profile?.phone || '',
    }));
  }, [profile, user]);
  useEffect(() => {
    if (!user) return;
    void supabase
      .from('addresses')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .then(({ data }) => setSaved((data ?? []) as Address[]));
  }, [user]);
  useEffect(() => {
    let current = true;
    if (!cityFeeKey) {
      setCityFeeState({ key: '', loading: false, error: false, country: null, cityFee: null });
      return () => {
        current = false;
      };
    }
    setCityFeeState({ key: cityFeeKey, loading: true, error: false, country: null, cityFee: null });
    void fetchShippingPricing(country, city)
      .then((freshPricing) => {
        if (current) setCityFeeState({ key: cityFeeKey, loading: true, error: false, ...freshPricing });
      })
      .catch((feeError) => {
        reportError('Lecture du tarif de livraison par ville', feeError);
        if (current) setCityFeeState({ key: cityFeeKey, loading: false, error: true, country: null, cityFee: null });
      })
      .finally(() => {
        if (current) setCityFeeState((state) => ({ ...state, loading: false }));
      });
    return () => {
      current = false;
    };
  }, [country, city, cityFeeKey, cityFeeRetry]);
  useEffect(() => {
    if (!promoCode) {
      setDiscount(0);
      return;
    }
    void supabase.rpc('validate_discount', { p_code: promoCode, p_subtotal: subtotal }).then(({ data, error }) => {
      if (error) {
        setPromo('');
        setDiscount(0);
      } else setDiscount(Number((data as { amount: number }).amount));
    });
  }, [promoCode, subtotal, setPromo]);

  const quote = pricing?.country ? quoteShipping(pricing.country, pricing.cityFee, Math.max(subtotal - discount, 0)) : null;
  const total = Math.max(subtotal - discount, 0) + (quote?.fee ?? 0);
  const availableMethods = useMemo(() => methods.data.filter((m) => !m.morocco_only || country === 'MA'), [methods.data, country]);
  useEffect(() => {
    if (payment && !availableMethods.some((m) => m.code === payment)) setPayment('');
  }, [availableMethods, payment]);

  if (!items.length)
    return (
      <div className="container-x py-10">
        <EmptyState
          title={t('cart.empty_title')}
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

  const validate = (s: Step): Record<string, string> => {
    const e: Record<string, string> = {};
    if (s === 'country' && !country) e.country = t('checkout.required');
    if (s === 'city' && !city) e.city = t('checkout.required');
    if (s === 'address' && address.trim().length < 5) e.address = t('checkout.address_short');
    if (s === 'info') {
      if (!f.first_name.trim()) e.first_name = t('checkout.required');
      if (!f.last_name.trim()) e.last_name = t('checkout.required');
      if (!isEmail(f.email)) e.email = t('errors.invalid_email');
      if (f.phone.replace(/\D/g, '').length < 8) e.phone = t('checkout.phone_invalid');
    }
    if (s === 'payment' && !payment) e.payment = t('checkout.choose_payment');
    return e;
  };
  const next = () => {
    const e = validate(STEPS[step]);
    setErrs(e);
    if (Object.keys(e).length === 0) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => {
    setErrs({});
    setStep((s) => Math.max(s - 1, 0));
  };

  const submit = async () => {
    if (!accepted) {
      setErrs({ accepted: t('checkout.accept_required') });
      return;
    }
    if (!quote) {
      setStep(STEPS.indexOf('delivery'));
      toast('error', t('checkout.shipping_quote_error'));
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc('create_order', {
      p: {
        items: items.map((i) => ({ variant_id: i.variantId, quantity: i.quantity })),
        country_code: country,
        city,
        address: address.trim(),
        postal_code: postal.trim() || null,
        first_name: f.first_name.trim(),
        last_name: f.last_name.trim(),
        email: f.email.trim(),
        phone: f.phone.trim(),
        notes: f.notes.trim() || null,
        payment_method: payment,
        promo_code: promoCode || null,
      },
    });
    setBusy(false);
    if (error) {
      toast('error', t(errorKey(error)));
      return;
    }
    const orderId = (data as { id: string }).id;
    // Position facultative : un échec d'enregistrement ne doit jamais empêcher ni retarder la confirmation de la commande.
    if (geo.location)
      await attachOrderLocation(orderId, geo.location).catch((e) => reportError('Position de livraison non enregistrée', e));
    clear();
    nav(`/account/orders/${orderId}?confirmed=1`, { replace: true });
  };

  const stepLabel = (s: Step) => t(`checkout.step_${s}`);
  const pm = availableMethods.find((m) => m.code === payment);

  return (
    <div className="container-x py-8 sm:py-12">
      <Seo title={t('checkout.title')} noindex />
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <Link to="/cart" className="link">
          ← {t('checkout.back_to_cart')}
        </Link>
        <Link to="/" className="link">
          {t('nav.back_home')}
        </Link>
      </div>
      <h1 className="text-3xl sm:text-4xl">{t('checkout.title')}</h1>
      <div className="gold-rule mb-6 mt-3" />
      <div
        className="mb-3 h-1 overflow-hidden rounded-full bg-bordeaux/10"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={STEPS.length}
        aria-valuenow={step + 1}
      >
        <div
          className="h-full origin-left bg-gradient-to-r from-bordeaux to-gold transition-transform duration-slow ease-dossora rtl:origin-right"
          style={{ transform: `scaleX(${(step + 1) / STEPS.length})` }}
        />
      </div>
      <ol className="mb-8 flex gap-1 overflow-x-auto pb-2" aria-label={t('checkout.title')}>
        {STEPS.map((s, i) => (
          <li
            key={s}
            aria-current={i === step ? 'step' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors duration-normal',
              i === step ? 'bg-bordeaux text-ivory' : i < step ? 'bg-gold/30 text-bordeaux' : 'bg-white text-ink/50',
            )}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/25 text-[10px]">{i < step ? '✓' : i + 1}</span>
            {stepLabel(s)}
          </li>
        ))}
      </ol>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="card p-5 sm:p-7">
          <div key={step} className="animate-rise">
            <h2 className="mb-5 text-2xl">{stepLabel(STEPS[step])}</h2>

            {STEPS[step] === 'country' && (
              <div className="max-w-md space-y-4">
                <p className="text-sm text-ink/70">{t('checkout.country_hint')}</p>
                <Field label={`${t('geo.country')} *`} error={errs.country}>
                  <select
                    className="input"
                    value={country}
                    onChange={(e) => {
                      setCountry(e.target.value);
                      setCity('');
                    }}
                  >
                    <option value="">{t('geo.select_country')}</option>
                    {countries.data.map((x) => (
                      <option key={x.code} value={x.code}>
                        {loc(x, 'name', lang)}
                      </option>
                    ))}
                  </select>
                </Field>
                {countries.loading && <Spinner className="h-5 w-5" />}
              </div>
            )}

            {STEPS[step] === 'city' && (
              <div className="max-w-md space-y-4">
                <CountryCitySelect
                  country={country}
                  city={city}
                  onChange={(v) => {
                    setCountry(v.country);
                    setCity(v.city);
                  }}
                  errors={{ city: errs.city }}
                />
                {country && !cities.loading && cities.data.length === 0 && (
                  <p className="text-sm text-amber-800">{t('errors.CITY_UNAVAILABLE')}</p>
                )}
              </div>
            )}

            {STEPS[step] === 'address' && (
              <div className="max-w-xl space-y-4">
                {saved.length > 0 && (
                  <Field label={t('checkout.saved_addresses')}>
                    <select
                      className="input"
                      defaultValue=""
                      onChange={(e) => {
                        const a = saved.find((x) => x.id === e.target.value);
                        if (!a) return;
                        setCountry(a.country_code);
                        setCity(a.city);
                        setAddress(a.address);
                        setPostal(a.postal_code ?? '');
                        if (a.phone) setF((p) => ({ ...p, phone: a.phone as string }));
                      }}
                    >
                      <option value="">—</option>
                      {saved.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label || a.address} — {a.city}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                <Field label={`${t('checkout.address')} *`} error={errs.address}>
                  <textarea
                    className="input min-h-[90px]"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    maxLength={300}
                    autoComplete="street-address"
                  />
                </Field>
                <Field label={t('checkout.postal_code')}>
                  <input
                    className="input"
                    value={postal}
                    onChange={(e) => setPostal(e.target.value)}
                    maxLength={12}
                    autoComplete="postal-code"
                    inputMode="text"
                  />
                </Field>
                <LocationConsent geo={geo} />
              </div>
            )}

            {STEPS[step] === 'info' && (
              <div className="grid max-w-xl gap-4 sm:grid-cols-2">
                <Field label={`${t('auth.first_name')} *`} error={errs.first_name}>
                  <input
                    className="input"
                    value={f.first_name}
                    onChange={(e) => setF({ ...f, first_name: e.target.value })}
                    autoComplete="given-name"
                  />
                </Field>
                <Field label={`${t('auth.last_name')} *`} error={errs.last_name}>
                  <input
                    className="input"
                    value={f.last_name}
                    onChange={(e) => setF({ ...f, last_name: e.target.value })}
                    autoComplete="family-name"
                  />
                </Field>
                <Field label={`${t('auth.email')} *`} error={errs.email}>
                  <input
                    type="email"
                    className="input"
                    value={f.email}
                    onChange={(e) => setF({ ...f, email: e.target.value })}
                    autoComplete="email"
                  />
                </Field>
                <Field label={`${t('auth.phone')} *`} error={errs.phone}>
                  <input
                    type="tel"
                    className="input"
                    dir="ltr"
                    value={f.phone}
                    onChange={(e) => setF({ ...f, phone: e.target.value })}
                    autoComplete="tel"
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label={t('checkout.notes')}>
                    <textarea
                      className="input min-h-[80px]"
                      maxLength={500}
                      value={f.notes}
                      onChange={(e) => setF({ ...f, notes: e.target.value })}
                    />
                  </Field>
                </div>
              </div>
            )}

            {STEPS[step] === 'delivery' && c && quote && (
              <div className="max-w-xl space-y-3">
                <div className="flex items-center gap-4 rounded-2xl border-2 border-bordeaux bg-bordeaux/5 p-4">
                  <Icon name="truck" className="h-8 w-8 text-bordeaux" />
                  <div className="flex-1">
                    <p className="font-semibold">
                      {t('checkout.standard_delivery')} — {loc(c, 'name', lang)}, {city}
                    </p>
                    {c.eta_min_days && (
                      <p className="text-xs text-ink/70">
                        {t('checkout.eta', { min: c.eta_min_days, max: c.eta_max_days ?? c.eta_min_days })}
                      </p>
                    )}
                  </div>
                  <p className="font-semibold text-bordeaux" dir="ltr">
                    {quote.free ? t('checkout.free') : formatMoney(quote.fee, currency, lang)}
                  </p>
                </div>
                {c.free_shipping_threshold !== null && !quote.free && (
                  <p className="text-xs text-ink/70">
                    {t('checkout.free_from', {
                      amount: formatMoney(Number(c.free_shipping_threshold) * Number(c.exchange_rate), currency, lang),
                    })}
                  </p>
                )}
              </div>
            )}

            {STEPS[step] === 'delivery' && cityFeeLoading && <div className="flex justify-center py-6"><Spinner /></div>}
            {STEPS[step] === 'delivery' && cityFeeError && (
              <div role="alert" className="space-y-3 rounded-xl bg-red-50 p-4 text-sm text-red-800">
                <p>{t('checkout.shipping_quote_error')}</p>
                <button type="button" className="btn-outline" onClick={() => setCityFeeRetry((value) => value + 1)}>{t('common.retry')}</button>
              </div>
            )}

            {STEPS[step] === 'payment' && (
              <div className="max-w-xl space-y-3">
                {errs.payment && (
                  <p role="alert" className="text-sm font-medium text-red-700">
                    {errs.payment}
                  </p>
                )}
                {availableMethods.map((m) => (
                  <label
                    key={m.code}
                    className={cn(
                      'block cursor-pointer rounded-2xl border-2 p-4 transition',
                      payment === m.code ? 'border-bordeaux bg-bordeaux/5' : 'border-bordeaux/15 hover:border-bordeaux/40',
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="pay"
                        className="h-4 w-4 accent-[#7A1F3D]"
                        checked={payment === m.code}
                        onChange={() => setPayment(m.code)}
                      />
                      <span className="font-semibold">{loc(m, 'name', lang)}</span>
                    </span>
                    {payment === m.code && (
                      <span className="mt-3 block space-y-2 text-sm text-ink/80">
                        {loc(m, 'instructions', lang) && <span className="block whitespace-pre-line">{loc(m, 'instructions', lang)}</span>}
                        {m.account_details && (
                          <span className="block whitespace-pre-line rounded-xl bg-white p-3 font-mono text-xs" dir="ltr">
                            {m.account_details}
                          </span>
                        )}
                        {m.code !== 'cod' && <span className="block text-xs font-medium text-bordeaux">{t('checkout.manual_notice')}</span>}
                      </span>
                    )}
                  </label>
                ))}
                {!methods.loading && availableMethods.length === 0 && (
                  <p className="text-sm text-ink/70">{t('errors.PAYMENT_UNAVAILABLE')}</p>
                )}
              </div>
            )}

            {STEPS[step] === 'summary' && (
              <div className="max-w-xl space-y-5 text-sm">
                <dl className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="label">{t('checkout.step_address')}</dt>
                    <dd>
                      {address}
                      <br />
                      {city}
                      {postal ? `, ${postal}` : ''}
                      <br />
                      {c && loc(c, 'name', lang)}
                    </dd>
                  </div>
                  <div>
                    <dt className="label">{t('checkout.step_info')}</dt>
                    <dd>
                      {f.first_name} {f.last_name}
                      <br />
                      {f.email}
                      <br />
                      <span dir="ltr">{f.phone}</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="label">{t('checkout.step_payment')}</dt>
                    <dd>{pm ? loc(pm, 'name', lang) : ''}</dd>
                  </div>
                  {f.notes && (
                    <div>
                      <dt className="label">{t('checkout.notes')}</dt>
                      <dd>{f.notes}</dd>
                    </div>
                  )}
                </dl>
                <label className="flex items-start gap-2 text-xs">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-[#7A1F3D]"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                  />
                  <span>
                    {t('checkout.accept_prefix')}{' '}
                    <Link to="/terms" target="_blank" className="link">
                      {t('footer.terms')}
                    </Link>{' '}
                    ·{' '}
                    <Link to="/returns" target="_blank" className="link">
                      {t('footer.returns')}
                    </Link>
                  </span>
                </label>
                {errs.accepted && (
                  <p role="alert" className="text-xs font-medium text-red-700">
                    {errs.accepted}
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="mt-8 flex items-center justify-between gap-3 border-t border-bordeaux/10 pt-5">
            <button className="btn-ghost" onClick={back} disabled={step === 0 || busy}>
              {t('checkout.back')}
            </button>
            {step < STEPS.length - 1 ? (
              <button className="btn-primary" onClick={next}>
                {t('checkout.next')}
              </button>
            ) : (
              <button className="btn-gold" onClick={() => void submit()} disabled={busy}>
                {busy && <Spinner className="h-4 w-4" />}
                {t('checkout.place_order')}
              </button>
            )}
          </div>
        </div>

        <aside className="card h-fit space-y-3 p-5 lg:sticky lg:top-28">
          <h2 className="text-2xl">{t('cart.summary')}</h2>
          <ul className="divide-y divide-bordeaux/10">
            {items.map((i) => (
              <li key={i.variantId} className="flex gap-3 py-3">
                <div className="h-16 w-14 shrink-0 overflow-hidden rounded-lg bg-ivory-dark">
                  {i.image && <img src={i.image} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1 text-xs">
                  <p className="line-clamp-2 font-semibold">{i.names[lang]}</p>
                  <p className="text-ink/60">
                    {[i.color, i.size, i.shoeSize].filter(Boolean).join(' · ')} × {i.quantity}
                  </p>
                </div>
                <p className="text-xs font-semibold" dir="ltr">
                  {formatMoney(i.price * i.quantity, currency, lang)}
                </p>
              </li>
            ))}
          </ul>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt>{t('cart.subtotal')}</dt>
              <dd dir="ltr">{formatMoney(subtotal, currency, lang)}</dd>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <dt>
                  {t('cart.discount')} ({promoCode})
                </dt>
                <dd dir="ltr">-{formatMoney(discount, currency, lang)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt>{t('cart.shipping')}</dt>
              <dd dir="ltr">{cityFeeLoading ? t('common.loading') : quote ? (quote.free ? t('checkout.free') : formatMoney(quote.fee, currency, lang)) : '—'}</dd>
            </div>
            <div className="flex justify-between border-t border-bordeaux/10 pt-3 text-lg font-semibold text-bordeaux">
              <dt>{t('cart.total')}</dt>
              <dd dir="ltr">{formatMoney(total, currency, lang)}</dd>
            </div>
          </dl>
          <p className="text-[11px] text-ink/60">{t('checkout.server_notice')}</p>
        </aside>
      </div>
    </div>
  );
}
