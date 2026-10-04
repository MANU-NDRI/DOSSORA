/**
 * Design system des animations DOSSORA.
 * Règles : transform + opacity uniquement (GPU), durées courtes, CSS d'abord, JS seulement si nécessaire.
 * Les mêmes valeurs existent côté Tailwind (transitionDuration fast/normal/slow, ease-dossora).
 */
export const DURATION = { fast: 0.15, normal: 0.25, slow: 0.4 } as const;
export const EASE = [0.22, 0.61, 0.36, 1] as const;
export const STAGGER_MS = 45;

export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Délai d'apparition en cascade (plafonné pour que les longues listes n'attendent pas). */
export const staggerDelay = (index: number, max = 7): string => `${Math.min(index, max) * STAGGER_MS}ms`;

export const CART_BUMP_EVENT = 'dossora:cart-bump';
let flyingUntil = 0;
/** Vrai tant que la miniature vole vers le panier : le badge attend l'atterrissage pour se mettre à jour. */
export const cartFlightRemaining = (): number => Math.max(0, flyingUntil - Date.now());

const FLIGHT_MS = 650;

/** Miniature du produit qui "vole" de `from` vers l'icône panier (Web Animations API, transform + opacity). */
export function flyToCart(from: Element | null | undefined, imageUrl: string | null): void {
  if (!from || typeof document === 'undefined' || prefersReducedMotion()) {
    window.dispatchEvent(new Event(CART_BUMP_EVENT));
    return;
  }
  const target = document.querySelector('[data-cart-icon]');
  const a = from.getBoundingClientRect();
  const b = target?.getBoundingClientRect();
  if (!b || !a.width || !b.width) {
    window.dispatchEvent(new Event(CART_BUMP_EVENT));
    return;
  }
  const size = 56;
  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  Object.assign(el.style, {
    position: 'fixed',
    left: `${a.left + a.width / 2 - size / 2}px`,
    top: `${a.top + a.height / 2 - size / 2}px`,
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '14px',
    backgroundColor: '#EFE7D8',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    border: '2px solid #C9A45C',
    boxShadow: '0 10px 28px rgba(122,31,61,.35)',
    zIndex: '120',
    pointerEvents: 'none',
    willChange: 'transform, opacity',
    backgroundImage: imageUrl ? `url("${imageUrl.replace(/["\\]/g, '')}")` : 'none',
  });
  document.body.appendChild(el);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  flyingUntil = Date.now() + FLIGHT_MS;
  const anim = el.animate(
    [
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${dx * 0.55}px, ${dy * 0.55 - 48}px) scale(0.75)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.2)`, opacity: 0.2 },
    ],
    { duration: FLIGHT_MS, easing: 'cubic-bezier(0.4, 0.1, 0.2, 1)' },
  );
  const done = () => {
    el.remove();
    window.dispatchEvent(new Event(CART_BUMP_EVENT));
  };
  anim.onfinish = done;
  anim.oncancel = done;
}
