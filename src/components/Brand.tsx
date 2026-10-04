import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useT } from '@/i18n';
import { DURATION, EASE } from '@/lib/motion';

export function Logo({ light = false, tagline = false }: { light?: boolean; tagline?: boolean }) {
  const { t } = useT();
  return (
    <Link to="/" className="inline-flex flex-col leading-none" aria-label="DOSSORA">
      <span
        className={`font-display text-2xl font-bold tracking-[0.28em] sm:text-3xl md:text-2xl lg:text-3xl ${light ? 'text-ivory' : 'text-bordeaux'}`}
        dir="ltr"
      >
        DOSSORA
      </span>
      <span className="mt-1 h-px w-full bg-gold" />
      {tagline && (
        <span className={`mt-1.5 text-[10px] tracking-wide ${light ? 'text-gold-light' : 'text-gold-dark'}`}>{t('brand.slogan')}</span>
      )}
    </Link>
  );
}

/** Écran d'ouverture (≈ 1,6 s) : fond ivoire, logo qui monte en fondu, halo doré discret, signature, sortie en fondu. */
export function SplashLoader() {
  const { t } = useT();
  return (
    <motion.div
      role="status"
      aria-live="polite"
      aria-label={t('common.loading')}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-ivory"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: DURATION.slow, ease: EASE }}
    >
      <div aria-hidden className="absolute h-72 w-72 animate-glow rounded-full bg-gold/40 blur-3xl sm:h-96 sm:w-96" />
      <motion.div
        className="relative font-display text-4xl font-bold tracking-[0.3em] text-bordeaux sm:text-6xl"
        dir="ltr"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: EASE }}
      >
        DOSSORA
      </motion.div>
      <motion.div
        className="relative mt-3 h-px bg-gold"
        initial={{ width: 0 }}
        animate={{ width: 180 }}
        transition={{ duration: 0.6, delay: 0.25, ease: EASE }}
      />
      <motion.p
        className="relative mt-3 font-display text-lg italic text-gold-dark"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.55 }}
      >
        {t('brand.tagline')}
      </motion.p>
    </motion.div>
  );
}
