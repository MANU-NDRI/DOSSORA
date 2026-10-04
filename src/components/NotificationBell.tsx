import { Link } from 'react-router-dom';
import { Icon } from './Icon';
import { useNotifications } from '@/hooks/useNotifications';
import { useT } from '@/i18n';

export function NotificationBell({ to }: { to: string }) {
  const { unread } = useNotifications(50);
  const { t } = useT();
  return (
    <Link
      to={to}
      aria-label={`${t('nav.notifications')}${unread ? ` (${unread})` : ''}`}
      className="relative flex h-10 w-10 items-center justify-center rounded-full text-bordeaux hover:bg-bordeaux/10"
    >
      <Icon name="bell" />
      {unread > 0 && (
        <span className="absolute end-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-bordeaux-dark">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  );
}
