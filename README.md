# DOSSORA — L'élégance à votre portée

Boutique e-commerce internationale (FR / EN / AR-RTL) : React + TypeScript + Vite + Tailwind + Zustand + Framer Motion + Supabase (Auth, Postgres/RLS, Storage, Realtime). Monolithe modulaire, sans serveur Node à héberger : le front est statique (Cloudflare Pages) et toute la logique sensible s'exécute dans Postgres (fonctions `SECURITY DEFINER` + RLS).

Contact boutique : dossorashop@gmail.com · WhatsApp +212 603 391 255

---

## 1. Prérequis
Node 20+ (testé avec Node 22 / npm 10) et un compte Supabase gratuit.

## 2. Installation
```bash
npm install
cp .env.example .env     # puis renseignez les variables (étape 3)
npm run dev              # http://localhost:5173
```

## 3. Variables d'environnement (`.env`)
| Variable | Rôle |
|---|---|
| `VITE_SUPABASE_URL` | URL du projet (Supabase → Settings → API) |
| `VITE_SUPABASE_ANON_KEY` | clé **anon/public** uniquement |
| `VITE_WHATSAPP_NUMBER` | `212603391255` (format international, sans `+`) |
| `VITE_SHOP_EMAIL` | `dossorashop@gmail.com` |

⚠️ N'ajoutez **jamais** la clé `service_role` : tout ce qui est préfixé `VITE_` est visible dans le navigateur. Le fichier `.env` est ignoré par git. Aucune clé factice n'est fournie.

## 4. Créer le projet Supabase
Créez un projet sur supabase.com, puis récupérez l'URL et la clé anon (étape 3).

## 5. Exécuter le SQL (dans cet ordre, SQL Editor)
1. `supabase/schema.sql` — tables, triggers, fonctions transactionnelles.
2. `supabase/policies.sql` — RLS, droits des fonctions, buckets Storage.
3. `supabase/seed.sql` — données de démonstration (facultatif mais conseillé pour tester).
4. Base déjà créée avec une ancienne version ? Exécutez en plus `supabase/migrations/001_…sql` et `002_…sql` (idempotents).
5. `supabase/verify.sql` — diagnostic : tout doit renvoyer 0 ligne (voir `supabase/README.md`, section « Erreur 404 »).

## 6. Authentification
Authentication → Providers → Email activé. Conseillé : « Confirm email » activé.
Authentication → URL Configuration : *Site URL* = votre domaine (ou `http://localhost:5173` en local) ; ajoutez dans *Redirect URLs* : `/login` et `/reset-password` de ce domaine. Sans cela, les liens de confirmation et de réinitialisation ne fonctionneront pas.
Astuce : configurez un SMTP personnalisé (Authentication → SMTP) pour un envoi fiable d'e-mails en production.

## 7. Storage
Créé par `policies.sql` : `shop-assets` (public, écriture admin : produits, bannières, catégories) et `payment-proofs` (privé : preuves de paiement et médias de retour, dossier = id du client, accès via URL signées).

## 8. Sécurité RLS
RLS est activé sur toutes les tables. Un client ne voit que ses données ; l'admin (`profiles.role = 'admin'`) voit tout. Le rôle ne peut pas être modifié depuis le client. La création de commande recalcule prix, frais, promo et stock **côté base** ; le navigateur n'est jamais une source de vérité.

## 9. Créer l'administrateur
Créez un compte via `/register`, puis dans le SQL Editor :
```sql
update public.profiles set role = 'admin' where email = 'VOTRE_EMAIL';
```
Connexion sur `/admin/login`.

