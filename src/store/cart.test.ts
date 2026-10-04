import { beforeEach, describe, expect, it } from 'vitest';
import { cartCount, cartSubtotal, useCart, type CartItem } from './cart';

const item = (over: Partial<CartItem> = {}): CartItem => ({
  variantId: 'v1',
  productId: 'p1',
  slug: 'robe',
  names: { fr: 'Robe', en: 'Dress', ar: 'فستان' },
  image: null,
  price: 100,
  color: 'Rouge',
  size: 'M',
  shoeSize: null,
  quantity: 1,
  maxStock: 3,
  ...over,
});

describe('panier', () => {
  beforeEach(() => useCart.getState().clear());

  it('fusionne une même variante et plafonne au stock disponible', () => {
    useCart.getState().add(item({ quantity: 2 }));
    useCart.getState().add(item({ quantity: 2 }));
    expect(useCart.getState().items).toHaveLength(1);
    expect(useCart.getState().items[0].quantity).toBe(3);
  });
  it('borne la quantité entre 1 et le stock', () => {
    useCart.getState().add(item());
    useCart.getState().setQuantity('v1', 99);
    expect(useCart.getState().items[0].quantity).toBe(3);
    useCart.getState().setQuantity('v1', 0);
    expect(useCart.getState().items[0].quantity).toBe(1);
  });
  it('calcule le nombre d’articles et le sous-total', () => {
    useCart.getState().add(item({ quantity: 2 }));
    useCart.getState().add(item({ variantId: 'v2', price: 50 }));
    expect(cartCount(useCart.getState().items)).toBe(3);
    expect(cartSubtotal(useCart.getState().items)).toBe(250);
  });
  it('supprime une ligne et vide le panier avec le code promo', () => {
    useCart.getState().add(item());
    useCart.getState().setPromo('DOSSORA10');
    useCart.getState().remove('v1');
    expect(useCart.getState().items).toHaveLength(0);
    useCart.getState().clear();
    expect(useCart.getState().promoCode).toBe('');
  });
});
