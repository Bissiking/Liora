# Liora 0.7.0 — notes, agendas et conversations

Administration → Intégrations affiche uniquement DropIt, dans les connecteurs existants comme dans le choix de fournisseur à la création. L’aide et les exemples de routage suivent ce périmètre. Les contrats API/webhook des autres modules restent disponibles pour les usages techniques existants ; aucune configuration enregistrée n’est supprimée.

## Notes datées et BrainDump

Notes datées est une rubrique personnelle, disponible même sans espace d’équipe. Une note Liora contient un titre, du Markdown et une date/heure obligatoire. Création, modification et suppression restent réservées à son propriétaire ; l’API est paginée par date et identifiant.

Le lien BrainDump est activé volontairement par compte. Liora utilise le bearer Kyros v4 de la session serveur déjà vérifiée et appelle le contrat existant `GET /api/braindump/dumps?type=note&limit=500`. Chaque `userId` retourné doit correspondre au `sub` vérifié. Seules les notes ayant un `dueAt` sont conservées ; leur identifiant reste stable lors d’une modification de titre/date. Une date retirée, une note supprimée ou archivée disparaît de la copie après une récupération complète réussie. Aucun jeton ni identifiant propriétaire fourni par le navigateur n’est transmis comme preuve d’identité.

Ces notes se modifient dans BrainDump, qui reste leur source. Liora ne crée ni tâche ni événement d’équipe à partir d’une note. Le lien s’actualise à la demande et chaque minute pendant que Notes datées est ouverte. Un échec conserve la dernière copie et affiche l’erreur/date de récupération. Désactiver le lien retire uniquement les copies BrainDump du compte, en conservant les notes Liora. Si BrainDump renvoie 500 notes, la synchronisation refuse une mise à jour incomplète plutôt que supprimer des notes hors de la page.

Configuration opérateur :

```dotenv
BRAINDUMP_BASE_URL=https://braindump.example.com
BRAINDUMP_ALLOW_PRIVATE=false
```

Dans BrainDump, configurer `KYROS_LUMA_CLIENT_ID` avec l’identifiant client Kyros de Liora et `KYROS_LUMA_RESOURCE_AUDIENCE` avec son audience de ressource. `KYROS_API_REQUIRED_SCOPES` doit être autorisé par Kyros et demandé dans `KYROS_SCOPES` de Liora, par exemple `braindump:access` en plus des scopes existants. Le protocole SSO v4 et le contrat d’identité signé sont conservés. En développement local uniquement, une boucle HTTP explicitement autorisée fonctionne avec `BRAINDUMP_ALLOW_PRIVATE=true`. Résolution IPv4 épinglée, aucune redirection, timeout huit secondes et réponse JSON limitée à 2 Mo.

## Google Agenda : modifications dans les deux sens

Le parcours principal demandé est Google Agenda Android/Web. Préférences → Synchronisation Agenda, ou Calendrier → Synchroniser mes agendas, permet de connecter Google, choisir un agenda modifiable et un espace Liora, puis activer la synchronisation.

Liora synchronise les événements de cet espace dont le compte est l’auteur, hors salons privés, DMs et salons archivés. Les créations et modifications Liora sont exportées. Les modifications et suppressions de ces mêmes rendez-vous dans Google reviennent dans Liora ; une suppression Liora supprime son événement Google lié. Les autres rendez-vous personnels de Google ne sont pas importés dans l’espace d’équipe. Le choix d’un agenda Google partagé implique que les événements exportés soient visibles aux personnes qui ont accès à cet agenda.

Le lien passe toutes les cinq minutes, indépendamment du navigateur, ou par Synchroniser maintenant. OAuth utilise un état à usage unique lié au compte **et à la session Kyros**, PKCE S256 et accès hors ligne. Les jetons sont chiffrés et rafraîchis côté serveur ; ils ne sont jamais retournés au navigateur. Permissions et auteur sont réévalués à chaque passage. Un événement déplacé hors du périmètre autorisé est signalé et ne déclenche aucune modification Google.

Le suivi compare la version locale et l’ETag Google. Quand les deux ont changé, les deux versions restent intactes et un conflit permet de conserver Liora ou Google. Les écritures Google utilisent `If-Match`, les exports un identifiant déterministe pour résister à une réponse perdue. Les liens de suppression restent en base pour éviter une réimportation. Déconnecter supprime les accès et liens locaux et tente de révoquer le consentement ; les événements déjà présents dans chaque agenda sont conservés.

Configuration : créer un client OAuth **Application Web** dans Google Cloud, activer Calendar API et autoriser le callback exact :

```text
https://liora.example.com/api/v1/google-calendar/callback
```

```dotenv
GOOGLE_CALENDAR_CLIENT_ID=
GOOGLE_CALENDAR_CLIENT_SECRET=
```

Scopes : `calendar.events` et `calendar.calendarlist.readonly`. La publication/vérification du consentement Google dépend de la configuration du projet ; Liora ne configure pas ce projet automatiquement. L’autorisation d’un autre compte Google n’attribue aucune permission Liora.

