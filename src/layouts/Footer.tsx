import { Link, useLocation } from 'react-router-dom';
import { Logo } from '@/components/Brand';
import { Icon } from '@/components/Icon';
import { useT } from '@/i18n';
import { SHOP_EMAIL, WHATSAPP_DISPLAY, waLink } from '@/lib/utils';

export function Footer() {
  const { t } = useT();
  const isOrderDetail = /^\/account\/orders\/[^/]+\/?$/.test(useLocation().pathname);
  const legal: Array<[string, string]> = [
    ['/terms', t('legal.terms.title')],
    ['/privacy', t('legal.privacy.title')],
    ['/legal-notice', t('legal.legal_notice.title')],
    ['/cookies', t('legal.cookies.title')],
    ['/returns', t('legal.returns.title')],
    ['/shipping-policy', t('legal.shipping.title')],
    ['/payment-policy', t('legal.payment.title')],
  ];
  return (
    <footer className={`${isOrderDetail ? '' : 'mt-20'} bg-bordeaux text-ivory`}>
      <div className="container-x grid gap-10 py-12 md:grid-cols-2 xl:grid-cols-4">
        <div className="md:col-span-1">
          <Logo light tagline />
          <p className="mt-4 max-w-xs text-sm text-ivory/75">{t('footer.about')}</p>
        </div>
        <div>
          <h3 className="mb-3 font-display text-xl text-gold">{t('footer.shop')}</h3>
          <ul className="space-y-2 text-sm">
            <li>
              <Link className="hover:text-gold" to="/shop">
                {t('nav.shop')}
              </Link>
            </li>
            <li>
              <Link className="hover:text-gold" to="/shop?flag=new">
                {t('nav.new')}
              </Link>
            </li>
            <li>
              <Link className="hover:text-gold" to="/shop?flag=sale">
                {t('nav.sale')}
              </Link>
            </li>
            <li>
              <Link className="hover:text-gold" to="/account">
                {t('nav.account')}
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 font-display text-xl text-gold">{t('footer.legal')}</h3>
          <ul className="space-y-2 text-sm">
            {legal.map(([to, label]) => (
              <li key={to}>
                <Link className="hover:text-gold" to={to}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-3 font-display text-xl text-gold">{t('footer.contact')}</h3>
          <ul className="space-y-3 text-sm">
            <li>
              <a className="flex items-center gap-2 hover:text-gold" href={`mailto:${SHOP_EMAIL}`}>
                <Icon name="mail" className="h-4 w-4 text-gold" />
                <span dir="ltr" className="min-w-0 break-all">
                  {SHOP_EMAIL}
                </span>
              </a>
            </li>
            <li>
              <a
                className="flex items-center gap-2 hover:text-gold"
                href={waLink(t('wa.general'))}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon name="whatsapp" className="h-4 w-4 text-gold" />
                <span dir="ltr">{WHATSAPP_DISPLAY}</span>
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-ivory/60">
        © {new Date().getFullYear()} DOSSORA — {t('brand.slogan')}
      </div>
    </footer>
  );
}
