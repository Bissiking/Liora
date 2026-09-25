# Liora — charte directrice · 0.4.7 BETA

**Avant tout développement significatif, lire PROJECT_CHARTER.md.**

La demande originale reste dans `DOCS/PROJECT_CHARTER.md`. Ce document fixe les choix d’implémentation. Ne pas supprimer les exigences originales ; les fonctionnalités différées sont suivies dans ROADMAP.md.

## Vision et philosophie

Liora relie communication, organisation et signaux techniques pour LUMA. Les intégrations restent autonomes : une panne Argos ou Nino ne doit pas bloquer la collaboration. Priorités : stabilité, simplicité, persistance, sécurité, UX, extensibilité.

## Nom et identité

Liora évoque la lumière et les liens de LUMA. Alternatives étudiées : Nacre, Relio, Atria. Choix de produit, sans revendication de disponibilité juridique. Logo SVG : deux liaisons formant un L ouvert, point de rencontre. Versions claires et sombres, icône et favicon.

## Architecture

React + TypeScript strict + Vite pour une application privée sans SEO ; Express 5 permanent pour API, SSE et tâches périodiques ; PostgreSQL via `pg`, migrations SQL versionnées et paramétrage obligatoire. Un déploiement contient une application et PostgreSQL. Pas de Redis, Kafka ni microservices par défaut. Les workers se coordonnent via verrous PostgreSQL.

## UX

Interface française, espace central lisible, navigation compacte, disponibilité réelle, états vides utiles, erreurs récupérables, clavier et mobile. Aucune fonction simulée en production. Les données du seed sont explicitement des démonstrations. Les contrôles visibles ont une opération persistée.

## Sécurité et Kyros

Kyros SSO v4 exclusivement : PAR, PKCE S256, state à usage unique, validation iss, RS256/JWKS, audience, resource_aud, client_id, version et scopes. Identité externe `kyros_user_id`. Aucun rôle Kyros ne donne de permission Liora. Owner de LUMA attribué uniquement au sujet explicitement configuré dans BOOTSTRAP_OWNER_KYROS_ID et si l’espace est sans membre.
Sessions opaques HttpOnly, SameSite=Lax, Secure en production. Jetons Kyros chiffrés AES-256-GCM en base. Refresh deux minutes avant expiration, verrou de session PostgreSQL et reprise lors du retour réseau/visibilité. Une erreur réseau conserve la session ; accès refusé temporairement si le jeton est expiré. Secrets jamais envoyés au frontend ni journalisés. CSRF par validation Origin stricte pour mutations avec cookies.

## Permissions

La supervision exige VIEW_MONITORING explicitement attribué par un administrateur. Les changements de droits actualisent les clients. Salons privés à liste de membres et groupes autorisés ; conversations directes limitées à leurs deux participants, sans accès administratif implicite.

Rôles locaux personnalisables et permissions atomiques dans `src/shared/permissions.ts`. Owner protégé ; toute attribution de permission vérifie celles de l’acteur. Cloisonnement systématique par workspace, références composites en DB. Bots et services sont des identités techniques distinctes, sans login humain. API à permissions explicites, jetons aléatoires hashés SHA-256, affichés une fois, rotation/révocation. Pas d’exécution de commandes distantes.

## API et DB

API `/api/v1`, JSON, validation Zod, erreurs `{error:{code,message,requestId}}`, UUID, dates UTC ISO-8601, SQL snake_case. Pas de SELECT massif de messages : 50 par curseur stable. Les migrations appliquées sont immuables et vérifiées par checksum. Les opérations administratives alimentent l’audit. Suppression des messages avec tombstone ; suppression d’un salon archive son historique.

## Temps réel

SSE fournit les invalidations avec id séquentiel PostgreSQL. Les écritures passent par l’API HTTP. Reconnexion native EventSource, reprise Last-Event-ID, relecture des ressources sous permissions. Pas de contenu privé dans les événements SSE. Réévaluation périodique des droits et sessions. Présence déduite d’activité récente, volontaire et configurable.

## Événements et intégrations

Événements persistés et outbox transactionnelle pour webhooks sortants. Réception générique et adaptation du format Argos existant. Webhooks entrants : jeton hashé, validation, limite de taille et cadence, idempotency-key optionnelle. Sortants : HTTPS public, résolution IPv4 contrôlée et épinglée, signature HMAC, cinq essais, état/retry/cancel visibles. Les URL de monitoring sont uniquement configurables par l’opérateur dans l’environnement, y compris destinations privées.

### Modules et fichiers — décision du 16 septembre 2026

