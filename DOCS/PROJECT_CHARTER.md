Tu es l’architecte logiciel principal, développeur full-stack senior, DevOps et product designer chargé de construire un nouveau produit complet dans un dossier actuellement vide.

# 1. OBJECTIF GLOBAL

Construire une application collaborative moderne inspirée principalement de :

- Discord pour les salons, channels, messages, réactions, bots et temps réel
- Notion pour les pages, organisation, documentation, blocs et gestion de projet
- Trello / Linear pour le Kanban et le suivi de tâches
- Slack pour les intégrations et automatisations
- Grafana / systèmes de monitoring pour certaines vues techniques

L’application doit devenir un Workspace central pour l’écosystème LUMA.

Elle doit permettre de :

- discuter en temps réel
- créer des espaces, catégories et channels
- gérer des projets
- créer des Kanban
- documenter des projets
- recevoir des événements d’applications externes
- héberger des bots
- recevoir et envoyer des webhooks
- superviser Argus / Argos
- centraliser les notifications des applications LUMA
- offrir une API solide pour les futures intégrations

Le projet doit être réellement fonctionnel, stable, maintenable et évolutif.

Il ne s’agit PAS d’une maquette.

---

# 2. CONTRAINTE MAJEURE

Le dossier actuel est vide.

Tu dois travailler directement à la racine.

Ne pose aucune question.

Prends toi-même les décisions raisonnables lorsque quelque chose n’est pas explicitement défini.

Tu dois documenter tes choix.

Tu dois toujours privilégier :

- stabilité
- simplicité
- sécurité
- maintenabilité
- performances
- bonne UX
- architecture extensible

Évite le sur-engineering.

---

# 3. TECHNOLOGIES

Base de données obligatoire :

PostgreSQL

Pour le reste, choisis toi-même une stack moderne, stable et adaptée.

Stack recommandée si aucun choix meilleur n’est justifié :

Frontend :

- Next.js récent stable
- React
- TypeScript
- Tailwind CSS

Backend :

- API intégrée Next.js ou backend Node.js séparé si cela améliore réellement l’architecture
- TypeScript

Base :

- PostgreSQL
- Prisma ORM ou équivalent mature

Temps réel :

- WebSocket ou Socket.IO
- SSE autorisé pour certains événements simples

Validation :

- Zod

Authentification :

- intégration Kyros SSO

Tests :

- tests unitaires
- tests d’intégration
- tests critiques E2E

Tu dois garder les dépendances au strict nécessaire.

---

# 4. NOM DU PRODUIT

Le produit n’a pas encore de nom définitif.

Tu dois :

1. analyser le concept
2. proposer plusieurs noms cohérents avec l’écosystème LUMA
3. sélectionner le meilleur
4. expliquer brièvement le choix dans la documentation
5. utiliser ce nom dans tout le produit

Le nom doit être :

- court
- identifiable
- moderne
- compatible avec l’univers LUMA
- utilisable comme nom de produit

Évite les noms génériques type :

- Workspace
- Chat
- Team
- Hub

Tu dois également créer une identité visuelle initiale.

---

# 5. LOGO

Créer un logo simple et exploitable.

Prévoir :

- logo principal
- icône carrée
- favicon
- version claire
- version sombre

Format privilégié :

SVG.

Le logo doit rester simple, moderne et facilement animable plus tard.

Si tu ne peux pas produire directement certains assets graphiques :

crée :

DOCS/demande_assets.txt

avec exactement les ressources nécessaires à récupérer ou générer.

Exemple :

Nom :
Description :
Format :
Dimensions :
Utilisation :
Source suggérée :

Tu peux utiliser Internet pour récupérer des informations, bibliothèques, sons libres ou ressources nécessaires lorsque cela est légalement et techniquement pertinent.

Ne récupère pas d’assets douteux ou soumis à des licences incompatibles.

---

# 6. CHARTE DIRECTRICE DU PROJET