Le connecteur est borné à 500 événements actifs et 1000 liens. Les répétitions quotidienne, hebdomadaire, mensuelle et annuelle sont prises en charge, y compris l’ancrage de fin de mois de Liora. Les exceptions, limites de série, rendez-vous spéciaux et invitations externes sont signalés sans écrasement. Un seul rappel visuel est pris en charge. Si un événement sans fin explicite est envoyé à Google, une durée d’une heure est utilisée pour satisfaire son format ; cette représentation revient sans fin dans Liora tant que la durée reste inchangée. Les notes BrainDump restent dans Notes datées et le calendrier CalDAV de notes ; elles ne sont pas envoyées à Google par ce connecteur.

Contrats officiels utilisés : [événements Calendar API](https://developers.google.com/workspace/calendar/api/v3/reference/events) et [OAuth serveur](https://developers.google.com/identity/protocols/oauth2/web-server). Ce connecteur interroge uniquement ses événements liés via leur propriété privée, puis compare les ETags ; il ne prétend pas utiliser les sync tokens de l’agenda entier.

## Applications de calendrier CalDAV

Un accès par appareil peut être créé puis révoqué dans Synchronisation Agenda. L’identifiant est le compte Liora ; le mot de passe aléatoire est affiché une seule fois et seul son hash est conservé. Aucun accès API général ou session Kyros n’est donné au client de calendrier.

Ajouter un compte CalDAV avec le serveur `https://liora.example.com/dav/`, l’identifiant et le mot de passe fournis. `/.well-known/caldav` découvre ce serveur. Les calendriers d’équipe exposent uniquement les événements visibles au compte ; seuls l’auteur ou un compte avec MANAGE_CALENDAR peut les modifier. La création exige CREATE_CALENDAR_EVENT. Les notes datées sont un calendrier personnel en lecture seule.

OPTIONS, PROPFIND (Depth 0/1), REPORT calendar-query/calendar-multiget, GET/HEAD, PUT et DELETE sont implémentés. Les événements gardent une URI, un UID et un ETag stables ; les conflits retournent 412. Les écritures passent dans une transaction avec réévaluation des droits. UTF-8, échappement/folding iCalendar, VTIMEZONE, journées entières à fin exclusive et rappels visuels sont conservés. Répétitions identiques au connecteur Google ; les formats non pris en charge sont refusés explicitement. Pas de scheduling/invitations CalDAV, de sync-collection ni de création/renommage de calendriers depuis un client externe. Les clients utilisent leurs calendriers, rapports et ETags existants. XML avec DTD/entités externes refusé, taille des requêtes bornée. HTTPS requis hors boucle locale de développement.

Le format/protocole repose sur [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545) et [RFC 4791](https://www.rfc-editor.org/rfc/rfc4791). Apple Calendrier et d’autres clients CalDAV peuvent utiliser ce parcours ; Google Agenda utilise le connecteur OAuth, pas un compte CalDAV arbitraire. Un véritable parcours Apple/Android reste à qualifier sur appareil.

## Thème du compte et choix par appareil

Le thème est enregistré dans le compte. Apparence ajoute « Synchroniser le thème de mon compte sur cet appareil », actif par défaut. Activé, le choix enregistré est récupéré aux autres connexions/appareils synchronisés ; le refresh périodique existant le reprend sous une minute. Désactivé, le thème choisi reste dans ce navigateur, sous une clé locale liée au compte, sans modifier le thème du compte. Densité et taille du texte restent des préférences de compte.

Les écritures d’apparence sont indépendantes et fusionnées en base, sans remplacer la navigation ou les préférences de notification. Lagune rejoint les neuf univers existants : fond minéral clair, accents turquoise, texte profond et marges aérées. Les thèmes existants sont conservés.

## Amis, conversations et Markdown

Index d’amis permanent sur desktop, recherche et filtres Tous / Non lus / En ligne, priorité aux échanges non lus/récents, invitations et révocations à proximité. Sur mobile, la conversation occupe l’écran et propose un retour explicite. Les messages restent personnels même sans espace commun. Groupes par jour, accusés envoyés/lus, ancien historique paginé et brouillon conservé en cas d’échec. Les nouveaux messages ne forcent pas la descente quand le lecteur consulte l’historique.

Messages et éditeurs partagent le rendu Markdown. Les composeurs d’amis et de salons proposent Mettre en forme et Aperçu. Titres 1–3, gras, italique, soulignement `++texte++`, barré, citations, listes, cases, liens, code, blocs de code, tableaux et séparateurs sont accessibles par la barre d’outils. Le HTML demeure ignoré, les protocoles dangereux bloqués, les images Markdown rendues en texte alternatif, les mentions sûres conservées. Le soulignement ne s’applique pas aux blocs de code et ne réintroduit pas le HTML.

## Migration et qualification

Appliquer `010_personal_connections.sql` après la 009. Elle ajoute notes personnelles, états BrainDump, accès CalDAV, métadonnées iCalendar et connexions/liens Google sans modifier les migrations appliquées.

Les preuves locales et leurs limites sont détaillées dans [VALIDATION.md](VALIDATION.md). Les tests n’envoient aucun événement à un vrai compte Google et n’accèdent à aucune vraie note BrainDump. Aucun déploiement, consentement Google Cloud ou appareil natif n’est validé par la compilation ou les fixtures.
