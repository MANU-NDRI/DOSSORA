import { useT } from '@/i18n';

/** Confirmation de commande : cercle qui s'ouvre, coche tracée, message sobre. Pur CSS (aucun JS d'animation). */
export function OrderSuccessAnimation({ orderNumber }: { orderNumber: string }) {
  const { t } = useT();
  return (
    <div
      role="status"
      className="relative overflow-hidden rounded-3xl border border-gold/60 bg-gradient-to-b from-gold/15 to-ivory px-5 py-8 text-center"
    >
      <svg viewBox="0 0 80 80" className="mx-auto h-20 w-20" aria-hidden>
        <circle
          cx="40"
          cy="40"
          r="36"
          fill="none"
          stroke="#C9A45C"
          strokeWidth="2"
          strokeOpacity="0.35"
          className="origin-center animate-ring"
          style={{ animationDelay: '0.12s' }}
        />
        <circle cx="40" cy="40" r="30" fill="#7A1F3D" className="origin-center animate-ring" />
        <path
          d="M27 41 l9 9 l17 -19"
          fill="none"
          stroke="#F8F3EA"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1}
          className="animate-draw"
        />
      </svg>
      <h2 className="mt-4 animate-rise text-3xl" style={{ animationDelay: '0.45s' }}>
        {t('orders.confirmed_title')}
      </h2>
      <p className="mt-1 animate-rise text-sm text-ink/80" style={{ animationDelay: '0.55s' }}>
        {t('orders.confirmed_text', { n: orderNumber })}
      </p>
      <p className="mt-2 animate-rise font-display text-lg italic text-gold-dark" style={{ animationDelay: '0.7s' }}>
        {t('orders.confirmed_thanks')}
      </p>
    </div>
  );
}
