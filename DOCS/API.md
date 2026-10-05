# API Liora v1

Base `/api/v1`. JSON, dates UTC ISO-8601, UUID. Authentification : cookie de session pour humains ; `Authorization: Bearer <token>` pour bots/services. En usage navigateur, les mutations exigent un en-tête Origin égal à APP_URL. Toute route d’espace contrôle son appartenance et sa permission atomique.

Réponse de liste `{data:[]}` ; objet `{data:{}}` ; action `{ok:true}`. Erreur `{error:{code,message,requestId}}`, sans stack. Codes HTTP : 400 validation, 401 session/token, 403 permission, 404 absent, 409 conflit/référence, 413 taille, 429 limite, 503 fournisseur temporairement inaccessible.

## Identité

| Méthode   | Route                  | Usage                                     |
| --------- | ---------------------- | ----------------------------------------- |
| GET       | `/auth/login`          | PAR et redirection Kyros                  |
| GET       | `/auth/callback`       | Validation code/state/iss, session        |
| POST      | `/auth/refresh`        | Refresh silencieux si proche d’expiration |
| POST      | `/auth/logout`         | Révocation locale et Kyros best effort    |
| GET/PATCH | `/api/v1/me`           | Profil et préférences                     |
| GET       | `/api/v1/sessions`     | Sessions du membre                        |
| DELETE    | `/api/v1/sessions/:id` | Révocation d’une session                  |
| POST      | `/api/v1/workspaces`   | Créer un espace et son rôle Owner         |

## Préfixe espace `/api/v1/workspaces/:workspace`

| Ressource            | Méthodes              | Champs principaux / permission                                                                            |
| -------------------- | --------------------- | --------------------------------------------------------------------------------------------------------- |
| `categories`         | GET POST PATCH DELETE | name, position / CREATE_CHANNEL, MANAGE_CHANNEL                                                           |
| `channels`           | GET POST PATCH DELETE | name, type, category_id, project_id, position, archived / VIEW_CHANNEL et gestion                         |
| `projects`           | GET POST PATCH DELETE | name, description / VIEW_PROJECT et gestion                                                               |
| `boards`             | GET POST PATCH DELETE | name, project_id / VIEW_BOARD, CREATE_BOARD, MANAGE_BOARD                                                 |
| `columns`            | GET POST PATCH DELETE | name, board_id, position / MANAGE_BOARD                                                                   |
| `tasks`              | GET POST PATCH DELETE | title, column_id, priority, tags, assignee, due_at, checklist, links, position / CREATE_TASK, MANAGE_TASK |
| `pages`              | GET POST PATCH DELETE | title, blocks ; PATCH exige revision / VIEW_PAGES, MANAGE_PAGES                                           |
| `members`            | GET POST PATCH        | POST kyros_user_id + role_id, PATCH role_id + state / MANAGE_MEMBERS                                      |
| `roles`              | GET POST PATCH        | name, permissions[] / MANAGE_ROLES et MANAGE_PERMISSIONS                                                  |
| `settings`           | PATCH                 | name, description, settings / MANAGE_WORKSPACE                                                            |
| `accounts`           | GET POST              | name, kind bot/service, permissions[] ; retourne token une fois                                           |
| `accounts/:id/token` | POST                  | `{revoke:true}` ou false pour rotation / MANAGE_BOT_TOKEN                                                 |
| `webhooks`           | GET POST DELETE       | name, channel_id, allow_tasks ; retourne URL une fois                                                     |
| `outbound`           | GET POST DELETE       | name, url ; retourne secret HMAC une fois                                                                 |
| `deliveries/:id`     | POST                  | action retry/cancel / MANAGE_WEBHOOK                                                                      |
| `flags`              | GET                   | Liste réservée MANAGE_FEATURE_FLAGS                                                                       |
| `flags/:key`         | PUT                   | `{enabled:false}` ; true rejeté pour modules différés                                                     |
| `audit`              | GET                   | 100 dernières actions / VIEW_AUDIT_LOG                                                                    |
| `events`             | GET POST              | lecture VIEW_MONITORING ; publication SEND_MESSAGE                                                        |
| `monitoring`         | GET                   | Cibles + 30 derniers checks / VIEW_MONITORING                                                             |
| `heartbeat`          | POST                  | Met à jour heartbeat / MANAGE_MONITORING                                                                  |
| `notifications`      | GET                   | Notifications personnelles                                                                                |
| `notifications/:id`  | PATCH                 | state read/dismissed                                                                                      |
| `presence`           | GET                   | Membres actifs avec opt-in                                                                                |
| `stream`             | GET                   | SSE, Last-Event-ID, invalidations sans contenu                                                            |
| `attachments`        | GET POST              | name, data base64 (1 Mo) / SEND_MESSAGE humain                                                            |
| `attachments/:id`    | GET                   | Fichier avec autorisation workspace                                                                       |
| `emojis`             | GET POST PATCH DELETE | name, attachment_id ; image <=256 Ko / MANAGE_EMOJIS                                                      |

