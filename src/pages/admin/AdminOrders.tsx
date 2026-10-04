import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { LocationMap } from '@/components/LocationMap';
import { reverseGeocode } from '@/services/geolocation';
import { reportError } from '@/lib/diagnostics';
import { ErrorState, Modal, PageHeader, Spinner, StatusBadge } from '@/components/ui';
import { useT } from '@/i18n';
import { useAsync } from '@/hooks/useAsync';
import { supabase } from '@/lib/supabase';
import { errorKey } from '@/lib/errors';
import { signedUrl } from '@/services/storage';
import { useUI } from '@/store/ui';
import { cn, formatDate, formatMoney } from '@/lib/utils';
import { ORDER_STATUSES, type Order, type OrderStatus } from '@/types';

interface Ret {
  id: string;
  order_id: string;
  reason: string;
  description: string | null;
  media_urls: string[];
  status: string;
  admin_note: string | null;
  created_at: string;
  orders?: { order_number: string } | null;
}
const RETURN_STATUSES = ['pending', 'approved', 'rejected', 'received', 'refunded', 'exchanged'];

export default function AdminOrders() {
  const { t, lang } = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useUI((s) => s.toast);
  const [tab, setTab] = useState<'orders' | 'returns'>('orders');
  const [status, setStatus] = useState<'' | OrderStatus>('');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Order | null>(null);
  const [proof, setProof] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [address, setAddress] = useState<string | null | 'loading' | 'error'>(null);

  const orders = useAsync(async () => {
    let query = supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }).limit(100);
    if (status) query = query.eq('status', status);
    const term = q.replace(/[%,()*]/g, ' ').trim();
    if (term) query = query.or(`order_number.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as unknown as Order[];
  }, [status, q]);
  useEffect(() => {
    const targetId = searchParams.get('order_id');
    if (!targetId || !orders.data) return;
    const target = orders.data.find((o) => o.id === targetId);
    if (target) setSel(target);
    else void supabase.from('orders').select('*, order_items(*)').eq('id', targetId).maybeSingle()
      .then(({ data, error }) => { if (!error && data) setSel(data as unknown as Order); });
  }, [orders.data, searchParams]);
  const returns = useAsync(async () => {
    const { data, error } = await supabase
      .from('return_requests')
      .select('*, orders(order_number)')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data ?? []) as unknown as Ret[];
  }, []);
  useEffect(() => {
    setAddress(null);
    setProof(null);
    if (sel?.payment_proof_url) void signedUrl(sel.payment_proof_url).then(setProof);
  }, [sel]);
  useEffect(() => {
    const ch = supabase
      .channel('admin-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => orders.reload())
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setOrderStatus = async (o: Order, s: OrderStatus) => {
    setBusy(true);
    const { error } = await supabase.rpc('admin_set_order_status', { p_order: o.id, p_status: s });
    setBusy(false);
    if (error) {
      toast('error', t(errorKey(error)));
      return;
    }
    toast('success', t('common.saved'));
    setSel({ ...o, status: s });
    orders.reload();
  };
  const updateReturn = async (r: Ret, patch: { status?: string; admin_note?: string }) => {
    const { error } = await supabase.from('return_requests').update(patch).eq('id', r.id);
    if (error) toast('error', t(errorKey(error)));
    else returns.reload();
  };
  const openMedia = async (path: string) => {
    const u = await signedUrl(path);
    if (u) window.open(u, '_blank', 'noopener');
  };

  return (
    <div>
      <PageHeader title={t('admin.nav.orders')} />
      <div className="mb-4 flex gap-2">
        {(['orders', 'returns'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn('btn btn-sm', tab === k ? 'bg-bordeaux text-ivory' : 'border border-bordeaux/30 text-bordeaux')}
          >
            {t(`admin.tab_${k}`)}
            {k === 'returns' && returns.data ? ` (${returns.data.filter((r) => r.status === 'pending').length})` : ''}
          </button>
        ))}
      </div>

      {tab === 'orders' && (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <input
              className="input max-w-xs"
              type="search"
              placeholder={t('admin.search_orders')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label={t('admin.search')}
            />
            <select
              className="input max-w-[220px]"
              value={status}
              onChange={(e) => setStatus(e.target.value as '' | OrderStatus)}
              aria-label={t('admin.status')}
            >
              <option value="">{t('common.all')}</option>
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`status.${s}`)}
                </option>
              ))}
            </select>
          </div>
          {orders.loading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : orders.error ? (
            <ErrorState onRetry={orders.reload} />
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead className="bg-ivory-dark text-xs text-bordeaux">
                  <tr>
                    {['#', 'admin.customer', 'geo.country', 'pay.method', 'admin.status', 'cart.total', ''].map((k, i) => (
                      <th key={i} className="px-3 py-2.5 text-start">
                        {k.includes('.') ? t(k) : k}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-bordeaux/10">
                  {orders.data?.map((o) => (
                    <tr key={o.id} className="hover:bg-ivory">
                      <td className="px-3 py-2.5 font-semibold">
                        #{o.order_number}
                        <div className="text-[11px] font-normal text-ink/50">{formatDate(o.created_at, lang, true)}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        {o.first_name} {o.last_name}
                      </td>
                      <td className="px-3 py-2.5">
                        {o.city} ({o.country_code})
                      </td>
                      <td className="px-3 py-2.5">{o.payment_method}</td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={o.status} />
                      </td>
                      <td className="px-3 py-2.5" dir="ltr">
                        {formatMoney(o.total, o.currency, lang)}
                      </td>
                      <td className="px-3 py-2.5">
                        <button className="btn-outline btn-sm" onClick={() => setSel(o)}>
                          {t('admin.open')}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!orders.data?.length && (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-ink/60">
                        {t('admin.empty')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'returns' &&
        (returns.loading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : (
          <ul className="space-y-3">
            {returns.data?.map((r) => (
              <li key={r.id} className="card space-y-2 p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">
                    #{r.orders?.order_number} — {t(`orders.reason_${r.reason}`)}
                  </p>
                  <span className="text-xs text-ink/60">{formatDate(r.created_at, lang, true)}</span>
                </div>
                {r.description && <p className="whitespace-pre-line text-ink/80">{r.description}</p>}
                <div className="flex flex-wrap gap-2">
                  {r.media_urls.map((m, i) => (
                    <button key={m} className="btn-outline btn-sm" onClick={() => void openMedia(m)}>
                      <Icon name="eye" className="h-4 w-4" />
                      {i + 1}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="input max-w-[200px]"
                    value={r.status}
                    onChange={(e) => void updateReturn(r, { status: e.target.value })}
                  >
                    {RETURN_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {t(`orders.return_status_${s}`)}
                      </option>
                    ))}
                  </select>
                  <input
                    className="input max-w-xs flex-1"
                    placeholder={t('admin.note')}
                    defaultValue={r.admin_note ?? ''}
                    onBlur={(e) => {
                      if (e.target.value !== (r.admin_note ?? '')) void updateReturn(r, { admin_note: e.target.value });
                    }}
                  />
                </div>
              </li>
            ))}
            {!returns.data?.length && <li className="p-6 text-center text-sm text-ink/60">{t('admin.empty')}</li>}
          </ul>
        ))}

      <Modal open={!!sel} onClose={() => { setSel(null); if (searchParams.has('order_id')) { const next = new URLSearchParams(searchParams); next.delete('order_id'); setSearchParams(next, { replace: true }); } }} title={sel ? `#${sel.order_number}` : ''} wide>
        {sel && (
          <div className="space-y-5 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={sel.status} />
              {sel.delivery_confirmed && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">✓ {t('orders.delivery_confirmed')}</span>}
              <select
                className="input max-w-[240px]"
                value={sel.status}
                disabled={busy}
                onChange={(e) => void setOrderStatus(sel, e.target.value as OrderStatus)}
                aria-label={t('admin.status')}
              >
                {ORDER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`status.${s}`)}
                  </option>
                ))}
              </select>
              <Link to={`/admin/orders/${sel.id}/label`} className="btn-outline btn-sm">
                <Icon name="print" className="h-4 w-4" />
                {t('label.print')}
              </Link>
              {proof && (
                <a href={proof} target="_blank" rel="noopener noreferrer" className="btn-gold btn-sm">
                  <Icon name="eye" className="h-4 w-4" />
                  {t('orders.view_proof')}
                </a>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="label">{t('admin.customer')}</p>
                <p>
                  {sel.first_name} {sel.last_name}
                </p>
                <p>{sel.email}</p>
                <p dir="ltr">{sel.phone}</p>
              </div>
              <div>
                <p className="label">{t('orders.delivery_to')}</p>
                <p className="whitespace-pre-line">{sel.address}</p>
                <p>
                  {sel.city}
                  {sel.postal_code ? `, ${sel.postal_code}` : ''} ({sel.country_code})
                </p>
              </div>
            </div>
            {sel.notes && <p className="rounded-xl bg-ivory-dark p-3">{sel.notes}</p>}
            <section className="rounded-2xl border border-bordeaux/10 p-3" aria-label={t('loc.title')}>
              <p className="label">📍 {t('loc.title')}</p>
              {sel.location_lat != null && sel.location_lng != null ? (
                <div className="space-y-2">
                  <p dir="ltr" className="font-medium">
                    {t('loc.latitude')} {sel.location_lat.toFixed(6)} · {t('loc.longitude')} {sel.location_lng.toFixed(6)}
                    {sel.location_accuracy != null ? ` · ±${Math.round(sel.location_accuracy)} m` : ''}
                  </p>
                  {sel.location_captured_at && (
                    <p className="text-xs text-ink/60">
                      {t('loc.captured')} {formatDate(sel.location_captured_at, lang, true)}
                    </p>
                  )}
                  <LocationMap
                    latitude={sel.location_lat}
                    longitude={sel.location_lng}
                    title={t('loc.map_title')}
                    openLabel={t('loc.open_osm')}
                  />
                  {address && address !== 'loading' && address !== 'error' ? (
                    <p className="rounded-xl bg-ivory-dark p-2 text-xs">{address}</p>
                  ) : (
                    <button
                      type="button"
                      className="btn-outline btn-sm"
                      disabled={address === 'loading'}
                      onClick={() => {
                        setAddress('loading');
                        reverseGeocode(sel.location_lat as number, sel.location_lng as number, lang)
                          .then((a) => setAddress(a ?? 'error'))
                          .catch((e) => {
                            reportError('Adresse lisible', e);
                            setAddress('error');
                          });
                      }}
                    >
                      {address === 'loading' ? t('common.loading') : t('loc.show_address')}
                    </button>
                  )}
                  {address === 'error' && (
                    <p role="alert" className="text-xs text-amber-900">
                      {t('loc.address_failed')}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-ink/60">{t('loc.unavailable')}</p>
              )}
            </section>
            <ul className="divide-y divide-bordeaux/10">
              {sel.order_items?.map((i) => (
                <li key={i.id} className="flex justify-between gap-3 py-2">
                  <span>
                    {i.name}{' '}
                    <span className="text-xs text-ink/60">
                      {[i.color, i.size, i.shoe_size].filter(Boolean).join(' · ')} × {i.quantity}
                    </span>
                  </span>
                  <span dir="ltr">{formatMoney(i.line_total, sel.currency, lang)}</span>
                </li>
              ))}
            </ul>
            <p className="text-end font-semibold text-bordeaux" dir="ltr">
              {t('cart.shipping')}: {formatMoney(sel.shipping_fee, sel.currency, lang)} · {t('cart.total')}:{' '}
              {formatMoney(sel.total, sel.currency, lang)}
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