Créer obligatoirement :

PROJECT_CHARTER.md

Cette charte doit devenir la référence permanente du projet.

Toute IA ou tout développeur travaillant sur le projet doit la lire avant toute modification importante.

Elle doit contenir au minimum :

- nom du produit
- vision
- objectif
- philosophie
- principes UX
- principes techniques
- architecture
- règles de sécurité
- conventions de développement
- conventions API
- conventions DB
- gestion du temps réel
- gestion des bots
- gestion des permissions
- intégration Kyros
- intégration Argos
- règles Feature Flags
- règles de versioning
- roadmap
- fonctionnalités interdites ou différées
- structure du repository
- définition de Done
- exigences de qualité

Ajouter clairement :

"Avant tout développement significatif, lire PROJECT_CHARTER.md."

---

# 7. VERSIONNING

Le projet commence obligatoirement en :

0.1.0 — ALPHA

Prévoir un système clair de versionning.

Utiliser Semantic Versioning :

MAJOR.MINOR.PATCH

Créer :

VERSION

ou équivalent centralisé.

Afficher la version :

- dans l’administration
- dans About / informations produit
- éventuellement dans les logs au démarrage

Créer :

CHANGELOG.md

Chaque évolution importante doit être documentée.

---

# 8. ROADMAP

Créer :

ROADMAP.md

Roadmap initiale recommandée :

## 0.1 — ALPHA

Fondations :

- architecture
- PostgreSQL
- authentification Kyros
- utilisateurs
- workspaces
- rôles
- permissions
- catégories
- channels
- chat
- messages
- réactions emojis
- notifications
- bots
- webhooks
- Kanban
- monitoring Argus / Argos
- administration
- paramètres utilisateur
- logs d’audit
- feature flags

## 0.2 — ALPHA

Collaboration avancée :

- threads
- messages épinglés
- recherche
- pièces jointes améliorées
- pages
- blocs
- documentation interne
- commentaires
- tâches enrichies
- templates
- automatisations simples

## 0.3 — BETA

Intégrations avancées :

- Argos enrichi
- Nino
- Narra
- GitHub
- API bots étendue
- dashboard d’intégrations
- événements inter-modules
- règles automatiques

## 0.4 — BETA

Expérience utilisateur :

- calendrier
- rappels
- meilleure recherche
- raccourcis clavier
- notifications desktop / push
- meilleure gestion mobile
- thèmes avancés

## 0.5 — BETA

Fonctions média optionnelles :

- fonctionnalités Jellyfin
- demandes de films / séries

Ces fonctionnalités sont FEATURE FLAGGED et désactivées par défaut.

## 1.0 — STABLE

Objectifs :

- sécurité validée
- migrations stables
- système de backup
- monitoring
- tests critiques complets
- API documentée
- UX consolidée
- optimisation performances
- migration stable des versions ALPHA/BETA

Tu peux ajuster la roadmap si une organisation meilleure est justifiée.

---

# 9. AUTHENTIFICATION KYROS

Kyros sert UNIQUEMENT à authentifier l’utilisateur.

Kyros peut fournir :

- Kyros User ID
- identité utilisateur
- informations de profil utiles
- indicateur admin global Kyros éventuellement

IMPORTANT :

Les permissions réelles du Workspace NE SONT PAS gérées par Kyros.

Le Workspace possède son propre système :

- rôles
- permissions
- membres
- groupes
- accès

Exemple :

Kyros :
user_id = abc123
admin = true

Workspace :
role = moderator

Le rôle Workspace reste géré localement.

Un administrateur Kyros peut éventuellement obtenir un comportement spécial lors du premier login selon les règles documentées, mais il ne doit pas remplacer le système de permissions interne.

Stocker obligatoirement :

kyros_user_id

comme identifiant externe de référence.

---

# 10. TYPES DE COMPTES

Prévoir :

- Owner
- Admin
- Moderator
- Member
- Bot
- Service

