import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Logo } from '@/components/Brand';
import { Icon } from '@/components/Icon';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { NotificationBell } from '@/components/NotificationBell';
import { useT } from '@/i18n';
import { useAuth } from '@/store/auth';
import { cartCount, useCart, useFavorites } from '@/store/cart';
import { useUI } from '@/store/ui';
import { useSettings } from '@/hooks/useData';
import { loc } from '@/lib/utils';
import { CART_BUMP_EVENT, cartFlightRemaining, staggerDelay } from '@/lib/motion';

export function Header() {
  const { t, lang } = useT();
  const user = useAuth((s) => s.user);
  const count = useCart((s) => cartCount(s.items));
  const favCount = useFavorites((s) => s.ids.length);
  // Le badge attend l'atterrissage de la miniature avant d'afficher le nouveau nombre ; l'icône rebondit à l'arrivée.
  const [shownCount, setShownCount] = useState(count);
  const [bump, setBump] = useState(0);
  useEffect(() => {
    const wait = cartFlightRemaining();
    if (!wait) {
      setShownCount(count);
      return;
    }
    const id = setTimeout(() => setShownCount(count), wait);
    return () => clearTimeout(id);
  }, [count]);
  useEffect(() => {
    const h = () => setBump((n) => n + 1);
    window.addEventListener(CART_BUMP_EVENT, h);
    return () => window.removeEventListener(CART_BUMP_EVENT, h);
  }, []);
  const { menuOpen, setMenu, setSearch } = useUI();
  const settings = useSettings();
  const { pathname } = useLocation();
  useEffect(() => {
    setMenu(false);
  }, [pathname, setMenu]);
  const announcement = loc(settings, 'announcement', lang);
  const links = [
    { to: '/', label: t('nav.home'), end: true },
    { to: '/shop', label: t('nav.shop'), end: true },
    { to: '/shop?flag=new', label: t('nav.new'), end: false },
    { to: '/shop?flag=sale', label: t('nav.sale'), end: false },
    { to: '/returns', label: t('nav.returns'), end: false },
  ];
  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-3 py-2 text-sm font-medium transition hover:text-bordeaux ${isActive ? 'text-bordeaux' : 'text-ink/80'}`;
  return (
    <header className="sticky top-0 z-50 bg-ivory/95 backdrop-blur">
      {announcement && (
        <div className="bg-bordeaux px-4 py-1.5 text-center text-[11px] font-medium text-gold-light sm:text-xs">{announcement}</div>
      )}
      <div className="container-x flex h-16 items-center justify-between gap-2 border-b border-bordeaux/10 sm:h-20">
        <div className="flex items-center gap-1 xl:hidden">
          <button
            onClick={() => setMenu(true)}
            aria-label={t('nav.menu')}
            aria-expanded={menuOpen}
            className="hidden h-10 w-10 items-center justify-center rounded-full text-bordeaux hover:bg-bordeaux/10 min-[360px]:flex"
          >
            <Icon name="menu" />
          </button>
        </div>
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 xl:flex">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={linkCls}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-0.5 sm:gap-1">
          <button
            onClick={() => setSearch(true)}
            aria-label={t('nav.search')}
            className="flex h-10 w-10 items-center justify-center rounded-full text-bordeaux hover:bg-bordeaux/10"
          >
            <Icon name="search" />
          </button>
          <span className="hidden sm:block">
            <LanguageSwitcher />
          </span>
          <Link
            to="/favorites"
            aria-label={t('nav.favorites')}
            className="relative hidden h-10 w-10 items-center justify-center rounded-full text-bordeaux hover:bg-bordeaux/10 lg:flex"
          >
            <Icon name="heart" />
            {favCount > 0 && <span className="absolute end-1 top-1 h-2 w-2 rounded-full bg-gold" />}
          </Link>
          {user && <NotificationBell to="/account/notifications" />}
          {user ? (
            <Link
              to="/account"
              aria-label={t('nav.account')}
              className="flex h-10 w-10 items-center justify-center rounded-full text-bordeaux hover:bg-bordeaux/10"
            >
              <Icon name="user" />
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                aria-label={t('auth.login')}
                className="flex h-10 w-10 items-center justify-center rounded-full text-bordeaux hover:bg-bordeaux/10 md:hidden"
              >
                <Icon name="user" />
              </Link>
              <Link to="/login" className="btn-ghost btn-sm hidden whitespace-nowrap md:inline-flex">
                {t('auth.login')}
              </Link>
              <Link to="/register" className="btn-primary btn-sm hidden whitespace-nowrap md:inline-flex">
                {t('auth.signup_short')}
              </Link>
            </>
          )}
          <Link
            to="/cart"
            data-cart-icon
            aria-label={`${t('nav.cart')} (${count})`}
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-bordeaux transition-colors duration-fast hover:bg-bordeaux/10"
          >
            <span key={bump} className={bump ? 'animate-bump' : undefined}>
              <Icon name="bag" />
            </span>
            <AnimatePresence>
              {shownCount > 0 && (
                <motion.span
                  key={shownCount}
                  initial={{ scale: 0.4 }}
                  animate={{ scale: 1 }}
                  className="absolute end-0.5 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-bordeaux px-1 text-[10px] font-bold text-ivory"
                >
                  {shownCount}
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        </div>
      </div>
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="fixed inset-0 z-[65] bg-ink/50 xl:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setMenu(false);
            }}
          >
            <motion.aside
              initial={{ x: lang === 'ar' ? 320 : -320 }}
              animate={{ x: 0 }}
              exit={{ x: lang === 'ar' ? 320 : -320 }}
              transition={{ type: 'tween', duration: 0.22 }}
              className="h-full w-[85%] max-w-sm overflow-y-auto bg-ivory p-5 shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-label={t('nav.menu')}
            >
              <div className="mb-6 flex items-center justify-between">
                <Logo tagline />
                <button
                  onClick={() => setMenu(false)}
                  aria-label={t('common.close')}
                  className="rounded-full p-2 text-bordeaux hover:bg-bordeaux/10"
                >
                  <Icon name="x" />
                </button>
              </div>
              {!user && (
                <div className="mb-4 grid grid-cols-2 gap-2">
                  <Link to="/login" className="btn-outline">
                    {t('auth.login')}
                  </Link>
                  <Link to="/register" className="btn-primary">
                    {t('auth.signup_short')}
                  </Link>
                </div>
              )}
              <nav className="flex flex-col">
                {[
                  ...links.map((l) => ({ to: l.to, end: l.end, label: l.label })),
                  { to: '/favorites', end: false, label: t('nav.favorites') },
                  { to: user ? '/account' : '/login', end: false, label: user ? t('nav.account') : t('auth.login') },
                  ...(user ? [] : [{ to: '/register', end: false, label: t('auth.signup_short') }]),
                ].map((l, i) => (
                  <NavLink
                    key={l.to + l.label}
                    to={l.to}
                    end={l.end}
                    style={{ animationDelay: `calc(120ms + ${staggerDelay(i)})` }}
                    className="animate-rise border-b border-bordeaux/10 py-3.5 text-base font-medium text-ink"
                  >
                    {l.label}
                  </NavLink>
                ))}
              </nav>
              <div className="mt-6">
                <LanguageSwitcher />
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
