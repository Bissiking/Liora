# Adaptations externes — historique versionné

## Liora 0.3.0 / DropIt 1.1.0 — 2026-09-16

DropIt passe de 1.0.2 à 1.1.0. Ajouts : src/integrations.js (API déléguée et SQLite), public/integrations.html et assets (clés/consentements), src/kyros-v4.js ; adaptation src/auth.js vers SSO v4 durable, server.js et navigation, dépendances et tests. Notes dans `DropIt/DOCS/RELEASE_1.1.0.md` et `DropIt/DOCS/LIORA_API.md`.

Compatibilité : Node ≥22.13, inscription Kyros v4 à vérifier, anciennes sessions mémoire à reconnecter une fois ; fichiers/partages conservés. Sauvegarder data (dont auth-master.key et les SQLite) et uploads avant déploiement. Aucun .env réel modifié, aucun service DropIt réel redémarré. Retour arrière : remettre le code/dépendances 1.0.2 et désactiver le connecteur Liora ; garder les nouveaux fichiers de données pour une reprise ultérieure.

Tests isolés de l’API réelle, PKCE, propriété, rotation/révocation et SSO v4 avec fournisseur de test. Aucun changement dans Argos, Kyros, Nino ou Narra. L’émission depuis leurs instances reste à configurer.

## Contrat d’intégration 0.1 — 2026-09-16 — base Liora 0.2.1

Décisions consignées dans ROADMAP.md, PROJECT_CHARTER.md et DOCS/INTEGRATIONS.md : fichiers délégués à DropIt, synchronisation dans un module LUMA distinct, configuration des connecteurs en base et séparation clé applicative/autorisation personnelle. TODO.md, README.md et le guide d’architecture sont alignés.

DropIt 1.0.2 et Kyros consultés en lecture seule pour vérifier API, identité et contraintes existantes. Aucun dépôt externe modifié, aucun secret déplacé, aucune migration ni nouvelle fonction exécutable ; version Liora inchangée. La clarification du 15 septembre ci-dessous est remplacée par ces décisions.

## Clarification de roadmap — base Liora 0.2.1 — 2026-09-15

Syncthing devient explicitement facultatif. ROADMAP.md distingue partage de fichiers dans Liora, synchronisation entre appareils et remontée d’événements. Aucun changement de code, de schéma ou de version exécutable ; aucun logiciel installé ni dépôt externe modifié. La synchronisation maison reste à cadrer selon l’usage demandé.

## Liora 0.2.1 — 2026-09-15

Modifications confinées à Liora : collaboration avancée, invitations et amis, médias/aperçus, pages/tâches, groupes, préférences et aide. Aucun dépôt externe modifié, aucun changement du contrat Kyros v4. Voir [RELEASE_0.2.1.md](RELEASE_0.2.1.md).

## Liora 0.2.0 — 2026-09-15

Modifications confinées au dépôt Liora : permissions de supervision, navigation/admin et collaboration privée. Aucun fichier, version, secret ou contrat modifié dans Argos, Kyros, Drivio ou Nino. Détails dans RELEASE_0.2.0.md.

## Liora 0.1.0 — 2026-09-15

| Dépôt        | Lecture / réutilisation                                              | Modification                           | Version externe |
| ------------ | -------------------------------------------------------------------- | -------------------------------------- | --------------- |
| Drivio       | Contrat client Kyros v4 réadapté dans `src/server/kyros.ts` de Liora | Aucune                                 | Inchangée       |
| kyros        | Vérification PAR, JWT, scopes et `/sso/v4/jwks`                      | Aucune                                 | Inchangée       |
| Argos        | Format `notification-channels.ts` et routes de santé                 | Aucune ; adaptation du récepteur Liora | Inchangée       |
| nino-backend | Réception générique des événements Nino préparée dans Liora          | Aucune                                 | Inchangée       |

Liora porte sa propre adaptation sous la version 0.1.0. Aucun commit, tag, fichier de configuration ou secret d’un dépôt externe n’a été modifié.