Les rôles humains doivent être personnalisables.

Les Bots et Services ne doivent pas être traités comme de simples utilisateurs.

---

# 11. PERMISSIONS

Créer un système de permissions atomiques.

Exemples :

Workspace :

- VIEW_WORKSPACE
- MANAGE_WORKSPACE
- MANAGE_MEMBERS
- MANAGE_ROLES
- MANAGE_PERMISSIONS

Channels :

- VIEW_CHANNEL
- CREATE_CHANNEL
- MANAGE_CHANNEL
- DELETE_CHANNEL

Messages :

- SEND_MESSAGE
- EDIT_OWN_MESSAGE
- DELETE_OWN_MESSAGE
- MANAGE_MESSAGES
- ADD_REACTION
- CREATE_THREAD

Bots :

- VIEW_BOTS
- CREATE_BOT
- MANAGE_BOT
- MANAGE_BOT_TOKEN

Webhooks :

- VIEW_WEBHOOKS
- CREATE_WEBHOOK
- MANAGE_WEBHOOK
- DELETE_WEBHOOK

Projects :

- VIEW_PROJECT
- CREATE_PROJECT
- MANAGE_PROJECT

Kanban :

- VIEW_BOARD
- CREATE_BOARD
- MANAGE_BOARD
- CREATE_TASK
- MANAGE_TASK

Monitoring :

- VIEW_MONITORING
- MANAGE_MONITORING

Administration :

- VIEW_AUDIT_LOG
- MANAGE_SECURITY
- MANAGE_FEATURE_FLAGS

Les permissions doivent être extensibles.

---

# 12. WORKSPACES

Prévoir un vrai système de Workspace.

Un Workspace contient :

- membres
- rôles
- channels
- catégories
- bots
- webhooks
- projets
- boards
- pages
- intégrations
- paramètres
- notifications
- audit logs

Prévoir l’architecture pour plusieurs Workspaces, même si l’installation initiale n’en utilise qu’un.

---

# 13. CHANNELS

Un administrateur autorisé doit pouvoir :

- créer
- modifier
- renommer
- déplacer
- réordonner
- archiver
- supprimer

des channels.

Prévoir les catégories.

Exemple :

INFRA
#general
#argos
#alerts
#deployments

ARC
#general
#production
#assets

Types initiaux :

- text
- announcement
- project
- monitoring

Prévoir une architecture permettant plus tard :

- vocal
- vidéo
- forum

sans les implémenter immédiatement.

---

# 14. CHAT

Le chat doit être temps réel.

Fonctions initiales :

- messages
- édition
- suppression
- réponses
- mentions
- emoji
- réactions emoji
- timestamps
- présence basique
- système de messages
- messages de bots
- messages de services
- liens
- previews contrôlées

Préparer l’architecture pour les threads.

---

# 15. EMOJIS

Support :

- emojis Unicode
- réactions
- emojis personnalisés du Workspace

Administration :

- ajout
- modification du nom
- suppression

---

# 16. PROJETS

Créer une notion de Project.

Un projet peut contenir :

- description
- membres
- channels liés
- boards
- pages
- tâches
- fichiers
- intégrations
- activité

Exemples :

ARC
Argos
Nino
Narra

---

# 17. KANBAN

Créer un vrai Kanban.

Un Board contient :

- colonnes
- cartes
- ordre
- filtres

Une carte contient :

- titre
- description
- priorité
- statut
- tags
- responsable
- participants
- échéance
- checklist
- commentaires
- activité
- pièces jointes
- liens vers messages
- liens vers pages
- liens vers modules LUMA externes

Les cartes doivent pouvoir être déplacées par Drag & Drop.

---

# 18. PAGES / DOCUMENTATION

Prévoir une architecture type Notion légère.

Une Page peut contenir des Blocks.

Blocks initiaux :

