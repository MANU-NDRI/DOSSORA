import { NotificationList } from '@/components/NotificationList';
import { PageHeader } from '@/components/ui';
import { useT } from '@/i18n';
export default function Notifications() {
  const { t } = useT();
  return (
    <div>
      <PageHeader title={t('account.notifications')} />
      <NotificationList />
    </div>
  );
}