GET d’une collection générique renvoie au plus 500 lignes et `nextCursor` ; poursuivre avec `?after=<curseur>` (et `limit` optionnel). Membres et rôles suivent aussi ce contrat. PATCH conserve les champs omis. Les routes d’objet utilisent `/:id`. Suppression de salon = archivage pour préserver l’historique.

## Messages et tâches

- GET `channels/:channel/messages?before=<uuid>` : 50 messages, ordre chronologique, `nextCursor` ou null.
- POST `channels/:channel/messages` : `{content,reply_to?}`, SEND_MESSAGE ; salons announcement exigent aussi MANAGE_CHANNEL.
- PATCH `messages/:id` : `{content}` pour l’auteur avec EDIT_OWN_MESSAGE.
- DELETE `messages/:id` : auteur ou MANAGE_MESSAGES.
- POST `messages/:id/reactions` : `{emoji:"👍"}` ou `{emoji:":custom_name:"}`, bascule la réaction de l’acteur.
- GET/PUT `channels/:channel/follow` : `{following,muted}`.
- GET/POST `tasks/:id/comments` : `{content}`.
- Mention : `@[uuid-du-membre]`. Les liens restent du texte cliquable sans récupération serveur de leur destination.
- Déplacement de carte : PATCH `tasks/:id` avec column_id et position. Les références restent dans le même espace.
- Page : blocks `{type,content,checked?}` ; types texte/heading/list/checklist/code/quote/divider/link. Révision obsolète : REVISION_CONFLICT 409.

## Webhook entrant

POST `/api/webhooks/:token`, hors préfixe v1 pour URL stable. Voir WEBHOOKS.md. Endpoint public porteur d’un secret, aucune session humaine.

## Santé

GET `/health/live` : processus ; `/health` et `/health/ready` : DB/migrations joignables. La panne d’un service externe ne rend pas Liora unhealthy.

## Ajouts 0.2.0

Préfixe `/api/v1/workspaces/:workspace` :

- `GET /channels` filtre les salons autorisés. `POST /channels` accepte `is_private`.
- `GET|PUT /channels/:id/access` : membres autorisés, PUT `{user_ids: uuid[]}` réservé à MANAGE_CHANNEL, hors conversations directes.
- `POST /conversations` : `{user_id}`, conversation à deux idempotente par paire.
- `GET /channels/:id/messages?thread=:message&before=:cursor` : réponses d’un fil, 50 par page. `?pinned=true` liste les épingles.
- `POST /channels/:id/messages` accepte `thread_id` et `attachment_ids`. CREATE_THREAD est nécessaire pour répondre dans un fil.
- `PUT /messages/:id/pin` : `{pinned: boolean}`, MANAGE_MESSAGES requis.
- `GET /search?q=:mots&before=:cursor` : mots entiers, résultats récents, 50 par page, accès contrôlé.
- `POST /attachments` accepte `channel_id` ; un fichier de salon conserve les mêmes droits au téléchargement.
- SSE `access.updated` demande une relecture de `/api/v1/me`. Les autres invalidations exposent uniquement `workspace.changed`.

