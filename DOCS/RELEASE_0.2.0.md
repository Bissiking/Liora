# Liora 0.2.0 — ALPHA

Date : 15 septembre 2026. Migration additive `002_collaboration.sql`. Aucun dépôt externe modifié.

## Corrections demandées

- **Supervision sur autorisation** : `VIEW_MONITORING` commande la navigation, les endpoints de supervision, les salons de type monitoring, leur contenu, la recherche et les notifications Argos. L’admin attribue cette permission dans **Administration → Rôles et permissions**, puis affecte le rôle dans **Membres**. `MANAGE_MONITORING` autorise la configuration de salons monitoring et le heartbeat. Aucune permission déduite du nom du rôle.
- Le preset Moderator ne reçoit plus la supervision. La migration retire ce droit uniquement des rôles Moderator qui correspondent exactement au preset historique ; les autres configurations sont conservées. Owner et Admin du seed conservent leurs permissions.
- Un changement de rôle ou de membre émet `access.updated`. Les clients relisent leurs droits via SSE (cycle de deux secondes), puis à la reprise réseau/visibilité et lors du refresh périodique. Une vue de supervision déjà ouverte se ferme après retrait du droit. Chaque requête API recontrôle les droits.
- **Menu de l’espace** : ouvrir/fermer, changer d’espace, créer un espace, gérer les membres et les paramètres selon ses permissions. Fermeture par Échap ou clic extérieur.
- **Membres → Rôles** : les résultats chargés portent la clé de l’onglet. Les réponses devenues obsolètes sont ignorées ; les lignes de membres ne sont plus interprétées comme des rôles. Une frontière d’erreur fournit aussi un écran récupérable.

## Collaboration livrée

- Fils rattachés à un message, compteur de réponses, lecture paginée et réponses persistées, actualisées par SSE.
- Épingler/désépingler avec `MANAGE_MESSAGES`, vue des messages épinglés.
- Recherche PostgreSQL indexée par mots entiers, pagination de 50 résultats, filtrée par accès au salon. Un résultat ouvre son salon ; le saut au message précis reste à améliorer.
- Salons privés créés via **+ Créer un salon → Visibilité**. Le cadenas dans le salon permet de choisir les membres autorisés. Les gestionnaires de salons peuvent y accéder ; la supervision conserve son contrôle supplémentaire.
- Conversations directes entre deux membres. Les participants sont fixes ; même un administrateur non participant ne peut pas lire la conversation. Les webhooks ne peuvent pas y être ajoutés.
- Les nouveaux fichiers envoyés depuis un salon sont rattachés à ce salon et au message. Leur téléchargement respecte les mêmes accès. Les fichiers historiques sans salon et les fichiers généraux de l’espace conservent leur portée workspace ; ce changement ne requalifie pas rétroactivement ces fichiers.

## Périmètre

La 0.2.0 livre le premier lot de collaboration avancée. Les pages embarquées, participants/templates de tâches, groupes, avatars/sons et aperçus enrichis restent explicitement prévus en **0.2.x** dans ROADMAP.md. Les champs d’archivage projets/boards sont préparés dans le schéma/API ; leur interface dédiée reste à faire. Les réponses de fils disposent des endpoints d’édition/suppression, mais leurs contrôles dédiés dans le panneau de fil restent à compléter.

Kyros reste exclusivement en SSO v4 avec refresh automatique et rotation sérialisée. Aucun changement de contrat externe.

## Mise à jour

1. Sauvegarder PostgreSQL, le dossier des fichiers et la configuration privée.
2. Installer les dépendances avec `npm ci`, exécuter `npm run build`.
3. Appliquer `npm run db:migrate:prod`, puis redémarrer l’application.
4. Recharger les clients pour charger la nouvelle interface ; vérifier `/health/ready` en 0.2.0.

Les migrations déjà appliquées restent immuables. Un retour au binaire 0.1 n’est pas recommandé après création de salons privés : il ne connaît pas leurs contrôles d’accès. Revenir à la sauvegarde antérieure avec le binaire correspondant si un retour arrière est nécessaire.

Voir VALIDATION.md pour les tests exécutés et les validations externes restantes.