- texte
- titre
- liste
- checklist
- code
- citation
- séparateur
- lien
- Kanban intégré
- messages récents
- statistiques
- intégration externe

Ne cherche pas à reconstruire Notion complet en 0.1.

---

# 19. BOTS

Les bots sont des identités techniques.

Un Bot possède :

- id
- nom
- description
- avatar
- token
- permissions
- workspace
- date création
- dernière utilisation
- état
- révocation

Le token doit être stocké correctement et sécurisé.

Le token brut ne doit pas être stocké en clair si évitable.

Un bot doit pouvoir via API selon permissions :

- envoyer un message
- éditer ses messages
- ajouter une réaction
- créer une tâche
- créer un channel
- récupérer les channels
- récupérer certaines informations du Workspace
- publier un événement

Prévoir la révocation de token.

---

# 20. SERVICES

Créer aussi un type Service.

Exemples :

Argos
Nino
Narra
GitHub
Syncthing

Un Service représente une application externe.

Il peut avoir :

- identité
- token
- permissions
- webhooks
- intégrations
- événements

---

# 21. WEBHOOKS

Créer un système complet de Webhooks entrants.

Exemple :

POST /api/webhooks/:token

Un webhook doit pouvoir :

- envoyer un message
- publier un événement
- créer une tâche si autorisé
- cibler un channel

Sécurité :

- token sécurisé
- révocation
- logs
- rate limiting
- validation du payload

Prévoir éventuellement signature HMAC.

---

# 22. EVENT SYSTEM

Créer un modèle événementiel interne simple.

Exemples :

argos.alert.created
argos.server.down
nino.video.ready
narra.scene.updated
project.task.created
workspace.channel.created

Chaque événement contient idéalement :

- id
- type
- source
- timestamp
- actor
- payload
- metadata

Ces événements peuvent être :

- persistés
- affichés
- routés
- transformés en notifications

Éviter de construire un Kafka miniature.

---

# 23. ARGOS

Le Workspace doit intégrer Argos.

Argos reste le système principal de supervision.

Le Workspace :

- reçoit les alertes Argos
- peut afficher les alertes
- peut créer des messages
- peut créer des tâches
- peut afficher certains états Argos

---

# 24. SURVEILLANCE ARGUS / ARGOS

Cas particulier important :

Argos fonctionne sur le serveur Argus.

Si Argus tombe, Argos ne peut plus s’auto-surveiller.

Le Workspace doit donc assurer une surveillance externe minimale de :

- serveur Argus
- API Argos
- heartbeat Argos

Le Workspace ne remplace PAS Argos.

Il surveille uniquement le superviseur lui-même.

Architecture :

SERVEURS
→ Argos
→ Workspace

Workspace
→ surveillance Argus / Argos uniquement

Afficher :

- statut Argos
- dernier heartbeat
- disponibilité API
- latence
- dernier événement
- historique simple

Si Argos devient inaccessible :

créer automatiquement une alerte interne.

Exemple :

ARGOS CORE DOWN
Last heartbeat : X
API : unavailable

Prévoir notification critique.

---

# 25. NOTIFICATIONS

Créer un centre de notifications.

Types :

- mention
- message
- DM futur
- tâche
- événement système
- alerte
- Argos critique
- bot
- intégration

Statuts :

- unread
- read
- dismissed

Prévoir :

- préférences utilisateur
- priorité
- mute
- suivi de channels

---

# 26. PARAMÈTRES UTILISATEUR

Créer les sections suivantes :

## Profil

- pseudo
- avatar
- statut
- bio courte

## Apparence

- thème
- densité
- taille du texte

## Notifications

- mentions
- messages directs
- salons suivis
- tâches
- alertes critiques
- Argos

## Sons

- messages
- mentions
- alertes
- Argos critique
- appels futur

Si des sons sont nécessaires et indisponibles :

DOCS/demande_assets.txt

## Confidentialité

- qui peut envoyer un MP
- visibilité du statut
- présence

## Préférences Chat