Les salons monitoring nécessitent VIEW_MONITORING en plus de VIEW_CHANNEL. Créer un salon monitoring nécessite MANAGE_MONITORING. Les DMs n’accordent aucun contournement au rôle Admin.

## Ajouts 0.2.1

Routes globales `/api/v1` (session humaine) :

- GET `friends`, DELETE `friends/:id` ; GET/POST `invitations`, DELETE `invitations/:id` ; GET `invitations/token/:token`, POST `invitations/token/:token/accept`.
- POST `me/avatar` : image base64 ; GET `avatars/:id` : image après authentification.
- GET/POST `integrations`, DELETE `integrations/:id` : raccourcis personnels `{name,url}` HTTPS.

Routes sous `/api/v1/workspaces/:workspace` :

- GET/POST `groups`, PUT/DELETE `groups/:id` ; GET/PUT `channels/:id/groups`.
- CRUD `templates` ; tâches enrichies `participants`, `attachment_ids`, `revision` ; GET `tasks/:id/activity`.
- POST `attachments` accepte `task_id` ou `channel_id`, exclusifs ; GET `attachments/:id?metadata=true` retourne les métadonnées après contrôle d’accès.
- PATCH `pages/:id` accepte `revision`, `base_blocks` et `blocks` pour la fusion ; GET `pages/:id/history`, GET/POST `pages/:id/comments`, GET `pages/:id/embeds/:block`. L’aperçu d’un bloc non enregistré utilise `draft=true&type=…&content=…` et exige MANAGE_PAGES.
- GET `messages/:id` pour l’accès direct ; les messages renvoient les noms des mentions et l’avatar de l’auteur.
- GET `link-preview?url=…`, GET `channels/:id/media?url=…` : récupérateur contrôlé, accès au salon obligatoire pour le média.

Préférences personnelles ajoutées : `theme: dusk`, `dmPolicy: members|friends|nobody`, catégories `messages`, `directMessages`, `tasks`, sons `soundMessages`, `soundMentions`, `soundCritical`, `soundVolume`. Voir les schémas de `app.ts` pour les valeurs exactes.

## Ajouts 0.3.0

Connecteurs, comptes personnels DropIt, règles, configuration de supervision et commandes : routes et authentification détaillées dans [INTEGRATIONS.md](INTEGRATIONS.md). Les identités personnelles sont déduites de la session, jamais d’un ID libre.

## Correctif 0.4.6 — réception heartbeat

`POST /api/v1/workspaces/:workspace/heartbeat` exige `MANAGE_MONITORING`. Pour un émetteur distant, utiliser un jeton de service Liora de cet espace. La cible `Heartbeat Argos` est créée si absente ; succès : `{ "ok": true, "received_at": "date ISO UTC" }`. Le prochain contrôle du worker calcule l’état et publie sa transition. Une cible homonyme d’un type incompatible renvoie 409. Installation et codes d’erreur dans [ARGOS.md](ARGOS.md).

## Expérience 0.4 finalisée (0.4.7)

Routes sous `/api/v1/workspaces/:workspace` :

