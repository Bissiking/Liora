# Validation — 0.5.0 BETA

## Recherche libre — extension 0.5.0 du 3 octobre 2026

- `npm run check` : **56/56 tests**, TypeScript strict et build client/serveur/outils. Neuf tests de recherche couvrent alias MacDo/McDo, cache commun des alias, séparation libre/proximité, villes/adresses conservées, restaurants/campings/musées, ordre fournisseur, distance/rayon, réponses invalides, erreurs/cooldown et compatibilité Burger King. Le test d’intégration recherche et enregistre McDonald’s sous Lieu libre avec deux comptes, sans écriture pendant la découverte et sans contourner les droits humains.
- Migration **008_place_search.sql** appliquée uniquement aux bases jetables de qualification, après la 007 inchangée. Elle ajoute Lieu libre sans supprimer ni modifier les lieux et suivis existants.
- Essais externes en lecture seule via `PlaceSearch` : « MacDo Rennes » renvoie vingt résultats, dont McDonald’s Rennes Villejean ; « Camping Rennes » renvoie vingt résultats, dont Camping municipal des Gayeulles. Aucun ajout en base. La recherche libre conserve au plus vingt résultats dans la pertinence du fournisseur, y compris les correspondances distantes ; `nearby=1` seul impose 15 km et trie par distance. Ces essais ne qualifient ni exhaustivité ni disponibilité permanente.
- Le parcours ciblé ajoute et relit McDonald’s À essayer et un camping Visité, recherche un musée sur mobile, conserve les suivis Burger King et les ajouts manuels sans coordonnées. Une erreur Leaflet de fin de zoom après changement d’écran a été détectée : les zooms sont désormais synchrones pour éviter le callback après destruction de la carte. Les erreurs navigateur restent bloquantes et comportent leur pile d’appel.

Chrome headless/Puppeteer, desktop 1440×1000 et mobile 390×844. Données, Photon, tuiles et position de navigateur simulés dans les E2E ; les essais Photon réels ci-dessus sont séparés. Aucun déploiement ni migration de la base personnelle. Appliquer 007/008 avant mise en service, voir [RELEASE_0.5.0.md](RELEASE_0.5.0.md).

## Recherche et ajout des lieux — correction 0.5.0 du 3 octobre 2026

Qualification locale sur le serveur compilé, PostgreSQL jetable et Chrome headless/Puppeteer. Aucune donnée de la base personnelle modifiée, aucune nouvelle migration après 007.

- `npm run check` : **54/54 tests**, TypeScript strict et build client/serveur/outils réussis. Sept tests du fournisseur couvrent localisation, tri/rayon/adresses, recherche nominative, réponses invalides, cache/requêtes simultanées, lieu inconnu et indisponibilité. Un test d’intégration vérifie authentification humaine, bornes des coordonnées, recherche sans écriture, cache et réutilisation du catalogue entre deux comptes.
- `E2E_050_ONLY=1 npm run test:e2e` : réussi après compaction du formulaire. Aucune requête pendant la saisie ; recherche validée avec Entrée ; choix de résultat puis À essayer → Visité sans coordonnées ; notes/partage et rechargement ; ajout manuel par clic sur la carte et, sur mobile, par placement au centre ; position de navigateur simulée, recherche vide et indisponibilité contrôlée avec actions de reprise. Les autres parcours 0.5.0 restent inclus.
- `npm run test:e2e` : non-régression complète réussie après ajout de la recherche, avant la dernière compaction CSS du panneau. La confirmation ciblée ci-dessus inclut les derniers changements. Les parcours PWA continuent d’exercer le service worker ; seul le parcours 0.5.0 le contourne côté Puppeteer pour intercepter les requêtes HTTP de recherche et injecter la panne contrôlée. Les autres erreurs réseau restent bloquantes.
- Captures `050-search-*.png`, `050-place-mobile.png`, `050-add-*.png`, `050-map-*.png` dans `.impeccable/review/`, à **1440×1000 et 390×844**. Photon, tuiles et position GPS sont des fixtures explicitement synthétiques. La carte réelle, les permissions/localisations d’appareils physiques et le déploiement ne sont pas qualifiés par ces captures.
- Essais API externes en lecture seule via le vrai proxy de recherche : « Burger King Rennes » renvoie cinq restaurants ; « Rennes » résout la ville et renvoie huit restaurants dans le rayon, dont Quai Lamennais et Boulevard de la Robiquette. Aucun ajout en base. Ces essais vérifient la réponse réelle de Photon au moment du test ; ils ne prouvent ni exhaustivité ni disponibilité permanente.
- Revue de finition indépendante et fraîche après le retour utilisateur sur la modale : verdict **ship** sur le parcours recherche/ajout et les neuf captures requises, sans correction matérielle demandée. La recherche, les actions directes, le panneau manuel, l’adaptation mobile et les reprises d’erreur correspondent au contrat ; le contenu inférieur au viewport est une continuation défilante. Ce verdict porte sur cette correction, sans certification du GPS, des tuiles réelles ou d’un appareil physique.

