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