- Entrée pour envoyer
- affichage emoji
- aperçu des liens
- timestamps

## Sessions / appareils

- voir les sessions
- appareil
- IP si approprié
- dernière activité
- révocation de session

## Intégrations personnelles

Préparer :

- GitHub
- autres intégrations futures

---

# 27. ADMINISTRATION

Créer une vraie interface Admin.

Navigation recommandée :

Overview
Members
Roles & Permissions
Channels
Projects
Bots
Webhooks
Integrations
Monitoring
Notifications
Security
Storage
Audit Logs
Emojis
Feature Flags
Workspace Settings

---

# 28. WORKSPACE SETTINGS

Permettre :

- nom
- logo
- description
- domaine
- paramètres généraux
- préférences régionales
- options UX globales

---

# 29. UTILISATEURS

Administration :

- liste
- recherche
- rôle
- statut
- ban
- disable
- réactivation
- historique raisonnable
- date dernière connexion

Ne jamais supprimer brutalement des données nécessaires aux audits.

---

# 30. SECURITY

Administration sécurité :

- configuration Kyros
- restrictions sessions
- rotation secrets
- tokens bots
- tokens webhook
- rate limits
- restrictions IP éventuelles
- logs sécurité

Ne jamais exposer les secrets côté frontend.

---

# 31. AUDIT LOG

Enregistrer les actions administratives importantes.

Exemples :

- rôle modifié
- channel supprimé
- bot créé
- token révoqué
- utilisateur banni
- webhook créé
- feature flag activé
- paramètres sécurité modifiés

Audit :

actor
action
target
timestamp
metadata

---

# 32. STOCKAGE

Prévoir la gestion de pièces jointes.

Architecture compatible :

- stockage local initial
- S3 / MinIO futur

Ne pas coupler toute l’application au filesystem local.

Créer une couche StorageProvider.

---

# 33. BACKUP

Préparer :

- documentation backup PostgreSQL
- sauvegarde configuration
- restauration

Créer :

DOCS/BACKUP.md

Ne pas nécessairement créer une usine automatique complexe en 0.1.

---

# 34. FEATURE FLAGS

Créer un vrai système de Feature Flags.

Minimum :

jellyfin.enabled = false

media_requests.enabled = false

Ces fonctionnalités doivent être réellement désactivées.

IMPORTANT :

Quand une feature est désactivée :

- aucun lien dans la navigation
- aucune page accessible normalement
- aucun bouton
- aucun appel API inutile
- aucune interface visible

---

# 35. JELLYFIN

Prévoir une future fonctionnalité Jellyfin.

Mais elle est DÉSACTIVÉE.

Ne pas afficher :

- page Jellyfin
- lien Jellyfin
- menu Jellyfin

Préparer uniquement l’architecture nécessaire pour pouvoir l’ajouter plus tard proprement.

---

# 36. DEMANDES DE FILMS / SÉRIES

Prévoir une future fonctionnalité permettant aux utilisateurs de demander :

- film
- série

Mais elle est DÉSACTIVÉE.

Aucun :

- lien
- bouton
- page visible

en 0.1.

Préparer via Feature Flag.

---

# 37. INTÉGRATIONS

Préparer un système générique d’intégration.

Intégrations futures ou initiales :

- Argos
- Nino
- Narra
- GitHub
- Syncthing
- Jellyfin
- autres modules LUMA

Une intégration peut contenir :

- configuration
- secrets
- état
- événements supportés
- actions supportées
- channels de destination
- logs

---

# 38. NINO

Prévoir réception des événements Nino.

Exemples :

nino.video.created
nino.video.ready
nino.transcoding.started
nino.transcoding.completed
nino.transcoding.failed

Ces événements peuvent alimenter un channel.

---

# 39. ARCHITECTURE API

Créer une API propre et versionnable.

Exemple :

/api/v1/...

Documenter l’API.

Créer :

DOCS/API.md

