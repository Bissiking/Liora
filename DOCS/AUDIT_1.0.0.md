# Audit préparatoire Liora 1.0.0

5 octobre 2026 · sources auditées : commit `fa93d20`, **0.7.1 BETA**. Demande : [brief original](BRIEF_1.0.0.md). Suite : [plan fichier par fichier](PLAN_1.0.0.md).

Cet audit prépare l’implémentation demandée. Il ne change ni le code applicatif, ni les migrations, ni le numéro de version. Les constats sont issus des sources, des schémas SQL et d’une validation locale renouvelée. Aucune opération sur la production.

## Verdict sur la cohérence de l’implémentation

**Échec au regard de la cible 1.0**, avec un socle réutilisable : l’identité visuelle Liora, les données persistantes, les contrôles d’accès et les composants partagés existent. En revanche, le contexte personnel reste attaché au workspace sélectionné ; le panneau du canal contient des blocs décoratifs ; la navigation mobile dépend d’indices dans une liste globale. Ce sont des problèmes vérifiés de structure, pas une absence de fonctionnalités métier.

Le détecteur Impeccable exécuté une fois sur `src/client` relève **445 avis**, sans résultat primaire ni avertissement : 356 tailles de police, 33 rayons, 56 couleurs. Les échantillons ont été confrontés aux sources : petites métadonnées dans `places.css`, rayons dans `release-050.css` et `release-060.css`, couleurs de palettes dans `styles.css`. Ces valeurs ne constituent pas 445 défauts : certaines sont intentionnelles et les règles du détecteur ne suffisent pas à établir un défaut de contraste ou de lisibilité. Elles servent à orienter la consolidation des tokens.

## Évaluation technique indicative

| Dimension                     | Score / 4   | Preuve principale                                                                                                    |
| ----------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------- |
| Accessibilité                 | 2           | Dialogues et menus clavier présents ; contrôles de Membres sans nom accessible, Tab intercepté dans ContextMenu.     |
| Performance                   | 2           | Places chargé à la demande ; bundle principal de 868,56 kB avant gzip, vues principales importées ensemble.          |
| Responsive                    | 3           | Parcours locaux desktop/mobile fonctionnels ; panneau contextuel masqué sans drawer et plusieurs commandes de 36 px. |
| Thèmes                        | 3           | Tokens, palettes et préférence de compte présents ; règles réparties entre styles historiques et CSS de versions.    |
| Intégrité de l’implémentation | 2           | Contexte personnel/workspace mélangé, actions Membres incompatibles avec leur contrat API, panneau décoratif.        |
| **Total**                     | **12 / 20** | **Acceptable, avec travail structurel significatif avant 1.0.**                                                      |

Ce score ne constitue ni une certification WCAG, ni un audit de sécurité indépendant. Les contrastes de toutes les palettes, les lecteurs d’écran, le zoom 200 % et les appareils physiques ne sont pas qualifiés par cette passe.

## Résultats locaux renouvelés

| Commande                                                                                | Résultat                                                                                  | Limite                                                                                             |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `TEST_DATABASE_URL=postgresql://matheohemery@127.0.0.1:55432/liora_test npm test`       | **72 / 72**, aucun échec, environ 4,76 s.                                                 | PostgreSQL local de test et fournisseurs simulés.                                                  |
| `npm run build`                                                                         | TypeScript, Vite, serveur et outils compilés.                                             | Avertissement Vite sur les chunks > 500 kB ; aucune mesure de charge.                              |
| `E2E_DATABASE_URL=postgresql://matheohemery@127.0.0.1:55432/liora_e2e npm run test:e2e` | **EXPERIENCE PASS** et **E2E PASS**, Chrome headless/Puppeteer, 1440 × 1000 et 390 × 844. | Données synthétiques, Kyros/DropIt et autres services de test ; pas de fournisseur réel.           |
| `impeccable detect --json --target src/client`                                          | 445 avis, 0 primaire, 0 avertissement.                                                    | Détection statique ; échantillonnage contextualisé, pas vérification individuelle de 445 éléments. |

Build mesuré : CSS principal 116,57 kB / 22,53 kB gzip ; JS principal 868,56 kB / 258,62 kB gzip ; données emoji 805,57 kB / 102,15 kB gzip ; chunk Places 170,56 kB / 50,51 kB gzip. Les données emoji constituent un chunk distinct ; leur taille ne prouve pas qu’elles sont chargées au démarrage.

Captures fraîches examinées : `.impeccable/review/desktop.png`, `mobile.png`, `dropit-settings-mobile.png`. Elles confirment le mélange de navigation, le panneau droit décoratif et la navigation mobile existante. La suite complète couvre davantage de parcours ; tous ses screenshots n’ont pas été inspectés visuellement pendant cet audit.

