import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Lang } from '@/types';

export interface CartItem {
  variantId: string;
  productId: string;
  slug: string;
  names: Record<Lang, string>;
  image: string | null;
  price: number;
  color: string | null;
  size: string | null;
  shoeSize: string | null;
  quantity: number;
  maxStock: number;
}
interface CartState {
  items: CartItem[];
  promoCode: string;
  add: (item: CartItem) => void;
  setQuantity: (variantId: string, q: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
  setPromo: (code: string) => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      promoCode: '',
      add: (item) =>
        set((s) => {
          const found = s.items.find((i) => i.variantId === item.variantId);
          if (found) {
            return {
              items: s.items.map((i) =>
                i.variantId === item.variantId
                  ? {
                      ...i,
                      price: item.price,
                      maxStock: item.maxStock,
                      quantity: Math.min(i.quantity + item.quantity, Math.max(item.maxStock, 1)),
                    }
                  : i,
              ),
            };
          }
          return { items: [...s.items, { ...item, quantity: Math.min(item.quantity, Math.max(item.maxStock, 1)) }] };
        }),
      setQuantity: (variantId, q) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.variantId === variantId ? { ...i, quantity: Math.max(1, Math.min(q, Math.max(i.maxStock, 1))) } : i,
          ),
        })),
      remove: (variantId) => set((s) => ({ items: s.items.filter((i) => i.variantId !== variantId) })),
      clear: () => set({ items: [], promoCode: '' }),
      setPromo: (promoCode) => set({ promoCode }),
    }),
    { name: 'dossora-cart' },
  ),
);
export const cartCount = (items: CartItem[]) => items.reduce((n, i) => n + i.quantity, 0);
export const cartSubtotal = (items: CartItem[]) => items.reduce((n, i) => n + i.price * i.quantity, 0);

interface FavState {
  ids: string[];
  toggle: (id: string) => void;
}
export const useFavorites = create<FavState>()(
  persist(
    (set) => ({ ids: [], toggle: (id) => set((s) => ({ ids: s.ids.includes(id) ? s.ids.filter((x) => x !== id) : [...s.ids, id] })) }),
    { name: 'dossora-favorites' },
  ),
);