Préparer éventuellement OpenAPI.

---

# 40. ERREURS

Toutes les API doivent retourner des erreurs structurées.

Format recommandé :

{
"error": {
"code": "CHANNEL_NOT_FOUND",
"message": "Channel not found",
"requestId": "..."
}
}

Ne jamais retourner de stack trace au client en production.

---

# 41. LOGGING

Créer un système de logs structuré.

Inclure :

- timestamp
- level
- service
- requestId
- userId éventuel
- message

Prévoir :

- development
- production

Les secrets ne doivent jamais être loggés.

---

# 42. HEALTHCHECK

Créer :

/health

et idéalement :

/health/ready
/health/live

Vérifier :

- application
- PostgreSQL
- éventuels services critiques

---

# 43. UI / UX

Interface moderne, professionnelle et cohérente.

Inspirations :

Discord :

- navigation latérale
- channels
- chat

Notion :

- pages
- espace de travail
- simplicité

Linear :

- finition
- raccourcis
- Kanban
- interactions

Éviter de copier visuellement directement une application existante.

Créer une identité propre.

Responsive obligatoire.

Desktop prioritaire mais mobile fonctionnel.

---

# 44. ACCESSIBILITÉ

Prévoir :

- navigation clavier
- focus visibles
- labels
- contraste suffisant
- composants accessibles

---

# 45. PERFORMANCE

Éviter :

- requêtes DB répétitives
- récupération massive de messages
- chargements inutiles
- polling agressif

Prévoir pagination / cursor pour les messages.

---

# 46. DATABASE

Créer un schéma PostgreSQL propre.

Tables / entités attendues approximativement :

users
user_sessions
workspaces
workspace_members
roles
permissions
role_permissions
channels
channel_members
messages
message_reactions
custom_emojis
projects
boards
board_columns
tasks
task_comments
task_checklists
pages
page_blocks
bots
bot_tokens
services
webhooks
events
notifications
integrations
feature_flags
audit_logs
attachments
monitoring_targets
monitoring_checks

Adapte intelligemment le modèle.

Utilise :

UUID

ou identifiants suffisamment robustes.

Créer les migrations proprement.

---

# 47. SEED

Créer un seed de développement.

Inclure :

Workspace :
LUMA

Channels :

GENERAL
#general

INFRA
#argos
#alerts

DEV
#development

Créer :

- quelques messages
- un board
- quelques tâches
- un bot Argos de démonstration

Ne pas créer de faux secrets.

---

# 48. DÉVELOPPEMENT

Créer :

README.md

avec :

- prérequis
- installation
- PostgreSQL
- environnement
- migrations
- seed
- développement
- build
- production
- tests

Créer :

.env.example

Ne jamais committer de secrets.

---

# 49. ENVIRONNEMENT

Prévoir au minimum :

DATABASE_URL

APP_URL

KYROS_BASE_URL
KYROS_CLIENT_ID
KYROS_CLIENT_SECRET

SESSION_SECRET

ARGOS_BASE_URL

et les variables nécessaires.

Documenter chaque variable.

---

# 50. TESTS

Tester au minimum :

- authentification
- permissions
- création channel
- création message
- réaction
- bot API
- webhook
- Kanban
- feature flags
- Argos monitoring
- endpoints critiques

---

# 51. STABILITÉ

Le produit doit être capable de :

- redémarrer sans casser les données
- supporter des migrations propres
- reconnecter le temps réel
- gérer les erreurs réseau
- gérer les services externes indisponibles
- ne pas planter parce qu’Argos ou Nino est hors ligne

Les intégrations externes doivent être isolées.

---

# 52. SERVICE EXTERNE DOWN

Si Argos, Nino ou un autre service externe est indisponible :

Le Workspace continue à fonctionner.

Afficher seulement :

Integration unavailable

ou un statut équivalent.

Ne jamais faire tomber toute l’application.

---

# 53. SÉCURITÉ DES BOTS

