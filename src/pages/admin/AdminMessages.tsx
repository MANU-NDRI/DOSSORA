import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChatThread } from '@/components/Chat';
import { EmptyState, ErrorState, PageHeader, Spinner } from '@/components/ui';
import { useT } from '@/i18n';
import { useAsync } from '@/hooks/useAsync';
import { supabase } from '@/lib/supabase';
import { cn, formatDate } from '@/lib/utils';
import type { Conversation } from '@/types';

export default function AdminMessages() {
  const { t, lang } = useT();
  const [params] = useSearchParams();
  const [active, setActive] = useState<string | null>(params.get('c'));
  const { data, loading, error, reload } = useAsync(async () => {
    const { data: rows, error: e } = await supabase
      .from('conversations')
      .select('*, profiles(first_name,last_name,email)')
      .order('last_message_at', { ascending: false })
      .limit(100);
    if (e) throw e;
    return (rows ?? []) as unknown as Conversation[];
  }, []);
  const current = data?.find((c) => c.id === active);
  const setStatus = async (c: Conversation, status: 'open' | 'closed') => {
    await supabase.from('conversations').update({ status }).eq('id', c.id);
    reload();
  };
  return (
    <div>
      <PageHeader title={t('admin.nav.messages')} />
      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : error ? (
        <ErrorState onRetry={reload} />
      ) : !data?.length ? (
        <EmptyState title={t('messages.empty_title')} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <ul className={cn('card max-h-[70vh] divide-y divide-bordeaux/10 overflow-y-auto', active && 'hidden lg:block')}>
            {data.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setActive(c.id)}
                  className={cn('w-full p-4 text-start hover:bg-ivory', c.id === active && 'bg-bordeaux/5')}
                >
                  <p className="line-clamp-1 text-sm font-semibold">{c.subject}</p>
                  <p className="text-xs text-ink/70">
                    {c.profiles?.first_name} {c.profiles?.last_name}
                  </p>
                  <p className="text-[11px] text-ink/50">
                    {formatDate(c.last_message_at, lang, true)}
                    {c.status === 'closed' ? ` · ${t('messages.closed_tag')}` : ''}
                  </p>
                </button>
              </li>
            ))}
          </ul>
          <div className={cn('card p-3 sm:p-4', !active && 'hidden lg:block')}>
            {current ? (
              <>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button className="btn-ghost btn-sm lg:hidden" onClick={() => setActive(null)}>
                      ←
                    </button>
                    <h2 className="line-clamp-1 text-xl">{current.subject}</h2>
                  </div>
                  <button
                    className="btn-outline btn-sm"
                    onClick={() => void setStatus(current, current.status === 'open' ? 'closed' : 'open')}
                  >
                    {current.status === 'open' ? t('messages.close') : t('messages.reopen')}
                  </button>
                </div>
                <ChatThread key={current.id} conversationId={current.id} closed={current.status === 'closed'} />
              </>
            ) : (
              <p className="p-6 text-center text-sm text-ink/60">{t('messages.select')}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
