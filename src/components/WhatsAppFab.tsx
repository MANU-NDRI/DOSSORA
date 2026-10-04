import { useLocation } from 'react-router-dom';
import { Icon } from './Icon';
import { useT } from '@/i18n';
import { waLink } from '@/lib/utils';

export function WhatsAppFab() {
  const { t } = useT();
  const { pathname } = useLocation();
  if (pathname.startsWith('/admin')) return null;
  return (
    <a
      href={waLink(t('wa.general'))}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="WhatsApp"
      className="fixed bottom-4 end-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-bordeaux text-gold shadow-soft ring-2 ring-gold transition hover:scale-105 hover:bg-bordeaux-dark"
    >
      <Icon name="whatsapp" className="h-7 w-7" />
    </a>
  );
}