La recherche n’importe rien sans action explicite ; le catalogue peut être alimenté par un résultat choisi ou un ajout manuel. Les limites fournisseur, confidentialité, configuration et exploitation sont décrites dans [RELEASE_0.5.0.md](RELEASE_0.5.0.md). Le chunk carte est désormais ~170 Ko minifié, chargé séparément ; les avertissements Vite sur les chunks principal et emojis restent présents.

## Espace personnel et refonte 0.5.0 — qualification initiale du 3 octobre 2026

Qualification locale sur macOS, Node 24.19.0, PostgreSQL jetable et Chrome headless via Puppeteer. Le serveur et les assets compilés sont exercés avec Kyros de test. Les migrations 001–007 sont appliquées uniquement aux bases de qualification ; aucune migration de la base personnelle ou distante.

- `npm run check` : **46/46 tests**, TypeScript strict et build client/serveur/outils réussis. Couverture supplémentaire du parseur français (ancrage, fuseaux, changements d’heure, plages et offsets), de la persistance et de l’idempotence des messages entre amis, des règles de partage des lieux, des thèmes et des droits/archives de projets.
- `E2E_050_ONLY=1 npm run test:e2e` : réussi après les corrections. Saisie d’une date et reprise de son heure locale dans le formulaire d’événement ; ajout d’un lieu, passage À essayer → Visité, notes et rechargement ; message persistant vers un ami sans session ni espace commun ; historique après rechargement ; filtres/liste de projets et sélection après création d’un projet puis d’un tableau ; Agenda ; trois nouveaux univers, thème sombre et aperçus isolés ; aides des réglages ; accès aux outils personnels après retrait de l’espace.
- `npm run test:e2e` : non-régression complète réussie sur le build final. Les parcours existants de collaboration, permissions, intégrations de test, persistance, calendrier/récurrences, favoris/rappels, PWA et mise à jour du service worker passent.
- `E2E_UX_ONLY=1 npm run test:e2e` : réussi sur la 0.5.0 ; accueil, réception, commande rapide et navigation sur l’ensemble des écrans conservés.
- Parcours et captures à **1440×1000 et 390×844**. Les captures `050-*.png` dans `.impeccable/review/`, ignorées par Git, utilisent des données de qualification. Les tuiles OSM sont remplacées par un fond portant « Fond simulé — test local » ; aucune qualification du fournisseur de tuiles réel ni du GPS.
- Détecteur Impeccable exécuté une fois sur les nouvelles surfaces : **0 antipattern, 30 conseils** de documentation de tokens. Revue indépendante : cinq corrections demandées et appliquées en un lot (contraste des priorités, compacité des filtres, isolation des aperçus de thèmes, traits de sélection, marqueurs SVG). Verdict final **ship**, avec ces cinq points résolus ; portée limitée aux corrections examinées, sans certification générale d’accessibilité.
- Prettier vérifié sur les fichiers modifiés ; `git diff --check` réussi. La carte est chargée séparément (~160 Ko minifié), le parseur importe la variante française et la dépendance inutilisée `date-fns` est retirée. Les avertissements Vite restent pour les chunks principal (~667 Ko) et emojis (~805 Ko) ; aucun résultat de performance sur appareil physique.

