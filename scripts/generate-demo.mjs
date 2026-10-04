// Génère les visuels de démonstration (SVG originaux, libres de droits) et supabase/seed.sql.
// Usage : npm run demo:generate
import { writeFileSync, mkdirSync } from 'node:fs';

const B = '#7A1F3D',
  I = '#F8F3EA',
  G = '#C9A45C';
mkdirSync('public/demo', { recursive: true });
const esc = (s) => String(s).replace(/'/g, "''");
const shade = (hex, k) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join('');
};

function shape(kind, sub, c) {
  const d = shade(c, 0.72);
  switch (kind) {
    case 'bag':
      return `<path d="M290 430C290 250 510 250 510 430" fill="none" stroke="${d}" stroke-width="22" stroke-linecap="round"/>
<rect x="180" y="410" width="440" height="330" rx="44" fill="${c}"/>
<path d="M180 470Q400 570 620 470V450Q620 410 580 410H220Q180 410 180 450Z" fill="${d}"/>
<circle cx="400" cy="548" r="24" fill="${G}"/><circle cx="400" cy="548" r="10" fill="${I}"/>`;
    case 'dress':
      return `<path d="M352 200L448 200L478 340L570 790Q400 840 230 790L322 340Z" fill="${c}"/>
<path d="M322 340L478 340" stroke="${G}" stroke-width="12"/>
<path d="M356 200L376 110M444 200L424 110" stroke="${d}" stroke-width="12" stroke-linecap="round"/>
<path d="M330 400Q400 470 470 400" stroke="${d}" stroke-width="6" fill="none" opacity=".5"/>`;
    case 'shoe':
      return `<path d="M170 560C240 560 310 520 345 410C370 470 440 520 530 540L630 565C665 572 662 620 628 622L565 622L565 720L538 720L520 622L235 622C190 622 160 590 170 560Z" fill="${c}"/>
<path d="M345 410C365 470 440 520 530 540" stroke="${G}" stroke-width="10" fill="none"/>`;
    case 'soap':
      return `<g transform="rotate(-12 400 520)"><rect x="220" y="410" width="360" height="220" rx="64" fill="${c}"/>
<rect x="244" y="432" width="312" height="176" rx="48" fill="none" stroke="${G}" stroke-width="5"/>
<text x="400" y="535" text-anchor="middle" font-family="Georgia,serif" font-size="46" fill="${G}" letter-spacing="8">DOSSORA</text></g>
<circle cx="600" cy="360" r="26" fill="none" stroke="${G}" stroke-width="4"/><circle cx="650" cy="300" r="14" fill="none" stroke="${G}" stroke-width="4"/><circle cx="560" cy="290" r="9" fill="${G}" opacity=".6"/>`;
    default:
      if (sub === 'necklace')
        return (
          `<path d="M220 280Q400 720 580 280" fill="none" stroke="${G}" stroke-width="7"/>` +
          Array.from({ length: 9 }, (_, i) => {
            const t = (i + 1) / 10;
            const x = 220 + 360 * t;
            return `<circle cx="${x}" cy="${280 + 880 * t * (1 - t) - 0}" r="14" fill="${I}" stroke="${G}" stroke-width="3"/>`;
          }).join('') +
          `<circle cx="400" cy="560" r="34" fill="${c}" stroke="${G}" stroke-width="6"/>`
        );
      if (sub === 'scarf')
        return `<path d="M230 300L570 300L640 700L160 700Z" fill="${c}"/><path d="M230 300L400 500L570 300" fill="${d}"/><path d="M190 610H610" stroke="${G}" stroke-width="8" stroke-dasharray="4 14" stroke-linecap="round"/>`;
      if (sub === 'sunglasses')
        return `<rect x="170" y="420" width="220" height="150" rx="60" fill="${d}"/><rect x="410" y="420" width="220" height="150" rx="60" fill="${d}"/><path d="M390 460Q400 440 410 460" stroke="${G}" stroke-width="10" fill="none"/><path d="M170 450L120 420M630 450L680 420" stroke="${G}" stroke-width="10" stroke-linecap="round"/>`;
      return `<rect x="110" y="470" width="580" height="70" rx="12" fill="${c}"/><rect x="330" y="440" width="140" height="130" rx="20" fill="none" stroke="${G}" stroke-width="14"/><rect x="392" y="490" width="16" height="30" fill="${G}"/>`;
  }
}

