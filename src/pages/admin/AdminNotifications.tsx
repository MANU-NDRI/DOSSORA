import { NotificationList } from '@/components/NotificationList';
import { PageHeader } from '@/components/ui';
import { useT } from '@/i18n';

export default function AdminNotifications() {
  const { t } = useT();
  return (
    <div>
      <PageHeader title={t('admin.nav.notifications')} />
      <NotificationList />
    </div>
  );
}