Avant mise en service : sauvegarder puis appliquer **007_personal_space.sql**. Le catalogue de lieux est renseigné sur action explicite ; il ne contient pas automatiquement tous les Burger King. Les anciens messages utilisent UTC faute de fuseau historique, et les conversations personnelles ne fusionnent pas l’historique des anciens salons privés. Voir [RELEASE_0.5.0.md](RELEASE_0.5.0.md).

Aucun déploiement, tag, publication ou restauration effectué dans ce lot. Kyros/DropIt réels, fournisseur push réel, fond de carte réel et appareils physiques restent hors de ces essais. Les résultats historiques suivants sont conservés avec leur version d’origine.

## Refonte UX 0.4.9 — 3 octobre 2026

Qualification locale sur macOS, Node 24.19.0, PostgreSQL jetable `liora_e2e` et Chrome headless via Puppeteer. Le serveur et les assets de production compilés sont exercés, pas uniquement le serveur Vite. Les identités Kyros, le consentement DropIt et les données de collaboration utilisent les fixtures locales.

- `npm run check` : TypeScript strict, **38/38 tests** et build client/serveur/outils réussis. Un dernier `npm run build` a compilé les corrections de revue.
- `npm run test:e2e` : réussi sur le build final. Login Kyros simulé, changements de permissions à chaud, accès privés/DMs, fils/épingles/recherche, deux sessions échangeant des messages, projets, édition/aperçu de pages, invitations, intégrations, six thèmes, persistance après redémarrage, calendrier/récurrences/favoris/rappels, retour hors ligne et mise à jour du service worker.
- `E2E_UX_ONLY=1 npm run test:e2e` : réussi. Accueil alimenté par calendrier/rappels persistés, commande rapide ouverte au clavier et sélection avec Entrée, marquage des notifications en lot vérifié en DB, accès notification → salon réel. Navigation effective et contrôle de débordement sur accueil, conversations, projets, pages, calendrier, réception, rappels, favoris, amis, supervision, aide, préférences et administration à **1440×1000 et 390×844**. Fermeture clavier du menu mobile et choix de salon dans le panneau dédié.
- Captures finales `ux-*.png` sous `.impeccable/review/`, ignorées par Git ; données explicitement de test. Inspection desktop/mobile en deux passes, filtre de pages mobile corrigé. Le hook Impeccable n’a relevé aucun problème déterministe sur `ux.css` et `Inbox.tsx` ; cela ne constitue pas un audit exhaustif d’accessibilité.
- Revue indépendante du code et des captures : après correction, le verdict `ship` confirme la résolution des deux points listés (accès notification → conversation et filtre de pages mobile), sans certification exhaustive du produit.
- Prettier vérifié sur tous les fichiers source modifiés ; `git diff --check` réussi. Le build signale encore des chunks supérieurs à 500 Ko, notamment le catalogue d’emojis chargé séparément. Aucun résultat de performance sur appareil physique n’est revendiqué.

Le nouveau parcours d’accueil a nécessité l’adaptation des sélecteurs E2E qui supposaient un accès initial direct au chat. Le test hors ligne classe uniquement les 503 dont le service worker fournit effectivement `error.code=OFFLINE`, y compris leurs messages console différés au retour réseau. Les erreurs réseau inattendues restent bloquantes.

Deux défauts corrigés pendant la qualification : import nu `chrono-node` laissé dans le build navigateur, et focus différé de navigation interrompant le début d’une saisie dans la seconde session. Le premier est désormais bundlé, le second conserve le focus d’un champ ou d’un dialogue déjà actif.

Pas de migration SQL, déploiement, tag ni publication. Kyros/DropIt réels, réception push par un fournisseur réel et iPhone/Android physiques restent hors de ces essais. L’historique de qualification ci-dessous est conservé.

## Finalisation du jalon 0.4.0 — 25 septembre 2026

