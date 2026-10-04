import { supabase } from '@/lib/supabase';
import type { PaymentMethod, ShippingCountry } from '@/types';

export interface ShippingPricing {
  country: ShippingCountry;
  cityFee: number | null;
}

export async function fetchCountries(): Promise<ShippingCountry[]> {
  const { data, error } = await supabase.from('shipping_countries').select('*').eq('is_active', true).order('sort_order').order('name_fr');
  if (error) throw error;
  return (data ?? []) as ShippingCountry[];
}
export async function fetchCities(code: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('shipping_cities')
    .select('name')
    .eq('country_code', code)
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return (data ?? []).map((r: { name: string }) => r.name);
}
export async function fetchShippingPricing(code: string, city: string): Promise<ShippingPricing> {
  const [countryResult, cityResult, rateResult] = await Promise.all([
    supabase.from('shipping_countries').select('*').eq('code', code).eq('is_active', true).maybeSingle(),
    supabase.from('shipping_cities').select('id').eq('country_code', code).eq('name', city).eq('is_active', true).maybeSingle(),
    supabase.from('shipping_rates').select('fee').eq('country_code', code).eq('city', city).maybeSingle(),
  ]);
  if (countryResult.error) throw countryResult.error;
  if (cityResult.error) throw cityResult.error;
  if (rateResult.error) throw rateResult.error;
  if (!countryResult.data) throw new Error('COUNTRY_UNAVAILABLE');
  if (!cityResult.data) throw new Error('CITY_UNAVAILABLE');
  return {
    country: countryResult.data as ShippingCountry,
    cityFee: rateResult.data ? Number(rateResult.data.fee) : null,
  };
}
export async function fetchPaymentMethods(): Promise<PaymentMethod[]> {
  const { data, error } = await supabase.from('payment_methods').select('*').eq('is_active', true).order('sort_order');
  if (error) throw error;
  return (data ?? []) as PaymentMethod[];
}

/** Même formule que create_order côté base (à titre d'affichage : le serveur reste l'autorité). */
export function quoteShipping(country: ShippingCountry, cityFee: number | null, subtotalAfterDiscount: number) {
  const base = Math.round((cityFee ?? Number(country.fee)) * Number(country.exchange_rate) * 100) / 100;
  const free = country.free_shipping_threshold !== null && subtotalAfterDiscount >= Number(country.free_shipping_threshold);
  return { fee: free ? 0 : base, base, free };
}
