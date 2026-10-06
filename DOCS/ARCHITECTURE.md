# Architecture · Liora 0.3.0 BETA

## Structure 1.0

`AppShell` compose rail, sidebar personnelle/workspace et contenu ; `ChannelContextPanel` réutilise le même contenu en panneau et tiroir. `ContextMenuProvider` centralise les menus des objets. CSS : `styles/base.css`, `components.css`, `features.css`, `layout.css`, `social.css`, `channel-settings.css` et tokens/palettes/géométrie des thèmes. Les anciennes feuilles par release sont supprimées.

`personal-activity.ts` expose l’activité/rappels/favoris/conversations au compte ; les files personnelles réutilisent les transports avec leurs propres FK. `channels.ts` configure les canaux ; `channel_permission` et les helpers d’accès calculent les capacités effectives, également pour les ressources liées. `webhook-message.ts` définit le format et la validation partagés par aperçu et ingestion. CalDAV conserve les contrats existants. Le runtime Google et l’interface Pages sont retirés ; leurs tables et les API Pages restent historiques.

## Composants

- `src/client` : React, interface française, styles locaux, police Manrope embarquée, icônes Lucide.
- `src/server/app.ts` : Express, JSON, validation Origin, erreurs structurées, limite de débit, sécurité HTTP.
- `auth.ts` + `kyros.ts` : client SSO v4 et sessions chiffrées PostgreSQL.
- `resources.ts`, `chat.ts`, `admin.ts`, `storage.ts` : domaines API avec droits côté serveur.
- `events.ts` : journal d’événements et outbox transactionnelle.
- `workers.ts` : checks Argus/Argos et livraison signée avec retry.
- PostgreSQL : source de vérité, transactions, index, migrations à checksum.

## Choix

Un backend permanent convient aux tâches périodiques et SSE. React/Vite sert une application privée ; aucune exigence SEO ne justifie un serveur de rendu Next.js. `pg` et SQL explicite évitent une seconde couche de migrations tout en gardant requêtes paramétrées et transactions. Les limites API sont appliquées dans une seule application ; déployer initialement une seule instance (les limiteurs sont en mémoire).

## Temps réel

Une connexion EventSource par espace actif. L’API vérifie les permissions toutes les deux secondes puis envoie uniquement `{type}` et un numéro monotone. PostgreSQL garde les événements ; `Last-Event-ID` permet la reprise. Le client recharge les collections sous authentification. La présence correspond à l’activité HTTP des deux dernières minutes, avec opt-out.

## Cohérence

Message + notifications + événement + outbox sont atomiques à la création. Les cartes et pages sont transactionnelles. Pages : révision attendue et fusion des modifications de blocs indépendants ; conflit 409 sur modifications incompatibles. Rafraîchissement Kyros sous verrou de session ; pas de rotation simultanée. Les suppressions de messages gardent un tombstone ; les salons sont archivés.

## Limites ALPHA

Collections de gestion paginées par curseur, au plus 500 éléments par page ; notifications/audit à 100, messages par pages de 50. Les salons privés utilisent une liste de membres et des groupes ; les DMs sont limités à leurs deux participants. La recherche, les pièces jointes liées et les notifications appliquent la visibilité du salon. Les pages proposent des blocs embarqués soumis aux permissions du lecteur ; la collaboration caractère par caractère est différée. Le stockage initial est local avec interface StorageProvider ; les images sont servies sous session et les autres fichiers téléchargés.

## Intégrations — 0.3.0

DropIt fournit les fichiers de partages personnels actifs ; la synchronisation sera un module LUMA distinct. Configuration des connecteurs en base via l’interface, clés distantes chiffrées et autorisations personnelles liées au compte Kyros. Le contrat et les limites de l’existant sont dans [INTEGRATIONS.md](INTEGRATIONS.md). Liora 0.3.0 et DropIt 1.1.0 implémentent le consentement et l’accès délégué en lecture ; les instances réelles restent à configurer.

## Sources de choix techniques

Versions installées verrouillées dans package-lock.json. Compatibilité vérifiée avec les documentations officielles [Vite](https://vite.dev/guide/) et [Express 5](https://expressjs.com/en/guide/migrating-5/). Contrat Kyros vérifié dans les dépôts locaux `kyros` et `Drivio` ; format webhook Argos vérifié dans `Argos/apps/api/src/notification-channels.ts`.