Version de maintenance **0.4.7**, validation locale macOS/Node 24.19.0, Chrome headless via Puppeteer et PostgreSQL jetable. Cette section remplace le constat de 0.4 partielle et de parcours E2E obsolète consigné plus bas dans l’historique 0.4.6.

| Contrôle exécuté                      | Résultat et portée                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                            | **38/38 réussis**. Calendrier, changements d’heure Europe/Paris, fin de mois/année bissextile, journées entières, mutations, isolation, rappels concurrents/replanification/report, favoris et filtres de recherche. Tests heartbeat et intégrations existants conservés.                                                                                                                            |
| Web Push dans les tests d’intégration | Abonnement chiffré, VAPID et chiffrement aes128gcm réel, création transactionnelle des livraisons, préférences et accès revérifiés, contenu générique, session révoquée, retry et suppression 410. Transport injecté : **aucun envoi vers un fournisseur push réel**.                                                                                                                                |
| `npm run build`                       | Réussi : TypeScript, client Vite, serveur et outils compilés. Syntaxe du service worker généré vérifiée pendant le build. Avertissement de taille sur les bundles principal (~570 kB minifié) et emojis (~805 kB) ; optimisation du chargement encore possible.                                                                                                                                      |
| `npm run test:e2e:experience`         | Réussi : recherche salon/auteur, calendrier créé/modifié/récurrent, favori ouvrant la série, rappel créé/reporté/modifié/déclenché/terminé, thèmes Minuit/Forêt/Braise, état push non configuré, raccourcis, écrans 1440×1000 et 390×844 sans débordement horizontal.                                                                                                                                |
| PWA dans Chrome                       | Cache statique sans API/auth, vraie coupure réseau de la page **et** du worker, API 503 explicite, rechargement du shell hors ligne puis retour réseau. Nouveau worker installé, action de mise à jour, rechargement et suppression effective de l’ancien cache. Flux SSE exclus du worker pour permettre son remplacement.                                                                          |
| `npm run test:e2e` complet            | **Réussi sur le build 0.4.7**, sans erreur console inattendue : Kyros de test, changement de droits en direct, navigation/admin, fils/épingles, salons privés/DMs, invitations/amis, réactions/mentions/images, groupes, DropIt/GitHub de test, Kanban/pages, persistance après redémarrage, puis totalité du parcours expérience 0.4. Les anciens sélecteurs de menu/invitation ont été actualisés. |
| Migration 006                         | Appliquée sur `liora_test` et `liora_e2e`, après les migrations 001–005 inchangées. Aucune migration de la base personnelle ou distante effectuée.                                                                                                                                                                                                                                                   |
| Présentation                          | Inspections desktop/mobile : agenda, rappels et réglages push. Correction des cellules hors mois, navigation secondaire, menu mobile masqué et actualisations sans disparition de liste. Captures synthétiques dans `.impeccable/review/experience-*.png`, ignorées par Git.                                                                                                                         |
| Format et dépendances                 | Prettier vérifié sur les nouvelles surfaces source ; `npm audit --omit=dev` : **0 vulnérabilité signalée** à cette date. `git diff --check` réussi.                                                                                                                                                                                                                                                  |

Le détecteur Impeccable a été exécuté une fois sur les surfaces modifiées : 1 avertissement principal sur une ancienne bordure de calendrier, retirée (déjà neutralisée par le style récent), et 218 conseils CSS de palette/échelle, majoritairement existants. Aucun constat TSX ; ces contrôles ne constituent pas un audit complet d’accessibilité. Pas de refonte de la palette de l’application dans ce lot.

### Conditions de mise en service

- Sauvegarder puis appliquer **006_experience_complete.sql** avant le démarrage du nouveau code.
- Générer/configurer des clés **VAPID** stables et un contact opérateur selon [EXPERIENCE_0.4.md](EXPERIENCE_0.4.md). Vérifier consentement, réception application fermée, clic, désactivation et révocation sur les appareils cibles. Aucun test sur iPhone/Android physique ni FCM/APNs réel effectué ici.
- Installer l’émetteur heartbeat sur **Argus** et constater réception, expiration puis retour. La santé HTTP d’Argos/Argus ne prouve pas ce flux sortant.
- Kyros et DropIt utilisent des fixtures locales dans les parcours ; leurs comptes/instances réels, le déploiement HTTPS et une restauration complète restent à qualifier dans l’environnement cible.

