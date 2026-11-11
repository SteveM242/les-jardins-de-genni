# L'Héritage des Mornes

Site de vente de paniers de fruits et légumes de Martinique : catalogue, commande en ligne (avec ou sans compte), suivi des commandes, et espace pro pour L'Héritage des Mornes.

- **Front** : Vue 3 + Vue Router, construit avec Vite (`src/`)
- **Serveur** : Express 5 (`app.cjs`, `server.cjs`, `routes/`, `lib/`), qui sert aussi le front construit
- **Base** : PostgreSQL (migrations SQL dans `migrations/`)
- **Hébergement visé** : Railway (service Node + Postgres)

## Démarrer en local

Prérequis : Node 22+ et une base Postgres.

```bash
npm install
cp .env.example .env        # puis renseigner DATABASE_URL, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npm run build               # construit le front dans dist/
npm run start:local         # serveur sur http://localhost:4173 (migre la base au démarrage)
```

Pour travailler sur le front avec rechargement à chaud, lancez le serveur ci-dessus puis `npm run dev` (Vite). Les appels `/api` doivent alors être redirigés vers le port 4173 (voir `vite.config.js`).

## Commandes

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Serveur de développement Vite |
| `npm run build` | Construit le front (`dist/`) |
| `npm start` | Lance le serveur (production) |
| `npm run start:local` | Idem, en chargeant `.env` |
| `npm test` | Tests unitaires et HTTP (sans base de données : elle est simulée) |
| `npm run lint` | ESLint |

La CI (`.github/workflows/ci.yml`) lance lint, build et tests à chaque push et pull request.

## Variables d'environnement

Toutes sont décrites dans [.env.example](.env.example). Les indispensables en production :

- `DATABASE_URL` — base Postgres
- `JWT_SECRET` — **obligatoire** : le serveur refuse de démarrer sans lui en production
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — **amorçage** du tout premier compte de l'espace pro (utilisés seulement si aucun administrateur n'existe). Ensuite L'Héritage des Mornes change son email et son mot de passe dans l'espace pro ; ces variables ne réécrivent plus rien. Mot de passe perdu : définir `ADMIN_FORCE_RESET=true` avec les nouvelles valeurs, redéployer, puis retirer `ADMIN_FORCE_RESET`.

Facultatives mais recommandées : `ORDER_SMTP_*` + `ORDER_NOTIFY_EMAIL` (emails de commande et de suivi) et `SITE_URL` (URL publique pour le sitemap et les aperçus WhatsApp).

## Architecture

```
app.cjs / server.cjs     création de l'app Express / démarrage + migrations
routes/                  catalogue, commandes, compte client, admin (par ressource)
lib/                     prix et remises (pricing), images, emails, SEO, limitation de débit
migrations/*.sql         schéma de la base, appliqué dans l'ordre et tracé dans schema_migrations
src/                     front Vue (views/, components/, stores/, composables/)
src/data/pages.json      titres et descriptions des pages (front et balises de partage serveur)
test/                    tests node:test
scripts/                 outils ponctuels (optimisation des images)
```

Points à connaître :

