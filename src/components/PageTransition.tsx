import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

/** Entrée de page : fondu + glissement de 8 px (≈ 280 ms). Le chemin change → la page se remonte et s'anime. */
export function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  // Les sous-pages du compte partagent leur navigation : on ne rejoue pas l'animation du cadre.
  const key = pathname.startsWith('/account') ? '/account' : pathname;
  return (
    <div key={key} className="animate-page-in">
      {children}
    </div>
  );
}
