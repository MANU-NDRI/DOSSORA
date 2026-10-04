import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Icon, type IconName } from '@/components/Icon';
import { useT } from '@/i18n';
import { useAuth } from '@/store/auth';
import { useNotifications } from '@/hooks/useNotifications';
import { Seo } from '@/components/Seo';
import { invalidateCache } from '@/hooks/useData';
import { Modal } from '@/components/ui';
import { useState } from 'react';

const ITEMS: Array<{ to: string; key: string; icon: IconName; end?: boolean }> = [
  { to: '/account', key: 'account.overview', icon: 'home', end: true },
  { to: '/account/orders', key: 'account.orders', icon: 'box' },
  { to: '/account/profile', key: 'account.profile', icon: 'user' },
  { to: '/account/addresses', key: 'account.addresses', icon: 'map' },
  { to: '/account/messages', key: 'account.messages', icon: 'message' },
  { to: '/account/notifications', key: 'account.notifications', icon: 'bell' },
  { to: '/account/security', key: 'account.security', icon: 'lock' },
];

export function AccountLayout() {
  const { t } = useT();
  const nav = useNavigate();
  const profile = useAuth((s) => s.profile);
  const signOut = useAuth((s) => s.signOut);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const { unread } = useNotifications(50);
  const cls = ({ isActive }: { isActive: boolean }) =>
    `flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition lg:rounded-xl ${isActive ? 'bg-bordeaux text-ivory' : 'text-ink/80 hover:bg-bordeaux/5'}`;
  return (
    <div className="container-x py-8 sm:py-10">
      <Seo title={t('account.title')} noindex />
      <div className="mb-6">
        <Link to="/" className="mb-2 inline-flex items-center gap-1 text-xs text-bordeaux hover:underline">
          <span aria-hidden className="rtl:rotate-180">
            ←
          </span>
          {t('nav.back_home')}
        </Link>
        <h1 className="text-3xl sm:text-4xl">{t('account.hello', { name: profile?.first_name ?? '' })}</h1>
        <div className="gold-rule mt-3" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <nav
          aria-label={t('account.title')}
          className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0"
        >
          {ITEMS.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.end} className={cls}>
              <Icon name={i.icon} className="h-4 w-4" />
              {t(i.key)}
              {i.icon === 'bell' && unread > 0 && (
                <span className="rounded-full bg-gold px-1.5 text-[10px] font-bold text-bordeaux-dark">{unread}</span>
              )}
            </NavLink>
          ))}
          {profile?.role === 'admin' && (
            <Link to="/admin" className="flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-bordeaux hover:bg-bordeaux/5 lg:rounded-xl">
              <Icon name="shield" className="h-4 w-4" />
              {t('account.admin_access')}
            </Link>
          )}
          <button
            onClick={() => setConfirmLogout(true)}
            className="flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 lg:rounded-xl"
          >
            <Icon name="logout" className="h-4 w-4" />
            {t('common.logout_action')}
          </button>
        </nav>
        <section className="min-w-0">
          <Outlet />
        </section>
      </div>
      <Modal open={confirmLogout} onClose={() => setConfirmLogout(false)} title={t('account.logout')}>
        <p className="text-sm">{t('common.confirm_logout')}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-outline" onClick={() => setConfirmLogout(false)}>{t('common.cancel')}</button>
          <button className="btn-primary" onClick={async () => {
            await signOut();
            invalidateCache();
            setConfirmLogout(false);
            nav('/login', { replace: true });
          }}>{t('common.logout_action')}</button>
        </div>
      </Modal>
    </div>
  );
}