Tokens :

- générés cryptographiquement
- affichés une seule fois si possible
- hashés en DB
- révocables
- rotatables

Rate limiting obligatoire.

---

# 54. PROTECTION WEBHOOK

Prévoir :

- secret
- rate limit
- payload size limit
- schema validation
- signature optionnelle HMAC

---

# 55. FEATURE PROPOSALS

Tu peux proposer de nouvelles fonctionnalités.

Mais elles doivent être classées :

CORE
FEATURE
FUTURE
EXPERIMENTAL

Ne rajoute pas immédiatement tout ce que tu imagines.

Documente-les dans :

FEATURES.md

---

# 56. FONCTIONNALITÉS QUE TU PEUX PROPOSER

Exemples pertinents :

- calendrier
- rappels
- automatisations
- templates
- favoris
- messages épinglés
- présence avancée
- recherche globale
- commandes slash
- bot marketplace interne
- workflows
- dashboard personnel
- dashboard projet
- dashboards Argos
- incidents
- status page
- notifications push
- PWA
- application mobile future
- import Discord / Slack futur
- liens enrichis
- commandes bots
- threads
- DMs
- groupes privés
- calendrier partagé
- pages publiques
- partage externe sécurisé

Ne pas forcément les coder maintenant.

---

# 57. COMMANDES / BOTS FUTURES

Préparer une architecture pouvant accueillir plus tard :

/argos status
/argos server annabelle
/task create
/project info
/nino latest

Mais ne construis pas un énorme moteur de commandes si inutile en 0.1.

---

# 58. ACTIONS SENSIBLES

Si un bot peut plus tard effectuer :

restart service
deployment
commandes serveur

Prévoir dès maintenant la notion :

read
operator
admin

Mais ne donne pas de contrôle serveur dangereux par défaut.

Les actions sensibles devront :

- être autorisées explicitement
- être auditées
- éventuellement demander confirmation

---

# 59. DOCUMENTATION OBLIGATOIRE

Créer :

README.md
PROJECT_CHARTER.md
ROADMAP.md
CHANGELOG.md
FEATURES.md

DOCS/
ARCHITECTURE.md
API.md
DATABASE.md
SECURITY.md
BOTS.md
WEBHOOKS.md
ARGOS.md
BACKUP.md
DEPLOYMENT.md
demande_assets.txt si nécessaire

---

# 60. FICHIER TODO

Créer :

TODO.md

Mais celui-ci ne doit pas devenir une poubelle.

Organiser :

NOW
NEXT
LATER
DONE

---

# 61. QUALITÉ DU CODE

Code :

- TypeScript strict
- lisible
- découpé
- documenté lorsque nécessaire
- sans duplication inutile
- sans any abusif
- erreurs gérées

Chaque fichier de code important doit avoir sur sa première ligne un commentaire indiquant son chemin ou nom de fichier lorsque cela est compatible avec le langage.

Exemple :

// src/services/webhooks.ts

---

# 62. GIT

Créer un .gitignore propre.

Préparer le projet pour Git.

Ne jamais inclure :

.env
secrets
tokens
uploads inutiles
node_modules
builds temporaires

---

# 63. DEFINITION OF DONE

Une fonctionnalité n’est terminée que si :

- elle fonctionne
- elle est testée
- les erreurs sont gérées
- les permissions sont appliquées
- l’UI est utilisable
- les données persistent
- elle fonctionne après redémarrage
- elle n’introduit pas de faille évidente
- elle est documentée lorsque nécessaire

---

# 64. PRIORITÉS

Ordre de priorité :

1. architecture
2. DB
3. auth
4. permissions
5. workspace
6. channels
7. chat
8. temps réel
9. bots
10. webhooks
11. Kanban
12. notifications
13. Argos
14. administration
15. paramètres utilisateur
16. pages
17. améliorations UX

---

# 65. RÉSULTAT ATTENDU

