import { describe, expect, it } from 'vitest';
import { isDbNotReady } from './diagnostics';
import { errorKey } from './errors';
import { DURATION, staggerDelay } from './motion';
import { discountPct, effectivePrice, formatMoney, hasDiscount, loc, slugify } from './utils';

describe('errorKey', () => {
  it('mappe les codes métier SQL vers des clés traduites', () => {
    expect(errorKey({ message: 'INSUFFICIENT_STOCK' })).toBe('errors.INSUFFICIENT_STOCK');
    expect(errorKey({ message: 'PROMO_EXPIRED: x' })).toBe('errors.PROMO_EXPIRED');
  });
  it('détecte une base non initialisée sans exposer le détail technique', () => {
    expect(errorKey({ code: 'PGRST205', message: "Could not find the table 'public.products'" })).toBe('errors.db_not_ready');
    expect(isDbNotReady({ status: 404 })).toBe(true);
    expect(isDbNotReady({ message: 'boom' })).toBe(false);
  });
  it('mappe les erreurs d’authentification', () => {
    expect(errorKey({ message: 'Invalid login credentials' })).toBe('errors.invalid_credentials');
    expect(errorKey({ message: 'User already registered' })).toBe('errors.email_taken');
  });
  it('distingue une erreur réseau d’un refus RLS ou d’un défaut de schéma', () => {
    expect(errorKey({ status: 401 })).toBe('errors.session_expired');
    expect(errorKey({ status: 403 })).toBe('errors.FORBIDDEN');
    expect(errorKey({ code: '42501', message: 'permission denied for table newsletter_subscribers' })).toBe('errors.FORBIDDEN');
    expect(errorKey({ code: '42703', message: 'column user_id does not exist' })).toBe('errors.db_not_ready');
    expect(errorKey({ message: 'Failed to fetch' })).toBe('errors.network');
    expect(errorKey({ status: 500, message: 'unexpected SQL failure' })).toBe('errors.generic');
  });
  it('retombe sur un message générique, jamais "undefined"', () => {
    expect(errorKey(undefined)).toMatch(/^errors\./);
    expect(errorKey(null)).toMatch(/^errors\./);
  });
});

describe('utils', () => {
  it('loc : langue demandée, puis français, puis anglais', () => {
    expect(loc({ name_fr: 'Robe', name_en: null, name_ar: 'فستان' }, 'name', 'ar')).toBe('فستان');
    expect(loc({ name_fr: 'Robe', name_en: null }, 'name', 'en')).toBe('Robe');
    expect(loc(null, 'name', 'fr')).toBe('');
  });
  it('prix effectif et pourcentage de réduction', () => {
    expect(effectivePrice({ price: 200, sale_price: 150 })).toBe(150);
    expect(effectivePrice({ price: 200, sale_price: null })).toBe(200);
    expect(hasDiscount({ price: 100, sale_price: 120 })).toBe(false);
    expect(discountPct({ price: 200, sale_price: 150 })).toBe(25);
  });
  it('formate les montants selon la langue (Intl)', () => {
    expect(formatMoney(1250000, 'XOF', 'fr').replace(/\s/g, ' ')).toContain('1 250 000');
    expect(formatMoney(1250000, 'XOF', 'en')).toContain('1,250,000');
    expect(formatMoney(10, 'INVALID', 'fr')).toContain('10.00');
  });
  it('slugify retire accents et symboles', () => {
    expect(slugify('Robe Élégante – Été 2026 !')).toBe('robe-elegante-ete-2026');
  });
});

describe('motion', () => {
  it('cascade plafonnée et durées cohérentes', () => {
    expect(staggerDelay(0)).toBe('0ms');
    expect(staggerDelay(100)).toBe(staggerDelay(7));
    expect(DURATION.fast).toBeLessThan(DURATION.normal);
    expect(DURATION.normal).toBeLessThan(DURATION.slow);
  });
});
