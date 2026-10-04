# Base de données DOSSORA (Supabase)

## Procédure sûre dans Supabase → SQL Editor

### Projet Supabase neuf

1. Exécuter `schema.sql` une fois. Il crée tables, contraintes, déclencheurs et fonctions. Il contient déjà les colonnes des migrations 001 et 002.
2. Exécuter `policies.sql` pour activer RLS, installer les politiques et créer/configurer les buckets Storage (`shop-assets` public, `payment-proofs` privé).
3. Exécuter `verify.sql`. Les requêtes 1 à 5 doivent ne renvoyer aucune ligne.
4. Exécuter `seed.sql` pour ajouter le catalogue et les données de démonstration.
5. Exécuter à nouveau `verify.sql` et contrôler les compteurs 7 et 8 : 100 produits publiés et 37 catégories.

### Projet déjà utilisé

1. Exécuter d'abord `verify.sql` en lecture seule. Ne pas rejouer `schema.sql` sur une base existante : certaines créations de déclencheurs ne sont pas idempotentes.
2. Exécuter une migration uniquement si la requête 5 signale ses colonnes manquantes (`001_admin_language_and_hero.sql`, puis `002_order_location.sql`). Les migrations utilisent `ADD COLUMN IF NOT EXISTS` et ne modifient pas les rôles des profils.
3. Pour RLS/buckets manquants, examiner `policies.sql` avant de l'exécuter : il remplace ses politiques nommées et met à jour la configuration des deux buckets.
4. Quand les requêtes 1 à 5 ne renvoient aucune ligne, exécuter `seed.sql`. Le script est relançable sans dupliquer ses images, mouvements de stock initiaux ou bannières; les lignes en conflit sont ignorées et ne sont pas écrasées.
5. Exécuter à nouveau `verify.sql` et contrôler les compteurs 7 et 8.

Dans `verify.sql`, la requête 6 renvoie toujours une ligne de statistiques. Après le seed, les requêtes 7 et 8 renvoient les compteurs de produits et catégories de démonstration; elles n'indiquent pas d'erreur.

## Erreur 404 sur `/rest/v1/<table>` (homepage_banners, products, categories…)

Le frontend utilise exactement les noms de `schema.sql` (vérifié automatiquement : aucune table ni fonction inconnue). Un 404 signifie donc que PostgREST ne trouve pas la table :

1. `schema.sql`, `policies.sql` puis `seed.sql` n'ont pas été exécutés dans CE projet Supabase → exécutez-les, puis `verify.sql`.
2. `VITE_SUPABASE_URL` est incorrecte : utilisez l'URL racine `https://<projet>.supabase.co` (sans `/rest/v1`, sans slash final — le site normalise ces cas et l'indique dans la console).
3. Le cache de schéma n'est pas à jour : _Settings → API → Reload schema_ (ou `notify pgrst, 'reload schema';`).
   Le détail technique est dans la console du navigateur (`[DOSSORA] …`) ; le visiteur voit seulement « La boutique est en cours de configuration ».

## Créer le premier administrateur

1. Créez un compte normalement via `/register` sur le site (ou Authentication → Users → Add user).
2. Dans le SQL Editor :

```sql
update public.profiles set role = 'admin' where email = 'VOTRE_EMAIL';
```

3. Connectez-vous sur `/admin/login`.

Le rôle ne peut jamais être modifié par un client (trigger `prevent_role_change` + RLS).

## Logique de stock

- Commande créée → `reserved += quantité` (24 h). `stock_state = 'reserved'`.
- Statut « payée » (ou préparation/livraison) posé par l'admin → stock déduit définitivement (`stock_state = 'deducted'`).
- Annulation ou expiration 24 h sans preuve de paiement → réservation libérée (ou stock remis si déjà déduit).
- Les verrous `FOR UPDATE` dans `create_order` évitent les surventes en cas de commandes simultanées.
- Les réservations expirées sont libérées à chaque nouvelle commande et à l'ouverture du dashboard admin.
  Option : planifier `select public.release_expired_reservations();` toutes les 15 min avec l'extension **pg_cron**.

## Devises

Les produits sont tarifés dans la devise de la boutique (`shop_settings.general.currency`, MAD par défaut).
Chaque pays de livraison a sa propre devise et un `exchange_rate` (combien de MAD pour 1 unité de cette devise) :
le tarif saisi en devise locale est converti côté serveur. Le total facturé est toujours en devise boutique.
