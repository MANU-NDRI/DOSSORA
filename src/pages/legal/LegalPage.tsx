import { useLocation } from 'react-router-dom';
import { Seo } from '@/components/Seo';
import { useT } from '@/i18n';
import { SHOP_EMAIL, WHATSAPP_DISPLAY } from '@/lib/utils';

const MAP: Record<string, string> = {
  '/privacy': 'privacy',
  '/terms': 'terms',
  '/legal-notice': 'legal_notice',
  '/cookies': 'cookies',
  '/returns': 'returns',
  '/shipping-policy': 'shipping',
  '/payment-policy': 'payment',
};
interface Section {
  h: string;
  p: string;
}

export default function LegalPage() {
  const { t, tr } = useT();
  const { pathname } = useLocation();
  const key = MAP[pathname] ?? 'terms';
  const sections = tr<Section[]>(`legal.${key}.sections`) ?? [];
  return (
    <div className="container-x max-w-3xl py-10 sm:py-14">
      <Seo title={t(`legal.${key}.title`)} description={t(`legal.${key}.intro`)} />
      <h1 className="text-3xl sm:text-5xl">{t(`legal.${key}.title`)}</h1>
      <div className="gold-rule mb-6 mt-3" />
      <p className="mb-6 rounded-2xl border border-gold/60 bg-gold/10 p-4 text-xs text-ink/80" role="note">
        {t('legal.review_notice')}
      </p>
      <p className="mb-6 text-sm leading-relaxed text-ink/85">{t(`legal.${key}.intro`)}</p>
      <div className="space-y-6">
        {sections.map((s) => (
          <section key={s.h}>
            <h2 className="mb-2 text-2xl">{s.h}</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink/85">{s.p}</p>
          </section>
        ))}
      </div>
      <p className="mt-10 border-t border-bordeaux/10 pt-4 text-xs text-ink/60">
        {t('legal.contact')} :{' '}
        <a className="link" href={`mailto:${SHOP_EMAIL}`}>
          {SHOP_EMAIL}
        </a>{' '}
        · WhatsApp <span dir="ltr">{WHATSAPP_DISPLAY}</span>
      </p>
    </div>
  );
}