Aucun déploiement, tag ni publication effectué. Les changements préexistants de l’espace de travail sont conservés. La qualification locale de la 0.4 ne vaut pas validation STABLE 1.0.

## Résultats 0.3.0 — 16 septembre 2026

- TypeScript et build client/serveur/outils réussis.
- **28/28 tests Liora** : suite précédente, secrets des modules, signatures GitHub et HMAC horodaté Nino/Narra, expiration/rejeu, filtres/routage, tâches et nettoyage des règles lors de suppression, commandes privées, accès personnel DropIt et rotation durable après erreur distante.
- **8/8 tests DropIt** : statuts existants, API déléguée réelle (PKCE, propriété, persistance, révocation), SSO v4 avec fournisseur de test, rotation unique de 8 appels concurrents, panne et token expiré sans suppression de session.
- Parcours Puppeteer sur serveur compilé : configuration DropIt, consentement, liste de ses seuls fichiers, insertion du lien dans un brouillon, commande privée, persistance/redémarrage, desktop 1440×1000 et mobile 390×844. Aucun message publié par la commande ; aucun fichier étranger affiché.
- Audit npm production : aucune vulnérabilité signalée pour Liora et DropIt.
- Détecteur UI : aucun constat principal ; remarques de palette/typographie existante transmises à la revue de finition. Captures dans .impeccable/review (données synthétiques).

Les API DropIt testées proviennent du vrai dépôt voisin, avec authentification injectée uniquement dans la fixture ; son authentification v4 est vérifiée séparément. Aucun login humain complet ni connexion aux instances externes réelles n’a été exécuté. DropIt doit être déployé/configuré avant l’usage réel. La synchronisation PC est hors de ce lot.

## Historique 0.2.1

Date : 15 septembre 2026. Exécution locale macOS, Node 24.19.0, Chrome headless via Puppeteer. Aucun déploiement distant effectué.

## Résultats vérifiés

| Vérification                | Résultat                                                                                                                                                                |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript strict           | `npm run typecheck` réussi                                                                                                                                              |
| Tests                       | 24/24 : 18 tests d’intégration PostgreSQL et 6 tests unitaires sécurité/fusion/mentions                                                                                 |
| Build                       | Vite production + compilation serveur + outils de migration réussis                                                                                                     |
| Formatage                   | Prettier vérifié sur src/scripts/tests/configs                                                                                                                          |
| Dépendances production      | `npm audit --omit=dev` : aucune vulnérabilité signalée au moment du test                                                                                                |
| Migration/seed              | Migrations 001/002/003 sur bases de tests ; migration 003 appliquée sur l’instance locale avec outil compilé après sauvegarde                                           |
| Base après redémarrage      | Messages conservés après arrêt/redémarrage du serveur compilé                                                                                                           |
| Sauvegarde/restauration     | Contrôle réalisé en 0.2.0 : dump de la base de test restauré dans une nouvelle base ; comptages messages/cartes/rôles/migrations identiques ; base temporaire supprimée |
| Healthcheck instance locale | `/health/ready` HTTP 200, PostgreSQL up, version 0.2.1                                                                                                                  |
| Kyros réel configuré        | GET `/auth/login` retourne 302 vers l’origine Kyros attendue : PAR accepté. Pas de login humain complet effectué                                                        |

## Nouveaux contrôles 0.2.1

