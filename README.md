# Les Jardins de Genni

Site de vente de paniers de fruits et légumes de Martinique : catalogue, commande en ligne (avec ou sans compte), suivi des commandes, et espace pro pour Genni.

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
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — compte de l'espace Genni (changer le mot de passe déconnecte les sessions existantes)

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

- **Paniers sur mesure** : le client compose son panier sur `/composer` ; chaque ligne de commande enregistre le contenu exact du panier au moment de la commande (paniers du catalogue compris), pour que modifier un panier plus tard ne change pas l'historique. Genni voit ce contenu dans le tableau de bord et dans l'email de commande.
- **Relecture avant envoi** : le checkout se fait en 3 étapes (panier, coordonnées, relecture). La relecture appelle `/api/cart/check` (prix et disponibilités relus en base) puis exige une confirmation explicite. Si un article disparaît ou qu'un prix change entre-temps, le serveur répond 409 et le client revoit ce qui a bougé : rien n'est jamais ignoré en silence.
- **Comptes** : mot de passe oublié par email (jeton à usage unique valable 1 h, stocké haché ; **nécessite le SMTP**), modification du profil et du mot de passe. Les commandes passées sans compte sont rattachées de deux façons sûres : (1) **avec email** — à l'inscription un lien de confirmation (48 h, à usage unique) est envoyé ; une fois cliqué, les commandes invité portant cette adresse rejoignent le compte (une réinitialisation de mot de passe prouve aussi l'email) ; (2) **sans email** — « Retrouver une commande » dans le compte, avec le numéro de commande **et** le téléphone saisi (formats `0696…` / `+596 696…` équivalents). Jamais de rattachement sur simple saisie d'un email : il n'est pas vérifié, cela exposerait les commandes d'autrui. Les deux flux de confirmation nécessitent le SMTP, pas le second.
- **Galerie et réseaux sociaux** : Genni gère lui-même, dans l'espace pro (« Galerie & réseaux »), les liens Instagram / TikTok / Snapchat / Facebook / YouTube (https uniquement, domaine contrôlé par réseau ; un réseau laissé vide n'est pas affiché) et les photos du diaporama de l'accueil (24 max, réordonnables, légende facultative ; les photos sont réduites à 1600 px dans le navigateur avant l'envoi). Tant que la galerie est vide, deux photos de Martinique par défaut s'affichent. Données dans `site_settings` et `gallery_images` (migration 008), exposées par `GET /api/site`.
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

`src/data/site.js` contient des **coordonnées de démonstration** : numéro WhatsApp (`596696000000`), email (`contact@lesjardinsdegenni.example`) et commune. La page Contact affiche d'ailleurs un avertissement tant qu'elles ne sont pas remplacées.
