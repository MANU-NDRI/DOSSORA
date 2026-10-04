import { useCallback, useState } from 'react';
import { GeoError, getCurrentLocation } from '@/services/geolocation';
import type { GeoErrorKind, UserLocation } from '@/types';

type GeoState = { status: 'idle' | 'loading' } | { status: 'granted'; location: UserLocation } | { status: 'error'; kind: GeoErrorKind };

/** Demande la position à la demande (jamais automatiquement). Une erreur ne bloque rien : l'adresse manuelle reste disponible. */
export function useGeolocation() {
  const [state, setState] = useState<GeoState>({ status: 'idle' });
  const request = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      setState({ status: 'granted', location: await getCurrentLocation() });
    } catch (e) {
      const kind: GeoErrorKind = e instanceof GeoError ? e.kind : 'unknown';
      if (import.meta.env.DEV) console.warn('[DOSSORA] Géolocalisation', kind, e);
      setState({ status: 'error', kind });
    }
  }, []);
  const clear = useCallback(() => setState({ status: 'idle' }), []);
  return { state, request, clear, location: state.status === 'granted' ? state.location : null };
}
