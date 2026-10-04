import { Link } from 'react-router-dom';
import { ErrorState, PageHeader, Spinner } from '@/components/ui';
import { NotificationList } from '@/components/NotificationList';
import { useT } from '@/i18n';
import { useAsync } from '@/hooks/useAsync';
import { useSettings } from '@/hooks/useData';
import { supabase } from '@/lib/supabase';
import { formatMoney } from '@/lib/utils';

interface Dash {
  orders_today: number;
  revenue_today: number;
  revenue_30d: number;
  pending_orders: number;
  payments_to_verify: number;
  out_of_stock: number;
  low_stock: number;
  new_customers: number;
  unread_messages: number;
  pending_returns: number;
  daily: Array<{ day: string; revenue: number }>;
  top_products: Array<{ name: string; qty: number }>;
}

export default function AdminDashboard() {
  const { t, lang } = useT();
  const { currency } = useSettings();
  const { data, loading, error, reload } = useAsync(async () => {
    const { data: d, error: e } = await supabase.rpc('admin_dashboard');
    if (e) throw e;
    return d as unknown as Dash;
  }, []);
  if (loading)
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  if (error || !data) return <ErrorState onRetry={reload} />;
  const max = Math.max(1, ...data.daily.map((d) => Number(d.revenue)));
  const money = (n: number) => formatMoney(Number(n), currency, lang);
  const tiles: Array<{ label: string; value: string | number; to?: string; warn?: boolean }> = [
    { label: t('dash.orders_today'), value: data.orders_today, to: '/admin/orders' },
    { label: t('dash.revenue_today'), value: money(data.revenue_today) },
    { label: t('dash.revenue_30d'), value: money(data.revenue_30d) },
    { label: t('dash.pending_orders'), value: data.pending_orders, to: '/admin/orders', warn: data.pending_orders > 0 },
    { label: t('dash.payments_to_verify'), value: data.payments_to_verify, to: '/admin/orders', warn: data.payments_to_verify > 0 },
    { label: t('dash.out_of_stock'), value: data.out_of_stock, to: '/admin/inventory', warn: data.out_of_stock > 0 },
    { label: t('dash.low_stock'), value: data.low_stock, to: '/admin/inventory', warn: data.low_stock > 0 },
    { label: t('dash.new_customers'), value: data.new_customers, to: '/admin/customers' },
    { label: t('dash.unread_messages'), value: data.unread_messages, to: '/admin/messages', warn: data.unread_messages > 0 },
    { label: t('dash.pending_returns'), value: data.pending_returns, to: '/admin/orders', warn: data.pending_returns > 0 },
  ];
  return (
    <div className="space-y-8">
      <PageHeader title={t('admin.nav.dashboard')} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {tiles.map((x) => {
          const inner = (
            <>
              <p className="text-xs text-ink/60">{x.label}</p>
              <p className={`mt-1 text-2xl font-semibold ${x.warn ? 'text-amber-700' : 'text-bordeaux'}`} dir="ltr">
                {x.value}
              </p>
            </>
          );
          return x.to ? (
            <Link key={x.label} to={x.to} className="card p-4 transition hover:border-gold">
              {inner}
            </Link>
          ) : (
            <div key={x.label} className="card p-4">
              {inner}
            </div>
          );
        })}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-4 text-2xl">{t('dash.sales_chart')}</h2>
          <svg viewBox="0 0 400 160" className="w-full" role="img" aria-label={t('dash.sales_chart')}>
            {data.daily.map((d, i) => {
              const w = 400 / data.daily.length;
              const h = (Number(d.revenue) / max) * 120;
              return (
                <g key={d.day}>
                  <rect x={i * w + 4} y={130 - h} width={w - 8} height={Math.max(h, 1)} rx="3" fill="#7A1F3D">
                    <title>{`${d.day}: ${money(d.revenue)}`}</title>
                  </rect>
                  <text x={i * w + w / 2} y="150" textAnchor="middle" fontSize="9" fill="#555">
                    {d.day}
                  </text>
                </g>
              );
            })}
          </svg>
        </section>
        <section className="card p-5">
          <h2 className="mb-3 text-2xl">{t('dash.top_products')}</h2>
          {!data.top_products.length ? (
            <p className="text-sm text-ink/60">{t('admin.empty')}</p>
          ) : (
            <ol className="space-y-2 text-sm">
              {data.top_products.map((p, i) => (
                <li key={p.name} className="flex justify-between gap-3">
                  <span className="truncate">
                    {i + 1}. {p.name}
                  </span>
                  <span className="font-semibold text-bordeaux">{p.qty}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
      <section>
        <h2 className="mb-3 text-2xl">{t('account.notifications')}</h2>
        <NotificationList limit={15} />
      </section>
    </div>
  );
}
