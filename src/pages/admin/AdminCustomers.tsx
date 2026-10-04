import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorState, PageHeader, Spinner } from '@/components/ui';
import { useT } from '@/i18n';
import { useAsync } from '@/hooks/useAsync';
import { useSettings } from '@/hooks/useData';
import { supabase } from '@/lib/supabase';
import { formatDate, formatMoney } from '@/lib/utils';

interface Cust {
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
  last_activity: string | null;
}

export default function AdminCustomers() {
  const { t, lang } = useT();
  const { currency } = useSettings();
  const [q, setQ] = useState('');
  const { data, loading, error, reload } = useAsync(async () => {
    let query = supabase.from('customers').select('*').order('created_at', { ascending: false }).limit(200);
    const term = q.replace(/[%,()*]/g, ' ').trim();
    if (term) query = query.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`);
    const { data: rows, error: e } = await query;
    if (e) throw e;
    return (rows ?? []) as Cust[];
  }, [q]);
  return (
    <div>
      <PageHeader title={t('admin.nav.customers')} />
      <input
        className="input mb-4 max-w-sm"
        type="search"
        placeholder={t('admin.search')}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label={t('admin.search')}
      />
      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : error ? (
        <ErrorState onRetry={reload} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-start text-sm">
            <thead className="bg-ivory-dark text-xs text-bordeaux">
              <tr>
                {[
                  'admin.name',
                  'auth.email',
                  'auth.phone',
                  'geo.city',
                  'cust.orders',
                  'cust.spent',
                  'cust.since',
                  'customer.last_activity',
                ].map((k) => (
                  <th key={k} className="px-3 py-2.5 text-start">
                    {t(k)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-bordeaux/10">
              {data?.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-2.5 font-semibold">
                    <Link className="link" to={`/admin/customers/${c.id}`}>
                      {c.first_name} {c.last_name}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">{c.email}</td>
                  <td className="px-3 py-2.5" dir="ltr">
                    {c.phone}
                  </td>
                  <td className="px-3 py-2.5">{[c.city, c.country_code].filter(Boolean).join(', ')}</td>
                  <td className="px-3 py-2.5">{c.orders_count}</td>
                  <td className="px-3 py-2.5" dir="ltr">
                    {formatMoney(Number(c.total_spent), currency, lang)}
                  </td>
                  <td className="px-3 py-2.5">{formatDate(c.created_at, lang)}</td>
                  <td className="px-3 py-2.5">{c.last_activity ? formatDate(c.last_activity, lang, true) : '—'}</td>
                </tr>
              ))}
              {!data?.length && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-ink/60">
                    {t('admin.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
