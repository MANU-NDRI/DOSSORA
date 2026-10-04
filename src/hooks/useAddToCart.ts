import { useCart } from '@/store/cart';
import { useUI } from '@/store/ui';
import { useT } from '@/i18n';
import { availableQty } from '@/services/catalog';
import { effectivePrice, mainImage } from '@/lib/utils';
import { flyToCart } from '@/lib/motion';
import type { Product, Variant } from '@/types';

export function useAddToCart() {
  const add = useCart((s) => s.add);
  const toast = useUI((s) => s.toast);
  const { t } = useT();
  /** `source` : élément d'où part la miniature animée (image produit ou bouton). */
  return (p: Product, v: Variant, quantity = 1, source?: Element | null) => {
    const max = availableQty(v);
    if (max < 1) {
      toast('error', t('errors.INSUFFICIENT_STOCK'));
      return false;
    }
    add({
      variantId: v.id,
      productId: p.id,
      slug: p.slug,
      names: { fr: p.name_fr, en: p.name_en || p.name_fr, ar: p.name_ar || p.name_fr },
      image: mainImage(p),
      price: v.price_override ?? effectivePrice(p),
      color: v.color,
      size: v.size,
      shoeSize: v.shoe_size,
      quantity,
      maxStock: max,
    });
    flyToCart(source, mainImage(p));
    toast('success', t('cart.added'));
    return true;
  };
}