Les logs de cette exécution sont locaux : `/tmp/liora-100-audit-tests.log`, `/tmp/liora-100-audit-build.log`, `/tmp/liora-100-audit-e2e.log`, `/tmp/liora-100-audit-detector.json`. Ces fichiers temporaires ne constituent pas une archive durable. Les résultats consignés ici sont le relevé du 5 octobre.

## Inventaire du socle existant

| Domaine        | Fichiers existants                                                                                                        | Contrat ou état actuel                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Shell          | `main.tsx`, `navigation.ts`, `WorkspaceMenu.tsx`, `QuickSwitch.tsx`                                                       | État plat vue/workspace/canal, liste de navigation commune ; menu workspace existant, pas de rail par workspace.         |
| Personnel      | `Home.tsx`, `Inbox.tsx`, `Reminders.tsx`, `Favorites.tsx`, `Social.tsx`, `FriendMessenger.tsx`, `Notes.tsx`, `Places.tsx` | Amis, DMs d’amis, lieux et notes réellement personnels ; Inbox/rappels/favoris encore servis dans un contexte workspace. |
| Conversations  | `Chat.tsx`, `MessageContent.tsx`, `Markdown.tsx`, `EmojiPicker.tsx`                                                       | Messages, fils, réactions, épingles, recherche, fichiers, mentions ; rendu Markdown partagé et sécurisé.                 |
| Organisation   | `Projects.tsx`, `TaskExtras.tsx`, `Calendar.tsx`, `Pages.tsx`                                                             | Kanban et actions métier réelles ; Pages encore montées et référencées.                                                  |
| Administration | `Admin.tsx`, `Members.tsx`, `Groups.tsx`, `Integrations.tsx`                                                              | Rôles, accès privés, groupes, membres, intégrations et webhooks présents, mais parcours fragmentés.                      |
| UI commune     | `ui.tsx`, `ContextMenu.tsx`, `RenderBoundary.tsx`, `api.ts`                                                               | Avatar, dialogues natifs, formulaires, erreurs, menu réutilisable déjà disponible.                                       |
| Accès          | `auth.ts`, `access.ts`, `experience-access.ts`, `shared/permissions.ts`                                                   | Rôle principal par membre ; permissions workspace ; filtrage SQL des canaux privés, groupes et DMs.                      |
| Calendrier     | `calendar.ts`, `caldav.ts`, `ical.ts`, `calendar-rule.ts`, `schedule.ts`, `CalendarSync.tsx`                              | Calendrier local et CalDAV existants ; Google intégré dans le même écran client.                                         |
| Webhooks       | `webhooks.ts`, `events.ts`, `workers.ts`, `network.ts`, `Admin.tsx`                                                       | Réception normalisée, signatures, idempotence, outbox, retry/cancel ; pas de message EMBED générique rendu.              |
| Exploitation   | `db.ts`, `crypto.ts`, `scripts/migrate.ts`, `push.ts`, `gotify.ts`, `pwa.ts`                                              | Migrations avec checksum, sessions chiffrées, workers durables et contrôles réseau à préserver.                          |

Les fichiers client sont sous `src/client`, serveur sous `src/server`, partagés sous `src/shared`. Le [plan](PLAN_1.0.0.md) distingue explicitement les fichiers existants de ceux à créer.

## Constats prioritaires

**12 constats : 0 P0, 8 P1, 4 P2, 0 P3.** P1 désigne ici une priorité avant 1.0, pas nécessairement une vulnérabilité actuelle. Les écarts à la nouvelle cible sont distingués des défauts actuels. Aucun incident critique de production n’est prouvé par cet audit.

### F01 · P1 · Personnel et workspace utilisent le même contexte

- **Nature :** défaut UX actuel et écart à la cible ; intégrité.
- **Sources :** `main.tsx:221`, `main.tsx:824`, `main.tsx:953`, `navigation.ts:1`.
- **Constat :** base API et fil d’Ariane attachés au workspace actif ; navigation regroupant vues personnelles, modules d’équipe et gestion. L’absence de workspace ouvre un autre shell personnel, avec une couverture différente.
- **Impact :** une note ou un ami paraît dépendre de l’équipe sélectionnée ; l’utilisateur ne sait pas toujours quel espace recevra une action.
- **Correction :** état de navigation discriminé personnel/workspace, rail et navigation contextuelle ; même shell personnel avec ou sans workspace. Commande adaptée : `$impeccable shape`.

