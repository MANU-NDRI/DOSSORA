import { supabase } from '@/lib/supabase';
import type { Banner, Category, Product } from '@/types';

export const PRODUCT_SELECT =
  '*, product_images(url,alt,sort_order), product_variants(id,sku,color,size,shoe_size,stock,reserved,price_override,low_stock_threshold), categories(slug,name_fr,name_en,name_ar)';

export interface ProductQuery {
  q?: string;
  categoryIds?: string[];
  min?: number;
  max?: number;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'popular';
  flag?: 'new' | 'sale' | 'popular' | 'featured' | '';
  inStock?: boolean;
  page?: number;
  pageSize?: number;
}

/** Requête paginée : on ne charge jamais tout le catalogue d'un coup. */
export async function fetchProducts(f: ProductQuery): Promise<{ items: Product[]; total: number }> {
  const page = f.page ?? 0;
  const size = f.pageSize ?? 12;
  let q = supabase.from('products').select(PRODUCT_SELECT, { count: 'exact' }).eq('status', 'published');
  const term = (f.q ?? '').replace(/[%,()*]/g, ' ').trim();
  if (term) q = q.or(`name_fr.ilike.%${term}%,name_en.ilike.%${term}%,name_ar.ilike.%${term}%,sku.ilike.%${term}%`);
  if (f.categoryIds?.length) q = q.in('category_id', f.categoryIds);
  if (f.min !== undefined && !Number.isNaN(f.min)) q = q.gte('price', f.min);
  if (f.max !== undefined && !Number.isNaN(f.max)) q = q.lte('price', f.max);
  if (f.inStock) q = q.gt('available_stock', 0);
  if (f.flag === 'new') q = q.eq('is_new', true);
  if (f.flag === 'sale') q = q.eq('is_on_sale', true);
  if (f.flag === 'popular') q = q.eq('is_popular', true);
  if (f.flag === 'featured') q = q.eq('is_featured', true);
  switch (f.sort) {
    case 'price_asc':
      q = q.order('price', { ascending: true });
      break;
    case 'price_desc':
      q = q.order('price', { ascending: false });
      break;
    case 'popular':
      q = q.order('is_popular', { ascending: false }).order('created_at', { ascending: false });
      break;
    default:
      q = q.order('created_at', { ascending: false });
  }
  const { data, error, count } = await q.range(page * size, page * size + size - 1);
  if (error) throw error;
  return { items: (data ?? []) as unknown as Product[], total: count ?? 0 };
}

export async function fetchProductBySlug(slug: string): Promise<Product | null> {
  const { data, error } = await supabase.from('products').select(PRODUCT_SELECT).eq('slug', slug).eq('status', 'published').maybeSingle();
  if (error) throw error;
  return (data as unknown as Product) ?? null;
}

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from('categories').select('*').eq('is_published', true).order('sort_order');
  if (error) throw error;
  return (data ?? []) as Category[];
}

export async function fetchBanners(): Promise<Banner[]> {
  const { data, error } = await supabase.from('homepage_banners').select('*').eq('is_active', true).order('sort_order');
  if (error) throw error;
  return (data ?? []) as Banner[];
}

/** Retourne l'id d'une catégorie + ceux de ses sous-catégories. */
export function categoryIdsWithChildren(all: Category[], slug: string): string[] {
  const c = all.find((x) => x.slug === slug);
  if (!c) return [];
  return [c.id, ...all.filter((x) => x.parent_id === c.id).map((x) => x.id)];
}

export const availableQty = (v: { stock: number; reserved: number }) => Math.max(v.stock - v.reserved, 0);