- Aperçu de réponse : conversion des mentions avant troncature, métadonnées du message source prises en compte ; cas d’une mention traversant la limite couvert par test.
- Invitation acceptée explicitement, usage unique, rôle de l’émetteur, amitié et restrictions de réception des DMs.
- Attribution/retrait d’accès par groupe, isolation de l’espace et interdiction d’appliquer un groupe à un DM.
- Fusion de modifications de blocs indépendants, rejet des conflits sur un bloc ou son ordre, historique/commentaires et droits des blocs embarqués.
- Participants, fichiers de tâche, révision attendue, activité des commentaires, modèles et suppression de projet ; une suppression via le mauvais workspace ne supprime aucun descendant.
- Collection de plus de 500 éléments : curseur, seconde page et absence de doublons. Mentions résolues, drapeau Unicode, upload GIF et avatar.
- Récupérateur : règles de destinations publiques, extraction sans HTML exécutable, validation des signatures ; essai HTTPS public vers example.com réussi. L’accès à tous les fournisseurs d’images n’est pas garanti.
- Navigateur : invitation entre deux comptes, ami présent, recherche des tutoriels, insertion de mention lisible, recherche française et insertion d’emoji, affichage d’un GIF joint, création/enregistrement d’un groupe, aperçu lecteur et statistiques d’un brouillon, trois thèmes, aide mobile.
- Le test GIF utilise une image de 1×1 pixel : il vérifie le chargement de l’image, sans constituer une validation visuelle d’une animation multi-images.
- Une rafale de lectures révélée par le test navigateur a conduit à séparer les quotas GET/mutations et à conserver l’écran courant lors d’une erreur temporaire du profil.

Les anciens contrôles ci-dessous restent inclus. Le build Vite signale la taille du catalogue emoji (~805 Ko avant compression, ~102 Ko gzip), chargé séparément à la première ouverture du sélecteur.

## Nouveaux contrôles 0.2.0

- Supervision refusée au membre, autorisée après attribution par l’admin puis refusée après retrait ; interface déjà ouverte actualisée sans reconnexion.
- Salons privés absents des listes et de la recherche, messages/réactions/suppression/fichiers refusés sans accès ; notification de mention privée masquée ; attribution/retrait de l’accès testés.
- Fil isolé du flux principal, compteur de réponses, lecture des réponses, épingle réservée à MANAGE_MESSAGES.
- Conversation directe idempotente par paire, impossibilité de la rendre publique, accès refusé à un administrateur extérieur.
- Navigateur : menu de l’espace et Échap, succession Membres/Rôles avec réponse réseau retardée, fil/réponse, épingle/recherche, permissions de supervision actualisées dans une deuxième session humaine, salon privé/invitations et message direct.

## Tests navigateur

Serveur **compilé en mode production**, y compris CSP et cookies, avec fournisseur Kyros de test distinct et clé RSA éphémère. Authentification via PAR, redirection, callback et JWT réels sur le protocole de test ; aucun contournement de l’application.

Parcours validés : entrée SSO, messages entre deux contextes de navigateur et invalidation SSE, réaction, déplacement de carte par contrôle accessible, modification/enregistrement d’une page, création de salon par l’administration, flags médias absents de la navigation d’usage, changement clair/sombre/crépuscule, redémarrage serveur et relecture des messages, tiroir mobile et board horizontal. Aucun débordement horizontal du document en 1440×1000 et 390×844.

Captures supplémentaires 0.2.1 : friends, help, mobile-help, emojis, page-preview, groups et dusk. Réduction des mouvements activée pour éviter les captures à mi-transition.

Captures supplémentaires 0.2.0 : workspace-menu, mobile-workspace-menu, roles, thread et direct-message.

Captures locales `fullPage:false` dans `.impeccable/review/` : desktop, mobile, board, mobile-board, login, monitoring, admin et thème clair. Ces captures contiennent exclusivement les données de test/démonstration.

Lors de la 0.1.0, l’analyse mécanique de design n’a renvoyé aucun signal. La revue indépendante de la 0.1.0 a demandé deux corrections (contraste clair, métadonnées/historique monitoring accessibles), puis a noté ces deux corrections **résolues** sur captures actualisées. Ce verdict porte sur les corrections examinées, pas sur une certification générale d’accessibilité.

## Couverture métier

