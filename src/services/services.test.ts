import { afterEach, describe, expect, it, vi } from 'vitest';
import { GeoError, geoErrorKey, getCurrentLocation, isValidLocation, osmEmbedUrl, osmLinkUrl } from './geolocation';
import { quoteShipping } from './shipping';
import type { ShippingCountry } from '@/types';

const country = (over: Partial<ShippingCountry> = {}): ShippingCountry =>
  ({
    code: 'FR',
    name_fr: 'France',
    currency: 'EUR',
    exchange_rate: 11,
    fee: 10,
    free_shipping_threshold: 1000,
    is_active: true,
    sort_order: 0,
    ...over,
  }) as ShippingCountry;

describe('frais de livraison', () => {
  it('convertit les frais du pays vers la devise de la boutique', () => {
    expect(quoteShipping(country(), null, 100)).toEqual({ fee: 110, base: 110, free: false });
  });
  it('un tarif par ville remplace les frais de base', () => {
    expect(quoteShipping(country(), 20, 100).fee).toBe(220);
  });
  it('livraison gratuite dès le seuil (devise boutique)', () => {
    expect(quoteShipping(country(), null, 1000)).toEqual({ fee: 0, base: 110, free: true });
    expect(quoteShipping(country({ free_shipping_threshold: null }), null, 99999).free).toBe(false);
  });
});

type GeoMock = { getCurrentPosition: (ok: (p: unknown) => void, err: (e: unknown) => void) => void };
const withGeo = (geo: GeoMock | undefined) => vi.stubGlobal('navigator', geo ? { geolocation: geo } : {});
const codes = { PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 };

describe('géolocalisation', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('renvoie latitude, longitude, précision et horodatage', async () => {
    withGeo({ getCurrentPosition: (ok) => ok({ coords: { latitude: 5.3, longitude: -4.02, accuracy: 18 }, timestamp: 1700000000000 }) });
    await expect(getCurrentLocation()).resolves.toEqual({ latitude: 5.3, longitude: -4.02, accuracy: 18, timestamp: 1700000000000 });
  });
  it.each([
    [1, 'denied'],
    [2, 'unavailable'],
    [3, 'timeout'],
    [99, 'unknown'],
  ])('erreur code %i → %s', async (code, kind) => {
    withGeo({ getCurrentPosition: (_ok, err) => err({ code, ...codes }) });
    await expect(getCurrentLocation()).rejects.toMatchObject({ kind });
  });
  it('navigateur sans géolocalisation → unsupported', async () => {
    withGeo(undefined);
    await expect(getCurrentLocation()).rejects.toBeInstanceOf(GeoError);
    await expect(getCurrentLocation()).rejects.toMatchObject({ kind: 'unsupported' });
  });
  it('valide les coordonnées et produit des liens OpenStreetMap', () => {
    expect(isValidLocation({ latitude: 5.3, longitude: -4 })).toBe(true);
    expect(isValidLocation({ latitude: 91, longitude: 0 })).toBe(false);
    expect(isValidLocation({ latitude: Number.NaN, longitude: 0 })).toBe(false);
    expect(osmEmbedUrl(5.3, -4)).toContain('marker=5.3,-4');
    expect(osmLinkUrl(5.3, -4)).toContain('mlat=5.3&mlon=-4');
    expect(geoErrorKey('denied')).toBe('geo.error_denied');
  });
});
