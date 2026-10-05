# Liora 0.6.0 — BETA · organisation et notifications

La 0.6 reprend les projets, les cartes, le Kanban et les pages d’équipe dans les neuf univers existants. Les API et les permissions de collaboration sont conservées.

## Parcours

- **Projets** : index recherchable sur ordinateur, choix horizontal sur mobile, contexte du projet/tableau, filtres repliables, vues Tableau/Liste. Les archives restent consultables ; les cartes sont en lecture seule.
- **Kanban** : colonnes ordonnées, cartes avec titres, étiquettes et aperçu Markdown compact, état vide filtré, déplacement par glisser-déposer ou menu. Actions par clic droit, Maj+F10 ou boutons à trois points ; Échap ferme et les flèches parcourent le menu. Carte : ouvrir, copier le lien, déplacer, dupliquer et supprimer selon les droits. Colonne : renommer, déplacer à gauche/droite, supprimer selon les droits. Les suppressions demandent confirmation.
- **Carte** : un dialogue avec description/étapes, discussion et fichiers/activité. Édition intégrée du titre, de la description et des tags. Propriétés à droite sur desktop, en premier sur mobile. État occupé, erreurs locales et saisies conservées après échec.
- **Pages d’équipe** : version publiée en lecture à l’ouverture ; index avec recherche/dates, actions Modifier/Aperçu/Historique, brouillons et fusion concurrente conservés.
- **Supervision et personnel** : signaux recherchables/filtrables, incidents en premier, dernier contrôle et historique ; latence min./moy./max. avec nombre de mesures sur les derniers contrôles. Comptes DropIt, partages et raccourcis privés présentés en lignes.
- **Navigation** : rubriques globales et catégories des salons repliables. État par compte, enregistré via un PATCH dédié sans écraser les autres préférences. La recherche de salons montre les catégories correspondantes même repliées.

## Markdown

CommonMark et extensions GFM : titres, gras, italique, citations, listes, cases à cocher en lecture, liens, code et tableaux. Rendu dans les messages et discussions, conversations entre amis, descriptions/commentaires des cartes, descriptions de projet et contenus des pages. Les formulaires multiligne proposent Écrire/Aperçu et des outils de mise en forme. Les pages gardent leur éditeur par blocs et leur aperçu global.

Le HTML est ignoré. Les protocoles de liens autorisés sont HTTP(S), mailto, chemins locaux et ancres. Les images Markdown affichent leur texte alternatif ; les images, GIF et pièces jointes de conversation gardent les aperçus existants contrôlés par Liora. Les retours à la ligne authored sont préservés. Bibliothèques : [react-markdown](https://github.com/remarkjs/react-markdown), [remark-gfm](https://github.com/remarkjs/remark-gfm).

## Gotify

Préférences → Notifications → Gotify : URL du serveur, jeton **d’application**, activation, enregistrement indépendant et test. Adresse HTTPS publique sur le port 443, sans identifiants/paramètres ; un Gotify derrière proxy HTTPS convient. Les adresses privées restent refusées comme pour les webhooks sortants.

Le jeton est chiffré avec la clé maîtresse de Liora et n’est jamais renvoyé au client. Laisser vide conserve le jeton uniquement si la destination est inchangée. Changer de destination ou de jeton annule les envois en attente/échoués de l’ancienne configuration. Désactiver annule la file ; déconnecter supprime la configuration et ses envois.

Les notifications internes créent une livraison dans la même transaction. Un worker indépendant réévalue compte, membership, permissions, visibilité du salon et préférences avant l’envoi. Gotify reçoit un titre/message générique et un lien vers la réception, sans texte privé. Priorité 8 pour les notifications critiques, 4 sinon. Les appels suivent le [contrat officiel Gotify](https://gotify.net/docs/pushmsg) : POST `/message`, JSON et header `X-Gotify-Key`, avec lien dans [les extras](https://gotify.net/docs/msgextras).

Historique des vingt derniers envois, états En attente/Envoyé/Échec/Annulé, actualisation périodique, relance manuelle et annulation. Au maximum cinq essais automatiques avec délai exponentiel pour réseau/429/5xx ; les autres refus sont définitifs. Expiration à 24 h, rétention des états terminaux 30 jours. Le test est **mis en file**, son état donne le résultat du transport ; un HTTP 2xx ne prouve pas la réception sur un téléphone.

## Avatar Kyros

Le mot « logo » de la demande désignait l’avatar. Liora utilise le claim signé `avatar_url` du SSO v4, avec `picture` accepté si absent, à la connexion et au refresh. URL absolue ou relative au Kyros configuré, HTTP limité à la boucle locale ; URL dangereuse refusée. Les images sont servies via `/api/v1/avatars/:id` pour conserver la CSP : DNS épinglé, redirections refusées, délai 5 s, maximum 2 Mo et signature PNG/JPEG/WebP/GIF. Un avatar importé localement reste prioritaire ; les initiales remplacent une image indisponible. L’avatar de `topbar-right` est retiré ; le profil en pied de sidebar reste accessible.

Contrat vérifié en lecture dans le dépôt Kyros local, dont le changelog 4.7.1 documente les avatars absolus. Aucun changement ni redémarrage de Kyros. La validation avec le fournisseur réellement déployé reste à faire.

## Mise à jour

Version synchronisée dans VERSION, package/lock et affichage. Appliquer **009_gotify.sql** avant de démarrer le code 0.6 ; elle ajoute les tables Gotify, le trigger de file et `users.kyros_avatar_url`, sans supprimer les données existantes. Le secret maître reste celui du déploiement. La migration est appliquée aux bases jetables de test ; aucune migration de la base principale ni publication distante réalisée pendant ce lot.

Commandes : `npm test`, `npm run build`, `npm run test:e2e:060` et `npm run test:e2e`. Les scripts de validation réinitialisent exclusivement des bases dédiées `_test`/`_e2e`. Résultats et captures : [VALIDATION.md](VALIDATION.md).
