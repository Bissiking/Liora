# Changelog

## 0.3.0 — BETA — 2026-09-16

- Configuration des modules en base, test, secrets chiffrés et rotation.
- DropIt personnel : consentement, renouvellement, fichiers autorisés et insertion de liens.
- GitHub/Nino/Narra : événements enrichis, HMAC, routage, tâches automatiques et filtres sortants.
- Commandes privées, tutoriels et réglages de supervision.
- Adaptation DropIt 1.1.0 avec Kyros v4 et sessions persistantes.

Détails et limites : [DOCS/RELEASE_0.3.0.md](DOCS/RELEASE_0.3.0.md).

## 0.2.1 — ALPHA — 2026-09-15

- Mentions lisibles, aperçus images/GIF/liens et sélecteur complet des emojis Unicode.
- Invitations par lien, amis et présence, préférences DMs, édition/modération des fils et accès direct aux résultats.
- Aperçu des pages, blocs embarqués, fusion des modifications par bloc et historique.
- Participants, fichiers, activité et modèles de tâches ; gestion des projets/boards et groupes d’accès.
- Avatar, sons, notifications, thème Crépuscule, raccourcis personnels et aide avec tutoriels.
- Pagination, isolation des suppressions, récupération distante contrôlée et résilience aux erreurs de lecture.

Détails et limites : [DOCS/RELEASE_0.2.1.md](DOCS/RELEASE_0.2.1.md).

## 0.2.0 — ALPHA — 2026-09-15

- Supervision réservée aux rôles autorisés, contrôles API et actualisation des droits sans reconnexion.
- Menu de l’espace fonctionnel au clavier, sur ordinateur et mobile.
- Correction de la page blanche Membres → Rôles et permissions et des réponses réseau obsolètes.
- Fils de discussion, messages épinglés et recherche PostgreSQL indexée.
- Salons privés avec accès par membre, conversations directes et fichiers liés aux salons.
- Migration additive, version partagée entre serveur et interface ; tests de confidentialité et de non-régression.

Détails, compatibilité et limites : [DOCS/RELEASE_0.2.0.md](DOCS/RELEASE_0.2.0.md). La suite du lot collaboration reste en 0.2.x.

## 0.1.0 — ALPHA — 2026-09-15

Première version de Liora à la racine du dépôt.

- Identité, logos SVG clair/sombre, icône/favicon, version produit.
- React/TypeScript, API Express, PostgreSQL avec migrations vérifiées, seed LUMA.
- Kyros SSO v4 PAR/PKCE, JWT RS256, refresh automatique sous verrou, sessions chiffrées et révocables.
- Workspaces, rôles personnalisables, permissions locales et audit ; bots et services séparés des comptes humains.
- Salons/catégories, messages SSE, réponses, mentions, réactions, édition et suppression logique.
- Projets, boards, colonnes, Kanban, cartes, responsables, échéances, checklist, liens et commentaires.
- Pages simples à blocs et révisions contre les écrasements concurrents.
- Webhooks entrants dont format Argos natif ; sortants signés, outbox, retries et annulation.
- Monitoring du superviseur Argus/Argos et heartbeat ; notifications personnelles.
- Administration, préférences, sessions, fichiers et emojis personnalisés.
- Modules médias désactivés ; documentation des limites et prochaines étapes.
- Tests des parcours métier et navigateur desktop/mobile sur serveur compilé.

Aucune modification des dépôts externes. Voir DOCS/EXTERNAL_CHANGES.md.
