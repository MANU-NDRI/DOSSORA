import { useState } from 'react';
import { Icon } from './Icon';
import { useT } from '@/i18n';
import { useFavorites } from '@/store/cart';
import { useUI } from '@/store/ui';
import { cn } from '@/lib/utils';

const PARTICLES = Array.from({ length: 6 }, (_, i) => {
  const angle = (i / 6) * Math.PI * 2;
  return { tx: `${Math.round(Math.cos(angle) * 18)}px`, ty: `${Math.round(Math.sin(angle) * 18)}px` };
});

interface Props {
  productId: string;
  variant?: 'icon' | 'labeled';
  className?: string;
}

/** Cœur favori : pop + rebond, quelques particules dorées très discrètes, notification traduite. */
export function FavoriteButton({ productId, variant = 'icon', className }: Props) {
  const { t } = useT();
  const active = useFavorites((s) => s.ids.includes(productId));
  const toggle = useFavorites((s) => s.toggle);
  const toast = useUI((s) => s.toast);
  const [burst, setBurst] = useState(0);
  const onClick = () => {
    toggle(productId);
    if (!active) setBurst((n) => n + 1);
    toast('success', t(active ? 'favorites.removed' : 'favorites.added'));
  };
  const heart = (
    <span className="relative inline-flex">
      <span key={`${active}-${burst}`} className={cn('inline-flex', active && 'animate-pop')}>
        <Icon name="heart" filled={active} className="h-4 w-4" />
      </span>
      {burst > 0 && active && (
        <span key={burst} aria-hidden className="pointer-events-none absolute inset-0">
          {PARTICLES.map((p, i) => (
            <span
              key={i}
              className="absolute left-1/2 top-1/2 -ms-[2px] -mt-[2px] h-1 w-1 animate-particle rounded-full bg-gold"
              style={{ '--tx': p.tx, '--ty': p.ty } as React.CSSProperties}
            />
          ))}
        </span>
      )}
    </span>
  );
  if (variant === 'labeled') {
    return (
      <button type="button" className={cn('btn-outline btn-sm', className)} aria-pressed={active} onClick={onClick}>
        {heart}
        {t('product.favorite')}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={t('product.favorite')}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-bordeaux shadow-soft transition duration-fast active:scale-90',
        className,
      )}
    >
      {heart}
    </button>
  );
}