| Route                         | Méthodes                  | Contrat / permission                                                                                                                         |
| ----------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `calendar`                    | GET, POST                 | Liste d’occurrences `start/end` (dates inclusives) et `timezone` ; lecture VIEW_WORKSPACE, création humaine CREATE_CALENDAR_EVENT.           |
| `calendar/:id`                | GET, PATCH, DELETE        | Lecture de la série ; mutation par l’auteur ou MANAGE_CALENDAR, avec accès au salon lié.                                                     |
| `reminders` / `reminders/:id` | GET, POST / PATCH, DELETE | Rappels personnels humains, VIEW_WORKSPACE ; dates ISO avec offset, fuseau IANA, références validées.                                        |
| `favorites` / `favorites/:id` | GET, POST / PATCH, DELETE | Favoris personnels ; type channel/message/page/project/task/event, autorisation de la ressource recontrôlée.                                 |
| `push/vapid-public-key`       | GET                       | État de configuration, clé publique et abonnement de la session ; humain membre de l’espace.                                                 |
| `push/subscribe`              | POST, DELETE              | Abonnement navigateur lié à la session ; endpoint HTTPS public, clés p256dh/auth. DELETE sans endpoint retire les abonnements de la session. |
| `push/test`                   | POST                      | Notification de test personnelle mise en file (202), après abonnement.                                                                       |
| `search`                      | GET                       | Texte `q`, filtres `channel`, `author`, `from/until` ISO (fin exclusive), curseur `before` ; VIEW_CHANNEL et visibilité réelle des salons.   |

Les événements acceptent `end_at` (nullable), `timezone`, `recurrence`, `all_day`, `channel_id`, `color` hex et `reminder_minutes` (rappel de l’auteur). Les occurrences renvoient aussi `series_start_at`, `series_end_at` et `occurrence_id`. PATCH modifie toute la série.

Rappels : `title`, `body`, `remind_at`, `timezone`, `recurring`, `recurring_interval` et références optionnelles `channel_id/message_id/task_id`. PATCH accepte également `state`. `pending` inclut les reportés dans le filtre GET ; `done` inclut les archivés. L’intervalle est obligatoire pour un rappel récurrent.

## Espace personnel — 0.5.0

Routes globales réservées aux humains authentifiés. Elles ne dépendent pas d’un workspace. Les clés techniques d’espace n’y donnent aucun accès.

| Méthode | Route relative à `/api/v1`                        | Contrat                                                                                                                                                                                                                                                                                                                                                           |
| ------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET     | `/friends`                                        | Amis et présence ; `unread_count` et `last_message` concernent uniquement la conversation du lecteur avec chaque ami.                                                                                                                                                                                                                                             |
| GET     | `/friends/:id/messages?before=<uuid>`             | Amitié actuelle obligatoire. Les 50 messages les plus récents dans l’ordre chronologique, `nextCursor` pour les plus anciens. Curseur limité à cette paire.                                                                                                                                                                                                       |
| POST    | `/friends/:id/messages`                           | `{content,client_id}` UUID client unique par émetteur. Idempotent si contenu et destinataire identiques ; 409 sinon. Amitié, compte actif et politique de réception vérifiés ; aucune exigence de présence.                                                                                                                                                       |
| POST    | `/friends/:id/messages/read`                      | `{through:<uuid>}` marque uniquement les messages reçus de cet ami jusqu’au message indiqué.                                                                                                                                                                                                                                                                      |
| GET     | `/places/categories`                              | Registre des catégories actives `{key,name}` ; Burger King initial.                                                                                                                                                                                                                                                                                               |
| GET     | `/places/search?q=&latitude=&longitude=&nearby=1` | Recherche explicite Photon/OpenStreetMap, réservée aux humains. Centre validé ; au plus 20 lieux libres dans l’ordre fournisseur. nearby=1 est facultatif et limite à 15 km avec tri par distance. MacDo/McDo sont normalisés en McDonald’s, réponse `{data,area}` sans suivi privé. Aucun ajout en base. 12 recherches/minute/compte, cache partagé dix minutes. |
| GET     | `/places?south=&north=&west=&east=&q=&after=`     | Zone validée, passage de l’antiméridien accepté ; 200 lieux et `nextCursor`. Seul le suivi personnel du lecteur est joint.                                                                                                                                                                                                                                        |
| GET     | `/places/mine`                                    | Collection personnelle, notes comprises ; au plus 1 000 lieux.                                                                                                                                                                                                                                                                                                    |
| POST    | `/places`                                         | `{category,name,address,latitude,longitude,entry}`. Coordonnées arrondies à 6 décimales ; réutilise le même lieu si catégorie/coordonnées identiques, sans changer ses informations partagées.                                                                                                                                                                    |
| PUT     | `/places/:id/entry`                               | `{state,visibility,visited_on,notes}` : état wishlist ou visited, visibilité private/friends/community, date ISO ou null. Modifie exclusivement le suivi de l’auteur ; À essayer ne partage aucune visite.                                                                                                                                                        |
| DELETE  | `/places/:id/entry`                               | Retire seulement l’entrée et les notes de l’auteur, sans effacer le lieu ni les entrées d’autrui.                                                                                                                                                                                                                                                                 |
| GET     | `/places/:id/visitors`                            | Noms/avatars des visiteurs autorisés : soi, visites communautaires, ou visites partagées par les amis actuels. Pas de notes/date. Limite 100.                                                                                                                                                                                                                     |

