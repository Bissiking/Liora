# Roadmap Liora

Revue du 5 octobre 2026 · version courante **0.7.1 BETA**. « Implémenté » ne vaut pas validation du déploiement. Bilan avec preuves et limites : [état du projet](DOCS/ETAT_DU_PROJET.md). Propositions : [Idées](DOCS/Idées.md).

## 0.1.0 — ALPHA

Livré : architecture React/Express/PostgreSQL, migrations/checksums et seed, Kyros v4 avec refresh durable, rôles/permissions multi-workspaces, salons/catégories, chat SSE avec réponses/mentions/réactions, présence simple, bots/services, webhooks entrants/sortants, projets/boards/colonnes/cartes/checklist/commentaires/liens, notifications, monitoring Argus/Argos, audit, paramètres, feature flags médias verrouillés, fichiers locaux et emojis, pages à blocs simples.

Validation externe préalable à une utilisation réelle : inscription Kyros avec callback/audiences/scopes exacts, login et refresh réels, réception d’une alerte Argos, heartbeat depuis Argus, restauration de backup et déploiement HTTPS.

## 0.2.0 — ALPHA · conversations et accès

Livré : corrections supervision/menu de l’espace/Membres → Rôles, fils de discussion paginés, épingles, recherche indexée, conversations directes, accès individuels aux salons privés et fichiers rattachés au salon. Voir [notes de version](DOCS/RELEASE_0.2.0.md).

## 0.2.1 — ALPHA · collaboration avancée

Livré : mentions lisibles, images/GIF et emojis Unicode, invitations par lien et amis, préférences DMs, édition/modération des fils et saut aux résultats de recherche. Pages avec aperçu lecteur, blocs embarqués, fusion par blocs, historique/commentaires. Participants, fichiers, activité et modèles des tâches. Avatar, sons et notifications par catégorie, thème Crépuscule, aide et tutoriels. Aperçus de liens sécurisés, gestion des archives/renommage/suppression, pagination au-delà de 500 et groupes d’accès.

Les intégrations personnelles sont des raccourcis HTTPS privés ; leur authentification et synchronisation avec les services relèvent de la 0.3. La collaboration fine porte sur les blocs, sans CRDT caractère par caractère. Les invitations utilisent un lien ; un QR code est également présent dans l’interface actuelle. Voir [périmètre et limites 0.2.1](DOCS/RELEASE_0.2.1.md).

## 0.3.0 — BETA · intégrations

Livré : dashboard de modules configurés en base, connexion personnelle DropIt, sélection de partages existants, événements GitHub/Nino/Narra enrichis, routage filtré vers salons et tâches, filtres sortants, HMAC entrant optionnel (GitHub signé), commandes slash privées en lecture seule et supervision HTTP. Les modifications locales actuelles ont retiré l’administration des URL de supervision : leur configuration passe par l’environnement opérateur.

DropIt 1.1.0 ajoute l’API déléguée et le SSO v4 durable. Les clés réelles se renseignent dans l’interface ; les émetteurs Nino/Narra restent à brancher au contrat. L’upload et la création des partages restent dans DropIt. Les pièces jointes Liora existantes sont conservées.

La synchronisation PC ↔ serveur reste un module LUMA distinct à réaliser par l’utilisateur (nom à choisir), sans moteur Syncthing ou maison ajouté à Liora. La configuration DB, la clé maîtresse et le SSO initial restent dans le déploiement ; aucune variable par connecteur n’est requise.

Voir [notes 0.3.0](DOCS/RELEASE_0.3.0.md) et [guide des intégrations](DOCS/INTEGRATIONS.md).

## 0.4 — BETA · expérience

**Implémenté dans 0.4.7.** Le jalon fonctionnel 0.4.0 est finalisé sans revenir à un numéro de version antérieur.

- Calendrier mensuel et agenda mobile, création/édition/suppression, occurrences quotidiennes à annuelles, fuseaux horaires et changements d’heure. Modification de toute la série, rappels personnels de l’auteur.
- Rappels personnels déclenchés par un worker indépendant : notification interne, report, récurrence, reprise après interruption et déduplication transactionnelle.
- Droits atomiques calendrier, références et favoris contrôlés ; navigation vers salons/pages/projets/tâches/événements.
- Recherche de messages par mots/expressions, salon, auteur et période ; raccourcis respectant les droits et la saisie.
- Web Push : activation explicite par appareil, abonnement chiffré lié à la session, file persistante, émission VAPID, retries, révocation et suppression des abonnements expirés.
- Thèmes Minuit/Forêt/Braise, manifest et icônes PWA, cache statique versionné, démarrage hors ligne explicite, mise à jour après action de l’utilisateur.

Qualification locale et commandes : [VALIDATION.md](DOCS/VALIDATION.md). Le déploiement doit appliquer la migration 006, fournir les clés VAPID et valider une réception réelle sur ses appareils. Ni fournisseur push réel, ni iPhone/Android physique ne sont certifiés par les fixtures locales. L’édition collaborative hors ligne, les exceptions de récurrence et le mobile natif restent hors du jalon. [Fonctionnement et déploiement](DOCS/EXPERIENCE_0.4.md).

