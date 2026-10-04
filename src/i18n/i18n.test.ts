import { beforeAll, describe, expect, it } from 'vitest';
import { dig, dirOf, interpolate, isLang } from './core';
import { applyAdminLanguage, loadAdminDict, useAdminLanguage, ADMIN_LANG_KEY } from './adminLanguage';
import { translate, useLangStore } from './index';

describe('i18n core', () => {
  it('lit une clé pointée et renvoie undefined si absente', () => {
    expect(dig({ a: { b: 'x' } }, 'a.b')).toBe('x');
    expect(dig({ a: { b: 'x' } }, 'a.c')).toBeUndefined();
    expect(dig(undefined, 'a')).toBeUndefined();
  });
  it('interpole les variables sans jamais écrire "undefined"', () => {
    expect(interpolate('Bonjour {name}', { name: 'Sara' })).toBe('Bonjour Sara');
    expect(interpolate('Bonjour {name}', {})).toBe('Bonjour ');
  });
  it('valide les langues et la direction', () => {
    expect(isLang('ar')).toBe(true);
    expect(isLang('de')).toBe(false);
    expect(dirOf('ar')).toBe('rtl');
    expect(dirOf('fr')).toBe('ltr');
  });
});

describe('traductions client / admin', () => {
  beforeAll(async () => {
    await Promise.all([loadAdminDict('fr'), loadAdminDict('en'), loadAdminDict('ar')]);
  });

  it('traduit côté client dans les 3 langues', () => {
    expect(translate('fr', 'nav.shop')).toBe('Boutique');
    expect(translate('en', 'nav.shop')).toBe('Shop');
    expect(translate('ar', 'nav.shop')).toBe('المتجر');
  });
  it('traduit côté admin avec le dictionnaire admin', () => {
    expect(translate('fr', 'admin.nav.orders', undefined, 'admin')).toBe('Commandes');
    expect(translate('en', 'admin.nav.orders', undefined, 'admin')).toBe('Orders');
    expect(translate('ar', 'admin.nav.orders', undefined, 'admin')).toBe('الطلبات');
  });
  it('les clés admin n’existent pas dans le périmètre client (étanchéité)', () => {
    expect(translate('fr', 'admin.nav.orders')).toBe('admin.nav.orders');
    expect(translate('fr', 'dash.orders_today')).toBe('dash.orders_today');
  });
  it('ne renvoie jamais undefined : clé inconnue → la clé elle-même', () => {
    expect(translate('en', 'does.not.exist')).toBe('does.not.exist');
    expect(translate('en', 'does.not.exist', undefined, 'admin')).toBe('does.not.exist');
  });
  it('la langue ADMIN et la langue CLIENT sont deux préférences indépendantes', async () => {
    useLangStore.getState().setLang('en');
    await applyAdminLanguage('ar');
    expect(useLangStore.getState().lang).toBe('en');
    expect(useAdminLanguage.getState().lang).toBe('ar');
    expect(localStorage.getItem(ADMIN_LANG_KEY)).toBe('ar');
    useLangStore.getState().setLang('fr');
    expect(useAdminLanguage.getState().lang).toBe('ar');
    await applyAdminLanguage('en');
    expect(useLangStore.getState().lang).toBe('fr');
  });
});
