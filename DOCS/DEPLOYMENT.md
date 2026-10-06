# Déploiement

Pour la préversion 1.0.0-beta.1, suivre d’abord [RELEASE_1.0.0.md](RELEASE_1.0.0.md) : sauvegarde, restauration isolée, migrations 012–015 et qualification avant bascule. Aucune production déployée pendant le développement. Les instructions Google 0.x sont historiques ; configuration calendrier courante dans [CALDAV.md](CALDAV.md).

## Node direct

Node 22.12+ (24 utilisé localement), PostgreSQL 17+, reverse proxy HTTPS. Une instance Liora initialement. Configurer `.env` à partir de `.env.example` sans écraser un fichier existant. Secrets hors Git. `APP_URL` est l’origine publique exacte et le callback Kyros doit correspondre.

```sh
npm ci
npm run db:migrate
npm run db:seed
npm run build
NODE_ENV=production HOST=127.0.0.1 npm start
```

En environnement compilé sans dépendances de développement : `npm run db:migrate:prod` et `npm run db:seed:prod`. Exécuter les migrations avant de basculer le service. Process manager recommandé pour redémarrage. SIGTERM interrompt les workers et ferme les connexions, délai de huit secondes.

## Docker Compose

Les fichiers sont fournis, mais un build Docker n’est pas une validation du déploiement réel. Ajouter POSTGRES_PASSWORD dans `.env` (une valeur aléatoire hexadécimale évite les caractères spéciaux d’URL).

```sh
docker compose build
docker compose up -d postgres
docker compose run --rm liora npm run db:migrate:prod
docker compose run --rm liora npm run db:seed:prod
docker compose up -d liora
```

L’app est exposée uniquement sur 127.0.0.1:4310 ; terminer TLS avec le proxy. PostgreSQL n’est pas exposé à l’hôte. Volumes persistants distincts pour base et fichiers. Configurer le backup de ces volumes.

## Proxy

Conserver Host et Origin, supporter SSE sans buffering et avec timeout >=75 secondes. Exemple Nginx pour `/api/v1/workspaces/` : `proxy_buffering off; proxy_read_timeout 90s;`. Limite de body >=1,5 Mo côté proxy, en accord avec le serveur. Ne pas journaliser les chemins `/api/webhooks/<token>` ou masquer leur dernier segment. Les tokens ne doivent pas figurer dans une métrique d’URL ou un log proxy.

## Mise en service

Renseigner KYROS_BASE_URL, KYROS_CLIENT_ID, KYROS_CLIENT_SECRET si client confidentiel, KYROS_RESOURCE_AUDIENCE et BOOTSTRAP_OWNER_KYROS_ID. `SESSION_SECRET` reste stable entre redémarrages et versions. `offline_access` permet les sessions renouvelables.

Liora doit être hébergé hors d’Argus. Configurer les cibles et heartbeat (ARGOS.md), le canal de webhook entrant, et les préférences d’alerte. Tester un vrai login et un refresh avant publication. Les limites par IP sont locales au processus ; plusieurs répliques nécessiteront un limiteur partagé ou au proxy.

## Variables

| Variable                              | Rôle                                                                |
| ------------------------------------- | ------------------------------------------------------------------- |
| DATABASE_URL                          | Connexion PostgreSQL, droits de migration lors des mises à jour     |
| APP_URL                               | Origine publique, callback et validation CSRF                       |
| PORT / HOST                           | Écoute, défaut 4310 / 127.0.0.1                                     |
| SESSION_SECRET                        | Clé >=32 caractères, générée aléatoirement                          |
| KYROS_BASE_URL                        | URL du serveur Kyros sans slash final                               |
| KYROS_CLIENT_ID / KYROS_CLIENT_SECRET | Application enregistrée, secret optionnel pour client public        |
| KYROS_ISSUER                          | Issuer attendu, défaut base Kyros                                   |
| KYROS_AUDIENCE                        | Audience JWT globale, défaut kyros-modules                          |
| KYROS_RESOURCE_AUDIENCE               | Audience ressource exacte, défaut kyros:liora                       |
| KYROS_SCOPES                          | profile email offline_access, prioritaire sur KYROS_REQUESTED_SCOPE |
| BOOTSTRAP_OWNER_KYROS_ID              | Sujet autorisé à réclamer LUMA au premier login                     |
| ARGOS_BASE_URL / ARGUS_HEALTH_URL     | Cibles opérateur de surveillance externe                            |
| MONITOR_INTERVAL_MS                   | Cadence des cycles, défaut 60000, minimum 10000                     |
| HEARTBEAT_TIMEOUT_SECONDS             | Péremption heartbeat, défaut 180                                    |
| UPLOAD_DIR                            | Stockage local, défaut ./uploads                                    |
| POSTGRES_PASSWORD                     | Mot de passe Docker Compose uniquement                              |
| TEST_DATABASE_URL / E2E_DATABASE_URL  | Bases jetables finissant par _test / _e2e                           |
| CHROME_PATH                           | Chemin Chrome pour les tests navigateur                             |

## Vérifications

`/health/live` vérifie le processus. `/health/ready` inclut PostgreSQL et la table de migrations. L’indisponibilité d’Argos ne dégrade pas ce healthcheck. Les logs JSON incluent timestamp, niveau, service, requestId, identité éventuelle et durée ; ni corps ni tokens.

## Finalisation 0.4 — 0.4.7

Appliquer `006_experience_complete.sql` avant de démarrer le nouveau serveur. Les workers rappels et push tournent indépendamment des contrôles Argos, à cadence nominale de 15 secondes. Web Push reste désactivé sans les trois variables `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. Génération privée des clés, consentement, réabonnement et vérification sur appareils : [EXPERIENCE_0.4.md](EXPERIENCE_0.4.md).
