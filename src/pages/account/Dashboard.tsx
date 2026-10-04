import { Link } from 'react-router-dom';
import { Icon, type IconName } from '@/components/Icon';
import { StatusBadge, Spinner } from '@/components/ui';
import { useT } from '@/i18n';
import { useAsync } from '@/hooks/useAsync';
import { supabase } from '@/lib/supabase';
import { formatDate, formatMoney } from '@/lib/utils';
import type { Order } from '@/types';

export default function Dashboard() {
  const { t, lang } = useT();
  const { data, loading } = useAsync(async () => {
    const { data: rows } = await supabase
      .from('orders')
      .select('id,order_number,status,total,currency,created_at')
      .order('created_at', { ascending: false })
      .limit(3);
    return (rows ?? []) as Order[];
  }, []);
  const tiles: Array<{ to: string; icon: IconName; key: string }> = [
    { to: '/account/orders', icon: 'box', key: 'account.orders' },
    { to: '/account/profile', icon: 'user', key: 'account.profile' },
    { to: '/account/addresses', icon: 'map', key: 'account.addresses' },
    { to: '/account/messages', icon: 'message', key: 'account.messages' },
  ];
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((x) => (
          <Link
            key={x.to}
            to={x.to}
            className="card flex flex-col items-center gap-2 p-5 text-center text-sm font-semibold text-bordeaux transition hover:-translate-y-0.5"
          >
            <Icon name={x.icon} className="h-7 w-7" />
            {t(x.key)}
          </Link>
        ))}
      </div>
      <section>
        <h2 className="mb-3 text-2xl">{t('account.recent_orders')}</h2>
        {loading ? (
          <Spinner />
        ) : !data?.length ? (
          <p className="text-sm text-ink/70">
            {t('orders.empty')}{' '}
            <Link className="link" to="/shop">
              {t('nav.shop')}
            </Link>
          </p>
        ) : (
          <ul className="card divide-y divide-bordeaux/10">
            {data.map((o) => (
              <li key={o.id}>
                <Link to={`/account/orders/${o.id}`} className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-ivory">
                  <span>
                    <span className="font-semibold">#{o.order_number}</span>{' '}
                    <span className="text-xs text-ink/60">{formatDate(o.created_at, lang)}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <StatusBadge status={o.status} />
                    <span className="text-sm font-semibold" dir="ltr">
                      {formatMoney(o.total, o.currency, lang)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