function productSvg(kind, sub, color, v = 1) {
  const bg1 = v === 1 ? I : shade('#F8F3EA', 0.94),
    bg2 = v === 1 ? '#EFE3D0' : '#E6D3D8';
  const sc = v === 1 ? 1 : 1.35;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" role="img">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></linearGradient></defs>
<rect width="800" height="1000" fill="url(#g)"/>
<circle cx="640" cy="180" r="120" fill="${G}" opacity=".12"/>
<ellipse cx="400" cy="${v === 1 ? 830 : 900}" rx="230" ry="26" fill="${B}" opacity=".10"/>
<g transform="translate(${400 - 400 * sc} ${v === 1 ? 0 : -190}) scale(${sc})">${shape(kind, sub, color)}</g>
<text x="400" y="945" text-anchor="middle" font-family="Georgia,serif" font-size="28" letter-spacing="12" fill="${G}" opacity=".9">DOSSORA</text></svg>`;
}

const cats = [
  ['sacs', null, 'Sacs', 'Bags', 'حقائب', 'bag', B, 1],
  ['sacs-a-main', 'sacs', 'Sacs à main', 'Handbags', 'حقائب يد', null, null, 2],
  ['sacs-a-dos', 'sacs', 'Sacs à dos', 'Backpacks', 'حقائب ظهر', null, null, 8],
  ['sacs-bandouliere', 'sacs', 'Sacs bandoulière', 'Crossbody bags', 'حقائب كتف', null, null, 9],
  ['sacs-soiree', 'sacs', 'Sacs de soirée', 'Evening bags', 'حقائب سهرة', null, null, 10],
  ['sacs-professionnels', 'sacs', 'Sacs professionnels', 'Work bags', 'حقائب عمل', null, null, 11],
  ['pochettes', 'sacs', 'Pochettes', 'Clutches', 'حقائب يد صغيرة', null, null, 12],
  ['mini-sacs', 'sacs', 'Mini sacs', 'Mini bags', 'حقائب صغيرة', null, null, 13],
  ['cabas', 'sacs', 'Cabas', 'Tote bags', 'حقائب كبيرة', null, null, 14],
  ['vetements', null, 'Vêtements', 'Clothing', 'ملابس', 'dress', '#9A3A58', 3],
  ['robes', 'vetements', 'Robes', 'Dresses', 'فساتين', null, null, 4],
  ['chemisiers', 'vetements', 'Chemisiers', 'Blouses', 'بلوزات', null, null, 15],
  ['hauts', 'vetements', 'T-shirts', 'T-shirts', 'قمصان', null, null, 16],
  ['pantalons', 'vetements', 'Pantalons et jeans', 'Trousers and jeans', 'سراويل وجينز', null, null, 17],
  ['jupes', 'vetements', 'Jupes', 'Skirts', 'تنانير', null, null, 18],
  ['vestes', 'vetements', 'Vestes et pulls', 'Jackets and sweaters', 'سترات وكنزات', null, null, 19],
  ['ensembles', 'vetements', 'Ensembles', 'Co-ord sets', 'أطقم', null, null, 20],
  ['sport', 'vetements', 'Vêtements de sport', 'Activewear', 'ملابس رياضية', null, null, 21],
  ['chaussures', null, 'Chaussures', 'Shoes', 'أحذية', 'shoe', '#5C1730', 5],
  ['baskets', 'chaussures', 'Baskets', 'Sneakers', 'أحذية رياضية', null, null, 22],
  ['talons', 'chaussures', 'Talons', 'Heels', 'أحذية بكعب', null, null, 23],
  ['sandales', 'chaussures', 'Sandales', 'Sandals', 'صنادل', null, null, 24],
  ['mocassins', 'chaussures', 'Mocassins', 'Loafers', 'أحذية بدون كعب', null, null, 25],
  ['bottines', 'chaussures', 'Bottines', 'Ankle boots', 'أحذية قصيرة', null, null, 26],
  [
    'accessoires-chaussures',
    'chaussures',
    'Chaussures de soirée et casual',
    'Evening and casual shoes',
    'أحذية سهرة وكاجوال',
    null,
    null,
    27,
  ],
  ['beaute', null, 'Beauté', 'Beauty', 'الجمال', 'soap', '#B08A45', 6],
  ['savons', 'beaute', 'Savons et gels douche', 'Soaps and shower gels', 'صابون وجل استحمام', null, null, 28],
  ['soins-visage', 'beaute', 'Soins du visage', 'Face care', 'العناية بالوجه', null, null, 29],
  ['soins-corps', 'beaute', 'Soins du corps', 'Body care', 'العناية بالجسم', null, null, 30],
  ['parfums', 'beaute', 'Huiles et parfums', 'Oils and perfumes', 'زيوت وعطور', null, null, 31],
  ['accessoires', null, 'Accessoires', 'Accessories', 'إكسسوارات', 'acc', B, 7],
  ['bijoux', 'accessoires', 'Bijoux et montres', 'Jewelry and watches', 'مجوهرات وساعات', null, null, 32],
  [
    'mode-accessoires',
    'accessoires',
    'Lunettes, ceintures et foulards',
    'Sunglasses, belts and scarves',
    'نظارات وأحزمة وأوشحة',
    null,
    null,
    33,
  ],
  ['maison', null, 'Maison', 'Home', 'المنزل', 'acc', '#9A3A58', 34],
  ['decoration', 'maison', 'Décoration', 'Decor', 'ديكور', null, null, 35],
  ['rangement', 'maison', 'Rangement', 'Storage', 'تنظيم', null, null, 36],
  ['salle-de-bain', 'maison', 'Salle de bain', 'Bathroom', 'الحمام', null, null, 37],
];
const catDesc = {
  sacs: ['Des sacs pensés pour sublimer chaque tenue.', 'Bags designed to elevate every outfit.', 'حقائب مصممة لتُبرز جمال كل إطلالة.'],
  vetements: ['Coupes fluides et matières nobles.', 'Fluid cuts and refined fabrics.', 'قصّات انسيابية وأقمشة راقية.'],
  chaussures: ['Confort et élégance, du matin au soir.', 'Comfort and elegance, morning to night.', 'راحة وأناقة من الصباح إلى المساء.'],
  savons: ['Soins artisanaux aux ingrédients naturels.', 'Artisanal care with natural ingredients.', 'عناية حرفية بمكونات طبيعية.'],
  accessoires: ['Le détail qui fait toute la différence.', 'The detail that makes all the difference.', 'التفصيل الذي يصنع الفرق.'],
  beaute: [
    'Des rituels de soin inspirés du savoir-faire marocain.',
    'Care rituals inspired by Moroccan craftsmanship.',
    'طقوس عناية مستوحاة من الحرفية المغربية.',
  ],
  maison: ['Des détails raffinés pour un intérieur accueillant.', 'Refined details for a welcoming home.', 'تفاصيل أنيقة لمنزل دافئ.'],
};

// slug, cat, fr, en, ar, price, sale, kind, sub, colorHex, [colorLabels fr], flags, variantType
const P = [
  [
    'sac-riviera',
    'sacs-a-main',
    'Sac à main Riviera',
    'Riviera handbag',
    'حقيبة يد ريفييرا',
    890,
    null,
    'bag',
    '',
    B,
    ['Bordeaux', 'Ivoire'],
    'fp',
    'none',
  ],
  [
    'sac-bandouliere-aurore',
    'sacs',
    'Sac bandoulière Aurore',
    'Aurore crossbody bag',
    'حقيبة كتف أورورا',
    640,
    520,
    'bag',
    '',
    G,
    ['Or champagne', 'Bordeaux'],
    's',
    'none',
  ],
  [
    'cabas-signature',
    'sacs',
    'Cabas Signature',
    'Signature tote',
    'حقيبة كبيرة سيغنتشر',
    1150,
    null,
    'bag',
    '',
    '#3B1220',
    ['Bordeaux nuit'],
    'n',
    'none',
  ],
  [
    'robe-satin-soraya',
    'robes',
    'Robe satin Soraya',
    'Soraya satin dress',
    'فستان ساتان سورايا',
    780,
    null,
    'dress',
    '',
    B,
    ['Bordeaux', 'Champagne'],
    'fp',
    'size',
  ],
  [
    'abaya-elegance',
    'vetements',
    'Abaya Élégance',
    'Élégance abaya',
    'عباءة أناقة',
    950,
    790,
    'dress',
    '',
    '#2B1B21',
    ['Noir'],
    's',
    'size',
  ],
  [
    'chemise-lin-nadia',
    'vetements',
    'Chemise en lin Nadia',
    'Nadia linen shirt',
    'قميص كتان نادية',
    420,
    null,
    'dress',
    '',
    '#D9C7A3',
    ['Sable'],
    'n',
    'size',
  ],
  [
    'escarpins-velours',
    'chaussures',
    'Escarpins velours',
    'Velvet pumps',
    'حذاء مخملي بكعب',
    690,
    null,
    'shoe',
    '',
    B,
    ['Bordeaux'],
    'p',
    'shoe',
  ],
  [
    'sandales-dorees-mira',
    'chaussures',
    'Sandales dorées Mira',
    'Mira golden sandals',
    'صندل ذهبي ميرا',
    480,
    390,
    'shoe',
    '',
    G,
    ['Doré'],
    's',
    'shoe',
  ],
  [
    'baskets-creme',
    'chaussures',
    'Baskets crème',
    'Cream sneakers',
    'حذاء رياضي كريمي',
    560,
    null,
    'shoe',
    '',
    '#E8DCC6',
    ['Crème'],
    'n',
    'shoe',
  ],
  [
    'savon-rose-argan',
    'savons',
    'Savon rose & argan',
    'Rose & argan soap',
    'صابون الورد والأرغان',
    55,
    null,
    'soap',
    '',
    '#B45C74',
    ['Rose'],
    'p',
    'none',
  ],
  [
    'savon-noir-beldi',
    'savons',
    'Savon noir beldi',
    'Beldi black soap',
    'الصابون الأسود البلدي',
    45,
    null,
    'soap',
    '',
    '#4A3A2A',
    ['Naturel'],
    '',
    'none',
  ],
  [
    'coffret-savons-dossora',
    'savons',
    'Coffret de savons DOSSORA',
    'DOSSORA soap gift set',
    'طقم صابون دوسورا',
    210,
    null,
    'soap',
    '',
    B,
    ['Coffret'],
    'fn',
    'none',
  ],
  [
    'foulard-soie-ivoire',
    'accessoires',
    'Foulard soie ivoire',
    'Ivory silk scarf',
    'وشاح حرير عاجي',
    260,
    null,
    'acc',
    'scarf',
    '#E9DCC3',
    ['Ivoire'],
    '',
    'none',
  ],
  [
    'collier-perle-or',
    'accessoires',
    'Collier perle & or',
    'Pearl & gold necklace',
    'قلادة لؤلؤ ذهبية',
    340,
    null,
    'acc',
    'necklace',
    B,
    ['Or'],
    'p',
    'none',
  ],
  [
    'lunettes-diva',
    'accessoires',
    'Lunettes de soleil Diva',
    'Diva sunglasses',
    'نظارات شمسية ديفا',
    380,
    null,
    'acc',
    'sunglasses',
    '#2B1B21',
    ['Noir'],
    'n',
    'none',
  ],
  [
    'ceinture-cuir-gold',
    'accessoires',
    'Ceinture cuir Gold',
    'Gold leather belt',
    'حزام جلدي ذهبي',
    290,
    230,
    'acc',
    'belt',
    '#5C1730',
    ['Bordeaux'],
    's',
    'none',
  ],
];
const desc = {
  bag: [
    'Cuir premium, doublure soignée et fermoir doré.',
    'Premium finish, neat lining and golden clasp.',
    'تشطيب فاخر وبطانة أنيقة وإغلاق ذهبي.',
  ],
  dress: [
    'Coupe fluide, tombé impeccable, confort toute la journée.',
    'Fluid cut, impeccable drape, all-day comfort.',
    'قصّة انسيابية وسقوط مثالي وراحة طوال اليوم.',
  ],
  shoe: ['Semelle confortable et finitions élégantes.', 'Comfortable sole and elegant finishing.', 'نعل مريح وتشطيبات أنيقة.'],
  soap: [
    'Savon artisanal doux, formulé avec des ingrédients naturels.',
    'Gentle artisanal soap made with natural ingredients.',
    'صابون حرفي لطيف بمكونات طبيعية.',
  ],
  acc: ['Un accessoire raffiné pour compléter votre allure.', 'A refined accessory to complete your look.', 'إكسسوار راقٍ يكمل إطلالتك.'],
};

// 84 références de démonstration variées avec images SVG locales.
const demoCollections = [
  [
    'sacs-a-dos',
    'bag',
    ['Sac à dos', 'Backpack', 'حقيبة ظهر'],
    [
      'Atlas',
      'Médina',
      'Oasis',
      'Rivage',
      'Kasbah',
      'Nomade',
      'Aquarelle',
      'Soleil',
      'Jardin',
      'Majorelle',
      'Dune',
      'Émeraude',
      'Sérénité',
      'Palmier',
    ],
  ],
  [
    'baskets',
    'shoe',
    ['Baskets', 'Sneakers', 'حذاء رياضي'],
    [
      'Cèdre',
      'Casablanca',
      'Nuage',
      'Luna',
      'Éclipse',
      'Avenue',
      'Lumière',
      'Étoile',
      'Saphir',
      'Nacré',
      'Mistral',
      'Velours',
      'Cobalt',
      'Sahara',
    ],
  ],
  [
    'chemisiers',
    'dress',
    ['Chemisier', 'Blouse', 'بلوزة'],
    ['Nour', 'Lina', 'Yasmine', 'Salma', 'Inès', 'Maya', 'Amira', 'Leïla', 'Sofia', 'Dalia', 'Mina', 'Aya', 'Nadia', 'Zina'],
  ],
  [
    'bijoux',
    'acc',
    ['Bijou', 'Jewelry piece', 'قطعة مجوهرات'],
    ['Lilas', 'Ambre', 'Perle', 'Éclat', 'Aube', 'Jasmin', 'Rubis', 'Opale', 'Tendresse', 'Flora', 'Dahlia', 'Étoile', 'Miel', 'Rêve'],
  ],
  [
    'soins-visage',
    'soap',
    ['Soin visage', 'Face care', 'عناية بالوجه'],
    [
      'Argan doux',
      'Rose de Fès',
      'Fleur d’oranger',
      'Lait d’amande',
      'Néroli',
      'Miel pur',
      'Jasmin blanc',
      'Aloe vera',
      'Grenade',
      'Eau de rose',
      'Lavande',
      'Karité',
      'Verveine',
      'Rituel Atlas',
    ],
  ],
  [
    'decoration',
    'acc',
    ['Décoration', 'Home decor', 'قطعة ديكور'],
    [
      'Zellige',
      'Tanger',
      'Marrakech',
      'Essaouira',
      'Babouche',
      'Safi',
      'Fès',
      'Andalousie',
      'Mosaïque',
      'Riad',
      'Safran',
      'Tadelakt',
      'Moucharabieh',
      'Dar',
    ],
  ],
];
const demoColors = ['#7A1F3D', '#C9A45C', '#D9C7A3', '#5C1730', '#B45C74', '#3B1220', '#8A6D4B'];
const demoFlags = ['', 'n', 'p', 's', 'fp', 'fn', ''];
const demoColorLabels = [['Bordeaux'], ['Or champagne'], ['Sable'], ['Bordeaux nuit'], ['Rose'], ['Noir'], ['Marron']];
for (const [gi, g] of demoCollections.entries())
  for (const [ni, model] of g[3].entries()) {
    const i = gi * g[3].length + ni;
    const slug =
      g[0] +
      '-' +
      model
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-');
    const price = [79, 99, 129, 149, 179, 199, 249, 299, 349, 399, 499, 599, 699, 799][(i * 5 + gi) % 14];
    const sale = i % 7 === 2 ? Math.round(price * 0.8) : null;
    const flags = sale !== null ? (i % 2 ? 'ps' : 's') : demoFlags[i % demoFlags.length];
    const stock = i % 19 === 0 ? 0 : i % 11 === 0 ? 1 : i % 11 === 1 ? 2 : 5 + (i % 13);
    P.push([
      slug,
      g[0],
      g[2][0] + ' ' + model,
      g[2][1] + ' ' + model,
      g[2][2] + ' ' + model,
      price,
      sale,
      g[1],
      '',
      demoColors[i % demoColors.length],
      demoColorLabels[i % demoColorLabels.length],
      flags,
      g[1] === 'shoe' ? 'shoe' : g[1] === 'dress' ? 'size' : 'none',
      stock,
    ]);
  }
if (P.length < 100) throw new Error('Le catalogue démo doit contenir au moins 100 produits.');
let sql = `-- DOSSORA — seed.sql (données de démonstration) — à exécuter UNE seule fois après schema.sql et policies.sql.
-- Généré par scripts/generate-demo.mjs. Les visuels /demo/*.svg sont des créations originales libres de droits.
-- Les tarifs de livraison et taux de change ci-dessous sont des EXEMPLES à modifier dans Admin → Livraison.

insert into public.shop_settings (key, value) values ('general', '${esc(
  JSON.stringify({
    shop_name: 'DOSSORA',
    slogan: "L'élégance à votre portée",
    currency: 'MAD',
    email: 'dossorashop@gmail.com',
    whatsapp: '212603391255',
    announcement_fr: 'Livraison internationale • Paiement à la livraison au Maroc',
    announcement_en: 'International delivery • Cash on delivery in Morocco',
    announcement_ar: 'توصيل دولي • الدفع عند الاستلام في المغرب',
  }),
)}'::jsonb) on conflict (key) do nothing;

`;
sql += `insert into public.categories (slug, parent_id, name_fr, name_en, name_ar, description_fr, description_en, description_ar, image_url, sort_order) values\n`;
sql +=
  cats
    .filter((c) => !c[1])
    .map((c) => {
      const d = catDesc[c[0]];
      return `('${c[0]}', null, '${esc(c[2])}', '${esc(c[3])}', '${esc(c[4])}', '${esc(d[0])}', '${esc(d[1])}', '${esc(d[2])}', '/demo/cat-${c[0]}.svg', ${c[7]})`;
    })
    .join(',\n') + '\non conflict (slug) do nothing;\n\n';
sql +=
  `insert into public.categories (slug, parent_id, name_fr, name_en, name_ar, sort_order)\nselect v.slug, p.id, v.fr, v.en, v.ar, v.o from (values\n` +
  cats
    .filter((c) => c[1])
    .map((c) => `('${c[0]}', '${c[1]}', '${esc(c[2])}', '${esc(c[3])}', '${esc(c[4])}', ${c[7]})`)
    .join(',\n') +
  `\n) as v(slug, parent, fr, en, ar, o) join public.categories p on p.slug = v.parent on conflict (slug) do nothing;\n\n`;

sql += `insert into public.products (slug, sku, category_id, name_fr, name_en, name_ar, description_fr, description_en, description_ar, price, sale_price, status, is_featured, is_popular, is_new, is_on_sale)\nselect v.slug, v.sku, c.id, v.fr, v.en, v.ar, v.dfr, v.den, v.dar, v.price, v.sale, 'published', v.f, v.p, v.n, v.s from (values\n`;
sql += P.map((p, i) => {
  const d = desc[p[7]];
  const fl = p[11];
  return `('${p[0]}', 'DOS-${String(i + 1).padStart(3, '0')}', '${p[1]}', '${esc(p[2])}', '${esc(p[3])}', '${esc(p[4])}', '${esc(d[0])}', '${esc(d[1])}', '${esc(d[2])}', ${p[5]}::numeric, ${p[6] ?? 'null'}::numeric, ${fl.includes('f')}, ${fl.includes('p')}, ${fl.includes('n')}, ${fl.includes('s')})`;
}).join(',\n');
sql += `\n) as v(slug, sku, cat, fr, en, ar, dfr, den, dar, price, sale, f, p, n, s) join public.categories c on c.slug = v.cat on conflict do nothing;\n\n`;

sql += `insert into public.product_images (product_id, url, alt, sort_order)\nselect p.id, v.url, p.name_fr, v.o from (values\n`;
sql += P.flatMap((p, i) => [
  `('${p[0]}', 'DOS-${String(i + 1).padStart(3, '0')}', '/demo/${p[0]}.svg', 0)`,
  `('${p[0]}', 'DOS-${String(i + 1).padStart(3, '0')}', '/demo/${p[0]}-2.svg', 1)`,
]).join(',\n');
sql += `\n) as v(slug, sku, url, o) join public.products p on p.slug = v.slug and p.sku = v.sku where not exists (select 1 from public.product_images i where i.product_id = p.id and i.url = v.url);\n\n`;

const rows = [];
P.forEach((p, i) => {
  const colors = p[10];
  const sizes = p[12] === 'size' ? ['S', 'M', 'L', 'XL'] : [null];
  const shoes = p[12] === 'shoe' ? ['37', '38', '39', '40', '41'] : [null];
  colors.forEach((col, ci) =>
    sizes.forEach((sz) =>
      shoes.forEach((sh) => {
        const stock = Number.isInteger(p[13]) ? p[13] : 4 + ((i * 7 + ci * 3 + (sz?.length ?? 0) + (sh ? +sh % 5 : 0)) % 14);
        const sku = `DOS-${String(i + 1).padStart(3, '0')}-${col.slice(0, 2).toUpperCase()}${sz ? '-' + sz : ''}${sh ? '-' + sh : ''}`;
        rows.push(
          `('${p[0]}', 'DOS-${String(i + 1).padStart(3, '0')}', '${esc(sku)}', '${esc(col)}', ${sz ? `'${sz}'` : 'null'}, ${sh ? `'${sh}'` : 'null'}, ${stock})`,
        );
      }),
    ),
  );
});
sql += `insert into public.product_variants (product_id, sku, color, size, shoe_size, stock, low_stock_threshold)\nselect p.id, v.sku, v.color, v.size, v.shoe, v.stock, 3 from (values\n${rows.join(',\n')}\n) as v(slug, product_sku, sku, color, size, shoe, stock) join public.products p on p.slug = v.slug and p.sku = v.product_sku on conflict (sku) do nothing;\n\n`;
const variantSkus = rows.map((row) => row.match(/^\('[^']+', '[^']+', '(DOS-[^']+)'/)?.[1]).filter(Boolean);
sql += `insert into public.inventory_movements (variant_id, delta, reason, note)\nselect v.id, v.stock, 'initial', 'Stock initial (démo)' from public.product_variants v where v.sku in (${variantSkus.map((sku) => `'${sku}'`).join(', ')}) and exists (select 1 from public.products p where p.id = v.product_id and p.sku = left(v.sku, 7) and p.slug in (${P.map((p) => `'${p[0]}'`).join(', ')})) and not exists (select 1 from public.inventory_movements m where m.variant_id = v.id and m.reason = 'initial' and m.note = 'Stock initial (démo)');\n\n`;

const C = [
  [
    'MA',
    'Maroc',
    'Morocco',
    'المغرب',
    'MAD',
    1,
    80,
    1000,
    2,
    5,
    1,
    ['Casablanca', 'Rabat', 'Marrakech', 'Fès', 'Tanger', 'Agadir', 'Meknès', 'Oujda', 'Tétouan', 'Kénitra', 'Salé', 'Laâyoune'],
  ],
  [
    'FR',
    'France',
    'France',
    'فرنسا',
    'EUR',
    10.8,
    15,
    1500,
    5,
    10,
    2,
    ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Lille', 'Bordeaux', 'Nice', 'Nantes', 'Strasbourg'],
  ],
  [
    'US',
    'États-Unis',
    'United States',
    'الولايات المتحدة',
    'USD',
    10,
    25,
    null,
    7,
    14,
    3,
    ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Miami', 'Washington'],
  ],
  ['CA', 'Canada', 'Canada', 'كندا', 'CAD', 7.3, 30, null, 7, 14, 4, ['Montréal', 'Toronto', 'Québec', 'Ottawa', 'Vancouver']],
  ['SN', 'Sénégal', 'Senegal', 'السنغال', 'XOF', 0.0165, 10000, null, 5, 10, 5, ['Dakar', 'Thiès', 'Saint-Louis']],
  ['CI', "Côte d'Ivoire", 'Ivory Coast', 'ساحل العاج', 'XOF', 0.0165, 10000, null, 5, 10, 6, ['Abidjan', 'Bouaké', 'Yamoussoukro']],
];
sql +=
  `insert into public.shipping_countries (code, name_fr, name_en, name_ar, currency, exchange_rate, fee, free_shipping_threshold, eta_min_days, eta_max_days, sort_order) values\n` +
  C.map(
    (c) =>
      `('${c[0]}', '${esc(c[1])}', '${esc(c[2])}', '${esc(c[3])}', '${c[4]}', ${c[5]}, ${c[6]}, ${c[7] ?? 'null'}, ${c[8]}, ${c[9]}, ${c[10]})`,
  ).join(',\n') +
  '\non conflict (code) do nothing;\n\n';
sql +=
  `insert into public.shipping_cities (country_code, name) values\n` +
  C.flatMap((c) => c[11].map((n) => `('${c[0]}', '${esc(n)}')`)).join(',\n') +
  '\non conflict do nothing;\n\n';

const PM = [
  ['cih_bank', 'CIH Bank', 'CIH Bank', 'بنك CIH', false, 1],
  ['wafacash', 'Wafacash', 'Wafacash', 'وفاكاش', false, 2],
  ['western_union', 'Western Union', 'Western Union', 'ويسترن يونيون', false, 3],
  ['moneygram', 'MoneyGram', 'MoneyGram', 'موني غرام', false, 4],
  ['wave', 'Wave', 'Wave', 'Wave', false, 5],
  ['bank_transfer', 'Virement bancaire', 'Bank transfer', 'تحويل بنكي', false, 6],
  ['cod', 'Paiement à la livraison (Maroc)', 'Cash on delivery (Morocco)', 'الدفع عند الاستلام (المغرب)', true, 7],
];
sql +=
  `insert into public.payment_methods (code, name_fr, name_en, name_ar, instructions_fr, instructions_en, instructions_ar, account_details, morocco_only, sort_order) values\n` +
  PM.map((m) =>
    m[0] === 'cod'
      ? `('cod', '${esc(m[1])}', '${esc(m[2])}', '${esc(m[3])}', 'Vous réglez en espèces au livreur à la réception (Maroc uniquement).', 'You pay the courier in cash on delivery (Morocco only).', 'تدفع نقدًا للموزع عند الاستلام (المغرب فقط).', null, true, 7)`
      : `('${m[0]}', '${esc(m[1])}', '${esc(m[2])}', '${esc(m[3])}', 'Effectuez le paiement avec les coordonnées ci-dessous, puis envoyez la preuve depuis votre commande ou par WhatsApp.', 'Make the payment using the details below, then send the proof from your order or via WhatsApp.', 'أرسل المبلغ بالمعلومات أدناه ثم ابعث الإثبات من طلبك أو عبر واتساب.', 'À renseigner dans Admin → Paiements (bénéficiaire, RIB / numéro).', false, ${m[5]})`,
  ).join(',\n') +
  '\non conflict (code) do nothing;\n\n';

sql += `insert into public.discount_codes (code, percent, min_order, is_active) values ('DOSSORA10', 10, 200, true) on conflict (code) do nothing;\n\n`;
sql += `insert into public.homepage_banners (title_fr, title_en, title_ar, subtitle_fr, subtitle_en, subtitle_ar, button_label_fr, button_label_en, button_label_ar, link_url, image_desktop_url, image_mobile_url, sort_order)
select v.title_fr, v.title_en, v.title_ar, v.subtitle_fr, v.subtitle_en, v.subtitle_ar, v.button_label_fr, v.button_label_en, v.button_label_ar, v.link_url, v.image_desktop_url, v.image_mobile_url, v.sort_order from (values
('Nouvelle collection', 'New collection', 'المجموعة الجديدة', 'Des pièces élégantes pour chaque instant.', 'Elegant pieces for every moment.', 'قطع أنيقة لكل لحظة.', 'Découvrir', 'Discover', 'اكتشفي', '/shop?flag=new', '/demo/banner-1.svg', '/demo/banner-1-m.svg', 1),
('Collection sacs', 'Bag collection', 'مجموعة الحقائب', 'Le sac qui complète toutes vos tenues.', 'The bag that completes every outfit.', 'الحقيبة التي تكمل كل إطلالاتك.', 'Voir les sacs', 'Shop bags', 'تسوقي الحقائب', '/shop?category=sacs', '/demo/banner-2.svg', '/demo/banner-2-m.svg', 2),
('Promotions', 'Special offers', 'عروض خاصة', 'Profitez de prix doux sur une sélection.', 'Enjoy gentle prices on a selection.', 'استفيدي من أسعار مميزة على مختارات.', 'Voir les offres', 'See offers', 'شاهدي العروض', '/shop?flag=sale', '/demo/banner-3.svg', '/demo/banner-3-m.svg', 3)\n) as v(title_fr, title_en, title_ar, subtitle_fr, subtitle_en, subtitle_ar, button_label_fr, button_label_en, button_label_ar, link_url, image_desktop_url, image_mobile_url, sort_order)\nwhere not exists (select 1 from public.homepage_banners b where b.link_url = v.link_url and b.image_desktop_url = v.image_desktop_url);\n`;
writeFileSync('supabase/seed.sql', sql);

// --- Images ---
P.forEach((p) => {
  writeFileSync(`public/demo/${p[0]}.svg`, productSvg(p[7], p[8], p[9], 1));
  writeFileSync(`public/demo/${p[0]}-2.svg`, productSvg(p[7], p[8], p[9], 2));
});
cats
  .filter((c) => !c[1])
  .forEach((c) => {
    writeFileSync(`public/demo/cat-${c[0]}.svg`, productSvg(c[5] === 'acc' ? 'acc' : c[5], c[5] === 'acc' ? 'necklace' : '', c[6], 1));
  });
const banner = (w, h, a, b, ring) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/><circle cx="${w * 0.78}" cy="${h * 0.45}" r="${h * 0.42}" fill="none" stroke="${ring}" stroke-width="2" opacity=".7"/><circle cx="${w * 0.78}" cy="${h * 0.45}" r="${h * 0.3}" fill="${ring}" opacity=".12"/><circle cx="${w * 0.78}" cy="${h * 0.45}" r="${h * 0.16}" fill="none" stroke="${ring}" stroke-width="2" opacity=".6"/></svg>`;
[
  [B, '#4A1226', G],
  ['#3B1220', B, G],
  ['#EFE3D0', '#DCC79C', B],
].forEach(([a, b, r], i) => {
  writeFileSync(`public/demo/banner-${i + 1}.svg`, banner(1600, 700, a, b, r));
  writeFileSync(`public/demo/banner-${i + 1}-m.svg`, banner(800, 1000, a, b, r));
});
console.log('Démo générée : supabase/seed.sql + public/demo/*.svg');
