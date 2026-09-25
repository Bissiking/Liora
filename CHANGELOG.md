# Changelog

## 0.4.7 — BETA — 2026-09-25

- Finalisation du jalon 0.4.0 : calendrier récurrent avec fuseaux, fins de mois et journées entières ; édition de séries et permissions dédiées.
- Worker transactionnel de rappels, report/récurrence et notifications d’événements, indépendant de la supervision Argos.
- Favoris validés et navigables, filtres de recherche salon/auteur/dates, raccourcis préservant la saisie.
- Web Push complet côté application : consentement, abonnements chiffrés liés à la session, file persistante, chiffrement/VAPID, retries et nettoyage.
- PWA : icônes PNG, précache statique sans données privées, retour hors ligne et mise à jour contrôlée avec retrait des anciens caches.
- Migration 006 additive, tests de calendrier/rappels/favoris/push et parcours navigateur 0.4. Contrats et configuration : DOCS/EXPERIENCE_0.4.md.

## 0.4.6 — BETA — 2026-09-25

- Heartbeat Argos : réception persistée même avant la création de la cible, accusé daté et distinction entre signal jamais reçu et expiré.
- Émetteur autonome pour Argus, contrôle de santé préalable, refus des redirections et guide systemd.
- Aide de configuration directement dans la supervision, lisible sur ordinateur et mobile.
- Enregistrement du service worker déplacé dans un module pour respecter la CSP qui bloquait le script inline.
- Versions package, fichier VERSION et affichage synchronisées (elles divergeaient entre 0.4.5 et 0.4.0). Type des groupes de membres complété pour rétablir la compilation.
- Revue factuelle de la roadmap et de la charte, limites 0.4 et propositions dans DOCS/Idées.md. Aucun déploiement distant effectué.

Les notes 0.4.0 ci-dessous décrivent l’intention historique ; la revue du 25 septembre fait autorité sur les fonctions partielles.

## 0.4.0 — BETA — 2026-09-16

- Calendrier d'équipe avec création, édition, suppression et récurrence des événements.
- Rappels personnels récurrents avec report et archivage.
- Favoris : raccourcis privés vers channels, pages, projets et événements.
- Raccourcis clavier étendus : ⌘1-7 pour les vues principales, ⌘, pour les préférences, ⌘/ pour l'aide.
- Notifications push desktop avec service worker et abonnement aux push.
- Thèmes avancés : Minuit, Forêt et Braise en plus de Graphite, Papier et Crépuscule.
- Gestion fine des états hors ligne avec indicateur et cache service worker.
- PWA installable : manifest, service worker avec cache et notifications push.
- Améliorations mobile : touch targets agrandis, grille calendrier adaptée.

Détails et limites : [DOCS/RELEASE_0.4.0.md](DOCS/RELEASE_0.4.0.md).

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
