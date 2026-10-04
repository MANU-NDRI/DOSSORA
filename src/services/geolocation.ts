import { supabase } from '@/lib/supabase';
import type { GeoErrorKind, UserLocation } from '@/types';

/** Erreur de géolocalisation typée : `kind` sert à choisir un message utilisateur traduit. */
export class GeoError extends Error {
  constructor(
    public readonly kind: GeoErrorKind,
    cause?: unknown,
  ) {
    super(`geolocation:${kind}`);
    this.name = 'GeoError';
    if (cause !== undefined) this.cause = cause;
  }
}

export const geoErrorKey = (kind: GeoErrorKind): string => `geo.error_${kind}`;

/**
 * Lit la position actuelle via l'API native du navigateur.
 * À appeler UNIQUEMENT après une action explicite de l'utilisateur (le navigateur affiche alors sa demande de permission).
 */
export function getCurrentLocation(): Promise<UserLocation> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return reject(new GeoError('unsupported'));
    if (typeof window !== 'undefined' && window.isSecureContext === false) return reject(new GeoError('insecure'));
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          accuracy: Number.isFinite(p.coords.accuracy) ? p.coords.accuracy : null,
          timestamp: p.timestamp,
        }),
      (e) =>
        reject(
          new GeoError(
            e.code === e.PERMISSION_DENIED
              ? 'denied'
              : e.code === e.POSITION_UNAVAILABLE
                ? 'unavailable'
                : e.code === e.TIMEOUT
                  ? 'timeout'
                  : 'unknown',
            e,
          ),
        ),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  });
}

export const isValidLocation = (l: Pick<UserLocation, 'latitude' | 'longitude'>): boolean =>
  Number.isFinite(l.latitude) && Number.isFinite(l.longitude) && Math.abs(l.latitude) <= 90 && Math.abs(l.longitude) <= 180;

/** Enregistre la position sur la commande (fonction SQL réservée au propriétaire de la commande). */
export async function attachOrderLocation(orderId: string, loc: UserLocation): Promise<void> {
  const { error } = await supabase.rpc('attach_order_location', {
    p_order: orderId,
    p_lat: loc.latitude,
    p_lng: loc.longitude,
    p_accuracy: loc.accuracy,
    p_captured_at: new Date(loc.timestamp).toISOString(),
  });
  if (error) throw error;
}

const addressCache = new Map<string, string | null>();
/**
 * Adresse lisible via Nominatim (OpenStreetMap, gratuit). À déclencher manuellement (conditions d'usage : ≤ 1 requête/s, pas de
 * géocodage en masse). Pour un fort volume, hébergez votre propre instance ou changez de fournisseur.
 */
export async function reverseGeocode(latitude: number, longitude: number, lang: string, signal?: AbortSignal): Promise<string | null> {
  const key = `${latitude.toFixed(5)},${longitude.toFixed(5)},${lang}`;
  if (addressCache.has(key)) return addressCache.get(key) ?? null;
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&accept-language=${encodeURIComponent(lang)}`;
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`NOMINATIM_${res.status}`);
  const json = (await res.json()) as { display_name?: string };
  const out = json.display_name ?? null;
  addressCache.set(key, out);
  return out;
}

/** Liens OpenStreetMap (carte intégrée gratuite, aucune clé d'API). */
export const osmEmbedUrl = (lat: number, lng: number, delta = 0.004): string =>
  `https://www.openstreetmap.org/export/embed.html?bbox=${lng - delta},${lat - delta},${lng + delta},${lat + delta}&layer=mapnik&marker=${lat},${lng}`;
export const osmLinkUrl = (lat: number, lng: number): string =>
  `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
