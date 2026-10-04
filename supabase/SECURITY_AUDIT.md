# SECURITY AUDIT DOSSORA

**Périmètre :** audit statique des sources locales, du schéma SQL, des policies, des migrations et des dépendances. Le projet n’est pas connecté à une instance Supabase pendant cet audit : les migrations n’ont pas été exécutées et les scénarios RLS n’ont pas été testés avec de vrais comptes.

## Résumé

- Les routes d’administration sont sous `RequireAdmin`; la sécurité des données dépend en plus des policies RLS `is_admin()` et des RPC PostgreSQL.
- Les 22 tables du schéma sont déclarées avec RLS activé dans `policies.sql`. Les vues `customers` sont `security_invoker` et ne contiennent que les données nécessaires à l’admin.
- Les commandes sont créées par `create_order`, qui valide côté serveur les produits, prix, réductions, frais et stocks; les éléments de commande conservent leurs instantanés.
- Les droits directs de modification de `profiles` et `notifications` sont réduits par privilèges de colonnes, en complément des policies et triggers.
- `npm audit --omit=dev` : **0 vulnérabilité** après mise à niveau de production. `npm audit` complet : **5 vulnérabilités élevées**, toutes dans les dépendances de développement de Tailwind 3 via `braces`; le registre ne propose pas encore de version corrigée de `braces`.

## Matrice RLS table par table

RLS est activé pour chacune des tables ci-dessous. « Admin » signifie une policy `admin_all_*` conditionnée par `public.is_admin()`. Les RPC SECURITY DEFINER sont listées dans la section PostgreSQL.

| Table | Client : SELECT | INSERT | UPDATE | DELETE | Admin |
|---|---|---|---|---|---|
| `profiles` | Son profil | Non | Champs autorisés uniquement : nom, téléphone, pays, ville; la langue admin est protégée par trigger | Non | Policy admin; privilèges de colonnes toujours appliqués |
| `categories` | Publiées | Non | Non | Non | Admin |
| `products` | Publiés | Non | Non | Non | Admin |
| `product_images` | Images de produits publiés | Non | Non | Non | Admin |
| `product_variants` | Variantes de produits publiés | Non | Non | Non | Admin |
| `shipping_countries` | Pays actifs | Non | Non | Non | Admin |
| `shipping_cities` | Villes actives | Non | Non | Non | Admin |
| `shipping_rates` | Tarifs publics | Non | Non | Non | Admin |
| `payment_methods` | Méthodes actives, authentification requise | Non | Non | Non | Admin |
| `discount_codes` | Non; validation via RPC | Non | Non | Non | Admin |
| `discount_usages` | Ses utilisations | Non | Non | Non | Admin |
| `orders` | Ses commandes | Non; `create_order` RPC | Non; RPC de statut pour admin | Non | Admin |
| `order_items` | Articles de ses commandes | Non | Non | Non | Admin |
| `inventory_movements` | Non | Non | Non | Non | Admin |
| `addresses` | Ses adresses | Ses adresses | Ses adresses | Ses adresses | Admin |
| `conversations` | Ses conversations | Ses conversations | Non | Non | Admin |
| `messages` | Messages de ses conversations | Messages de ses conversations | Non | Non | Admin |
| `notifications` | Ses notifications | Non; notifications serveur/admin | `read_at` uniquement | Ses notifications | Admin, limité aussi aux privilèges SQL accordés |
| `return_requests` | Ses demandes | RPC `create_return_request` | Non | Non | Admin |
| `homepage_banners` | Bannières actives | Non | Non | Non | Admin |
| `shop_settings` | Uniquement `key = 'general'` | Non | Non | Non | Admin |
| `newsletter_subscribers` | Non | Inscription email publique; trigger normalise l’email et associe `auth.uid()` | Non | Non | Admin |

`customers` est une vue `security_invoker` en lecture seule; la policy `profiles` limite les lignes et la vue renvoie nom, email, téléphone, lieu, date d’inscription, commandes, total dépensé et dernière activité. Aucun mot de passe n’est stocké dans cette vue ni affiché.

## Rapport des 20 domaines