Les messages de salon acceptent désormais `timezone` optionnel (IANA, UTC par défaut). Les `detectedDates` renvoient `{originalText,index,start,end?,allDay,timezone}` et utilisent `created_at` / `detection_timezone` stockés ; les instants sont sérialisés en ISO UTC. Les profils acceptent les thèmes `atelier`, `orbit`, `terminal` en plus des six existants.

## 0.6 — navigation et Gotify

Toutes ces routes exigent une session humaine. Les mutations suivent le contrôle Origin habituel.

- `PATCH /api/v1/me/navigation` : `{collapsedNavigation: string[]}`. Met à jour cette seule préférence ; les clés de salon comprennent l’identifiant du workspace.
- `GET /api/v1/gotify` : `{connection: {url,enabled}|null, deliveries: [{id,state,attempts,last_error,created_at}]}`. Les données sont personnelles, vingt envois maximum, aucun token.
- `PUT /api/v1/gotify` : `{url,token?,enabled}`. URL publique HTTPS/443 sans query/hash/credentials, token d’application requis pour une nouvelle destination, token chiffré. Remplacement/arrêt annule les envois pendants ou échoués.
- `DELETE /api/v1/gotify` : déconnecte et supprime la file associée.
- `POST /api/v1/gotify/test` : `{workspace: uuid}`, membership actif et VIEW_WORKSPACE requis. Réponse 202 : test en file.
- `POST /api/v1/gotify/deliveries/:id/retry` : relance un échec personnel si la connexion est active. Droits réévalués par le worker.
- `POST /api/v1/gotify/deliveries/:id/cancel` : annule un envoi personnel pending/failed. Autre état ou autre compte : 409.
- `GET /api/v1/avatars/:id` : conserve l’avatar local prioritaire ; sinon image Kyros contrôlée, cache privé de cinq minutes. Image absente/indisponible : 404, initiales côté interface.

Le format stocké des messages et blocs reste texte ; le rendu Markdown n’ajoute aucun HTML stocké. Les API projets/tableaux/cartes/pages conservent leurs contrats.

## Notes et agendas — 0.7.0

Toutes les routes ci-dessous, sauf `/dav/`, demandent la session humaine Kyros de Liora. Aucune clé technique n’accède aux notes ni aux connexions personnelles.

