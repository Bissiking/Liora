# Expérience 0.4 — fonctionnement et déploiement

Le jalon 0.4 est finalisé dans la version de maintenance 0.4.7. Ce guide décrit le code et la qualification locale ; les services push et appareils du déploiement doivent être configurés puis vérifiés séparément.

## Calendrier

Calendrier mensuel et agenda lisible sur mobile, recherche par titre, création, édition et suppression. Une modification d’un événement récurrent porte sur **toute la série**, comme annoncé dans le dialogue ; les exceptions par occurrence ne font pas partie du jalon.

Les dates d’API sont des instants ISO avec offset. Chaque série conserve un fuseau IANA (`Europe/Paris`, etc.). Les répétitions quotidiennes, hebdomadaires, mensuelles et annuelles sont calculées depuis la date initiale : le 31 janvier devient le dernier jour de février puis revient au 31 mars. L’heure locale est conservée après les changements d’heure ; une heure inexistante est décalée vers l’avant, une heure ambiguë utilise la première occurrence. Les journées entières utilisent minuit dans le fuseau de l’événement et peuvent durer 23 ou 25 heures.

`CREATE_CALENDAR_EVENT` autorise la création. L’auteur peut modifier/supprimer ses événements ; `MANAGE_CALENDAR` permet la gestion de ceux des autres. Un événement lié à un salon ne se lit ni ne se modifie sans accès à ce salon. Les anciennes permissions sont migrées explicitement : CREATE_CHANNEL → CREATE_CALENDAR_EVENT, MANAGE_WORKSPACE → MANAGE_CALENDAR. Aucun droit n’est déduit d’un nom de rôle.

L’API accepte une période de 367 jours maximum, au plus 500 séries et 10 000 occurrences ; une fenêtre trop volumineuse renvoie une erreur explicite. Un événement ne peut pas durer plus de 366 jours. Le rappel avant événement concerne son auteur uniquement. Les modifications invalident les autres onglets via SSE sans y diffuser le contenu privé.

## Rappels

Les rappels sont personnels : CRUD, report d’une heure à partir de maintenant, fin et archivage. « En cours » inclut les rappels reportés ; « Terminés » inclut les rappels archivés. Un rappel déclenché apparaît dans le centre de notifications. Un rappel récurrent conserve son ancrage lors d’un report ponctuel ; une modification de son horaire ou fuseau établit un nouvel ancrage.

Un worker indépendant passe nominalement toutes les 15 secondes. Il verrouille les lignes PostgreSQL, crée la notification et met à jour le rappel dans la même transaction. Plusieurs instances ne déclenchent pas deux notifications pour la même échéance. Après une interruption, une occurrence échue est notifiée puis la prochaine échéance future est calculée ; aucune rafale pour toutes les occurrences manquées. Les références aux messages, salons et tâches sont contrôlées ; un accès retiré empêche le déclenchement et archive le rappel concerné.

## Recherche, favoris et clavier

La recherche de messages accepte expressions entre guillemets, exclusions, salon, auteur et période. La pagination conserve les filtres de la recherche lancée. L’accès aux salons reste vérifié côté serveur.

Favoris privés de salons, messages (API), pages, projets, tâches et événements. Le sélecteur permet l’ajout depuis la vue Favoris ; un événement peut aussi être ajouté depuis son détail. L’ouverture cible la bonne ressource et les ressources devenues inaccessibles disparaissent de la liste. Le sélecteur d’événements montre les 90 prochains jours.

Les raccourcis 1–7 avec Ctrl/⌘ naviguent dans les vues, Ctrl/⌘+K ouvre le filtre des salons, Ctrl/⌘+Maj+F ouvre la recherche, Ctrl/⌘+, ouvre les préférences et Ctrl/⌘+/ l’aide. Les raccourcis de navigation respectent les permissions et n’interrompent pas la saisie dans un champ ni un dialogue ouvert.

## Notifications Web Push

L’activation se fait volontairement dans **Préférences → Notifications → Notifications sur cet appareil**. Aucun prompt au chargement. L’abonnement est chiffré en base et lié à la session : déconnexion, révocation ou expiration de session supprime ou invalide son accès. Dix appareils maximum par utilisateur.

