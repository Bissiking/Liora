# Liora · 0.5.0 BETA

Un espace LUMA pour discuter, organiser les projets et recevoir les signaux des applications.

**Avant tout développement significatif, lire [PROJECT_CHARTER.md](PROJECT_CHARTER.md).** La demande originale est conservée dans [DOCS/PROJECT_CHARTER.md](DOCS/PROJECT_CHARTER.md).

## Expérience 0.4 finalisée

Calendrier récurrent avec fuseaux horaires, rappels et notifications effectifs, favoris navigables, recherche filtrée, Web Push sur consentement, thèmes et PWA avec cache privé exclu. Migration 006 et configuration VAPID : [guide 0.4](DOCS/EXPERIENCE_0.4.md).

## Intégrations 0.3

Modules configurés en base, connexion personnelle DropIt, événements enrichis et automatisations filtrées. [Guide de configuration](DOCS/INTEGRATIONS.md) · [Notes de version](DOCS/RELEASE_0.3.0.md).

## Ce qui fonctionne

- Workspaces, membres, rôles personnalisables et permissions locales.
- Kyros SSO v4 : PAR/PKCE, validation JWT, sessions chiffrées, renouvellement automatique sérialisé.
- Salons/catégories, chat SSE, édition/suppression, réponses, mentions, réactions, emojis personnalisés et pièces jointes.
- Projets, boards, colonnes, cartes déplaçables, responsables, échéances, checklists, liens et commentaires.
- Pages avec aperçu lecteur, blocs embarqués, fusion des éditions par bloc, historique et commentaires.
- Bots/services, tokens hashés révocables, webhooks entrants et sortants signés avec file persistante.
- Notifications, monitoring indépendant Argus/Argos, audit, administration et préférences.
- Amis, invitations par lien, emojis Unicode, images/GIF, aide et tutoriels.
- Avatars, trois thèmes, sons, groupes et modèles de tâches.
- Jellyfin et demandes média désactivés et inaccessibles.

## Installation

Prérequis : Node >=22.12 (24 testé), PostgreSQL >=17. Aucun service Kyros local de substitution n’est fourni dans l’application.

```sh
npm ci
cp .env.example .env  # uniquement si .env n’existe pas
# Renseigner DATABASE_URL et la configuration Kyros.
# Générer SESSION_SECRET avec : openssl rand -hex 32
npm run db:migrate
npm run db:seed
npm run dev
```

Ouvrir http://localhost:4310. L’application utilise `.env` ; ne jamais le committer. Le seed crée LUMA et ses données de démonstration, sans utilisateur ni token technique. Configurer BOOTSTRAP_OWNER_KYROS_ID pour le propriétaire initial. Les autres personnes se connectent d’abord à Liora puis sont ajoutées avec leur identifiant Kyros dans Administration → Membres.

## Production

```sh
npm run build
NODE_ENV=production npm start
```

Dockerfile et compose.yaml fournis. Voir [DEPLOYMENT](DOCS/DEPLOYMENT.md) pour migrations compilées, volumes, HTTPS, SSE et variables. Voir [BACKUP](DOCS/BACKUP.md) avant mise en service.

## Tests

Pour les tests intermodules 0.3, le dépôt DropIt 1.1.0 et ses dépendances doivent être présents dans `../DropIt` (routeur réel, données temporaires).

Créer deux bases **jetables**, isolées de toute donnée utile. Les suites réinitialisent leur schéma public ; elles refusent un nom ne finissant pas par `_test` ou `_e2e`.

```sh
createdb liora_test
createdb liora_e2e
TEST_DATABASE_URL=postgresql://localhost/liora_test npm test
npm run build
E2E_DATABASE_URL=postgresql://localhost/liora_e2e npm run test:e2e
npm run typecheck
```

Les defaults de développement de ces suites pointent vers l’instance locale isolée 127.0.0.1:55432. CHROME_PATH permet de sélectionner Chrome. Les tests utilisent un fournisseur Kyros signé de test sur 14312/14322, jamais une porte dérobée dans l’app. Le navigateur teste le serveur compilé en mode production, les interactions, le temps réel entre deux contextes, la persistance après redémarrage et les viewports 1440×1000 / 390×844. Captures locales dans `.impeccable/review/` (ignorées par Git).

## Guides

[Architecture](DOCS/ARCHITECTURE.md) · [Contrat des intégrations](DOCS/INTEGRATIONS.md) · [API](DOCS/API.md) · [Base](DOCS/DATABASE.md) · [Sécurité](DOCS/SECURITY.md) · [Bots](DOCS/BOTS.md) · [Webhooks](DOCS/WEBHOOKS.md) · [Argos](DOCS/ARGOS.md) · [Modifications externes](DOCS/EXTERNAL_CHANGES.md) · [Validation](DOCS/VALIDATION.md)

Les limites ALPHA et fonctions différées sont explicites dans [ROADMAP](ROADMAP.md), [FEATURES](FEATURES.md) et [TODO](TODO.md). Un build local ne prouve pas le login Kyros réel ou le fonctionnement sur les serveurs de production.

## Historique 0.2.1

Collaboration avancée, invitations/amis, aperçus et tutoriels : [notes de version](DOCS/RELEASE_0.2.1.md). Appliquer les migrations avant de redémarrer le nouveau build.

Refonte UX 0.4.9 : accueil, navigation par usage, commande rapide et parcours mobile. [Notes de version](DOCS/RELEASE_0.4.9.md). Qualification dédiée : `E2E_UX_ONLY=1 npm run test:e2e` (base PostgreSQL jetable `_e2e`).

Version 0.5.0 : thèmes structurants, dates françaises, carte personnelle en recherche libre et messages entre amis, projets et calendrier remaniés, réglages guidés. [Notes de version](DOCS/RELEASE_0.5.0.md). Appliquer les migrations 007/008 avant démarrage. Qualification : `E2E_050_ONLY=1 npm run test:e2e` (base jetable `_e2e`, recherche et tuiles simulées).