### F02 · P1 · Inbox, rappels et favoris personnels restent limités au workspace

- **Nature :** écart à la cible ; intégrité.
- **Sources :** `Inbox.tsx:1`, `Reminders.tsx:1`, `Favorites.tsx:1`, migrations `005_experience.sql` et `006_experience_complete.sql`.
- **Constat :** routes et données possèdent un `workspace_id` ; déplacer leurs boutons ne suffit pas. Les DMs historiques de workspace et les messages d’amis sont deux historiques distincts.
- **Impact :** l’espace personnel ne donne pas une vue complète et reste incomplet sans workspace.
- **Correction :** agrégation personnelle avec revalidation de chaque accès, indication du workspace d’origine, rappels personnels autonomes sans réécriture des anciennes lignes. Ne pas fusionner les historiques de DMs. Commande : `$impeccable harden`.

### F03 · P1 · Actions de Membres incompatibles avec le contrat serveur

- **Nature :** défaut actuel établi par lecture des contrats ; intégrité.
- **Sources :** `Members.tsx:53`, `Members.tsx:85`, `Members.tsx:94`, `Members.tsx:201`, `src/server/admin.ts:15`, `src/server/admin.ts:67`.
- **Constat :** édition envoie seulement `role_id`, retrait seulement `state`, alors que le PATCH exige les deux. Ces requêtes échouent à la validation avant mutation. Le GET omet également `m.state`, pourtant utilisé pour le compteur de membres actifs. « Gérer les groupes » recharge les données sans ouvrir leur gestion.
- **Impact :** édition/retrait depuis cette page impossibles, compteur erroné, commande de groupes sans résultat attendu.
- **Correction :** PATCH partiel sous verrou avec conservation du champ absent, GET comprenant l’état, branchement sur `Groups.tsx`. Préserver protection Owner et interdiction d’escalade. Ajouter une régression sur cette page précise : la suite actuelle exerce aussi l’autre formulaire, dans Admin, qui transmet les deux champs. Pas de reproduction HTTP séparée réalisée pendant cet audit. Commande : `$impeccable harden`.

### F04 · P1 · Configuration et permissions fines des canaux absentes

- **Nature :** écart à la cible, pas preuve d’une fuite actuelle ; intégrité.
- **Sources :** `src/shared/permissions.ts:1`, `src/server/access.ts:1`, `src/server/chat.ts:1`, `src/server/resources.ts:60`.
- **Constat :** paramètres généraux et accès privés existent ; droits surtout définis au workspace. Lecture, pièces jointes, réponse aux fils et mentions ne disposent pas des droits distincts demandés. Slowmode et activation des fils absents.
- **Impact :** impossible d’exprimer les nouveaux réglages ; un changement seulement client laisserait des autorisations incohérentes.
- **Correction :** modèle central de permissions effectives, nouvelles capacités et overrides rôle/utilisateur ; appliquer le même filtrage aux routes, recherche, fichiers, notifications et CalDAV. Commande : `$impeccable harden`.

### F05 · P1 · Panneau droit décoratif et membres passifs

- **Nature :** défaut UX actuel et écart à la cible ; intégrité/responsive.
- **Sources :** `Chat.tsx:843`, `main.tsx:953`, styles du panneau contextuel.
- **Constat :** « Dans ce salon / Un fil commun », présence passive globale au workspace, pas de fiche utilisateur ni liste hors ligne ; panneau masqué aux petites largeurs sans accès équivalent. « En direct » persiste en topbar.
- **Impact :** la place occupée n’aide pas à gérer le canal ; contexte indisponible sur mobile.
- **Correction :** membres autorisés du canal, description sobre, fils/épingles/fichiers réels ; fiche et drawer. Garder un état de connexion uniquement lorsqu’une action ou une anomalie doit être signalée. Commande : `$impeccable distill`.

### F06 · P1 · Menus contextuels limités à deux objets Kanban

- **Nature :** écart à la cible ; intégrité/accessibilité.
- **Sources :** `ContextMenu.tsx:1`, `Projects.tsx:765`, `Projects.tsx:869`.
- **Constat :** composant partagé déjà présent, raccordé aux colonnes/cartes ; pas de système couvrant les 13 objets demandés, ni de garde commune pour conserver le menu natif dans les zones de saisie/sélection.
- **Impact :** accès aux actions variable selon écran et périphérique.
- **Correction :** registre central d’actions par objet, clic droit/Maj+F10/bouton mobile sur la même définition ; filtrer les actions interdites. Commande : `$impeccable harden`.

### F07 · P1 · Webhooks sans format EMBED ni diagnostic HTTP complet