| Domaine | Gravité | Résultat, correction ou limite | Fichiers / vérification |
|---|---|---|---|
| 1. Authentification | Faible | Supabase Auth gère session, connexion, inscription, déconnexion, vérification/reset; aucun stockage maison des mots de passe. Configuration de l’instance et MFA non vérifiables localement. | `src/store/auth.ts`, `src/pages/Auth.tsx`; revue statique |
| 2. Autorisation | Faible | `RequireAdmin` vérifie session et rôle, RLS et RPC réévaluent l’autorité côté serveur. | `src/components/Guards.tsx`, `supabase/policies.sql` |
| 3. RLS | Moyen avant migration | Policies table par table ci-dessus; correctifs locaux prêts. Tant que `policies.sql` et migration 003 ne sont pas appliqués sur l’instance réelle, le backend peut différer de ces sources. | `supabase/policies.sql`, `supabase/migrations/003_security_notifications.sql`, `supabase/verify.sql` |
| 4. PostgreSQL | Faible | Les opérations sensibles passent par des RPC; pas de prix ou stock faisant autorité depuis le navigateur. Exécution directe de `release_expired_reservations()` révoquée dans les scripts. | `supabase/schema.sql`, `supabase/policies.sql` |
| 5. Storage | Faible | `shop-assets` est public en lecture et administrateur seul en écriture; `payment-proofs` est privé, dépôt dans le dossier UID et lecture propriétaire/admin. Pas de policy client d’édition/suppression des fichiers administratifs. | `supabase/policies.sql`; config réelle non interrogée |
| 6. Secrets | Faible, sous réserve | `.env` ne déclare que les noms `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_WHATSAPP_NUMBER`, `VITE_SHOP_EMAIL`; aucun nom de variable service-role. Les valeurs n’ont pas été affichées. | `.env`, `.env.example`, `src/lib/supabase.ts` |
| 7. Variables d’environnement | Faible | `.env` est ignoré par Git; aucune clé privée dans le client. Une clé anon est publique par conception et dépend de RLS. | `.gitignore`, `src/lib/supabase.ts` |
| 8. XSS | Faible | Recherche de `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function` : aucun résultat dans `src`/`scripts`. Les messages sont rendus comme texte React. | Recherche statique |
| 9. Injection SQL | Faible | Requêtes via Supabase JS paramétrées; fonctions SQL utilisent des arguments typés et ne concatènent pas de chaînes utilisateur en SQL dynamique. | `src`, `supabase/schema.sql`; recherche statique |
| 10. IDOR | Faible, non testé sur backend | RLS filtre commandes, adresses, profils, conversations, messages et notifications par `auth.uid()`; route d’étiquette admin dans le guard et requête soumise à RLS. | `supabase/policies.sql`, `src/pages/admin/OrderLabel.tsx` |
| 11. Routes admin | Faible, non testé en navigateur avec comptes réels | Toutes les pages admin sont imbriquées sous `RequireAdmin`; une redirection React seule ne constitue pas le contrôle final, les tables et RPC le font. | `src/App.tsx`, `src/components/Guards.tsx` |
| 12. Commandes | Faible | RPC serveur revérifie UID, produits publiés, variantes, prix, frais, code promo et stock; éléments historiques en instantané. WhatsApp compose le message depuis la commande relue en base. | `supabase/schema.sql`, `src/pages/account/OrderDetail.tsx` |
| 13. Paiements | Faible, configuration à confirmer | Preuve privée, reçue via RPC et bucket privé; les moyens de paiement ne sont visibles qu’aux utilisateurs connectés. Vérification de configuration de paiement réelle non possible. | `supabase/policies.sql`, `src/services/storage.ts` |
| 14. Stocks | Faible | Modifications via `admin_adjust_stock` avec contrôle admin et journal de mouvements; la commande réserve atomiquement le stock. | `supabase/schema.sql`, `src/pages/admin/AdminInventory.tsx` |
| 15. Messages | Faible | Messages liés à des conversations; trigger détermine l’expéditeur depuis la session et notifie le destinataire. Client limité à ses conversations. | `supabase/schema.sql`, `supabase/policies.sql` |
| 16. Notifications | Corrigé dans migration | Client lit/supprime ses notifications et ne modifie que `read_at`; migration crée la suppression propriétaire et réduit les privilèges de colonnes. | `supabase/migrations/003_security_notifications.sql`, `src/hooks/useNotifications.ts` |
| 17. Promotions | Faible | `admin_send_promotion` vérifie `is_admin()`, valide le texte et les destinataires serveur; un code peut être restreint aux clients sélectionnés. | `supabase/schema.sql`, migration 003, `src/pages/admin/AdminPromotions.tsx` |
| 18. Dépendances | Moyen | Après mise à niveau, audit production à zéro. Cinq avis élevés restent en développement dans Tailwind 3 (`braces` et chaîne transitive), sans version corrigée publiée au moment de l’audit; aucun `npm audit fix --force`. | `package.json`, `package-lock.json`; `npm audit` |
| 19. Git | Faible, historique inconnu | `.env` est ignoré. Le dossier ne contient pas de dépôt Git exploitable dans cet environnement; l’absence d’exposition dans un historique distant ne peut donc pas être certifiée. | `.gitignore`; contrôle local |
| 20. Tests de sécurité | Moyen | Build, typecheck, lint et 31 tests existants passent. Pas d’instance Supabase locale/credentials pour exécuter les scénarios cross-user, reset, expiration, ou assertions RLS; `verify.sql` fournit des vérifications post-migration. | `supabase/verify.sql`, `npm run check`, `npm run build` |

## Fonctions SECURITY DEFINER

Les fonctions métier utilisent `SET search_path = public` et les références de tables sont qualifiées. Les RPC admin vérifient `public.is_admin()`; les RPC client vérifient l’identité/propriété des objets. Les fonctions de trigger ne sont pas destinées à être appelées comme RPC. Le propriétaire effectif des fonctions et les ACL de l’instance distante ne sont pas vérifiables sans connexion PostgreSQL.

## Dépendances et exécution

Versions principales après mise à niveau : React Router DOM 7.18.4, Vite 8.3.2, `@vitejs/plugin-react` 6.1.1, Vitest 5.0.3, Tailwind CSS 3.4.19. `npm run check` exécute génération de types, vérification i18n, TypeScript, ESLint et 31 tests; `npm run build` compile le client de production.

## Étapes requises sur Supabase

1. Appliquer les migrations déjà existantes dans l’ordre, puis `supabase/migrations/003_security_notifications.sql` et `supabase/policies.sql` si ces policies ne sont pas déjà installées.
2. Lancer `supabase/verify.sql`; toutes les vérifications étiquetées manquantes/dangereuses doivent retourner zéro ligne.
3. Dans un environnement de staging avec deux comptes clients et un admin, tester explicitement `/admin/*`, lecture croisée d’une commande, modification du rôle/email, suppression croisée de notification, modification produit/stock et campagne promotionnelle non-admin.
4. Ajouter une limitation de débit et une confirmation d’inscription newsletter côté fournisseur/Edge Function avant d’ouvrir largement le formulaire : l’insertion publique est volontaire pour les visiteurs, mais l’anti-abus dépend du service Supabase/edge non présent dans ce dépôt.
