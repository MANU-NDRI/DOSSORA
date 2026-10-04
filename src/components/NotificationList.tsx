import { Link } from 'react-router-dom';
import { Icon } from './Icon';
import { useNotifications } from '@/hooks/useNotifications';
import { useSettings } from '@/hooks/useData';
import { useT } from '@/i18n';
import { formatDate, formatMoney, cn } from '@/lib/utils';
import { EmptyState, Spinner } from './ui';
import type { AppNotification } from '@/types';

export function NotificationList({ limit = 50 }: { limit?: number }) {
  const { t, lang } = useT();
  const { currency } = useSettings();
  const { items, loading, markRead, markAllRead, remove, unread } = useNotifications(limit);
  const text = (n: AppNotification) => {
    const p = n.params as Record<string, unknown>;
    if (n.type === 'custom' || n.type === 'promotion')
      return `${String(p.title ?? '')} — ${String(p.message ?? '')}${p.code ? `\n${t('cart.promo_code')}: ${String(p.code)}` : ''}`;
    return t(`notif.${n.type}`, {
      order_number: String(p.order_number ?? ''),
      client: String(p.client ?? ''),
      subject: String(p.subject ?? ''),
      product: String(p.product ?? ''),
      available: String(p.available ?? ''),
      total: p.total !== undefined ? formatMoney(Number(p.total), currency, lang) : '',
      status: p.status ? t(`status.${String(p.status)}`) : '',
      email: String(p.email ?? ''),
      title: String(p.title ?? ''),
      message: String(p.message ?? ''),
      recipients: String(p.recipients ?? ''),
    });
  };
  if (loading)
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  if (!items.length) return <EmptyState title={t('notif.empty')} />;
  return (
    <div>
      {unread > 0 && (
        <button className="btn-outline btn-sm mb-3" onClick={() => void markAllRead()}>
          {t('notif.mark_all')}
        </button>
      )}
      <ul className="card divide-y divide-bordeaux/10">
        {items.map((n) => {
          const inner = (
            <>
              <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read_at ? 'bg-transparent' : 'bg-gold')} />
              <span className="min-w-0 flex-1">
                <span className="block whitespace-pre-line text-sm">{text(n)}</span>
                <span className="text-xs text-ink/50">{formatDate(n.created_at, lang, true)}</span>
              </span>
            </>
          );
          return (
            <li key={n.id} className="flex items-center gap-2 pe-3">
              {n.link ? (
                <Link to={n.link} onClick={() => void markRead(n.id)} className="flex min-w-0 flex-1 gap-3 p-4 hover:bg-ivory">
                  {inner}
                </Link>
              ) : (
                <button onClick={() => void markRead(n.id)} className="flex min-w-0 flex-1 gap-3 p-4 text-start hover:bg-ivory">
                  {inner}
                </button>
              )}
              <button
                type="button"
                onClick={() => void remove(n.id)}
                aria-label={t('common.delete')}
                title={t('common.delete')}
                className="rounded-full p-2 text-ink/50 hover:bg-red-50 hover:text-red-700"
              >
                <Icon name="trash" className="h-4 w-4" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
