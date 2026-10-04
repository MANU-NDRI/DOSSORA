import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { PageTransition } from '@/components/PageTransition';
import { Footer } from './Footer';
import { WhatsAppFab } from '@/components/WhatsAppFab';
import { SearchOverlay } from '@/components/SearchOverlay';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useT } from '@/i18n';

export function MainLayout() {
  const { t } = useT();
  const isOrderDetail = /^\/account\/orders\/[^/]+\/?$/.test(useLocation().pathname);
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:bg-gold focus:p-3">
        {t('nav.skip')}
      </a>
      {!isSupabaseConfigured && <div className="bg-amber-100 px-4 py-2 text-center text-xs text-amber-900">{t('config.missing')}</div>}
      <Header />
      <main id="main" className={isOrderDetail ? undefined : 'flex-1'}>
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>
      <Footer />
      <SearchOverlay />
      <WhatsAppFab />
    </div>
  );
}