- **Paniers personnalisables** (migration `010`) : dans l'espace pro › Paniers, « Rendre ce panier personnalisable » définit un total d'articles (ex. 16) et une liste d'articles : *dans le panier* (quantité par défaut) ou *de remplacement* (0 par défaut), chacun avec une quantité maximale et une précision (provenance, quantité). Le client compose son panier sur la page du panier (compteur « 14 / 16 », +/−, retour au panier d'origine) : le **prix reste fixe**. Le serveur recontrôle toujours le choix (`lib/composition.cjs`) : article inconnu, maximum ou total dépassé = refus, jamais d'ajustement silencieux. Le choix exact est enregistré dans la commande (et visible dans l'espace pro, l'email et le retrait). Sans choix précis (WhatsApp, ancien panier d'achat), la composition par défaut s'applique. Option **panier complet** : le client doit atteindre exactement le total pour commander (les quantités par défaut doivent déjà l'atteindre). Si la composition change alors que des clients ont un ancien choix dans leur panier d'achat, le serveur répond 409 `SELECTION_CHANGED` avec un choix corrigé (`reconcileSelection` : articles retirés, maximums, total, complément) ; la ligne reste dans le panier et le client valide le changement avant de commander.
- **Code de retrait** : chaque commande reçoit un code de 6 caractères (ex. `K7M-4QH`, alphabet sans `0/O/1/I/L`, tiré au hasard et unique en base ; il est stocké dans `orders.order_number`, les anciens numéros restent valides). Il est affiché à la validation (et mémorisé sur l'appareil), envoyé par email si l'adresse est donnée, et utilisé par le client pour « Retrouver une commande ». Dans l'espace pro, le panneau « Servir une commande » (`GET /api/admin/orders/code/:code`) retrouve la commande à partir du code (avec ou sans tiret, en minuscules) et la marque remise en un clic. La recherche de la liste accepte aussi le code.

- **Session de vente** (migration `012`) : une seule session par semaine, ouverte du samedi au lundi soir (heure de la Martinique, `lib/salesWindow.cjs`), retrait le mercredi suivant. Hors session, `POST /api/orders` répond 403 `SALES_CLOSED`. Dans l'espace pro › Contenu du site › « Vente de la semaine », on peut forcer l'ouverture ou la fermeture. La date de retrait est fixée par le serveur (`orders.desired_date`), plus saisie par le client.
- **Préparation et suivi** : « Préparation » (`GET /api/admin/orders/prep`) additionne les quantités par article (contenu exact des paniers personnalisés compris), imprimable ; paiement suivi par commande (`orders.paid`, case « encaissé » à la remise, filtre « À encaisser ») ; statut « Non retirée » proposé quand le jour de retrait est passé ; export CSV (`GET /api/admin/orders/export.csv`, cellules neutralisées contre l'injection de formules).
- **Ruptures de la semaine** : case « Rupture cette semaine » par article (`products.sold_out`, bouton « Tout remettre en stock ») et par article d'un panier personnalisable (`soldOut` dans la composition) : le client ne peut pas le choisir, un ancien choix est corrigé avec explication.
- **Rappel du lundi** : à la commande, avec un email, le client peut cocher « Me rappeler » (`reminder_subscribers`). Un planificateur (`server.cjs`, toutes les 15 min, **nécessite le SMTP et `SITE_URL`**) envoie le lundi à partir de midi un email à ceux qui n'ont pas encore commandé pour la session, une seule fois par session ; désinscription en un clic (`/rappel/desabonnement`).
- **Mon espace client** (migration `013`) : trois onglets (commandes, informations, sécurité et données). En haut : état de la vente, commande en cours avec son code de retrait, « Recommander ». Inscription avec adresse facultative et consentement obligatoire (`acceptTerms`), écran de bienvenue ; mode de réception habituel (pré-sélectionné au checkout) ; rappel du lundi activable (email confirmé requis) ; changement d'email (mot de passe exigé, nouvelle adresse à confirmer) ; suppression du compte (`DELETE /api/account`, mot de passe exigé, effacement des données des commandes en option).
- **Recommander / dupliquer** : « Recommander » dans Mon compte remet une ancienne commande dans le panier (revérifiée par le serveur) ; « Dupliquer » dans Paniers crée une copie hors vente pour la semaine suivante.
- **Paniers sur mesure** : le client compose son panier sur `/composer` ; chaque ligne de commande enregistre le contenu exact du panier au moment de la commande (paniers du catalogue compris), pour que modifier un panier plus tard ne change pas l'historique. L'Héritage des Mornes voit ce contenu dans le tableau de bord et dans l'email de commande.
- **Relecture avant envoi** : le checkout se fait en 3 étapes (panier, coordonnées, relecture). La relecture appelle `/api/cart/check` (prix et disponibilités relus en base) puis exige une confirmation explicite. Si un article disparaît ou qu'un prix change entre-temps, le serveur répond 409 et le client revoit ce qui a bougé : rien n'est jamais ignoré en silence.
- **Comptes** : mot de passe oublié par email (jeton à usage unique valable 1 h, stocké haché ; **nécessite le SMTP**), modification du profil et du mot de passe. Les commandes passées sans compte sont rattachées de deux façons sûres : (1) **avec email** — à l'inscription un lien de confirmation (48 h, à usage unique) est envoyé ; une fois cliqué, les commandes invité portant cette adresse rejoignent le compte (une réinitialisation de mot de passe prouve aussi l'email) ; (2) **sans email** — « Retrouver une commande » dans le compte, avec le numéro de commande **et** le téléphone saisi (formats `0696…` / `+596 696…` équivalents). Jamais de rattachement sur simple saisie d'un email : il n'est pas vérifié, cela exposerait les commandes d'autrui. Les deux flux de confirmation nécessitent le SMTP, pas le second.
- **Contenu du site (espace pro › « Contenu du site »)** : L'Héritage des Mornes modifie elle-même, sans développeur : le bandeau d'annonce, ses coordonnées (WhatsApp, email, commune, horaires), le texte « À propos », les infos de retrait/livraison rappelées au checkout, les mentions légales, les liens Instagram / TikTok / Snapchat / Facebook / YouTube (https uniquement, domaine contrôlé par réseau) et la galerie photo de l'accueil (24 max, réordonnable ; photos réduites à 1600 px dans le navigateur avant envoi ; deux photos par défaut tant qu'elle est vide). Données dans `site_settings` et `gallery_images`, exposées par `GET /api/site`. **Aucune coordonnée de démonstration n'est affichée** : sans numéro WhatsApp ou email configuré, les boutons correspondants n'apparaissent pas ; le tableau de bord liste ce qui reste à compléter.
- **Réseaux sociaux** : page publique `/reseaux` (« Suivre L'Héritage des Mornes ») avec une carte par réseau configuré (Instagram, TikTok, Snapchat, Facebook, YouTube) ; WhatsApp s'y ajoute automatiquement dès que le numéro est renseigné. Dans l'espace pro, L'Héritage des Mornes peut écrire un simple pseudo (`@heritagedesmornes`) ou coller l'adresse, puis cliquer sur « Tester le lien ».
- **Comptes** : « Mon compte » (changer son email et son mot de passe, mot de passe actuel exigé) et « Utilisateurs » (liste et suppression des comptes clients, ajout et retrait d'administrateurs ; on ne peut ni se supprimer soi-même ni retirer le dernier administrateur). Supprimer un client conserve ses commandes mais les détache du compte ; la case « effacer ses données personnelles » anonymise aussi ses commandes (demande d'effacement RGPD).
- **Pages légales** : `/mentions-legales` (alimentée par l'espace pro, avec les crédits photo exigés par les licences CC), `/confidentialite` (rédigée d'après les données réellement collectées : commandes, comptes, cookies strictement nécessaires uniquement) et `/conditions`. Textes types à faire relire par un professionnel avant la mise en ligne définitive.
- **Jour souhaité** : champ facultatif à la commande (de J à J+60, indicatif), visible dans le tableau de bord et l'email de commande.
- **Tableau de bord** : chiffres sur 7 et 30 jours (hors annulées), articles les plus commandés, et alerte à chaque nouvelle commande (toast, son activable, compteur dans l'onglet) — utile même sans SMTP.
- **Prix** : toujours recalculés côté serveur (`lib/pricing.cjs`) ; le front n'envoie que des slugs et des quantités.
- **Photos** : les photos envoyées par l'admin sont stockées en base64 dans Postgres (pas de volume de fichiers) et servies par `/api/products/:slug/image` et `/api/baskets/:slug/image`, avec un cache long (l'URL change à chaque nouvel envoi). Limite : 3 Mo par photo.
- **Sessions** : cookies `HttpOnly`, 7 jours pour l'admin et 30 jours pour les clients. Incrémenter `token_version` d'un compte révoque ses sessions (bouton « Déconnecter tous les appareils » côté admin).
- **Sécurité** : en-têtes `helmet` (CSP), limitation de débit sur la connexion, l'inscription, les commandes et les codes promo, contrôle d'origine sur les requêtes d'écriture.
- **Partage et SEO** : le serveur injecte titre, description et balises Open Graph dans `index.html` (`lib/seo.cjs`) ; `/robots.txt` et `/sitemap.xml` sont générés.

## Ajouter une migration

Créez `migrations/NNN-description.sql` (numéro suivant, SQL idempotent de préférence). Elle sera appliquée au prochain démarrage, dans une transaction, une seule fois.

## Images

Les images de `public/images/` sont en WebP redimensionné. Pour en ajouter : déposez un JPG/PNG dans ce dossier, lancez `node scripts/optimize-images.cjs`, puis supprimez l'original.

## Contenu à remplacer avant la mise en ligne

`src/data/site.js` contient des **coordonnées de démonstration** : numéro WhatsApp (`596696000000`), email (`contact@heritagedesmornes.example`) et commune. La page Contact affiche d'ailleurs un avertissement tant qu'elles ne sont pas remplacées.