- Auth SSO et bootstrap explicite ; absence de droits implicites au second login.
- CSRF, absence de session, permissions et isolation inter-workspaces.
- Création de salon et PATCH préservant les champs omis.
- Messages, mention/notification, réactions, édition interdite à un autre auteur, réponses limitées au salon.
- Bot à token hashé, permissions, révocation.
- Payload Argos natif, idempotence, création de tâche autorisée, révocation webhook.
- Déplacement Kanban persistant et checklist conservée ; conflit de révision des pages.
- Médias fermés par flag et endpoint absent.
- Refresh concurrent unique, conservation de session en cas de panne temporaire.
- Incident heartbeat dédupliqué, rétablissement et blocage de destinations webhook privées.
- SSE durable et session révoquée ; chiffrement/tampering et politique de permissions atomiques.

## Revue visuelle 0.2.1

Le détecteur mécanique a été exécuté une fois : aucun signal bloquant, 185 conseils de documentation de tokens/échelles (dont les nouvelles couleurs Crépuscule). Deux séries d’inspection ont corrigé l’alignement des groupes, les actions mobiles et le bouton d’enregistrement inactif en aperçu publié. La revue indépendante a demandé de résoudre les mentions avant de tronquer les aperçus de réponse. Correction appliquée et testée ; verdict **ship**, avec ce P2 noté **résolu**. Ce verdict clôt ce défaut précis et ne constitue pas une certification globale d’accessibilité.

## Limites explicites

- Login et refresh avec un véritable compte Kyros encore à vérifier ; la configuration privée actuelle n’est pas remplacée par les fixtures des tests.
- Pas de heartbeat distant ni alerte envoyée depuis le serveur Argos réel. Seuls le contrat local et les scénarios simulés ont été validés.
- Dockerfile et Compose fournis ; build d’image et déploiement Docker non exécutés.
- Restauration PostgreSQL locale vérifiée ; restauration complète des pièces jointes et exercice de reprise en environnement cible restent à réaliser.
- Pas de test de charge ni audit de sécurité indépendant. Les fonctions reportées sont listées dans ROADMAP.md.

## Revue et correctif 0.4.6 — 25 septembre 2026

- `npm test` : **30 tests réussis**, dont émetteur local (santé, authentification, refus de redirection, accusé de réception), création du heartbeat avant premier worker, expiration, cloisonnement par espace et révocation du service. Un test existant de rejeu signé a été stabilisé : les deux envois réutilisent le même horodatage au lieu de dépendre d’un passage de seconde.
- `npm run build` : réussi, incluant TypeScript, Vite, serveur et outils. Avertissement Vite sur un bundle > 500 kB (données emojis notamment) ; aucune optimisation de ce bundle dans ce lot. Un champ `group_ids` manquant dans le type client bloquait initialement la compilation et a été ajouté.
- `E2E_MONITORING_ONLY=1 npm run test:e2e` : réussi sur serveur compilé, PostgreSQL jetable et Kyros de test, via Chrome/Puppeteer. Scénarios jamais reçu, réception authentifiée, rétablissement, expiration, aide de configuration et absence de débordement à 1440×1000 / 390×844. Captures inspectées dans `.impeccable/review/heartbeat-*.png` (ignorées par Git).
- La première passe navigateur a révélé un script inline de service worker bloqué par la CSP. Déplacement vers `src/client/pwa.ts`, rebuild puis reprise ciblée sans erreur console. Ceci ne qualifie pas l’ensemble du mode hors ligne ni Web Push.
- `npm run test:e2e` complet : **non validé** ; il s’arrête avant la supervision car il cherche l’ancien bouton « Administration ». Le parcours actuel passe par le menu d’espace. Les autres parcours complets restent à actualiser et relancer ; la passe ciblée n’est pas présentée comme leur remplacement.
- `git diff --check` : réussi. Inspection mécanique de la surface : pas de nouveau problème sur les éléments heartbeat ; les avertissements globaux du CSS existant ne sont pas une certification d’accessibilité.

Aucune installation du timer sur Argus, aucun heartbeat depuis ce serveur, aucune validation Kyros/DropIt de production ni restauration de sauvegarde pendant cette intervention. Les changements locaux préexistants sont conservés. Les écarts 0.4 recensés alors dans ETAT_DU_PROJET.md ont depuis été traités en 0.4.7 ; voir les résultats actuels en tête de ce document.
