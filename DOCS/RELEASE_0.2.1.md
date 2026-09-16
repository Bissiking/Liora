# Liora 0.2.1 — ALPHA · collaboration avancée

15 septembre 2026. Migration additive `003_collaboration_plus.sql`. Aucun dépôt externe modifié. Kyros reste exclusivement en SSO v4 avec renouvellement automatique sérialisé.

## Conversations et vie d’équipe

- Mentions lisibles sous la forme **@Nom**, dans la saisie, les messages, les réponses et les fils ; les identifiants restent utilisés dans le protocole.
- Images et GIF joints affichés dans le fil. Les liens HTTPS directs vers une image passent par un récupérateur contrôlé ; les autres liens peuvent afficher titre, description et domaine selon la préférence d’aperçu.
- Sélecteur Unicode complet avec recherche en français, catégories et variantes de peau, en plus des emojis personnalisés. Données [Emojibase](https://github.com/milesj/emojibase) 17 (licence MIT), chargées à l’ouverture du sélecteur ; rendu natif dépendant du système.
- Panneau de fil : édition par l’auteur et suppression/modération selon les droits. Les résultats de recherche ouvrent le message exact ou son fil.
- Boutons **Épingles** et **Notifications/Suivi** fonctionnels, état sélectionné explicite et retour après action.
- **Amis** : invitations par lien, acceptation explicite, suppression d’un ami, accès à la conversation et liste des amis en ligne. La présence respecte le statut invisible ; elle reflète une activité récente, sans garantie de disponibilité immédiate.
- Invitations personnelles à usage unique, révocables et valables sept jours. Un admin disposant des droits nécessaires peut permettre de rejoindre l’espace avec le rôle Member. Le lien passe par Kyros si nécessaire. Aucun QR code dans cette version.
- Préférences DMs : membres de l’espace, amis seulement, ou personne. Le contrôle est appliqué à chaque envoi.

## Pages, tâches et gestion

- **Pages d’équipe → Aperçu** reprend le rendu lecteur et permet de vérifier un brouillon avant publication. Les blocs embarqués exposent un board, un message, les statistiques des tâches ou la configuration publique d’un webhook ; chaque lecteur reste soumis à ses propres permissions.
- Collaboration par blocs stables : deux modifications de blocs distincts fusionnent ; un conflit sur le même bloc ou l’ordre des blocs est signalé. Historique des révisions et restauration dans le brouillon, commentaires d’équipe. Il ne s’agit pas d’une édition simultanée caractère par caractère.
- Tâches : participants, pièces jointes propres à la tâche, activité des modifications/commentaires et modèles réutilisables (description, checklist, tags et priorité). Révision attendue pour prévenir l’écrasement d’une modification concurrente.
- Projets/boards : renommer, archiver/restaurer, afficher les archives et supprimer après confirmation. Supprimer un projet supprime ses boards et tâches ; les pages et salons restent conservés et détachés. Les métadonnées des fichiers des tâches supprimées sont supprimées aussi.
- Collections paginées par curseur au-delà de 500 éléments, chargement complet des sélecteurs et chargement supplémentaire dans la gestion des membres/rôles.
- Groupes de membres administrables et attribution de groupes aux salons privés. Ils ne donnent aucun accès aux DMs ni de contournement de la permission de supervision.

## Profil et prise en main

- Avatar personnel importable (PNG, JPEG, WebP ou GIF, 1 Mo maximum).
- Troisième thème **Crépuscule**, bleu nuit et lavande, en plus de Clair et Sombre.
- Sons configurables par catégorie, volume et bouton d’essai ; le navigateur peut exiger une première interaction avant lecture. Filtres de notifications distincts pour messages, DMs, mentions et tâches.
- Intégrations personnelles : raccourcis HTTPS privés, nommés et supprimables. Ce lot n’ajoute pas de connexion OAuth ni de synchronisation automatique à ces services.
- **Aide et tutoriels** dans la navigation : onze guides recherchables pour les principaux parcours.
- Une erreur réseau temporaire pendant l’actualisation du profil conserve l’écran courant. Limites séparées pour les lectures et les mutations API afin de ne pas confondre une activité normale avec un abus.

## Contraintes techniques

Le récupérateur distant accepte uniquement HTTPS et des destinations IPv4 publiques après résolution DNS, avec adresse épinglée pendant la connexion, sans redirection ni transmission de cookies. Délai maximal de 5 s, HTML limité à 512 Ko et images à 3 Mo ; validation des signatures PNG/JPEG/WebP/GIF. Un lien reste utilisable si son aperçu échoue. Les fichiers importés restent limités à 1 Mo. Les comptes techniques ne peuvent pas créer d’invitations ni administrer les amis.

Les listes d’historique affichent les 50 dernières révisions de page et les 100 dernières activités de tâche ; les anciennes lignes restent en base. Les fichiers physiques devenus orphelins ne sont pas encore purgés automatiquement.

## Mise à jour et retour arrière

1. Sauvegarder PostgreSQL, la configuration privée et le dossier de stockage.
2. `npm ci`, puis `npm run build`.
3. Arrêter l’ancien serveur, appliquer `npm run db:migrate:prod`, puis démarrer `NODE_ENV=production npm start`.
4. Vérifier `/health/ready` en **0.2.1**, puis recharger les navigateurs.

Les migrations appliquées restent immuables. Ne pas simplement remettre le binaire 0.2.0 après activation des groupes ou des politiques DM : il ne connaît pas les nouveaux contrôles. En cas de retour arrière, restaurer la sauvegarde complète avec le binaire correspondant.

Tests effectivement exécutés et limites de validation : [VALIDATION.md](VALIDATION.md). Historique des adaptations : [EXTERNAL_CHANGES.md](EXTERNAL_CHANGES.md).
