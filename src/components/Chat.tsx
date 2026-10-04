import { useEffect, useRef, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/store/auth';
import { useT } from '@/i18n';
import { useUI } from '@/store/ui';
import { errorKey } from '@/lib/errors';
import { cn, formatDate } from '@/lib/utils';
import { Icon } from './Icon';
import { Spinner } from './ui';
import type { Message } from '@/types';

/** Fil de discussion en temps réel (Supabase Realtime) partagé par le client et l'admin. */
export function ChatThread({ conversationId, closed }: { conversationId: string; closed?: boolean }) {
  const { t, lang } = useT();
  const user = useAuth((s) => s.user);
  const toast = useUI((s) => s.toast);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at')
      .then(({ data }) => {
        if (!alive) return;
        const loaded = (data ?? []) as Message[];
        setMsgs(loaded);
        setLoading(false);
        // Acknowledge only after this selected thread has loaded, and only if it contains incoming unread messages.
        if (loaded.some((m) => m.sender_id !== user?.id && !m.read_at))
          void supabase.rpc('mark_conversation_read', { p_conv: conversationId });
      });
    const ch = supabase
      .channel(`chat-${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (p) => {
          const m = p.new as Message;
          setMsgs((s) => (s.some((x) => x.id === m.id) ? s : [...s, m]));
          if (m.sender_id !== user?.id) void supabase.rpc('mark_conversation_read', { p_conv: conversationId });
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (p) => {
          const updated = p.new as Message;
          setMsgs((items) => items.map((m) => (m.id === updated.id ? updated : m)));
        },
      )
      .subscribe();
    return () => {
      alive = false;
      void supabase.removeChannel(ch);
    };
  }, [conversationId, user?.id]);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [msgs.length]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || !user) return;
    setSending(true);
    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: user.id, body })
      .select()
      .single();
    setSending(false);
    if (error) {
      toast('error', t(errorKey(error)));
      return;
    }
    setText('');
    setMsgs((s) => (s.some((x) => x.id === (data as Message).id) ? s : [...s, data as Message]));
  };

  return (
    <div className="flex h-[60vh] min-h-[380px] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl bg-ivory-dark/50 p-3 sm:p-4" aria-live="polite">
        {loading && (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        )}
        {msgs.map((m) => {
          const mine = m.sender_id === user?.id;
          const isAdmin = m.sender_role === 'admin';
          return (
            <div key={m.id} className={cn('flex', isAdmin ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-soft sm:max-w-[75%]',
                  isAdmin ? 'bg-bordeaux text-ivory' : 'border border-gold/40 bg-white text-ink',
                )}
              >
                <p className={cn('mb-1 text-[10px] font-bold uppercase tracking-wide', isAdmin ? 'text-gold' : 'text-bordeaux')}>
                  {isAdmin ? 'DOSSORA · Administration' : t('messages.customer_label')}
                </p>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={cn('mt-1 flex flex-wrap items-center justify-between gap-x-3 text-[10px]', isAdmin ? 'text-ivory/70' : 'text-ink/50')}>
                  {formatDate(m.created_at, lang, true)}
                  {mine && <span>{m.read_at ? t('messages.read') : t('messages.sent')}</span>}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      {closed ? (
        <p className="mt-3 text-center text-xs text-ink/60">{t('messages.closed')}</p>
      ) : (
        <form onSubmit={send} className="mt-3 flex gap-2">
          <label className="sr-only" htmlFor="chat-input">
            {t('messages.write')}
          </label>
          <textarea
            id="chat-input"
            className="input min-h-[44px] flex-1 resize-none"
            rows={2}
            maxLength={4000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('messages.write')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button className="btn-primary self-end" disabled={sending || !text.trim()} aria-label={t('messages.send')}>
            {sending ? <Spinner className="h-4 w-4" /> : <Icon name="right" className="h-4 w-4 rtl:rotate-180" />}
          </button>
        </form>
      )}
    </div>
  );
}