Toute future modification externe doit ajouter ici une entrée : dépôt, ancienne/nouvelle version, fichiers, comportement, compatibilité, tests et procédure de déploiement/retour arrière. Ajouter aussi un résumé sous DOCS du dépôt modifié.

## 25 septembre 2026 — heartbeat et revue 0.4.6

Aucun dépôt externe modifié, aucun secret créé sur un service distant. Liora fournit un émetteur autonome à installer sur Argus et une procédure systemd dans ARGOS.md. Le timer n’a pas été installé ni exécuté sur Argus pendant cette intervention. Les changements locaux déjà présents sur les intégrations et la synchronisation des cibles ont été conservés.

## 25 septembre 2026 — finalisation expérience 0.4.7

Modifications limitées à Liora. Dépendances ajoutées : `@js-temporal/polyfill` (calculs horaires) et `web-push` (protocole/chiffrement), avec types de développement. Aucun dépôt ou service Kyros/Argos/DropIt/Nino/Narra modifié. Les tests push utilisent un transport contrôlé ; aucune notification envoyée à un destinataire externe pendant cette intervention.

## 3 octobre 2026 — refonte UX 0.4.9

Changements confinés à Liora : interface, packaging navigateur, version, documentation et qualification. Aucun dépôt externe modifié. Kyros et DropIt sont exercés par les fixtures de test locales, sans action sur leurs services réels.

## 3 octobre 2026 — espace personnel 0.5.0

Migration 007 pour conversations entre amis, catalogue et suivis de lieux, fuseau des messages. Nouveaux endpoints globaux `/friends/:id/messages` et `/places`, réservés aux humains et indépendants des espaces. Le contrat d’envoi des messages de salon accepte un fuseau optionnel et les suggestions de dates précisent `allDay`, `timezone` et l’offset de texte. Ajout des thèmes Atelier/Orbital/Terminal au profil ; contrats Kyros, DropIt, Argos et APIs d’espace conservés. Fond Leaflet 1.9.4 / OpenStreetMap, politique de referrer explicite et CSP images limitée au domaine de tuiles. Recherche géographique Photon par proxy authentifié, cache/throttle et URL configurable ; ajout de catalogue uniquement après sélection explicite, pas de synchronisation en masse. À appliquer et qualifier sur le déploiement ; aucune publication pendant l’intervention.

## 3 octobre 2026 — recherche et ajout des lieux

