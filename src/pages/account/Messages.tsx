import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChatThread } from '@/components/Chat';
import { EmptyState, ErrorState, Field, Modal, PageHeader, Spinner } from '@/components/ui';
import { useT } from '@/i18n';
import { useAsync } from '@/hooks/useAsync';
import { supabase } from '@/lib/supabase';
import { errorKey } from '@/lib/errors';
import { useAuth } from '@/store/auth';
import { useUI } from '@/store/ui';
import { cn, formatDate } from '@/lib/utils';
import type { Conversation } from '@/types';

export default function Messages() {
  const { t, lang } = useT();
  const user = useAuth((s) => s.user);
  const toast = useUI((s) => s.toast);
  const [params, setParams] = useSearchParams();
  const orderId = params.get('order');
  const [active, setActive] = useState<string | null>(params.get('c'));
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const { data, loading, error, reload } = useAsync(async () => {
    const { data: rows, error: e } = await supabase.from('conversations').select('*').order('last_message_at', { ascending: false });
    if (e) throw e;
    return (rows ?? []) as Conversation[];
  }, []);

  useEffect(() => {
    if (orderId) {
      setOpen(true);
      void supabase
        .from('orders')
        .select('order_number')
        .eq('id', orderId)
        .maybeSingle()
        .then(({ data: o }) => {
          if (o) setSubject(t('messages.about_order', { n: (o as { order_number: string }).order_number }));
        });
    }
  }, [orderId, t]);
  useEffect(() => {
    if (!active && data?.length && window.innerWidth >= 1024) setActive(data[0].id);
  }, [data, active]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !subject.trim() || !body.trim()) return;
    setBusy(true);
    const { data: c, error: err } = await supabase
      .from('conversations')
      .insert({ user_id: user.id, subject: subject.trim(), order_id: orderId })
      .select()
      .single();
    if (err) {
      setBusy(false);
      toast('error', t(errorKey(err)));
      return;
    }
    const { error: e2 } = await supabase
      .from('messages')
      .insert({ conversation_id: (c as Conversation).id, sender_id: user.id, body: body.trim() });
    setBusy(false);
    if (e2) {
      toast('error', t(errorKey(e2)));
      return;
    }
    setOpen(false);
    setSubject('');
    setBody('');
    setParams({}, { replace: true });
    setActive((c as Conversation).id);
    reload();
  };

  const current = data?.find((c) => c.id === active);
  return (
    <div>
      <PageHeader
        title={t('account.messages')}
        actions={
          <button className="btn-primary btn-sm" onClick={() => setOpen(true)}>
            {t('messages.new')}
          </button>
        }
      />
      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : error ? (
        <ErrorState onRetry={reload} />
      ) : !data?.length ? (
        <EmptyState title={t('messages.empty_title')} text={t('messages.empty_text')} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <ul className={cn('card max-h-[70vh] divide-y divide-bordeaux/10 overflow-y-auto', active && 'hidden lg:block')}>
            {data.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setActive(c.id)}
                  className={cn('w-full p-4 text-start hover:bg-ivory', c.id === active && 'bg-bordeaux/5')}
                >
                  <p className="line-clamp-1 text-sm font-semibold">{c.subject}</p>
                  <p className="text-xs text-ink/60">{formatDate(c.last_message_at, lang, true)}</p>
                </button>
              </li>
            ))}
          </ul>
          <div className={cn('card p-3 sm:p-4', !active && 'hidden lg:block')}>
            {current ? (
              <>
                <div className="mb-3 flex items-center gap-2">
                  <button className="btn-ghost btn-sm lg:hidden" onClick={() => setActive(null)}>
                    ←
                  </button>
                  <h2 className="line-clamp-1 text-xl">{current.subject}</h2>
                </div>
                <ChatThread conversationId={current.id} closed={current.status === 'closed'} />
              </>
            ) : (
              <p className="p-6 text-center text-sm text-ink/60">{t('messages.select')}</p>
            )}
          </div>
        </div>
      )}
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          if (orderId) setParams({}, { replace: true });
        }}
        title={t('messages.new')}
      >
        <form onSubmit={create} className="space-y-4">
          <Field label={t('messages.subject')}>
            <input className="input" value={subject} maxLength={120} onChange={(e) => setSubject(e.target.value)} required />
          </Field>
          <Field label={t('messages.write')}>
            <textarea className="input min-h-[120px]" maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)} required />
          </Field>
          <button className="btn-primary w-full" disabled={busy}>
            {busy && <Spinner className="h-4 w-4" />}
            {t('messages.send')}
          </button>
        </form>
      </Modal>
    </div>
  );
}
