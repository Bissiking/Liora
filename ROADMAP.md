# Roadmap Liora

## 0.1.0 — ALPHA

Livré : architecture React/Express/PostgreSQL, migrations/checksums et seed, Kyros v4 avec refresh durable, rôles/permissions multi-workspaces, salons/catégories, chat SSE avec réponses/mentions/réactions, présence simple, bots/services, webhooks entrants/sortants, projets/boards/colonnes/cartes/checklist/commentaires/liens, notifications, monitoring Argus/Argos, audit, paramètres, feature flags médias verrouillés, fichiers locaux et emojis, pages à blocs simples.

Validation externe préalable à une utilisation réelle : inscription Kyros avec callback/audiences/scopes exacts, login et refresh réels, réception d’une alerte Argos, heartbeat depuis Argus, restauration de backup et déploiement HTTPS.

## 0.2.0 — ALPHA · conversations et accès

Livré : corrections supervision/menu de l’espace/Membres → Rôles, fils de discussion paginés, épingles, recherche indexée, conversations directes, accès individuels aux salons privés et fichiers rattachés au salon. Voir [notes de version](DOCS/RELEASE_0.2.0.md).

## 0.2.1 — ALPHA · collaboration avancée

Livré : mentions lisibles, images/GIF et emojis Unicode, invitations par lien et amis, préférences DMs, édition/modération des fils et saut aux résultats de recherche. Pages avec aperçu lecteur, blocs embarqués, fusion par blocs, historique/commentaires. Participants, fichiers, activité et modèles des tâches. Avatar, sons et notifications par catégorie, thème Crépuscule, aide et tutoriels. Aperçus de liens sécurisés, gestion des archives/renommage/suppression, pagination au-delà de 500 et groupes d’accès.

Les intégrations personnelles sont des raccourcis HTTPS privés ; leur authentification et synchronisation avec les services relèvent de la 0.3. La collaboration fine porte sur les blocs, sans CRDT caractère par caractère. Les invitations utilisent un lien, sans QR code. Voir [périmètre et limites 0.2.1](DOCS/RELEASE_0.2.1.md).

## 0.3.0 — BETA · intégrations

Livré : dashboard de modules configurés en base, connexion personnelle DropIt, sélection de partages existants, événements GitHub/Nino/Narra enrichis, routage filtré vers salons et tâches, filtres sortants, HMAC entrant optionnel (GitHub signé), commandes slash privées en lecture seule et URL de supervision administrables.

DropIt 1.1.0 ajoute l’API déléguée et le SSO v4 durable. Les clés réelles se renseignent dans l’interface ; les émetteurs Nino/Narra restent à brancher au contrat. L’upload et la création des partages restent dans DropIt. Les pièces jointes Liora existantes sont conservées.

La synchronisation PC ↔ serveur reste un module LUMA distinct à réaliser par l’utilisateur (nom à choisir), sans moteur Syncthing ou maison ajouté à Liora. La configuration DB, la clé maîtresse et le SSO initial restent dans le déploiement ; aucune variable par connecteur n’est requise.

Voir [notes 0.3.0](DOCS/RELEASE_0.3.0.md) et [guide des intégrations](DOCS/INTEGRATIONS.md).

## 0.4 — BETA · expérience

Calendrier, rappels, favoris, raccourcis supplémentaires, push/desktop, thèmes avancés, gestion fine des états hors ligne, PWA et étude mobile native.

## 0.5 — BETA · médias optionnels

Jellyfin et demandes films/séries seulement derrière feature flags. Aucun lien/page/bouton d’usage aujourd’hui. Ne pas déverrouiller un flag avant implémentation et tests.

## 1.0 — STABLE

Audit sécurité indépendant, sauvegardes/restaurations automatisées et vérifiées, métriques, limites distribuées, plan de rétention, migrations ALPHA/BETA validées, tests de charge, accessibilité consolidée, API OpenAPI complète et runbooks d’incidents.
