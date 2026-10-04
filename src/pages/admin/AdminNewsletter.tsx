import { useMemo, useState } from 'react';
import { EmptyState, ErrorState, PageHeader, Spinner } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { useT } from '@/i18n';
import { formatDate } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

interface Subscriber {
  id: string;
  email: string;
  user_id: string | null;
  created_at: string;
  first_name?: string;
  last_name?: string;
}

function newsletterErrorMessage(error: unknown): { key: string; details: string } {
  const e = error as { code?: string; message?: string; status?: number } | null;
  const code = e?.code ?? '';
  const status = e?.status;
  const message = e?.message ?? String(error ?? '');
  let label = 'newsletter.errors.generic';

  if (code === 'PGRST205' || code === '42P01' || status === 404 || /relation .* does not exist|could not find the table/i.test(message)) {
    label = 'newsletter.errors.tableMissing';
  } else if (code === 'PGRST204' || code === '42703' || /column .* does not exist|could not find the .* column/i.test(message)) {
    label = 'newsletter.errors.columnMissing';
  } else if (status === 401 || code === '401') {
    label = 'newsletter.errors.authRequired';
  } else if (status === 403 || code === '42501' || /permission denied|row.level security|not authorized/i.test(message)) {
    label = 'newsletter.errors.accessDenied';
  } else if (/invalid.*url|supabase.*url|fetch failed|failed to fetch|network/i.test(message)) {
    label = 'newsletter.errors.configuration';
  }

  const details = [status ? `HTTP ${status}` : '', code, message].filter(Boolean).join(' · ');
  return { key: label, details };
}

export default function AdminNewsletter() {
  const { t, lang } = useT();
  const [q, setQ] = useState('');
  const { data, loading, error, reload } = useAsync(async () => {
    const { data: rows, error: e } = await supabase
      .from('newsletter_subscribers')
      .select('id,email,user_id,created_at')
      .order('created_at', { ascending: false })
      .limit(500);
    if (e) throw e;
    const list = (rows ?? []) as Array<Omit<Subscriber, 'first_name' | 'last_name'>>;
    const ids = [...new Set(list.map((r) => r.user_id).filter((id): id is string => Boolean(id)))];
    if (!ids.length) return list as Subscriber[];
    const { data: profiles, error: pe } = await supabase.from('profiles').select('id,first_name,last_name').in('id', ids);
    if (pe) throw pe;
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
    return list.map((row) => ({ ...row, ...byId.get(row.user_id ?? '') })) as Subscriber[];
  }, []);
  const filteredData = useMemo(() => {
    const term = q.trim().toLocaleLowerCase();
    if (!term) return data ?? [];
    return (data ?? []).filter((row) =>
      `${row.email} ${row.first_name ?? ''} ${row.last_name ?? ''}`.toLocaleLowerCase().includes(term),
    );
  }, [data, q]);

  return (
    <div>
      <PageHeader title={t('admin.nav.newsletter')} />
      <input
        className="input mb-4 max-w-sm"
        type="search"
        placeholder={t('admin.search')}
        aria-label={t('admin.search')}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : error ? (
        <ErrorState
          text={(() => {
            const diagnostic = newsletterErrorMessage(error);
            return import.meta.env.DEV && diagnostic.details
              ? `${t(diagnostic.key)} — ${diagnostic.details}`
              : t(diagnostic.key);
          })()}
          onRetry={reload}
        />
      ) : !filteredData.length ? (
        <EmptyState title={t('admin.empty')} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[520px] text-start text-sm">
            <thead className="bg-ivory-dark text-xs text-bordeaux">
              <tr>
                {[t('auth.email'), t('admin.name'), t('newsletter.registered_at')].map((label) => (
                  <th key={label} className="px-3 py-2.5 text-start">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-bordeaux/10">
              {filteredData.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2.5" dir="ltr">
                    {row.email}
                  </td>
                  <td className="px-3 py-2.5">{row.user_id ? `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || '—' : '—'}</td>
                  <td className="px-3 py-2.5">{formatDate(row.created_at, lang, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