À la fin, le projet doit :

- build correctement
- démarrer
- se connecter à PostgreSQL
- disposer de migrations
- disposer d’un seed
- permettre l’authentification
- permettre la gestion du Workspace
- avoir des channels
- permettre de chatter
- supporter les réactions
- avoir un Kanban
- permettre les bots
- recevoir des webhooks
- surveiller Argus / Argos
- disposer d’une interface admin
- disposer de paramètres utilisateur
- disposer de feature flags
- avoir Jellyfin désactivé
- avoir les demandes films/séries désactivées
- être documenté
- avoir une roadmap
- avoir un versionning
- avoir un logo initial
- être réellement exploitable

---

# 66. MODE DE TRAVAIL

Tu ne dois pas simplement produire un plan.

Tu dois construire le projet.

Procède progressivement :

1. créer la documentation directrice
2. choisir le nom
3. créer l’identité initiale
4. définir l’architecture
5. créer la base
6. créer les migrations
7. créer l’authentification
8. créer les permissions
9. développer les fonctionnalités principales
10. tester
11. corriger
12. documenter
13. effectuer un build production
14. corriger jusqu’à build fonctionnel

Tu dois régulièrement relire :

PROJECT_CHARTER.md

afin de ne pas dévier du projet.

Ne laisse pas volontairement :

TODO critiques
mock principal
fausses fonctions
boutons non fonctionnels
interfaces importantes sans backend

Si une fonctionnalité ne peut réellement pas être terminée :

- documente précisément pourquoi
- désactive-la proprement
- ajoute-la à la roadmap

---

# 67. PRINCIPE FINAL

Ce projet ne doit pas devenir un clone de Discord, Notion ou Slack.

Il doit devenir un Workspace natif LUMA.

Sa force est :

Communication +
Organisation +
Projets +
Bots +
Webhooks +
Intégrations +
Monitoring

Le produit doit rester indépendant des modules externes.

Argos, Nino, Narra, GitHub ou d’autres services doivent être des intégrations.

Si une intégration disparaît, le Workspace continue de fonctionner.

Commence maintenant à la racine du dossier vide.

Ne me pose aucune question.

Prends les décisions nécessaires.

Construis d’abord une base solide, puis les fonctionnalités.

Version initiale :

0.1.0 — ALPHA

## Livraison 0.3.0 — 16 septembre 2026

Le lot intégrations est implémenté : modules configurés en base, DropIt personnel en lecture de partages, GitHub/Nino/Narra, règles de routage et tâches, HMAC et commandes privées. DropIt 1.1.0 est adapté avec Kyros v4. La synchronisation PC reste un futur module LUMA séparé ; aucun moteur dans Liora. Contrat et limites : [INTEGRATIONS.md](INTEGRATIONS.md).

## Revue d’implémentation — 25 septembre 2026

Ce cahier des charges original est conservé. Son état d’avancement, les écarts et les validations restantes sont consignés dans [ETAT_DU_PROJET.md](ETAT_DU_PROJET.md) et la [roadmap](../ROADMAP.md). La revue initiale portait sur 0.4.6 BETA et constatait un lot 0.4 partiel ; ce constat est remplacé par la finalisation 0.4.7 ci-dessous. Les propositions sont dans [Idées.md](Idées.md).

## Finalisation du jalon 0.4 — 25 septembre 2026

Les lacunes relevées dans la revue précédente ont été traitées dans la version de maintenance **0.4.7** : récurrences avec fuseaux, rappels déclenchés et replanifiés, mutations corrigées, favoris contrôlés et navigables, recherche filtrée, émission Web Push et cache PWA versionné. Le cahier des charges original ci-dessus est conservé. [Guide de fonctionnement](EXPERIENCE_0.4.md), [état actualisé](ETAT_DU_PROJET.md) et [preuves de validation](VALIDATION.md). L’installation et la réception push réelles restent des vérifications propres au déploiement.
