// Vérifie les traductions par périmètre (client / admin) et signale les clés manquantes.
//   node scripts/i18n-keys.mjs            → contrôle (échoue si une clé manque)
//   node scripts/i18n-keys.mjs --hardcoded → liste les textes JSX probablement codés en dur
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..', 'src');
const LANGS = ['fr', 'en', 'ar'];
export const ADMIN_ONLY_NS = ['admin', 'dash', 'prod', 'inv', 'cust', 'promo', 'pay', 'ship', 'settings', 'label', 'validation', 'hero'];

const walk = (d, out = []) => {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|ts)$/.test(f) && !/\.test\.ts$/.test(f)) out.push(p);
  }
  return out;
};
const rel = (p) => path.relative(root, p).replaceAll('\\', '/');
// Périmètre d'un fichier : admin, client, ou partagé (rendu dans les deux espaces).
const SHARED = [
  /^components\/(ui|Chat|NotificationList|NotificationBell|LanguageSwitcher|Icon|Guards|Seo|Toaster|Brand|AdminLanguageGate)\.tsx$/,
  /^(hooks|lib|store|services)\//,
  /^App\.tsx$/,
];
export const scopeOf = (r) =>
  /^(services\/geolocation|hooks\/useGeolocation)\.ts$/.test(r)
    ? 'client'
    : /^pages\/admin\//.test(r) ||
        r === 'layouts/AdminLayout.tsx' ||
        r === 'components/ResourceManager.tsx' ||
        r === 'components/ImageUpload.tsx'
      ? 'admin'
      : SHARED.some((x) => x.test(r))
        ? 'shared'
        : r.startsWith('i18n/')
          ? 'skip'
          : 'client';

export const flat = (o, p = '', out = {}) => {
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) flat(v, p + k + '.', out);
    else out[p + k] = v;
  }
  return out;
};
export const loadDict = (scope, l) => {
  try {
    return flat(JSON.parse(fs.readFileSync(path.join(root, 'i18n', scope, l + '.json'), 'utf8')));
  } catch {
    return {};
  }
};

/** Clés utilisées par périmètre. `universe` = ensemble de clés connues (pour reconnaître les littéraux). */
export function scan(universe) {
  const used = { admin: new Set(), client: new Set() };
  const prefixes = { admin: new Set(), client: new Set() };
  for (const f of walk(root)) {
    const sc = scopeOf(rel(f));
    if (sc === 'skip') continue;
    const s = fs.readFileSync(f, 'utf8');
    const targets = sc === 'shared' ? ['admin', 'client'] : [sc];
    const add = (k) => targets.forEach((t) => used[t].add(k));
    for (const m of s.matchAll(/\b(?:t|tr)\(\s*(['"])([^'"]+?)\1/g)) add(m[2]);
    for (const m of s.matchAll(/\b(?:t|tr)\(\s*`([^`$]*)\$\{/g)) targets.forEach((t) => prefixes[t].add(m[1]));
    for (const m of s.matchAll(/`((?:[a-z_]+\.)+[a-z_]*)\$\{/g)) targets.forEach((t) => prefixes[t].add(m[1]));
    if (universe) for (const m of s.matchAll(/['"]([a-z_]+(?:\.[a-z_0-9]+)+)['"]/g)) if (m[1] in universe) add(m[1]);
  }
  return { used, prefixes };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv[2] === '--hardcoded') {
    for (const f of walk(root)) {
      const r = rel(f);
      if (!f.endsWith('.tsx') || r.startsWith('i18n/')) continue;
      const lines = fs.readFileSync(f, 'utf8').split('\n');
      lines.forEach((ln, i) => {
        for (const m of ln.matchAll(/>\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' ,.!?-]{3,})\s*</g))
          if (!/^(DOSSORA|SKU|Slug|WhatsApp)/.test(m[1])) console.log(`${r}:${i + 1}: ${m[1]}`);
        for (const m of ln.matchAll(/(?:aria-label|placeholder|title|alt)="([A-Za-zÀ-ÿ][^"{]{3,})"/g))
          console.log(`${r}:${i + 1}: [attr] ${m[1]}`);
      });
    }
    process.exit(0);
  }
  let bad = 0;
  const dicts = {
    admin: Object.fromEntries(LANGS.map((l) => [l, loadDict('admin', l)])),
    client: Object.fromEntries(LANGS.map((l) => [l, loadDict('client', l)])),
  };
  const { used, prefixes } = scan({ ...dicts.client.fr, ...dicts.admin.fr });
  for (const sc of ['client', 'admin']) {
    for (const l of LANGS) {
      const d = dicts[sc][l];
      const miss = [...used[sc]].filter((k) => !(k in d));
      const missPref = [...prefixes[sc]].filter((p) => !Object.keys(d).some((k) => k.startsWith(p)));
      if (miss.length || missPref.length) {
        bad++;
        console.log(`[${sc}/${l}] manquantes:\n  ` + [...miss, ...missPref.map((p) => p + '*')].join('\n  '));
      }
    }
    for (const l of ['en', 'ar']) {
      const miss = Object.keys(dicts[sc].fr).filter((k) => !(k in dicts[sc][l]));
      if (miss.length) {
        bad++;
        console.log(`[${sc}/${l}] absentes vs fr:\n  ` + miss.join('\n  '));
      }
    }
  }
  // Étanchéité : aucune clé réservée à l'admin ne doit exister côté client.
  const leaks = Object.keys(dicts.client.fr).filter((k) => ADMIN_ONLY_NS.includes(k.split('.')[0]));
  if (leaks.length) {
    bad++;
    console.log('Clés admin présentes côté client:', leaks.join(', '));
  }
  console.log(
    bad ? 'i18n: INCOMPLET' : `i18n: OK — client ${used.client.size} clés, admin ${used.admin.size} clés (+ préfixes dynamiques)`,
  );
  process.exit(bad ? 1 : 0);
}