| Route | Fonction |
| --- | --- |
| `GET /api/v1/notes?before=<uuid>` | Notes personnelles triées par date/id, 100 par page et `nextCursor`. |
| `POST /api/v1/notes` | `{title,content,due_at}` ; date ISO avec offset obligatoire. |
| `PATCH/DELETE /api/v1/notes/:id` | Notes Liora du propriétaire ; copies BrainDump en lecture seule. |
| `GET/PUT /api/v1/braindump` | État/configuration disponible ; `{enabled}` pour lier/délier le compte. |
| `POST /api/v1/braindump/sync` | Copie datée sous identité Kyros vérifiée, transactionnelle. |
| `PATCH /api/v1/me/appearance` | Fusion atomique de `{theme?,density?,fontSize?}`, dix thèmes dont `lagoon`. |
| `GET /api/v1/calendar-sync` | Accès CalDAV, serveur et identifiant ; aucun mot de passe retourné. |
| `POST /api/v1/calendar-sync` | `{name}` ; mot de passe aléatoire affiché une seule fois, maximum dix appareils. |
| `DELETE /api/v1/calendar-sync/:id` | Révocation limitée au compte courant. |
| `GET /api/v1/google-calendar` | Connexion, statut, périmètre et conflits, sans jetons. |
| `POST /api/v1/google-calendar/connect` | URL OAuth Google, état et PKCE liés à la session. |
| `GET /api/v1/google-calendar/callback` | Consomme l’état à usage unique, échange le code et revient aux préférences. |
| `GET /api/v1/google-calendar/calendars` | Agendas Google où le compte peut écrire. |
| `PUT /api/v1/google-calendar` | `{workspace_id,calendar_id,enabled}` ; événements de l’auteur hors salons privés. |
| `POST /api/v1/google-calendar/sync` | Passage manuel ; `{ok,count,conflicts?}` ou `{ok:false,error}` affiché en UI. |
| `POST /api/v1/google-calendar/resolve` | `{google_id,version:"liora"|"google"}` ; choix personnel et synchronisation. |
| `DELETE /api/v1/google-calendar` | Supprime autorisation/liens locaux ; événements existants conservés. |

CalDAV sous `/dav/`, découverte `/.well-known/caldav` : Basic avec identifiant de compte et accès par appareil, HTTPS hors localhost. OPTIONS, PROPFIND Depth 0/1, REPORT calendar-query/multiget, GET/HEAD, PUT et DELETE. PUT/DELETE d’un événement existant exigent son ETag exact par `If-Match` ; une version obsolète retourne 412. Répétitions simples/ancrées et droits calendrier existants ; les notes datées forment une collection personnelle en lecture seule. Formats et limites dans RELEASE_0.7.0.md.

## Intégration BrainDump — 0.7.1

`POST /api/v1/workspaces/:id/connectors` accepte aussi `provider: "braindump"`, avec `name`, `api_key` et `config: {base_url,client_id,allow_private?}`. Aucun salon, webhook entrant ou compte technique n’est créé pour ce fournisseur. Les droits d’administration et la politique réseau habituelle s’appliquent. Le test de capacités exige le protocole 1, le même émetteur Kyros et le scope `notes:dated:read`.

Les routes personnelles `POST /api/v1/workspaces/:id/connections/:integration/start` et `DELETE /api/v1/workspaces/:id/connections/:integration` utilisent le même consentement PKCE que DropIt ; l’état est lié à la session humaine. `/api/v1/integration-callback` exige le même sujet Kyros, chiffre les accès et refuse un état déjà consommé. Une déconnexion ou une désactivation retire les copies personnelles ; les notes originales BrainDump restent intactes.

`GET /api/v1/braindump` ajoute `available`, liste des intégrations visibles et du consentement personnel, et `data.integration_id`. `PUT` accepte `{enabled,integration_id?}` ; l’activation exige une intégration testée et une autorisation personnelle. `POST /api/v1/braindump/sync` lit un instantané complet de 500 notes datées maximum, sous l’identité du propriétaire. Une autorisation révoquée renvoie 409 `CONNECT_REQUIRED` et supprime les copies ; une panne réseau conserve le cache. Le relais par variables d’environnement reste compatible pour les installations 0.7.0 sans intégration choisie.

Protocole du fournisseur, configuration et migrations : [RELEASE_0.7.1.md](RELEASE_0.7.1.md) et `BrainDump/DOCS/LIORA_2.1.0.md` dans le dépôt voisin.
