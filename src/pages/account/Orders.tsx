import { Link } from 'react-router-dom';
import { EmptyState, ErrorState, PageHeader, Spinner, StatusBadge } from '@/components/ui';
import { useT } from '@/i18n';
import { useAsync } from '@/hooks/useAsync';
import { supabase } from '@/lib/supabase';
import { formatDate, formatMoney } from '@/lib/utils';
import type { Order } from '@/types';

export default function Orders() {
  const { t, lang } = useT();
  const { data, loading, error, reload } = useAsync(async () => {
    const { data: rows, error: e } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(100);
    if (e) throw e;
    return (rows ?? []) as Order[];
  }, []);
  return (
    <div>
      <PageHeader title={t('account.orders')} />
      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : error ? (
        <ErrorState onRetry={reload} />
      ) : !data?.length ? (
        <EmptyState
          title={t('orders.empty')}
          action={
            <Link to="/shop" className="btn-primary">
              {t('nav.shop')}
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {data.map((o) => (
            <li key={o.id}>
              <Link
                to={`/account/orders/${o.id}`}
                className="card flex flex-wrap items-center justify-between gap-3 p-4 transition hover:border-gold"
              >
                <div>
                  <p className="font-semibold text-bordeaux">#{o.order_number}</p>
                  <p className="text-xs text-ink/60">{formatDate(o.created_at, lang, true)}</p>
                </div>
                <StatusBadge status={o.status} />
                <p className="font-semibold" dir="ltr">
                  {formatMoney(o.total, o.currency, lang)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
