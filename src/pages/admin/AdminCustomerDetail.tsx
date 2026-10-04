import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { EmptyState, ErrorState, Field, PageHeader, Spinner } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { useT } from '@/i18n';
import { formatDate, formatMoney } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useUI } from '@/store/ui';
import { useSettings } from '@/hooks/useData';

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  country_code: string | null;
  city: string | null;
  created_at: string;
  orders_count: number;
  total_spent: number;
}
interface CustomerOrder {
  id: string;
  order_number: string;
  total: number;
  currency: string;
  status: string;
  created_at: string;
}
interface CustomerAddress {
  id: string;
  label: string | null;
  country_code: string;
  city: string;
  address: string;
  postal_code: string | null;
}
interface CustomerConversation {
  id: string;
  subject: string;
  status: string;
  last_message_at: string;
}

export default function AdminCustomerDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { t, lang } = useT();
  const { currency } = useSettings();
  const toast = useUI((s) => s.toast);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [notifyTitle, setNotifyTitle] = useState('');
  const [notifyMessage, setNotifyMessage] = useState('');
  const [notifyBusy, setNotifyBusy] = useState(false);
  const { data, loading, error, reload } = useAsync(async () => {
    const [c, o, a, m, n] = await Promise.all([
      supabase.from('customers').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('orders')
        .select('id,order_number,total,currency,status,created_at')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('addresses')
        .select('id,label,country_code,city,address,postal_code')
        .eq('user_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('conversations')
        .select('id,subject,status,last_message_at')
        .eq('user_id', id)
        .order('last_message_at', { ascending: false })
        .limit(50),
      supabase
        .from('notifications')
        .select('id,type,created_at')
        .eq('audience', 'user')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);
    for (const result of [c, o, a, m, n]) if (result.error) throw result.error;
    return {
      customer: c.data as Customer | null,
      orders: (o.data ?? []) as CustomerOrder[],
      addresses: (a.data ?? []) as CustomerAddress[],
      conversations: (m.data ?? []) as CustomerConversation[],
      notifications: n.data ?? [],
    };
  }, [id]);

  const sendMessage = async (e: FormEvent) => {
    e.preventDefault();
    const c = data?.customer;
    if (!c || !title.trim() || !message.trim()) return;
    setBusy(true);
    try {
      const { data: conv, error: ce } = await supabase
        .from('conversations')
        .insert({ user_id: c.id, subject: title.trim() })
        .select('id')
        .single();
      if (ce) throw ce;
      const { error: me } = await supabase.from('messages').insert({ conversation_id: conv.id, sender_id: c.id, body: message.trim() });
      if (me) throw me;
      nav(`/admin/messages?c=${conv.id}`);
    } catch {
      toast('error', t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  const sendNotification = async (e: FormEvent) => {
    e.preventDefault();
    const c = data?.customer;
    if (!c || !notifyTitle.trim() || !notifyMessage.trim()) return;
    if (!window.confirm(t('customer.confirm_notification'))) return;
    setNotifyBusy(true);
    const { error: e1 } = await supabase.from('notifications').insert({
      audience: 'user',
      user_id: c.id,
      type: 'custom',
      params: { title: notifyTitle.trim(), message: notifyMessage.trim() },
      link: '/account/notifications',
    });
    setNotifyBusy(false);
    if (e1) {
      toast('error', t('errors.generic'));
      return;
    }
    setNotifyTitle('');
    setNotifyMessage('');
    toast('success', t('common.saved'));
    reload();
  };

  if (loading)
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  if (error) return <ErrorState onRetry={reload} />;
  const c = data?.customer;
  if (!c) return <EmptyState title={t('errors.not_found')} />;
  const lastActivity = [data.orders[0]?.created_at, data.conversations[0]?.last_message_at].filter(Boolean).sort().at(-1) ?? c.created_at;

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${c.first_name} ${c.last_name}`.trim() || t('admin.customer')}
        actions={
          <Link to="/admin/customers" className="btn-outline btn-sm">
            ← {t('admin.nav.customers')}
          </Link>
        }
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="card space-y-2 p-5">
          <h2 className="text-xl">{t('customer.profile')}</h2>
          <p>
            {t('auth.email')}: {c.email ?? '—'}
          </p>
          <p>
            {t('auth.phone')}: {c.phone ?? '—'}
          </p>
          <p>
            {t('geo.city')}: {[c.city, c.country_code].filter(Boolean).join(', ') || '—'}
          </p>
          <p>
            {t('cust.since')}: {formatDate(c.created_at, lang)}
          </p>
          <p>
            {t('customer.last_activity')}: {formatDate(lastActivity, lang, true)}
          </p>
          <p>
            {t('cust.orders')}: {c.orders_count} · {formatMoney(Number(c.total_spent), currency, lang)}
          </p>
        </section>
        <section className="card p-5">
          <h2 className="mb-3 text-xl">{t('customer.send_notification')}</h2>
          <form onSubmit={sendNotification} className="space-y-3">
            <Field label={t('customer.title')}>
              <input className="input" maxLength={120} value={notifyTitle} onChange={(e) => setNotifyTitle(e.target.value)} required />
            </Field>
            <Field label={t('customer.message')}>
              <textarea
                className="input min-h-24"
                maxLength={1000}
                value={notifyMessage}
                onChange={(e) => setNotifyMessage(e.target.value)}
                required
              />
            </Field>
            <button className="btn-primary" disabled={notifyBusy}>
              {notifyBusy ? <Spinner className="h-4 w-4" /> : t('messages.send')}
            </button>
          </form>
        </section>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 text-xl">{t('customer.orders')}</h2>
          {!data.orders.length ? (
            <p className="text-sm text-ink/60">{t('admin.empty')}</p>
          ) : (
            <ul className="divide-y divide-bordeaux/10">
              {data.orders.map((o) => (
                <li key={o.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
                  <span>
                    #{o.order_number} · {t(`status.${o.status}`)} · {formatDate(o.created_at, lang)}
                  </span>
                  <b>{formatMoney(Number(o.total), o.currency, lang)}</b>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card p-5">
          <h2 className="mb-3 text-xl">{t('customer.addresses')}</h2>
          {!data.addresses.length ? (
            <p className="text-sm text-ink/60">{t('admin.empty')}</p>
          ) : (
            <ul className="space-y-2">
              {data.addresses.map((a) => (
                <li key={a.id} className="rounded-xl bg-ivory-dark/50 p-3 text-sm">
                  {a.label && <b>{a.label} · </b>}
                  {a.address}, {a.postal_code ? `${a.postal_code} ` : ''}
                  {a.city}, {a.country_code}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <section className="card p-5">
        <h2 className="mb-3 text-xl">{t('customer.contact')}</h2>
        {data.conversations.length > 0 && (
          <ul className="mb-4 divide-y divide-bordeaux/10">
            {data.conversations.map((conv) => (
              <li key={conv.id} className="flex justify-between gap-2 py-2 text-sm">
                <span>
                  {conv.subject} · {formatDate(conv.last_message_at, lang, true)}
                </span>
                <Link className="link" to={`/admin/messages?c=${conv.id}`}>
                  {t('admin.open')}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={sendMessage} className="grid gap-3 sm:grid-cols-2">
          <Field label={t('customer.subject')}>
            <input className="input" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} required />
          </Field>
          <Field label={t('customer.message')}>
            <textarea className="input min-h-24" maxLength={4000} value={message} onChange={(e) => setMessage(e.target.value)} required />
          </Field>
          <button className="btn-primary sm:col-span-2" disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : t('messages.send')}
          </button>
        </form>
      </section>
      <section className="card p-5">
        <h2 className="mb-3 text-xl">
          {t('customer.notifications')} ({data.notifications.length})
        </h2>
        <Link className="link" to="/admin/notifications">
          {t('admin.nav.notifications')}
        </Link>
      </section>
    </div>
  );
}
