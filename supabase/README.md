# Base de données DOSSORA (Supabase)

## Procédure sûre dans Supabase → SQL Editor

### Projet Supabase neuf

1. Exécuter `schema.sql` une fois. Il crée tables, contraintes, déclencheurs et fonctions. Il contient déjà les colonnes des migrations 001 et 002.
2. Exécuter `policies.sql` pour activer RLS, installer les politiques et créer/configurer les buckets Storage (`shop-assets` public, `payment-proofs` privé).
3. Exécuter `verify.sql`. Les diagnostics de structure et de sécurité ne doivent renvoyer aucune ligne.
4. Exécuter `seed.sql` pour ajouter le catalogue et les données de démonstration.
5. Exécuter à nouveau `verify.sql` et contrôler les compteurs 7 et 8 : 100 produits publiés et 37 catégories.

### Projet déjà utilisé

1. Exécuter d'abord `verify.sql` en lecture seule. Ne pas rejouer `schema.sql` sur une base existante : certaines créations de déclencheurs ne sont pas idempotentes.
2. Exécuter seulement les migrations manquantes signalées par `verify.sql`, dans l'ordre `001`, `002`, `003`, `004`, `005_social_auth_profiles.sql`, puis `006_whatsapp_order_outbox.sql`. Les migrations 005/006 sont additives; elles ne suppriment aucune commande ni aucun profil.
3. Pour RLS/buckets manquants, examiner `policies.sql` avant de l'exécuter : il remplace ses politiques nommées et met à jour la configuration des deux buckets.
4. Quand les diagnostics de structure ne renvoient aucune ligne, exécuter `seed.sql`. Le script est relançable sans dupliquer ses images, mouvements de stock initiaux ou bannières; les lignes en conflit sont ignorées et ne sont pas écrasées.
5. Exécuter à nouveau `verify.sql` et contrôler les compteurs 7 et 8.

Dans `verify.sql`, la requête 6 renvoie toujours une ligne de statistiques. Après le seed, les requêtes 7 et 8 renvoient les compteurs de produits et catégories de démonstration; elles n'indiquent pas d'erreur.

## Connexion Google et Apple

- Dans **Supabase → Authentication → Sign In / Providers**, activer Google et Apple et saisir les identifiants fournisseur dans le dashboard Supabase. Aucun secret OAuth ne doit être ajouté à `.env`, au frontend ou au dépôt.
- Dans **Authentication → URL Configuration → Redirect URLs**, autoriser les callback URLs de l'application, par exemple `http://localhost:5173/auth/callback` en local et `https://VOTRE-DOMAINE/auth/callback` en production. Garder la Site URL correspondant au site déployé.
- Dans Google Cloud et Apple Developer, déclarer comme URI de retour OAuth l'URL de callback Supabase affichée par le dashboard du projet (`https://<project-ref>.supabase.co/auth/v1/callback`). Cette URL du fournisseur est distincte du callback de l'application.
- Pour une base existante, exécuter `supabase/migrations/005_social_auth_profiles.sql` seulement si le diagnostic 10 de `verify.sql` indique que le bootstrap OAuth manque ou est obsolète; ne pas rejouer `schema.sql`.

## Notification WhatsApp automatique des commandes

### Architecture

- La migration `006_whatsapp_order_outbox.sql` attache un trigger différé à `orders`. À la validation de la transaction de commande, il copie le contenu complet de toutes les lignes `order_items` dans l'outbox, avec un identifiant unique par commande et type. Le déclencheur est différé pour inclure toutes les lignes de commande.
- La fonction `whatsapp-order-dispatcher` lit l'outbox côté serveur, découpe les messages longs en segments sans perdre de caractères et envoie chaque segment via l'API officielle WhatsApp Business Cloud avec un modèle approuvé. Le statut `sent` signifie accepté par l'API, pas une preuve de livraison sur l'appareil du destinataire.
- Les segments réussis ne sont pas renvoyés lors d'une reprise. Les échecs temporaires sont réessayés après 1, puis 5 minutes, avec 3 tentatives par segment. Les tentatives et réponses HTTP sont conservées. Un crash après acceptation par Meta mais avant l'enregistrement SQL peut néanmoins entraîner un doublon : l'API externe ne fournit pas ici de transaction atomique avec PostgreSQL.
- Le client ne peut ni insérer ni modifier l'outbox. Seul `service_role`, dans l'Edge Function, peut appeler les fonctions de traitement; les administrateurs peuvent lire le journal sous RLS.

### Mise en service nécessaire

1. Appliquer `006_whatsapp_order_outbox.sql` après les migrations précédentes. Ne pas réexécuter `schema.sql` sur une base utilisée.
2. Dans Meta WhatsApp Business, créer et faire approuver un modèle **Utility** avec un unique paramètre texte `{{1}}` dans le corps. Le destinataire doit être un numéro WhatsApp Business joignable et configuré pour le mode de test/production Meta. Les modèles sont nécessaires pour initier un message sortant hors fenêtre de service; voir la [collection officielle Meta WhatsApp Cloud API](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api).
3. Déployer les fichiers de `supabase/functions/whatsapp-order-dispatcher/` avec Supabase CLI lié au projet existant : `supabase functions deploy whatsapp-order-dispatcher --no-verify-jwt`. La fonction désactive la validation JWT du gateway et vérifie elle-même le secret partagé Bearer.
4. Dans **Supabase → Edge Functions → Secrets**, configurer `WHATSAPP_DISPATCH_SECRET`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ADMIN_PHONE`, `WHATSAPP_GRAPH_API_VERSION`, `WHATSAPP_ORDER_TEMPLATE_NAME` et `WHATSAPP_TEMPLATE_LANGUAGE`. `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis au runtime hébergé Supabase; ne jamais les ajouter à Vite ou au frontend.
5. Dans **Supabase → SQL Editor**, stocker le même secret partagé dans Vault (sans me le communiquer), ainsi que l'URL du projet :

```sql
select vault.create_secret('https://<project-ref>.supabase.co', 'dossora_project_url');
select vault.create_secret('<LE_MÊME_SECRET_QUE_WHATSAPP_DISPATCH_SECRET>', 'dossora_whatsapp_dispatch_secret');
```

6. Exécuter `supabase/whatsapp_cron.sql`. Il active `pg_cron`/`pg_net` et appelle l'Edge Function chaque minute. Aucune action du navigateur n'est impliquée.
7. Relancer `verify.sql`; le diagnostic 11 ne doit rien signaler. Vérifier ensuite le journal d'exécution du cron et les logs de l'Edge Function après une commande de test.

Les paramètres WhatsApp sont des secrets backend et ne doivent pas être placés dans `.env`, `.env.example`, `VITE_*` ou dans React. L'envoi automatique n'est pas actif avant application de la migration, déploiement de l'Edge Function, approbation/configuration du modèle et activation du cron.

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
