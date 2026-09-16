# Validation — 0.3.0 BETA

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
