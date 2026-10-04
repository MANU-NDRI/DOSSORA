import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { OrderSuccessAnimation } from '@/components/OrderSuccessAnimation';
import { ErrorState, Field, Modal, NotFound, PageSpinner, StatusBadge, Spinner } from '@/components/ui';
import { useT } from '@/i18n';
import { useAsync } from '@/hooks/useAsync';
import { usePaymentMethods, useSettingsState } from '@/hooks/useData';
import { supabase } from '@/lib/supabase';
import { errorKey } from '@/lib/errors';
import { isDbNotReady, reportError } from '@/lib/diagnostics';
import { uploadPrivateFile } from '@/services/storage';
import { useAuth } from '@/store/auth';
import { useUI } from '@/store/ui';
import { cn, formatDate, formatMoney, loc, waLink } from '@/lib/utils';
import { ORDER_STATUSES, type Order } from '@/types';

const FLOW = ['pending_payment', 'payment_proof_received', 'paid', 'preparing', 'delivering', 'delivered'] as const;

export default function OrderDetail() {
  const { id = '' } = useParams();
  const { t, lang } = useT();
  const [params] = useSearchParams();
  const user = useAuth((s) => s.user);
  const toast = useUI((s) => s.toast);
  const methods = usePaymentMethods();
  const settingsState = useSettingsState();
  const settings = settingsState.data;
  const {
    data: order,
    loading,
    error,
    reload,
  } = useAsync(async () => {
    const { data, error: e } = await supabase.from('orders').select('*, order_items(*)').eq('id', id).maybeSingle();
    if (e) throw e;
    return data as Order | null;
  }, [id]);
  const [proofBusy, setProofBusy] = useState(false);
  const [deliveryBusy, setDeliveryBusy] = useState(false);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [proofError, setProofError] = useState(false);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const deliveryLock = useRef(false);
  const [ret, setRet] = useState(false);
  const [reason, setReason] = useState<'defective' | 'wrong_color'>('defective');
  const [desc, setDesc] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [retBusy, setRetBusy] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);
  const [returnsError, setReturnsError] = useState(false);
  const [returnsLoading, setReturnsLoading] = useState(true);
  const [returns, setReturns] = useState<Array<{ id: string; status: string; reason: string; created_at: string }>>([]);

  useEffect(() => {
    const ch = supabase
      .channel(`order-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, () => reload())
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [id, reload]);
  useEffect(() => {
    let alive = true;
    if (!order?.payment_proof_url) {
      setProofUrl(null);
      setProofError(false);
      return () => { alive = false; };
    }
    setProofError(false);
    void supabase.storage.from('payment-proofs').createSignedUrl(order.payment_proof_url, 3600).then(({ data, error: e }) => {
      if (!alive) return;
      if (e) {
        reportError('Création du lien de preuve de paiement', e);
        setProofError(true);
      } else setProofUrl(data?.signedUrl ?? null);
    });
    return () => { alive = false; };
  }, [order?.payment_proof_url]);
  const loadReturns = useCallback(
    async () => {
      setReturnsLoading(true);
      const { data, error: e } = await supabase
        .from('return_requests')
        .select('id,status,reason,created_at')
        .eq('order_id', id)
        .order('created_at', { ascending: false });
      if (e) {
        reportError('Chargement des demandes de retour', e);
        setReturnsError(true);
      } else {
        setReturns((data ?? []) as typeof returns);
        setReturnsError(false);
      }
      setReturnsLoading(false);
    },
    [id],
  );
  useEffect(() => {
    void loadReturns();
  }, [loadReturns]);

  if (loading && !order) return <PageSpinner />;
  if (error && !order) return <ErrorState error={error} onRetry={reload} />;
  if (!order) return <NotFound />;

  const method = methods.data.find((m) => m.code === order.payment_method);
  const awaiting = order.status === 'pending_payment' && order.payment_method !== 'cod';
  const expires =
    order.stock_reserved_until && order.stock_state === 'reserved' ? formatDate(order.stock_reserved_until, lang, true) : null;
  const canReturn =
    order.status === 'delivered' && !!order.delivered_at && Date.now() - new Date(order.delivered_at).getTime() < 48 * 3600 * 1000;
  const cancelled = order.status === 'cancelled';
  const orderWhatsappText = [
    `DOSSORA — ${t('orders.whatsapp_header')}`,
    t('orders.whatsapp_intro', { n: order.order_number }),
    `${t('auth.first_name')} ${t('auth.last_name')}: ${order.first_name} ${order.last_name}`,
    `${t('auth.phone')}: ${order.phone}`,
    `${t('auth.email')}: ${order.email}`,
    `${t('orders.date')}: ${formatDate(order.created_at, lang, true)}`,
    `${t('geo.country')}: ${order.country_code}`,
    `${t('geo.city')}: ${order.city}`,
    `${t('checkout.address')}: ${order.address}${order.postal_code ? `, ${order.postal_code}` : ''}`,
    `${t('orders.items')}:`,
    ...(order.order_items ?? []).map(
      (item) =>
        `• ${item.name}${[item.color, item.size, item.shoe_size].filter(Boolean).length ? ` (${[item.color, item.size, item.shoe_size].filter(Boolean).join(', ')})` : ''} × ${item.quantity} — ${formatMoney(item.line_total, order.currency, lang)}`,
    ),
    `${t('cart.subtotal')}: ${formatMoney(order.subtotal, order.currency, lang)}`,
    `${t('cart.shipping')}: ${formatMoney(order.shipping_fee, order.currency, lang)}`,
    `${t('cart.total')}: ${formatMoney(order.total, order.currency, lang)}`,
    `${t('checkout.step_payment')}: ${
      loc(
        methods.data.find((m) => m.code === order.payment_method),
        'name',
        lang,
      ) ||
      order.payment_method ||
      '—'
    }`,
  ].join('\n');
  const idx = FLOW.indexOf(order.status as (typeof FLOW)[number]);

  const confirmDelivery = async () => {
    if (!user || deliveryLock.current || order.status !== 'delivered' || order.delivery_confirmed) return;
    deliveryLock.current = true;
    setDeliveryBusy(true);
    setDeliveryError(null);
    try {
      const { error: confirmError } = await supabase.rpc('confirm_order_delivery', { p_order: order.id });
      if (confirmError) throw confirmError;
      toast('success', t('orders.delivery_thanks'));
      reload();
    } catch (confirmError) {
      reportError('Confirmation de livraison (confirm_order_delivery)', confirmError);
      setDeliveryError(t(isDbNotReady(confirmError) ? 'orders.delivery_unavailable' : errorKey(confirmError)));
    } finally {
      deliveryLock.current = false;
      setDeliveryBusy(false);
    }
  };

  const uploadProof = async (file?: File) => {
    if (!file || !user) return;
    setProofBusy(true);
    try {
      const path = await uploadPrivateFile(file, user.id, 'proofs');
      const { error: e } = await supabase.rpc('attach_payment_proof', { p_order: order.id, p_path: path });
      if (e) throw e;
      toast('success', t('orders.proof_sent'));
      reload();
    } catch (e) {
      const m = (e as Error).message;
      toast('error', m === 'FILE_SIZE' ? t('errors.file_size') : m === 'FILE_TYPE' ? t('errors.file_type') : t(errorKey(e)));
    } finally {
      setProofBusy(false);
    }
  };
  const submitReturn = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setRetBusy(true);
    setReturnError(null);
    try {
      const media: string[] = [];
      for (const f of files.slice(0, 3)) media.push(await uploadPrivateFile(f, user.id, 'returns'));
      const { error: err } = await supabase.rpc('create_return_request', {
        p_order: order.id,
        p_reason: reason,
        p_description: desc,
        p_media: media,
      });
      if (err) throw err;
      toast('success', t('orders.return_sent'));
      setRet(false);
      setDesc('');
      setFiles([]);
      void loadReturns();
    } catch (err) {
      reportError('Création de demande de retour', err);
      const m = (err as Error).message;
      setReturnError(m === 'FILE_SIZE' ? t('errors.file_size') : m === 'FILE_TYPE' ? t('errors.file_type') : t(isDbNotReady(err) ? 'orders.return_unavailable' : errorKey(err)));
    } finally {
      setRetBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {Boolean(error && order) && <p role="alert" className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">{t('orders.refresh_unavailable')}</p>}
      {params.get('confirmed') && <OrderSuccessAnimation orderNumber={order.order_number} />}
      {params.get('confirmed') && !settingsState.error && (
        <a className="btn-outline w-fit" target="_blank" rel="noopener noreferrer" href={waLink(orderWhatsappText, settings.whatsapp)}>
          <Icon name="whatsapp" className="h-4 w-4" />
          {t('orders.whatsapp_order')}
        </a>
      )}
      {Boolean(params.get('confirmed') && settingsState.error) && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{t('orders.contact_unavailable')}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/account/orders" className="text-xs text-bordeaux hover:underline">
            ← {t('account.orders')}
          </Link>
          <h1 className="text-3xl">#{order.order_number}</h1>
          <p className="text-xs text-ink/60">{formatDate(order.created_at, lang, true)}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {cancelled ? (
        <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">{t('orders.cancelled_note')}</p>
      ) : (
        <ol className="card flex gap-1 overflow-x-auto p-4" aria-label={t('orders.timeline')}>
          {FLOW.map((s, i) => (
            <li
              key={s}
              className={cn(
                'flex min-w-[92px] flex-1 flex-col items-center gap-1 text-center text-[11px] font-medium',
                i <= idx ? 'text-bordeaux' : 'text-ink/40',
              )}
            >
              <span
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs',
                  i <= idx ? 'bg-bordeaux text-ivory' : 'bg-ivory-dark',
                )}
              >
                {i < idx ? '✓' : i + 1}
              </span>
              {t(`status.${s}`)}
            </li>
          ))}
        </ol>
      )}

      {awaiting && (
        <section className="card space-y-3 p-5">
          <h2 className="text-2xl">{t('orders.pay_title')}</h2>
          {Boolean(methods.error) && <p role="alert" className="text-sm text-red-800">{t('orders.payment_info_unavailable')}</p>}
          {method && <p className="text-sm font-semibold">{loc(method, 'name', lang)}</p>}
          {method && loc(method, 'instructions', lang) && (
            <p className="whitespace-pre-line text-sm text-ink/80">{loc(method, 'instructions', lang)}</p>
          )}
          {method?.account_details && (
            <p className="whitespace-pre-line rounded-xl bg-ivory-dark p-3 font-mono text-xs" dir="ltr">
              {method.account_details}
            </p>
          )}
          {expires && <p className="text-xs font-medium text-amber-800">{t('orders.reserved_until', { date: expires })}</p>}
          <div className="flex flex-wrap gap-2">
            <input
              id="proof"
              type="file"
              className="sr-only"
              accept="image/*,application/pdf,video/mp4"
              onChange={(e) => void uploadProof(e.target.files?.[0])}
            />
            <label htmlFor="proof" className="btn-primary cursor-pointer">
              {proofBusy ? <Spinner className="h-4 w-4" /> : <Icon name="upload" className="h-4 w-4" />}
              {t('orders.upload_proof')}
            </label>
            <a className="btn-outline" target="_blank" rel="noopener noreferrer" href={waLink(t('wa.proof', { n: order.order_number }))}>
              <Icon name="whatsapp" className="h-4 w-4" />
              {t('orders.proof_whatsapp')}
            </a>
          </div>
        </section>
      )}
      {order.status === 'delivered' && (
        <section className="card space-y-3 border-2 border-gold/60 bg-ivory p-5 sm:p-6" aria-live="polite">
          <h2 className="text-2xl text-bordeaux">{t('orders.delivered_title')}</h2>
          {order.delivery_confirmed ? (
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-emerald-800">✓ {t('orders.delivery_confirmed')}</p>
              {order.delivery_confirmed_at && <p className="text-ink/70">{t('orders.received_on', { date: formatDate(order.delivery_confirmed_at, lang, true) })}</p>}
            </div>
          ) : (
            <>
              <p className="text-sm">{t('orders.delivery_question')}</p>
              {deliveryError && <p role="alert" className="text-sm text-red-800">{deliveryError}</p>}
              <button type="button" className="btn-primary min-h-12" disabled={deliveryBusy} onClick={() => void confirmDelivery()}>
                {deliveryBusy ? <Spinner className="h-4 w-4" /> : <Icon name="check" className="h-4 w-4" />}
                {t('orders.confirm_delivery')}
              </button>
            </>
          )}
        </section>
      )}
      {order.status === 'payment_proof_received' && (
        <p className="rounded-2xl bg-blue-50 p-4 text-sm text-blue-900">{t('orders.proof_received_note')}</p>
      )}
      {order.payment_method === 'cod' && !cancelled && order.status !== 'delivered' && (
        <p className="rounded-2xl bg-ivory-dark p-4 text-sm">{t('orders.cod_note')}</p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="card p-5">
          <h2 className="mb-3 text-2xl">{t('orders.items')}</h2>
          <ul className="divide-y divide-bordeaux/10">
            {(order.order_items ?? []).map((i) => (
              <li key={i.id} className="flex gap-3 py-3">
                <div className="h-16 w-14 shrink-0 overflow-hidden rounded-lg bg-ivory-dark">
                  {i.image_url && <img src={i.image_url} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-semibold">{i.name}</p>
                  <p className="text-xs text-ink/60">
                    {[i.color, i.size, i.shoe_size].filter(Boolean).join(' · ')} × {i.quantity}
                  </p>
                </div>
                <p className="text-sm font-semibold" dir="ltr">
                  {formatMoney(i.line_total, order.currency, lang)}
                </p>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1.5 border-t border-bordeaux/10 pt-4 text-sm">
            <div className="flex justify-between">
              <dt>{t('cart.subtotal')}</dt>
              <dd dir="ltr">{formatMoney(order.subtotal, order.currency, lang)}</dd>
            </div>
            {order.discount_amount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <dt>{t('cart.discount')}</dt>
                <dd dir="ltr">-{formatMoney(order.discount_amount, order.currency, lang)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt>{t('cart.shipping')}</dt>
              <dd dir="ltr">{formatMoney(order.shipping_fee, order.currency, lang)}</dd>
            </div>
            <div className="flex justify-between text-lg font-semibold text-bordeaux">
              <dt>{t('cart.total')}</dt>
              <dd dir="ltr">{formatMoney(order.total, order.currency, lang)}</dd>
            </div>
          </dl>
        </section>
        <aside className="space-y-4">
          <section className="card p-5 text-sm">
            <h2 className="mb-2 text-xl">{t('orders.delivery_to')}</h2>
            <p>
              {order.first_name} {order.last_name}
            </p>
            <p className="whitespace-pre-line">{order.address}</p>
            <p>
              {order.city}
              {order.postal_code ? `, ${order.postal_code}` : ''} ({order.country_code})
            </p>
            <p dir="ltr">{order.phone}</p>
          </section>
          {proofError && <p role="alert" className="text-sm text-red-800">{t('orders.proof_unavailable')}</p>}
          {proofUrl && (
            <a href={proofUrl} target="_blank" rel="noopener noreferrer" className="btn-outline w-full">
              <Icon name="eye" className="h-4 w-4" />
              {t('orders.view_proof')}
            </a>
          )}
          <Link to={`/account/messages?order=${order.id}`} className="btn-outline w-full">
            <Icon name="message" className="h-4 w-4" />
            {t('orders.message_about')}
          </Link>
          {canReturn && (
            <button className="btn-gold w-full" onClick={() => setRet(true)}>
              {t('orders.return_request')}
            </button>
          )}
          {order.status === 'delivered' && !canReturn && <p className="text-xs text-ink/60">{t('orders.return_closed')}</p>}
        </aside>
      </div>

      {(returns.length > 0 || returnsError || returnsLoading) && (
        <section className="card p-5">
          <h2 className="mb-2 text-xl">{t('orders.returns')}</h2>
          {returnsLoading && <Spinner />}
          {returnsError && <div role="alert" className="space-y-2 text-sm text-red-800"><p>{t('orders.returns_unavailable')}</p><button className="btn-outline" onClick={() => void loadReturns()}>{t('common.retry')}</button></div>}
          <ul className="space-y-1 text-sm">
            {returns.map((r) => (
              <li key={r.id}>
                {formatDate(r.created_at, lang)} — {t(`orders.reason_${r.reason}`)} —{' '}
                <span className="font-semibold">{t(`orders.return_status_${r.status}`)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Modal open={ret} onClose={() => setRet(false)} title={t('orders.return_request')}>
        <form onSubmit={submitReturn} className="space-y-4">
          {returnError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{returnError}</p>}
          <p className="text-xs text-ink/70">{t('orders.return_policy')}</p>
          <Field label={t('orders.reason')}>
            <select className="input" value={reason} onChange={(e) => setReason(e.target.value as 'defective' | 'wrong_color')}>
              <option value="defective">{t('orders.reason_defective')}</option>
              <option value="wrong_color">{t('orders.reason_wrong_color')}</option>
            </select>
          </Field>
          <Field label={t('orders.description')}>
            <textarea className="input min-h-[100px]" maxLength={2000} value={desc} onChange={(e) => setDesc(e.target.value)} required />
          </Field>
          <Field label={t('orders.photos')} hint={t('orders.photos_hint')}>
            <input
              type="file"
              multiple
              accept="image/*,video/mp4"
              className="input"
              onChange={(e) => {
                const selected = Array.from(e.target.files ?? []);
                setFiles(selected.slice(0, 3));
                setReturnError(selected.length > 3 ? t('orders.max_files') : null);
              }}
            />
          </Field>
          <button className="btn-primary w-full" disabled={retBusy}>
            {retBusy && <Spinner className="h-4 w-4" />}
            {t('orders.send_request')}
          </button>
        </form>
      </Modal>
    </div>
  );
}
void ORDER_STATUSES;