- **Nature :** écart à la cible ; intégrité.
- **Sources :** `src/server/webhooks.ts:1`, `src/server/events.ts:1`, `src/server/workers.ts:1`, `Admin.tsx:1`, `migrations/001_initial.sql`.
- **Constat :** texte, adaptateurs, signatures et files existent ; absence de schéma générique EMBED persistant/rendu, aperçu live et test administrateur. L’historique sortant expose état/tentatives/erreur, sans statut HTTP ni date du dernier envoi ; les livraisons copient leur destination sans identifiant de webhook source.
- **Impact :** configuration et diagnostic incomplets ; la désactivation d’une destination doit aussi traiter sa file déjà créée.
- **Correction :** enrichissement additif des messages/livraisons, aperçu sur le vrai composant de rendu, test utilisant la même pipeline, lien source et revalidation avant émission. Le risque de file après désactivation est issu du code, pas d’un envoi externe reproduit. Commande : `$impeccable harden`.

### F08 · P1 · Google est encore actif et CalDAV reste secondaire

- **Nature :** écart à la nouvelle décision produit ; intégrité.
- **Sources :** `CalendarSync.tsx:1` et `:397`, `Preferences.tsx:34`, `src/server/google-calendar.ts:1`, `src/server/app.ts:37`, `src/server/workers.ts:12`.
- **Constat :** chargement Google/CalDAV couplé ; CalDAV dans un bloc replié. Serveur, identifiant, mot de passe unique, appareils, dernière utilisation et révocation existent déjà côté API ; copies et guide multi-clients incomplets.
- **Impact :** connecteur retiré par la demande toujours proposé ; panne Google susceptible de gêner l’écran CalDAV.
- **Correction :** retirer tous les chemins Google actifs, extraire les réglages CalDAV, conserver les tables historiques et toutes les protections DAV. Aucun SDK Google dédié dans `package.json` ; `ical.js`, XML et fuseaux sont requis par CalDAV. Commande : `$impeccable clarify`.

### F09 · P2 · Retrait des Pages réparti dans plusieurs parcours

- **Nature :** écart à la cible ; intégrité.
- **Sources :** `navigation.ts:1`, `main.tsx:443`, `main.tsx:519`, `main.tsx:1234`, `Home.tsx:1`, `Favorites.tsx:1`, `Help.tsx:1`, `Pages.tsx:1`.
- **Impact :** retirer seulement l’entrée de sidebar laisse raccourci, recherche, favoris et promotion capables de rouvrir la fonctionnalité.
- **Correction :** retirer les points d’entrée client, gérer les anciennes vues mémorisées et favoris Pages ; conserver API/données/fusion/historique compatibles sans les promouvoir. Commande : `$impeccable distill`.

### F10 · P2 · CSS de versions et règles stables entrelacés

- **Nature :** maintenance actuelle ; thèmes/intégrité.
- **Sources :** `styles.css`, `ux.css`, `release-050.css`, `release-060.css`, `release-070.css`, `themes/*`, `places.css`.
- **Constat :** **8 474 lignes**, 10 `!important` ; trois feuilles de version importées successivement. Les nombres mesurent la surface à organiser, pas une preuve que chaque règle est inutile.
- **Impact :** modifications locales susceptibles de dépendre d’un override éloigné ; coût de validation de toutes les palettes.
- **Correction :** déplacer chaque surface stabilisée vers tokens/base/layout/composants/features ; supprimer seulement les règles dont les usages sont vérifiés. Aucun `release-100.css`, thèmes refaits en dernier. Commande : `$impeccable distill`.

### F11 · P2 · Clavier, labels et cibles tactiles à consolider

- **Nature :** défauts actuels localisés ; accessibilité/responsive.
- **Sources :** `Members.tsx:158`, `Members.tsx:176`, `Members.tsx:185`, `ContextMenu.tsx:1`, styles de commandes de chat/Kanban.
- **Constat :** sélection de rôle et boutons icônes sans nom accessible ; Tab dans le menu est annulé puis renvoie le focus au déclencheur ; plusieurs boutons de 36 × 36 px sous l’objectif tactile 44 px du brief.
- **Impact :** actions difficiles à identifier sans souris ou lecteur d’écran ; parcours Tab peu naturel et précision tactile excessive.
- **Norme :** noms des contrôles concernés par WCAG 4.1.2 ; navigation cohérente par 2.4.3. 44 px est ici l’objectif produit, pas une assertion automatique d’échec WCAG 2.2 sur chaque bouton.
- **Correction :** noms accessibles, fermeture sur Tab sans piège, Maj+F10 sur colonnes, focus conservé lors d’une suppression, cibles 44 px. Commande : `$impeccable adapt`.