### 0.4.6 — maintenance supervision

Récepteur heartbeat corrigé, accusé de réception daté, émetteur autonome à installer sur Argus, diagnostic et procédure guidée. Un vrai envoi distant et un arrêt/reprise restent à vérifier sur le déploiement.

Voir [notes 0.4.0](DOCS/RELEASE_0.4.0.md).

### 0.4.9 — refonte UX globale

Accueil personnel, navigation regroupée par usage, index contextuel des salons, commande rapide, boîte de réception filtrable, recherche des pages et navigation mobile basse. Écrans et réglages harmonisés ; API, permissions et thèmes préservés. [Périmètre et qualification](DOCS/RELEASE_0.4.9.md).

## 0.5.0 — BETA · espace personnel et expérience

Thèmes structurants et tokens extensibles, dates françaises stables, carte avec recherche libre de lieux/enseignes/adresses, ajout direct À essayer / Visité et partage volontaire, messagerie durable entre amis sans espace commun. Projets/tableau/liste et filtres, calendrier Mois/Agenda, réglages guidés et aide enrichie. Migrations 007/008. [Notes et limites](DOCS/RELEASE_0.5.0.md).

## 0.6.0 — BETA · organisation et notifications

Implémenté : index des projets, Kanban compact et filtrable, carte avec édition intégrée/propriétés/onglets, pages d’équipe en lecture initiale et index daté. Markdown GFM partagé, aperçus d’édition, menus contextuels des cartes/colonnes accessibles au clavier et par bouton mobile. Supervision avec recherche/états et latence min./moy./max., raccourcis et partages personnels en lignes. Avatar Kyros récupéré à la connexion/au refresh, avatar de la topbar retiré ; catégories de navigation/salons repliables et persistées. Gotify personnel chiffré, file durable, contrôle des droits à l’envoi, retry/cancel et test. Migration 009. [Notes et qualification](DOCS/RELEASE_0.6.0.md).

## 0.7.0 — BETA · liens personnels

Implémenté : Notes datées/BrainDump, Google Agenda Android/Web pour les événements Liora liés, CalDAV par appareil, thème de compte ou navigateur, Lagune, refonte amis/conversations et Markdown enrichi. Les exceptions de récurrence, invitations externes et import de rendez-vous Google non liés restent hors de ce connecteur. Configuration et qualification : DOCS/RELEASE_0.7.0.md.

## Intégration BrainDump — 0.7.1 du 5 octobre 2026

BrainDump 2.1.0 rejoint DropIt dans les paramètres : configuration en base, consentement personnel et PKCE, même sujet/émetteur Kyros, lecture seule des notes datées, refresh rotatif, révocation et retrait des copies. Aucune publication des notes privées dans un salon. Migration Liora 011 et SQLite BrainDump additive 3. Configuration et limites : DOCS/RELEASE_0.7.1.md. Fournisseurs réels et déploiement restent à qualifier.

## Jalon suivant — médias optionnels

Jellyfin et demandes films/séries seulement derrière feature flags. Aucun lien/page/bouton d’usage aujourd’hui. Ne pas déverrouiller un flag avant implémentation et tests.

## 1.0 — STABLE

Refonte structurelle demandée le 5 octobre 2026 : séparation personnel/workspace, rail et navigation contextuelle, canaux configurables, panneau utile et profils, menus contextuels centralisés, webhooks TEXT/EMBED, CalDAV comme seul connecteur calendrier officiel, retrait des Pages de l’UX et de Google du runtime, responsive et accessibilité, consolidation CSS puis thèmes en dernier.

**Préparation seulement, pas encore implémentée.** [Brief original](DOCS/BRIEF_1.0.0.md), [audit du dépôt 0.7.1](DOCS/AUDIT_1.0.0.md), [plan précis fichier par fichier, migrations et critères de sortie](DOCS/PLAN_1.0.0.md). Les migrations historiques et données de production doivent être conservées ; la préparation a précédé l’implémentation locale 1.0.0-beta.1 du 6 octobre 2026.

La stabilité exige aussi : audit sécurité indépendant, sauvegardes/restaurations automatisées et vérifiées, métriques, limites distribuées, plan de rétention, migrations ALPHA/BETA validées, tests de charge, accessibilité consolidée, API OpenAPI complète et runbooks d’incidents. Les preuves locales de l’audit ne remplacent pas ces qualifications.

## Préversion 1.0.0-beta.1 — 6 octobre 2026

Les lots applicatifs du brief sont livrés localement : navigation, personnel, canaux/droits, membres/profils, menus, webhooks, retrait Google/Pages UI, CalDAV officiel, CSS et palettes. Migrations 012–015 additives ; 76 tests et E2E Chrome. [État livré et critères ouverts](DOCS/RELEASE_1.0.0.md). Avant stable : qualification CalDAV native multi-clients, sécurité/charge, restauration et bascule de production. Pas de déploiement effectué.
