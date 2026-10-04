import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { ErrorState, NotFound, PageSpinner } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useT } from '@/i18n';
import { useAsync } from '@/hooks/useAsync';
import { useCountries, usePaymentMethods, useSettings } from '@/hooks/useData';
import { supabase } from '@/lib/supabase';
import { formatDate, formatMoney, loc } from '@/lib/utils';
import type { Order, OrderItem, OrderStatus } from '@/types';
import { getLabelMetrics, labelTrackingUrl, type LabelFormat } from '@/lib/order-label';

type LabelOrder = Order & { notes: string | null; order_items: OrderItem[] };

export default function OrderLabel() {
  const { id = '' } = useParams();
  const { t, lang } = useT();
  const [format, setFormat] = useState<LabelFormat>('100');
  const [qr, setQr] = useState('');
  const settings = useSettings();
  const countries = useCountries();
  const paymentMethods = usePaymentMethods();
  const {
    data: order,
    loading,
    error,
    reload,
  } = useAsync(async () => {
    // This page is admin-guarded; RLS still limits the query to admin-authorized records.
    const { data, error: queryError } = await supabase.from('orders').select('*, order_items(*)').eq('id', id).maybeSingle();
    if (queryError) throw queryError;
    return data as unknown as LabelOrder | null;
  }, [id]);

  const metrics = useMemo(() => getLabelMetrics(format), [format]);
  useEffect(() => {
    let active = true;
    setQr('');
    if (order) {
      // The QR links to the authenticated order page. It contains no customer or payment details.
      const target = labelTrackingUrl(window.location.origin, order.id);
      void QRCode.toDataURL(target, { errorCorrectionLevel: 'M', margin: 1, width: 256 })
        .then((url) => {
          if (active) setQr(url);
        })
        .catch(() => {
          if (active) setQr('');
        });
    }
    return () => {
      active = false;
    };
  }, [order]);

  if (loading) return <PageSpinner />;
  if (error) return <ErrorState onRetry={reload} />;
  if (!order) return <NotFound />;

  const itemCount = order.order_items.reduce((sum, item) => sum + item.quantity, 0);
  const maxLines = format === 'a4x4' ? 12 : 3;
  const shownItems = order.order_items.slice(0, maxLines);
  const remainingLines = Math.max(0, order.order_items.length - shownItems.length);
  const country = countries.data.find((item) => item.code.toUpperCase() === order.country_code.toUpperCase());
  const countryName = country ? loc(country, 'name', lang) : order.country_code;
  const payment = paymentMethods.data.find((method) => method.code === order.payment_method);
  const phone = settings.whatsapp.replace(/\D/g, '');
  const phoneLabel = phone ? `+${phone}` : '';
  const status = t(`status.${order.status as OrderStatus}`);
  const pageStyle = `@page { size: ${metrics.pageSize}; margin: ${metrics.margin}; }
    @media print { html, body, #root { width: ${metrics.pageWidth}; min-height: ${metrics.pageHeight}; margin: 0 !important; padding: 0 !important; } }`;

  const copies = Array.from({ length: metrics.columns * metrics.rows }, (_, index) => index);
  return (
    <div className="label-page min-h-screen bg-ivory-dark/50 pb-8">
      <style>{pageStyle}</style>
      <div className="no-print sticky top-0 z-40 border-b border-bordeaux/10 bg-ivory/95 p-3 shadow-soft backdrop-blur sm:px-5">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/admin/orders" className="btn-ghost btn-sm shrink-0">
              ← {t('admin.nav.orders')}
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold text-bordeaux">{t('label.preview')}</h1>
              <p className="truncate text-xs text-ink/60">
                #{order.order_number} · {order.first_name} {order.last_name}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="label-format">
              {t('label.format')}
            </label>
            <select
              id="label-format"
              className="input min-h-10 w-auto py-1"
              value={format}
              onChange={(event) => setFormat(event.target.value as LabelFormat)}
            >
              <option value="100">{t('label.format_100')}</option>
              <option value="a4x4">{t('label.format_a4x4')}</option>
              <option value="a4x8">{t('label.format_a4x8')}</option>
            </select>
            <button className="btn-primary btn-sm" onClick={() => window.print()}>
              <Icon name="print" className="h-4 w-4" />
              {t('label.print')}
            </button>
            <button className="btn-outline btn-sm" title={t('label.pdf_hint')} onClick={() => window.print()}>
              <Icon name="download" className="h-4 w-4" />
              {t('label.pdf')}
            </button>
          </div>
        </div>
      </div>

      <main className="label-preview-viewport mx-auto max-w-6xl overflow-auto px-3 py-6 sm:px-5" aria-label={t('label.preview')}>
        <div
          className={`label-sheet label-sheet--${format} mx-auto`}
          style={{
            width: metrics.sheetWidth,
            height: metrics.sheetHeight,
            gridTemplateColumns: `repeat(${metrics.columns}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${metrics.rows}, minmax(0, 1fr))`,
            gap: metrics.gap,
          }}
        >
          {copies.map((copy) => (
            <article key={copy} className={`label-cell label-cell--${format}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
              <header className="label-head">
                <div className="label-brand-block">
                  <div className="label-brand">DOSSORA</div>
                  {settings.slogan && <p className="label-slogan">{settings.slogan}</p>}
                </div>
                <div className="label-reference">
                  <span className="label-kicker">{t('label.order')}</span>
                  <strong dir="ltr">#{order.order_number}</strong>
                  <span>{formatDate(order.created_at, lang)}</span>
                </div>
                <div className="label-qr-block">
                  {qr ? (
                    <img src={qr} alt={t('label.qr_alt')} className="label-qr" />
                  ) : (
                    <span className="label-qr-placeholder" aria-hidden="true" />
                  )}
                  <span>{t('label.scan_to_track')}</span>
                </div>
              </header>

              <div className="label-parties">
                <section className="label-party label-sender">
                  <h2>{t('label.from')}</h2>
                  <strong>DOSSORA</strong>
                  {phoneLabel && <span dir="ltr">{phoneLabel}</span>}
                  {settings.email && <span>{settings.email}</span>}
                  {settings.sender_address && <span>{settings.sender_address}</span>}
                  {(settings.sender_city || settings.sender_country) && (
                    <span>{[settings.sender_city, settings.sender_country].filter(Boolean).join(' · ')}</span>
                  )}
                </section>
                <section className="label-party label-recipient">
                  <h2>{t('label.to')}</h2>
                  <strong className="label-recipient-name">
                    {order.first_name} {order.last_name}
                  </strong>
                  {order.phone && <span dir="ltr">{order.phone}</span>}
                  <span>{order.address}</span>
                  <span>{[order.postal_code, order.city, countryName].filter(Boolean).join(' · ')}</span>
                </section>
              </div>

              <section className="label-shipping-line">
                <span>
                  <b>{t('label.delivery')}:</b> {status}
                </span>
                <span>
                  <b>{t('label.reference')}:</b> <strong dir="ltr">{order.order_number}</strong>
                </span>
              </section>

              <section className="label-items">
                <div className="label-section-heading">
                  <h2>{t('label.contents')}</h2>
                  <span>
                    {itemCount} {t('label.items')}
                  </span>
                </div>
                <ul>
                  {shownItems.map((item) => (
                    <li key={item.id}>
                      <span>
                        {item.name}
                        {[item.color, item.size, item.shoe_size].filter(Boolean).length > 0 &&
                          ` · ${[item.color, item.size, item.shoe_size].filter(Boolean).join(' / ')}`}
                      </span>
                      <strong dir="ltr">× {item.quantity}</strong>
                    </li>
                  ))}
                  {remainingLines > 0 && (
                    <li className="label-more">
                      + {remainingLines} {t('label.more_products')}
                    </li>
                  )}
                </ul>
              </section>

              <div className="label-lower">
                <section className="label-payment">
                  <span>
                    {t('label.payment')}: <strong>{payment ? loc(payment, 'name', lang) : order.payment_method || '—'}</strong>
                  </span>
                  <span>
                    {t('label.status')}: <strong>{status}</strong>
                  </span>
                  {order.payment_method === 'cod' && order.status !== 'paid' && order.status !== 'delivered' && (
                    <span className="label-cod">
                      {t('label.collect')}: <strong>{formatMoney(order.total, order.currency, lang)}</strong>
                    </span>
                  )}
                </section>
                <section className="label-totals" aria-label={t('label.totals')}>
                  <span>
                    {t('label.subtotal')} <b>{formatMoney(order.subtotal, order.currency, lang)}</b>
                  </span>
                  <span>
                    {t('label.shipping')} <b>{formatMoney(order.shipping_fee, order.currency, lang)}</b>
                  </span>
                  <span className="label-grand-total">
                    {t('label.total')} <b>{formatMoney(order.total, order.currency, lang)}</b>
                  </span>
                </section>
              </div>

              {order.notes?.trim() && (
                <section className="label-comment">
                  <b>{t('label.comment')}:</b> {order.notes}
                </section>
              )}
              <footer className="label-thanks">
                {t('label.thanks')} <span aria-hidden="true">♥</span>
              </footer>
            </article>
          ))}
        </div>
      </main>
      <p className="no-print mx-auto max-w-6xl px-3 text-xs text-ink/60 sm:px-5">{t('label.print_hint')}</p>
    </div>
  );
}