Ajout de `GET /api/v1/places/search` : noms, villes et adresses publics transmis à Photon uniquement sur validation de l’utilisateur, position de proximité arrondie, aucun suivi privé ni secret transmis. Le fournisseur public est remplaçable par `PLACES_GEOCODER_URL` ; cache et limites de requêtes côté Liora. Source et conditions : [Photon](https://github.com/komoot/photon). La recherche peut retourner moins de résultats qu’il existe d’établissements dans la zone.

L’ajout s’appuie sur le contrat `/places` existant et la migration 007, sans nouvelle migration. Les champs de coordonnées sont avancés ; date, notes et partage utilisent le suivi personnel existant. Aucun dépôt externe modifié ni déploiement effectué. Les fixtures de qualification n’envoient aucune recherche aux services publics ; l’essai API réel sur Rennes est consigné séparément dans VALIDATION.md.

## 3 octobre 2026 — recherche libre des lieux

Le contrat `/places/search` retourne désormais les lieux, villes et adresses pertinents de Photon, sans filtre Burger King ni seconde recherche implicite. Alias MacDo/McDo/McDonalds normalisés en McDonald’s. Le paramètre facultatif `nearby=1` borne à 15 km du centre et trie par distance ; sans lui, les vingt premiers résultats conservent la pertinence du fournisseur. Cache, limites, droits humains et transmission sans notes ni identifiant restent en place. La recherche est toujours déclenchée explicitement.

Migration **008_place_search.sql** additive : catégorie Lieu libre, sans modification des lieux/suivis Burger King ni de la migration 007. Appliquer avant démarrage. Aucun dépôt externe modifié, aucun fournisseur supplémentaire ni secret, aucun déploiement. Les essais réels en lecture seule « MacDo Rennes » et « Camping Rennes » sont distincts des fixtures et n’ajoutent rien au catalogue. Retour arrière du code possible en conservant la catégorie et les suivis ; ne pas supprimer les données Lieu libre.

## 5 octobre 2026 — 0.6 : avatar Kyros et Gotify

Kyros consulté en lecture seule (`src/auth/tokens.service.js`, CHANGELOG 4.7.1) : claim signé `avatar_url` absolu. Aucun fichier externe modifié, aucun service externe relancé. Liora synchronise cet avatar à la connexion/au refresh et le sert via un proxy d’image local ; import local prioritaire.

Gotify utilise le [contrat officiel](https://gotify.net/docs/pushmsg) et ses [extras](https://gotify.net/docs/msgextras), sur action/configuration personnelle explicite. Token chiffré, message générique et lien vers la réception ; aucun contenu de conversation transmis. Les tests de livraison injectent un transport local ; la QA navigateur enregistre une configuration synthétique désactivée et n’émet aucun message vers un vrai Gotify. Aucun déploiement distant ni mutation de la base principale. Migration 009 appliquée uniquement aux bases jetables.

## 0.7.0 — 5 octobre 2026

Le dépôt adjacent BrainDump a été consulté en lecture seule : `src/api-routes.ts`, `src/auth/auth-service.ts`, `src/auth/auth-config.ts`, `src/types.ts` et `src/database/database.ts`. Aucun fichier BrainDump ni Kyros n’a été modifié. Son API `/api/braindump/dumps` fournit déjà `dueAt`, identité propriétaire, dates et notes filtrées ; son bearer peut autoriser explicitement le client Liora avec `KYROS_LUMA_CLIENT_ID`, `KYROS_LUMA_RESOURCE_AUDIENCE` et les scopes convenus. Ces configurations de production restent à appliquer par l’opérateur.

Google Cloud/Calendar API est un nouveau fournisseur externe : création du client OAuth Web, activation Calendar API, callback et consentement restent à configurer. Implémentation Liora avec scopes événements et liste d’agendas, OAuth/PKCE lié à la session, secrets chiffrés et synchronisation limitée aux événements Liora de l’auteur hors salons privés. Les essais emploient un fournisseur local, sans connexion ni écriture vers un compte Google réel. Aucune application de calendrier native n’a été configurée. Guide : RELEASE_0.7.0.md.

## 0.7.1 — BrainDump 2.1.0 — 5 octobre 2026

Le dépôt adjacent `BrainDump` est maintenant modifié : applications connectées, consentement de compte, API de capacités/notes datées, jetons rotatifs, révocation, migration SQLite additive 3, entrées de navigation et documentation versionnée. Package et lockfile passent à 2.1.0. Liora configure BrainDump en base et conserve DropIt ; les autres fournisseurs restent masqués dans les paramètres. Migration Liora 011. Tests sur SQLite en mémoire et bases PostgreSQL jetables, sans ouverture ni migration des bases personnelles, écriture sur fournisseurs réels, redémarrage de services ou déploiement. Aucun changement dans Kyros ou DropIt.

## 1.0.0-beta.1 — 6 octobre 2026

Aucun service, fournisseur, compte calendrier ni production modifié. Google Calendar OAuth/runtime est retiré localement, consentements distants non révoqués, tables historiques conservées. CalDAV devient le parcours officiel ; aucun client natif configuré. BrainDump/DropIt/Kyros gardent leurs contrats et configurateurs disponibles. Migrations 012–015 exécutées uniquement dans les bases de qualification `_test`/`_e2e` ; upgrade depuis 0.7.1 synthétique. Qualification native, sécurité/charge et bascule réelle demeurent nécessaires avant stable.
