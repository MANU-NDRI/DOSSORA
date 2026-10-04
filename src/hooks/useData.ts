import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { reportError } from '@/lib/diagnostics';
import { fetchCategories } from '@/services/catalog';
import { fetchCities, fetchCountries, fetchPaymentMethods } from '@/services/shipping';
import type { Category, PaymentMethod, ShippingCountry, ShopSettings } from '@/types';

/** Petit cache mémoire pour les données quasi-statiques (catégories, pays, réglages). */
const cache = new Map<string, Promise<unknown>>();
export function invalidateCache(prefix = '') {
  for (const k of [...cache.keys()]) if (k.startsWith(prefix)) cache.delete(k);
}
function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (!cache.has(key))
    cache.set(
      key,
      fn().catch((e) => {
        cache.delete(key);
        throw e;
      }),
    );
  return cache.get(key) as Promise<T>;
}
function useCachedData<T>(key: string, fn: () => Promise<T>, initial: T) {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    cached(key, fn)
      .then((d) => {
        if (alive) {
          setData(d);
          setError(null);
        }
      })
      .catch((e) => {
        reportError(`Chargement « ${key} » échoué`, e);
        if (alive) setError(e);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { data, loading, error };
}

export const DEFAULT_SETTINGS: ShopSettings = {
  shop_name: 'DOSSORA',
  slogan: "L'élégance à votre portée",
  currency: 'MAD',
  email: 'dossorashop@gmail.com',
  whatsapp: '212603391255',
  sender_address: '',
  sender_city: '',
  sender_country: '',
};
export function useSettingsState() {
  return useCachedData<ShopSettings>(
    'settings',
    async () => {
      const { data: row, error } = await supabase.from('shop_settings').select('value').eq('key', 'general').maybeSingle();
      if (error) throw error; // ne pas masquer : journalisé, les valeurs par défaut restent affichées
      return { ...DEFAULT_SETTINGS, ...((row as { value: Partial<ShopSettings> } | null)?.value ?? {}) };
    },
    DEFAULT_SETTINGS,
  );
}
export function useSettings(): ShopSettings {
  return useSettingsState().data;
}
export const useCategories = () => useCachedData<Category[]>('categories', fetchCategories, []);
export const useCountries = () => useCachedData<ShippingCountry[]>('countries', fetchCountries, []);
export const useCities = (code: string) =>
  useCachedData<string[]>(`cities:${code}`, () => (code ? fetchCities(code) : Promise.resolve([])), []);
export const usePaymentMethods = () => useCachedData<PaymentMethod[]>('payment_methods', fetchPaymentMethods, []);