L’insertion d’une notification alimente une file transactionnelle. Le worker vérifie à nouveau l’état de lecture, la session, l’adhésion à l’espace, les préférences et l’accès au salon avant d’envoyer. Le contenu envoyé au système est volontairement générique : titre « Liora », invitation à ouvrir l’espace, sans contenu de message. Un clic ouvre la boîte de réception du bon espace après authentification.

Chiffrement Web Push aes128gcm et VAPID via [web-push](https://github.com/web-push-libs/web-push). Connexion HTTPS vers une IPv4 publique vérifiée et épinglée ; pas de redirection ni de destination privée. Réessais bornés à cinq sur panne réseau, HTTP 429 ou 5xx. HTTP 404/410 supprime l’abonnement expiré. Les autres erreurs arrêtent cette livraison. Les lignes terminées sont conservées 30 jours. La réception sur l’appareil dépend également de ses réglages système et de sa connexion.

### Configuration serveur

1. Appliquer les migrations, notamment `006_experience_complete.sql`.
2. Générer une fois les clés avec `npm run push:keys`. Le fichier privé `.local/vapid.env` est créé en mode 600 ; un fichier existant n’est jamais écrasé. Sur une installation sans outils TypeScript : `node dist/tools/scripts/generate-vapid.js`.
3. Remplacer `VAPID_SUBJECT` par une adresse de contact réelle `mailto:…` ou une URL HTTPS. Ajouter `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` aux variables du serveur et conserver ces valeurs entre redéploiements. Ne jamais versionner la clé privée.
4. Déployer sous HTTPS, autoriser les connexions sortantes vers les services push, puis redémarrer Liora.
5. Sur un navigateur compatible, activer les notifications depuis les préférences, puis cliquer **Envoyer un test**. La réponse confirme la mise en file, pas la réception par l’appareil.
6. Fermer l’application et provoquer un rappel ; vérifier la réception puis le clic vers le bon espace. Tester aussi la désactivation et la révocation de session.

Sans configuration VAPID valide, l’activation est désactivée et expliquée. Le centre de notifications interne continue de fonctionner. Les anciens abonnements JSON de la 0.4.0 sont vidés par la migration : ils n’étaient liés à aucune session et nécessitent un nouveau consentement. Une rotation VAPID impose également un réabonnement ; le client remplace une ancienne clé lors de l’activation.

Sur iOS/iPadOS, utiliser une application ajoutée à l’écran d’accueil et une activation par geste utilisateur, conformément à la [documentation WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/). Aucun test sur iPhone physique n’est prétendu par les tests desktop.

## PWA et hors ligne

Le build génère un service worker et un identifiant de cache à partir des assets, du manifeste et du code du worker. Sa syntaxe est vérifiée pendant le build. Icônes PNG 192/512 et manifeste permettent l’installation sur les navigateurs compatibles.

Seuls le shell et ses assets statiques sont précachés. Aucune réponse API, auth, pièce jointe privée ou donnée de compte n’entre dans ce cache. Les flux SSE passent directement au réseau pour ne pas bloquer le remplacement du worker. Les navigations tentent le réseau avant de revenir au shell hors ligne. Les appels API hors ligne renvoient 503 avec un message de reprise. **Aucune file de mutations hors ligne** : un enregistrement échoué doit être réessayé une fois connecté.

Une nouvelle version attend l’action **Mettre à jour Liora** après enregistrement des modifications ; le nouveau worker prend alors la main et retire les anciens caches Liora. La page ouverte reste utilisable avant cette action. Le mode hors ligne ne promet pas la consultation des données personnelles après fermeture/rechargement.

Les calculs calendaires reposent sur le [polyfill Temporal officiel](https://github.com/js-temporal/temporal-polyfill), couvert par les tests de fuseaux et de fin de mois du dépôt.

## Mise à jour et retour arrière

Sauvegarder DB, fichiers et clé maîtresse selon BACKUP.md. Exécuter `npm ci`, `npm run build`, puis `npm run db:migrate:prod` avec les variables du déploiement, avant le redémarrage du serveur. Les migrations 001 à 005 sont inchangées ; 006 ajoute les colonnes, droits et tables nécessaires. Les anciennes dates sans fuseau explicite restent en UTC. Aucun secret VAPID n’est généré automatiquement au démarrage.

Pour revenir au code précédent, restaurer une sauvegarde compatible dans une base séparée ; ne pas réécrire une migration déjà appliquée. Voir VALIDATION.md pour les commandes réellement exécutées et leurs limites.