### F12 · P2 · Découpage du shell et chargement des vues à améliorer

- **Nature :** risque de maintenance/performance vérifié, lenteur ressentie non mesurée.
- **Sources :** `main.tsx:1` (1 433 lignes), `Projects.tsx:1` (1 548 lignes), imports client et sortie Vite.
- **Impact :** large périmètre de régression par modification de navigation ; nombreuses vues chargées avec le shell.
- **Correction :** extraire le shell par responsabilités et charger les écrans à la demande ; mesurer ensuite chargement, gros historiques et nombre de workspaces. Pas de mémoïsation systématique sans profilage. Commande : `$impeccable optimize`.

## Risques structurels et de migration

1. **Checksums de production :** `scripts/migrate.ts` vérifie les migrations existantes. `001` à `011` restent immuables ; notamment `010` contient à la fois Google, notes et CalDAV. La modifier casserait les installations existantes.
2. **Accès :** SQL `visibleChannel()` et `channelAccess()` protègent déjà DMs et canaux privés. Les overrides doivent produire la même décision dans le filtrage SQL et les mutations ; les droits workspace seuls ne suffisent plus. Aucun accès via notification, recherche ou fichier ne doit contourner un refus canal.
3. **DMs :** `channels.is_dm` et `friend_messages` ont des modèles distincts. L’index personnel peut les présenter ensemble, pas les fusionner sans migration de produit explicitement conçue.
4. **Rappels/favoris :** `workspace_id` obligatoire dans les tables existantes. Ne pas le rendre nullable partout par commodité ; préserver les lignes et leurs références, ajouter un support personnel séparé si nécessaire.
5. **Pseudo/rôles :** `users` n’a pas de pseudo indépendant ; `workspace_members` attribue un rôle principal, pas plusieurs. Utiliser les claims Kyros vérifiés pour un pseudo éventuel ; ne pas présenter un identifiant technique comme pseudo ni les groupes d’accès comme rôles supplémentaires.
6. **Webhooks :** `messages.content` reste obligatoire et borné ; enrichissement JSON avec texte de repli, sans réécriture destructrice. Relier les nouvelles livraisons à leur source ; ne pas attribuer arbitrairement les anciennes.
7. **Retrait Google/Pages :** déconnecter les fonctionnalités actives sans effacer leur historique. Les fixtures Google partagent `tests/fixtures/connections.ts` avec BrainDump : ne pas supprimer ce fichier intégralement.
8. **Retour arrière :** une ancienne version ne connaît pas les nouveaux refus canal. Après activation des overrides, revenir au code 0.7.1 pourrait rouvrir des accès ; migration additive ne signifie pas rollback applicatif automatiquement sûr.

## Points à préserver

- SSO Kyros v4 et sessions serveur chiffrées avec refresh rotatif ; avatar et préférences personnelles existants.
- Contrôle de l’Owner, prévention d’escalade, transactions et audit métier.
- Filtrage des canaux privés/groupes/DMs, pièces jointes contrôlées et Markdown sécurisé.
- CalDAV déjà utilisable par accès d’appareil hashé, mot de passe affiché une fois, révocation, ETags et notes datées en lecture seule.
- Webhooks avec signatures/idempotence, outbox et protections HTTPS/SSRF ; notifications Push/Gotify réévaluant les accès.
- Menu contextuel et dialogues partagés ; réutilisation plutôt que multiplication de composants équivalents.
- Migrations contrôlées, 72 tests et parcours navigateur locaux verts. Ils établissent une base de comparaison, pas la qualification de la future 1.0.

## Ordre conseillé

1. `$impeccable shape` : appliquer le plan de navigation et de contexte F01/F02.
2. `$impeccable harden` : contrats Membres, ACL, menus et webhooks F03/F04/F06/F07.
3. `$impeccable distill` et `$impeccable clarify` : panneau utile, retraits Pages/Google et CalDAV F05/F08/F09.
4. `$impeccable adapt` : mobile, clavier et labels dès chaque lot, puis qualification transversale F11.
5. `$impeccable optimize` : découpage mesuré du shell et des imports F12.
6. `$impeccable distill` : consolidation CSS progressive, puis thèmes F10.
7. `$impeccable audit` : renouveler les preuves après implémentation ; `$impeccable polish` : dernière passe bornée après correction des défauts fonctionnels.

Ces passes peuvent être exécutées séparément ou regroupées en suivant les dépendances du plan. La refonte complète et le passage en 1.0 restent à réaliser.