DropIt porte les fichiers et le partage. La synchronisation des dossiers appartient à un futur module LUMA distinct. Les connecteurs seront configurables dans l’interface et persistés en base : URL, secrets chiffrés, droits, état, rotation et révocation. Les paramètres de démarrage et la clé maîtresse restent hors de cette base.

Une clé API identifie l’application appelante ; l’accès aux ressources personnelles exige en plus une autorisation liée au compte Kyros vérifié. Ne jamais utiliser un `user_id` fourni par le client comme preuve d’identité. Les droits techniques, personnels et ceux du workspace restent distincts. Contrat implémenté et configuration : [DOCS/INTEGRATIONS.md](DOCS/INTEGRATIONS.md).

## Argos

Surveillance indépendante de l’API Argos, de l’URL de santé Argus et d’un heartbeat authentifié. Une transition vers down crée un événement et une notification critique ; retour à up notifié. Aucun contrôle de serveur. Historique 30 jours. Déployer Liora hors d’Argus pour conserver cette indépendance.

## Feature flags et fonctions différées

`jellyfin.enabled=false`, `media_requests.enabled=false`. Activation refusée tant que les modules ne sont pas implémentés ; aucune page, navigation ni appel média. Vocal/vidéo, marketplace bots, contrôle infra, partage externe et intégrations enrichies sont différés. Pages à blocs avec aperçus, éléments embarqués et fusion concurrente par bloc ; pas de clone Notion complet.

## Conventions et structure

`src/client` interface ; `src/server` API/auth/workers/storage ; `src/shared` contrats ; `migrations` SQL ; `scripts` opérations ; `tests` validation ; `public/brand` SVG ; `DOCS` guides. Première ligne des fichiers source : chemin en commentaire. Tests métiers ciblés, pas de secrets ni données locales Git. Tout changement d’un autre dépôt est résumé et versionné dans DOCS/EXTERNAL_CHANGES.md.

## Versioning et roadmap

SemVer, version courante **0.4.7 — BETA** dans VERSION et package.json, affichée dans À propos et administration. Toute évolution significative met à jour CHANGELOG.md et ROADMAP.md. Pas de tag ou publication automatique requis. Voir ROADMAP.md pour 0.2 à 1.0.

## Definition of Done et qualité

Fonction réelle, persistée, erreurs gérées, droits vérifiés, utilisable au clavier et mobile, tests pertinents, build production réussi et documentation fidèle. La compilation ne prouve ni le SSO réel ni le déploiement : indiquer séparément la validation locale et les validations externes restantes. Migrations et sauvegardes testables ; redémarrage sans perte de données.

## Livraison 0.3.0 — 16 septembre 2026

Le lot intégrations est implémenté : modules configurés en base, DropIt personnel en lecture de partages, GitHub/Nino/Narra, règles de routage et tâches, HMAC et commandes privées. DropIt 1.1.0 est adapté avec Kyros v4. La synchronisation PC reste un futur module LUMA séparé ; aucun moteur dans Liora. Contrat et limites : [DOCS/INTEGRATIONS.md](DOCS/INTEGRATIONS.md).

## Revue du 25 septembre 2026

État vérifié dans [DOCS/ETAT_DU_PROJET.md](DOCS/ETAT_DU_PROJET.md). Le socle 0.1–0.3 est implémenté ; le lot 0.4 est désormais implémenté dans 0.4.7 (récurrences, rappels, émission Web Push, favoris et PWA). Les résultats locaux et les validations externes sont distingués dans DOCS/VALIDATION.md. Ne pas assimiler présence d’une interface et livraison complète. Les idées classées CORE/FEATURE/FUTURE/EXPERIMENTAL sont dans [DOCS/Idées.md](DOCS/Idées.md). Les exigences originales sont conservées. Le heartbeat exige un émetteur sur Argus ; guide et limites dans [DOCS/ARGOS.md](DOCS/ARGOS.md).

## Expérience 0.4 — décision du 25 septembre 2026

Les séries conservent un fuseau IANA et un ancrage ; modifier une série concerne toutes ses occurrences. CREATE_CALENDAR_EVENT autorise la création humaine, l’auteur gère ses événements, MANAGE_CALENDAR gère ceux des autres sans contourner l’accès à un salon privé. Les rappels sont personnels, transactionnels et replanifiés depuis l’ancrage après interruption. Le rappel d’un événement concerne son auteur.

Web Push utilise un consentement par appareil et un abonnement chiffré lié à la session. File transactionnelle, contrôle des droits au moment de l’envoi, contenu générique, expiration et retries bornés. Les clés VAPID restent dans le déploiement, avec la clé maîtresse. Le cache PWA exclut API, authentification et fichiers privés ; aucune mutation n’est stockée hors ligne. Guide : [DOCS/EXPERIENCE_0.4.md](DOCS/EXPERIENCE_0.4.md).
