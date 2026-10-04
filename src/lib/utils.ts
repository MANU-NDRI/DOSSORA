import type { Lang, Product } from '@/types';

export const WHATSAPP = import.meta.env.VITE_WHATSAPP_NUMBER || '212603391255';
export const SHOP_EMAIL = import.meta.env.VITE_SHOP_EMAIL || 'dossorashop@gmail.com';
export const WHATSAPP_DISPLAY = '+212 603 391 255';

export const cn = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

export const waLink = (text?: string, phone = WHATSAPP) =>
  `https://wa.me/${phone.replace(/\D/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

/** Lit name_fr / name_en / name_ar avec repli sur le français puis l'anglais. */
export function loc(row: object | null | undefined, field: string, lang: Lang): string {
  const r = (row ?? {}) as Record<string, unknown>;
  return (r[`${field}_${lang}`] || r[`${field}_fr`] || r[`${field}_en`] || '') as string;
}

const localeOf: Record<Lang, string> = { fr: 'fr-FR', en: 'en-US', ar: 'ar-MA-u-nu-latn' };
export function formatMoney(amount: number, currency: string, lang: Lang): string {
  try {
    return new Intl.NumberFormat(localeOf[lang], { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}
export function formatDate(iso: string, lang: Lang, withTime = false): string {
  return new Intl.DateTimeFormat(localeOf[lang], withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(
    new Date(iso),
  );
}

export const effectivePrice = (p: Pick<Product, 'price' | 'sale_price'>) =>
  p.sale_price !== null && p.sale_price < p.price ? p.sale_price : p.price;
export const hasDiscount = (p: Pick<Product, 'price' | 'sale_price'>) => p.sale_price !== null && p.sale_price < p.price;
export const discountPct = (p: Pick<Product, 'price' | 'sale_price'>) =>
  hasDiscount(p) ? Math.round((1 - (p.sale_price as number) / p.price) * 100) : 0;

export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
export const isEmail = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);

/** Image principale d'un produit (première par sort_order). */
export function mainImage(p: Pick<Product, 'product_images'>): string | null {
  const imgs = [...(p.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  return imgs[0]?.url ?? null;
}

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
