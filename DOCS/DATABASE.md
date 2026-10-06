# PostgreSQL

## Migrations 012–015 — 1.0.0-beta.1

012 ajoute les rappels, notifications et files push/Gotify personnels sans déplacer les données workspace historiques. 013 ajoute username, options des canaux, overrides et la fonction `channel_permission`, et dérive les nouvelles capacités des droits antérieurs. 014 ajoute marqueurs de lecture, point de bascule et liaison notification/message. 015 ajoute rich_content, historique de réception et source/statut/date des envois webhook. Les migrations 001–011 ne changent pas ; Pages et tables Google sont conservées. Le test E2E courant met à niveau un schéma 0.7.1 rempli et vérifie la conservation d’une Page et connexion Google, puis l’idempotence. Aucune base principale migrée.

Migrations : `npm run db:migrate`. Le runner prend un verrou global, exécute les nouvelles migrations dans une transaction et enregistre leur SHA-256. Ne jamais modifier une migration déjà déployée : ajouter un fichier numéroté.

`001_initial.sql` crée les utilisateurs, sessions, tentatives PAR, workspaces, membres, rôles (permissions atomiques en tableau), catégories, salons, projets, messages/réactions, identités techniques, boards/colonnes/cartes/commentaires, pages/blocs JSONB, notifications, webhooks entrants/sortants et livraisons, intégrations, audit, feature flags, pièces jointes, emojis, monitoring et idempotence.

Les UUID sont produits par PostgreSQL. Horodatages UTC `timestamptz`. Les références de domaine utilisent `(id, workspace_id)` pour empêcher le rattachement à un autre espace. Les valeurs JSONB sont explicitement sérialisées ; les tableaux SQL restent des tableaux natifs.

## Seed

`npm run db:seed` crée LUMA si absent, les rôles Owner/Admin/Moderator/Member, les catégories et salons demandés, un projet, un board, quatre cartes, une page et trois messages de démonstration. Le bot de démonstration est révoqué et n’a aucun jeton. Aucun faux compte humain ni secret. Le propriétaire n’est créé qu’au login du sujet Kyros configuré.

Le seed n’est pas un outil de synchronisation de configuration : des URL de monitoring modifiées après le seed doivent être mises à jour via `npm run monitoring:configure` (seules les cibles LUMA préexistantes sont concernées).

## Données supprimées

Messages : contenu remplacé par un tombstone, date de suppression. Salons : archive. Tokens techniques et webhooks : révocation. Identités humaines et audit conservés. Les références empêchent de supprimer un projet/board utilisé. Les sessions expirées et checks de plus de 30 jours sont purgés par le worker. Événements/audit sont conservés en 0.1 ; établir une rétention explicite avant gros volume.

## Migration 002 — 0.2.0

Salons : confidentialité, conversation directe, clé unique de paire, auteur ; `channel_access` pour les membres invités. Messages : racine de fil, épingle, références fichiers et index GIN de recherche. Notifications et pièces jointes : salon d’origine pour filtrage d’accès. Projets/boards : champ d’archivage préparé. Mise à jour du preset Moderator historique et ajout de CREATE_THREAD aux rôles pouvant envoyer des messages.

## Migration 003 — 0.2.1

`003_collaboration_plus.sql` ajoute avatars, invitations hashées, amitiés, groupes/membres/groupes de salons, participants et révisions de tâches, rattachement des fichiers aux tâches, activité/modèles, historique/commentaires de pages et raccourcis d’intégrations personnelles. Les blocs existants reçoivent un identifiant stable pour la fusion concurrente. Migration additive, données existantes conservées. Les préférences étendues restent dans le JSON utilisateur. Ne pas modifier le contenu d’une migration déjà appliquée.

## Migration 004 — intégrations (0.3.0)

Étend integrations (activation, révision, test), webhooks (module et signature) et outbound_webhooks (filtres). Ajoute integration_rules, integration_attempts et integration_grants. Secrets et jetons chiffrés, state hashé, tentatives expirantes ; verrou sur le grant pour sérialiser la rotation. Les règles liées aux colonnes sont retirées transactionnellement lors des suppressions de boards/projets.
