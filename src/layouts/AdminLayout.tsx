import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Icon, type IconName } from '@/components/Icon';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { NotificationBell } from '@/components/NotificationBell';
import { Seo } from '@/components/Seo';
import { useT } from '@/i18n';
import { useAuth } from '@/store/auth';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/ui';
import { invalidateCache } from '@/hooks/useData';

const ITEMS: Array<{ to: string; key: string; icon: IconName }> = [
  { to: '/admin/dashboard', key: 'admin.nav.dashboard', icon: 'chart' },
  { to: '/admin/products', key: 'admin.nav.products', icon: 'box' },
  { to: '/admin/categories', key: 'admin.nav.categories', icon: 'grid' },
  { to: '/admin/orders', key: 'admin.nav.orders', icon: 'bag' },
  { to: '/admin/inventory', key: 'admin.nav.inventory', icon: 'sliders' },
  { to: '/admin/customers', key: 'admin.nav.customers', icon: 'users' },
  { to: '/admin/newsletter', key: 'admin.nav.newsletter', icon: 'mail' },
  { to: '/admin/messages', key: 'admin.nav.messages', icon: 'message' },
  { to: '/admin/notifications', key: 'admin.nav.notifications', icon: 'bell' },
  { to: '/admin/promotions', key: 'admin.nav.promotions', icon: 'tag' },
  { to: '/admin/shipping', key: 'admin.nav.shipping', icon: 'truck' },
  { to: '/admin/payments', key: 'admin.nav.payments', icon: 'card' },
  { to: '/admin/homepage', key: 'admin.nav.homepage', icon: 'image' },
  { to: '/admin/settings', key: 'admin.nav.settings', icon: 'sliders' },
];

export function AdminLayout() {
  const { t } = useT();
  const nav = useNavigate();
  const signOut = useAuth((s) => s.signOut);
  const [open, setOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const links = (
    <nav aria-label={t('admin.title')} className="flex flex-col gap-0.5">
      {ITEMS.map((i) => (
        <NavLink
          key={i.to}
          to={i.to}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
              isActive ? 'bg-gold text-bordeaux-dark' : 'text-ivory/85 hover:bg-white/10',
            )
          }
        >
          <Icon name={i.icon} className="h-4 w-4" />
          {t(i.key)}
        </NavLink>
      ))}
      <Link
        to="/"
        onClick={() => setOpen(false)}
        className="mt-3 flex items-center gap-3 rounded-xl border border-white/15 px-3 py-2.5 text-sm font-medium text-ivory/85 hover:bg-white/10 lg:hidden"
      >
        <Icon name="home" className="h-4 w-4" />
        {t('admin.view_shop')}
      </Link>
    </nav>
  );
  return (
    <div className="min-h-screen bg-ivory-dark/40 lg:grid lg:grid-cols-[250px_1fr]">
      <Seo title={t('admin.nav.dashboard')} noindex />
      <aside className="hidden bg-bordeaux p-4 lg:block">
        <Link to="/admin/dashboard" className="mb-6 block px-3 pt-2 font-display text-2xl font-bold tracking-[0.25em] text-ivory" dir="ltr">
          DOSSORA
        </Link>
        {links}
      </aside>
      {open && (
        <div
          className="fixed inset-0 z-[60] bg-ink/50 lg:hidden"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <aside className="h-full w-72 overflow-y-auto bg-bordeaux p-4">
            <div className="mb-4 flex items-center justify-between">
              <span className="px-3 font-display text-2xl font-bold tracking-[0.25em] text-ivory" dir="ltr">
                DOSSORA
              </span>
              <button onClick={() => setOpen(false)} aria-label={t('common.close')} className="rounded-full p-2 text-ivory">
                <Icon name="x" />
              </button>
            </div>
            {links}
          </aside>
        </div>
      )}
      <div className="min-w-0">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-bordeaux/10 bg-ivory/95 px-4 backdrop-blur">
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full text-bordeaux hover:bg-bordeaux/10 lg:hidden"
            onClick={() => setOpen(true)}
            aria-label={t('nav.menu')}
          >
            <Icon name="menu" />
          </button>
          <Link to="/" className="hidden items-center gap-1 text-xs font-semibold text-bordeaux hover:underline lg:flex">
            <span aria-hidden className="rtl:rotate-180">
              ←
            </span>
            {t('admin.view_shop')}
          </Link>
          <div className="flex items-center gap-1">
            <LanguageSwitcher />
            <NotificationBell to="/admin/notifications" />
            <button
              onClick={() => setConfirmLogout(true)}
              className="flex h-10 items-center justify-center gap-2 rounded-full px-3 text-sm font-medium text-red-700 hover:bg-red-50"
              aria-label={t('common.logout_action')}
            >
              <Icon name="logout" />
              <span className="hidden sm:inline">{t('common.logout_action')}</span>
            </button>
          </div>
        </header>
        <main className="p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
      <Modal open={confirmLogout} onClose={() => setConfirmLogout(false)} title={t('account.logout')}>
        <p className="text-sm">{t('common.confirm_logout')}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-outline" onClick={() => setConfirmLogout(false)}>{t('common.cancel')}</button>
          <button className="btn-primary" onClick={async () => {
            await signOut();
            invalidateCache();
            setConfirmLogout(false);
            nav('/admin/login', { replace: true });
          }}>{t('common.logout_action')}</button>
        </div>
      </Modal>
    </div>
  );
}