## 10. Développement
| Commande | Rôle |
|---|---|
| `npm run dev` / `build` / `preview` | développement, build de production (`tsc` strict + Vite), prévisualisation |
| `npm run lint` · `lint:fix` | ESLint (TypeScript strict, hooks React, pas de `any`, pas de `console.log`) |
| `npm run format` · `format:check` | Prettier |
| `npm test` | tests unitaires Vitest (traduction client/admin, panier, livraison, géolocalisation, erreurs) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:types` | régénère `src/types/database.ts` depuis `supabase/schema.sql` |
| `npm run i18n:check` | vérifie les clés de traduction par périmètre (client / admin) et l'étanchéité |
| `npm run check` | tout enchaîner : types BD à jour, i18n, typecheck, lint, tests |

## 11. Build
```bash
npm run build     # tsc --noEmit puis vite build → dossier dist/
npm run preview
```

## 12. Déploiement Cloudflare Pages
- Connectez le dépôt · *Build command* : `npm run build` · *Build output directory* : `dist`
- *Environment variables* : les 4 variables de l'étape 3 (Production et Preview)
- `public/_redirects` (`/* /index.html 200`) gère le routage SPA ; `public/_headers` ajoute des en-têtes de sécurité et de cache.

## 13. Nom de domaine
Cloudflare Pages → Custom domains. Puis mettez à jour : *Site URL* Supabase (étape 6), `public/sitemap.xml` et `public/robots.txt` (remplacez le domaine d'exemple par le vôtre).

## 14. Images
Les images de démonstration (`public/demo/*.svg`) sont originales et générées par `npm run demo:generate`. En production, téléversez vos vraies photos depuis l'admin (JPG/PNG/WebP/AVIF, 5 Mo max) ; elles vont dans Storage.

## 15. Produits
Admin → Produits : noms/descriptions FR-EN-AR, prix et prix promo, catégorie, statut (brouillon/publié/archivé), drapeaux (nouveau, promo, populaire, sélection), images réordonnables, variantes (couleur, taille, pointure, SKU, prix spécifique, seuil de stock faible). Le stock initial d'une nouvelle variante passe par un mouvement « initial » ; ensuite il se règle dans Admin → Stock (historique conservé). Un produit déjà commandé ne peut pas être supprimé : archivez-le.

## 16. Commandes
Statuts : `pending_payment → payment_proof_received → paid → preparing → delivering → delivered` (+ `cancelled`).
- Stock réservé 24 h à la commande, déduit au passage en « payée », libéré en cas d'annulation ou d'expiration.
- Les réservations expirées sont libérées à chaque nouvelle commande et à l'ouverture du tableau de bord ; option : planifier `select public.release_expired_reservations();` toutes les 15 min avec pg_cron.
- Étiquettes colis : Admin → Commandes → Ouvrir → Imprimer l'étiquette (100×100 mm, A4×4, A4×8, QR code, réimpression illimitée).
- Retours : 48 h après réception, produit défectueux ou erreur de couleur ; traitement dans l'onglet « Retours ».

## 17. Paiements
Admin → Paiements : CIH Bank, Wafacash, Western Union, MoneyGram, Wave, virement et paiement à la livraison (Maroc uniquement). **Renseignez les coordonnées (RIB, numéros, bénéficiaire) de chaque moyen avant la mise en ligne** : le seed contient des valeurs à remplacer. Les paiements manuels restent « en attente » jusqu'à validation par l'admin (changement de statut).

## 18. Codes promo
Admin → Promotions : % ou montant fixe, minimum de commande, limite d'usage, dates. Le code de démonstration `DOSSORA10` peut être supprimé. La validation est refaite côté serveur à la commande.

## 19. Livraison
Admin → Livraison : par pays (devise, taux de change vers la devise boutique, frais de base, seuil de gratuité, délais, actif), liste de villes, et tarifs par ville (`Ville=frais`). Le pays est choisi avant la ville, au paiement et dans les adresses.

## 20. Langues : client et administration indépendants
- **Client** : `src/i18n/client/{fr,en,ar}.json`, choix stocké dans le navigateur du client (`dossora-lang`).
- **Admin** : `src/i18n/admin/{fr,en,ar}.json`, chargés **à la demande** (jamais téléchargés par un client). Préférence rattachée au **compte admin** (`profiles.admin_language`) + cache `localStorage['dossora_admin_language']` ; à la connexion, la valeur du compte fait foi.
- Le périmètre est déterminé par la route (`/admin/*` = admin) ; `useT()` choisit automatiquement le bon dictionnaire. Changer l'une des langues ne modifie jamais l'autre, et deux admins peuvent travailler simultanément dans deux langues.
- Réglage : **Admin → Réglages → Langue et région** (ou le sélecteur 🌐 de l'en-tête). L'arabe active le RTL (`dir="rtl"`) sur tout l'espace concerné.
- Repli : langue demandée → français → clé (jamais « undefined »). Les données métier (noms de produits…) ne sont jamais traduites automatiquement ; elles ont leurs propres champs `_fr/_en/_ar`.

## 21. Géolocalisation de livraison (gratuite, avec consentement)
- À l'étape *Adresse* du paiement, le client peut cliquer « Utiliser ma position » (`navigator.geolocation`). **Rien n'est demandé automatiquement** ; un refus, un délai dépassé, une position indisponible ou un navigateur incompatible affichent un message clair et la saisie manuelle de l'adresse reste possible.
- Latitude, longitude, précision et horodatage sont enregistrés **après** la commande via `attach_order_location` (réservée au propriétaire de la commande, dans les 2 h) ; un échec n'empêche jamais la commande.
- Confidentialité : lecture protégée par RLS (le client voit sa commande, l'admin toutes). Aucun autre client n'y accède.
- Admin → Commandes → *Ouvrir* : coordonnées, carte **OpenStreetMap** intégrée (sans clé ni bibliothèque), lien d'ouverture, et bouton « Afficher l'adresse lisible » (Nominatim, déclenché à la demande — respectez ses conditions d'usage ; pour un fort volume, utilisez votre propre instance). Sans coordonnées : « Position non disponible ».
- Pensez à mentionner ce traitement dans votre politique de confidentialité et à définir une durée de conservation.

## 22. Animations
Système centralisé : `src/lib/motion.ts` (durées FAST 150 / NORMAL 250 / SLOW 400 ms, courbe unique, cascade, miniature « vole vers le panier »), keyframes dans `tailwind.config.js`, composants `FadeImage`, `FavoriteButton`, `PageTransition`, `OrderSuccessAnimation`, `ProductSkeleton`. Principes : `transform` + `opacity` uniquement, CSS d'abord (Framer Motion pour les entrées/sorties de menus, recherche, lignes du panier, splash), survol réservé aux appareils qui en ont un, `prefers-reduced-motion` respecté (CSS global + `MotionConfig`). Le splash (≈ 1,6 s, ivoire) ne s'affiche qu'une fois par session. Aucune dépendance ajoutée.

## 23. Types Supabase
`src/types/database.ts` est **généré** depuis `supabase/schema.sql` (`npm run db:types`) et passé à `createClient<Database>()` : une table, une colonne ou une fonction RPC mal orthographiée fait échouer la compilation. `npm run check` refuse un fichier obsolète. Seul le gestionnaire CRUD générique de l'admin utilise un accès non typé (`untypedFrom`).

## 24. Tests de bout en bout
`tests/e2e/smoke.py` (Playwright Python, `pip install playwright && playwright install chromium`) simule Supabase (aucune base réelle nécessaire) et vérifie routes, responsive 375/768/1024/1280 px, FR/AR-RTL, indépendance des langues admin/client, hero admin, panier, favoris, recherche, géolocalisation, confirmation de commande et pannes réseau. Voir l'en-tête du fichier pour le lancer.

## 25. Dépendances et alertes `npm audit`
Aucune dépendance de production n'a été ajoutée par les animations, la géolocalisation ou la traduction admin. Ajoutées en développement uniquement : ESLint, typescript-eslint, eslint-plugin-react-hooks, Prettier, Vitest. `npm audit` signale encore des alertes **modérées/élevées** corrigées seulement par des montées de version majeures : `vite`/`esbuild`/`vitest` (serveur de développement local uniquement, jamais déployé) et `react-router` (failles de redirection ouverte via liens construits avec une saisie utilisateur et de désérialisation du mode « framework » ; DOSSORA n'utilise ni l'un ni l'autre). Une migration vers Vite 7+/React Router 7 est possible mais exige Node ≥ 20.19 ; à planifier séparément.

## 26. Limites connues / à faire avant production
- Les pages légales sont des **modèles** : faites-les relire par un juriste et complétez les mentions légales (raison sociale, ICE/RC, adresse).
- Les tests unitaires (Vitest) et la suite e2e simulée ne remplacent pas un test contre un vrai projet Supabase ; le projet a été vérifié par `tsc` strict, `vite build` et un test de navigation sans Supabase (pages publiques, mobile 375 px et bureau, FR et AR-RTL, sans débordement horizontal) ; il n’a pas été testé contre une instance Supabase réelle ni sur appareils physiques.
- Les e-mails transactionnels (hors auth) ne sont pas envoyés : les notifications sont in-app (temps réel). WhatsApp est un lien `wa.me` (pas d'API).
- Pas de paiement par carte en ligne (hors périmètre demandé).
