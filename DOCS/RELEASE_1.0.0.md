# Liora 1.0.0-beta.1 — développement du 6 octobre 2026

Le brief 1.0 est implémenté dans une **préversion**, avec qualification locale. Le numéro stable 1.0.0 reste réservé à la clôture des critères de sortie du [plan](PLAN_1.0.0.md). Aucun déploiement, tag, migration principale ou changement chez un fournisseur n’a été effectué.

## Changements livrés

- Rail personnel/messages/workspaces ; navigation contextuelle, catégories repliables, retour à la vue et au canal par workspace ; navigation et panneau de contexte en tiroirs sur téléphone.
- Messages privés et amis : listes avec avatars de taille fixe, recherche et filtres, conversation sur toute la largeur restante et composeur visible ; téléphone avec retour explicite à la liste. Invitations regroupées dans Ajouter un ami.
- Activité et rappels réellement personnels, utilisables sans workspace. Notifications et favoris des espaces agrégés en fonction des droits ; les anciens rappels restent dans leur espace et sont accessibles avec leur source.
- Paramètres de canal Général, Permissions, Options et Connexions. Exceptions par rôle puis utilisateur, héritage explicite, Owner protégé, garde des accès privés/DM et comptes techniques. Lecture, envoi, pièces jointes, réactions, fils, mentions et gestion sont évalués côté serveur. Slowmode sérialisé, fils désactivables, marqueurs non-lus précis. Navigation dédiée, sections Identité/Organisation/Fonctionnement, champs défilants avec pied d’enregistrement séparé ; accès privés intégrés dans la même fenêtre. Le suivi personnel ne recharge pas les options non enregistrées.
- Panneau de canal avec membres présents/absents, profils, rôles et modération autorisée, fils, épingles et fichiers réels. Les aperçus des fils/épingles résolvent les mentions du message d’origine et enlèvent le Markdown ; le compteur utilise « 1 réponse ». Menus partagés sur workspace, catégorie, canal, message, membre, projet, colonne, carte, événement, note, intégration, webhook et fichier ; clic droit, Shift+F10 et bouton « … » selon la surface ; le rail des serveurs et les lignes de conversations privées gardent le menu contextuel sans bouton supplémentaire. Menus natifs conservés dans les champs, éditeurs, code et texte sélectionné.
- Webhooks génériques TEXT/EMBED, validation commune à l’aperçu et au serveur, test explicite publié dans le canal, historique entrant et état HTTP des envois sortants. Les champs enrichis sont stockés comme données ; le texte reste disponible pour recherche, notifications et clients historiques. Pas d’HTML arbitraire.
- CalDAV comme parcours calendrier officiel : serveur/identifiant copiables, mot de passe par appareil affiché une seule fois, liste/révocation et aide. Les événements restent soumis aux droits ; notes en lecture seule. [Configuration](CALDAV.md).
- Interface Pages retirée, API et données conservées. Google Calendar OAuth, routes, worker, variables et interface retirés ; anciennes connexions/liens conservés inertes. Libellé « En direct » retiré.
- CSS regroupé en base/composants/features/layout, feuilles ciblées social/channel-settings et thèmes ; fichiers CSS par release supprimés. Dix identifiants de thème et choix compte/local conservés, avec une géométrie commune. Chargement différé des principales vues.

## Mise à niveau

Sauvegarder PostgreSQL, fichiers et configuration ensemble selon [BACKUP.md](BACKUP.md). Tester d’abord la mise à niveau sur une restauration séparée ; garder l’instance de qualification isolée des destinations réelles.

Appliquer `npm run db:migrate` ou `npm run db:migrate:prod` avec le nouvel artefact, puis basculer le service. Les migrations **001–011 sont inchangées** ; **012–015** ajoutent les tables personnelles, capacités/configurations des canaux, marqueurs de lecture et messages/historiques webhook. Elles ne suppriment aucune table historique. Les droits existants READ_MESSAGE/ATTACH_FILES/MENTION_USERS/REPLY_THREAD sont initialisés d’après les capacités antérieures correspondantes. Le point de bascule des non-lus évite de considérer tout l’historique ancien comme nouveau sans réécrire les notifications existantes.

Les nouvelles exceptions de canal exigent le nouveau code : revenir au serveur 0.7.1 sans restaurer une base compatible ferait ignorer ces exceptions. Arrêter les écritures, restaurer une sauvegarde cohérente et redémarrer la version correspondante ; ne pas supprimer les nouvelles tables ni modifier les checksums pour forcer un retour arrière.

Retirer les paramètres Google Calendar du gestionnaire de secrets à l’occasion de la bascule, après conservation dans la sauvegarde opérateur si nécessaire. L’application 1.0 ne les lit plus. Les anciens consentements chez Google ne sont pas révoqués automatiquement : aucune modification externe n’a été exécutée.

## Qualification

`npm test` : **76/76**, avec PostgreSQL `_test`, notamment isolation des overrides, slowmode, marquage lu, mise à jour partielle des membres, rappels sans espace, file Gotify personnelle et webhooks enrichis. `npm run build` : TypeScript et compilation serveur/client/outils. `npm run test:e2e:100` : Chrome/Puppeteer sur artefacts compilés, parcours 1.0 et mise à niveau d’un schéma 0.7.1 rempli, anciennes Pages/connexion Google conservées et seconde migration sans modification.

Les fixtures Kyros et transports Gotify sont synthétiques. Le contrôle CalDAV est celui du protocole local : aucune application native, téléphone ou vrai compte fournisseur n’est qualifié. Avant stable : matrice réelle iOS/macOS/Thunderbird/Android-DAV, audit sécurité, performances sous charge, restauration et bascule de production avec données réelles. Le build signale encore des chunks supérieurs à 500 kB ; le découpage des vues réduit le chargement initial mais ne constitue pas une mesure de performance utilisateur.

Preuves, captures et limites dans [VALIDATION.md](VALIDATION.md). Le script E2E recrée uniquement une base dont le nom finit par `_e2e` ; les tests d’intégration exigent `_test`.
