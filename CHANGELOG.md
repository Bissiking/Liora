# Changelog

## 1.0.0-beta.1 — 2026-10-06

- Rail personnel/workspaces, navigation contextuelle et tiroirs mobiles ; retrait Pages de l’interface et du libellé En direct.
- Activité, rappels et favoris personnels ; notifications et données historiques des espaces accessibles selon les droits.
- Canaux : paramètres complets, permissions par rôle/utilisateur, slowmode atomique, fils configurables et non-lus précis ; profils, rôles, modération et panneau utile.
- Menus contextuels centralisés sur les objets applicatifs ; clavier/mobile et menus natifs des éditeurs conservés.
- Rail des serveurs : boutons « … » retirés ; menu au clic droit et au clavier conservé.
- Messages privés et amis : listes compactes avec avatars fixes, recherche/filtres, discussion qui occupe le panneau et écriture visible sur mobile ; invitations accessibles via Ajouter un ami.
- Paramètres de canal regroupés par usage, navigation dédiée, champs défilants et actions séparées ; accès privés dans la même fenêtre. Le suivi personnel conserve les options en cours de modification.
- Fils actifs et épingles : aperçu lisible du message d’origine, mentions remplacées par les noms et compteur « 1 réponse » corrigé.
- Webhooks TEXT/EMBED avec aperçu, test et historique ; HTTP/erreur/date des envois sortants.
- CalDAV devient le parcours officiel ; code Google Calendar retiré, anciennes données conservées. CSS consolidé, dix palettes sur une géométrie commune, principales vues chargées à la demande.
- Migrations 012–015 additives, migrations 001–011 immuables. Qualification locale : 76 tests, build et Chrome/Puppeteer ; clients réels et production encore à qualifier. [Guide](DOCS/RELEASE_1.0.0.md).

## 0.7.1 — BETA — 2026-10-05

- BrainDump rejoint DropIt dans les intégrations configurables. URL, identifiant et clé chiffrée en base, test de capacités et consentement personnel pour les notes datées.
- Connexion PKCE liée à la session, contrôle du même compte Kyros, renouvellement des jetons, révocation et retrait des copies privées. Aucun événement BrainDump publié dans les salons. Migration 011.
- BrainDump mis à jour en 2.1.0 avec Applications connectées et API de délégation en lecture seule. [Guide](DOCS/RELEASE_0.7.1.md).

## 0.7.0 — BETA — 2026-10-05

- Paramètres d’intégration limités à DropIt ; autres fournisseurs masqués, aide et exemples adaptés.
- Notes datées personnelles et lien BrainDump opt-in, identité Kyros vérifiée, copie conservée en cas d’indisponibilité.
- Google Agenda Android/Web : connexion OAuth, événements Liora de l’auteur synchronisés dans les deux sens, conflits explicites et traitement des suppressions ; accès CalDAV distinct par appareil. Migration 010.
- Thème enregistré dans le compte avec option de choix local au navigateur, sans écraser les autres préférences. Nouveau thème Lagune.
- Amis : recherche/filtres, index et conversation côte à côte, dates et lecture, parcours mobile dédié.
- Markdown et aperçu dans les conversations ; outils titres, soulignement sûr, citations, listes, code et tableaux.
- [Configuration, périmètre et limites](DOCS/RELEASE_0.7.0.md).

## 0.6.0 — BETA — 2026-10-05

- Refonte Projets : index compact, tableaux contextualisés et filtres repliables ; Kanban plus lisible et actions de cartes/colonnes par clic droit, clavier ou bouton.
- Carte : description Markdown éditable dans le dialogue, propriétés séparées, étapes, commentaires et fichiers/activité par onglets ; erreurs locales et brouillons conservés.
- Markdown GFM : messages, conversations entre amis, descriptions, commentaires et blocs texte des pages ; outils d’écriture et aperçu dans les formulaires.
- Pages d’équipe : ouverture en lecture, index avec dates, édition/aperçu/historique regroupés.
- Supervision et données personnelles : recherche/états, latence min./moy./max. sur échantillons réels, comptes et services en lignes lisibles.
- Gotify : activation personnelle, jeton chiffré, envoi générique, file transactionnelle avec droits/préférences réévalués, cinq essais, retry/cancel et test. Migration 009.
- Avatar du compte Kyros synchronisé à la connexion et au refresh, proxy d’image local et surcharge locale conservée ; avatar retiré de topbar-right.
- Catégories de sidebar et de salons repliables, état enregistré par compte.
- Version 0.6.0 synchronisée. Qualification et limites dans DOCS/RELEASE_0.6.0.md. Aucun déploiement distant.

## 0.5.0 — BETA — 2026-10-03

- Trois thèmes structurants : Atelier, Orbital et Terminal, avec catalogue et variables organisés.
- Dates détectées françaises, plages et durées, fuseau et référence stables après rechargement.
- Carte personnelle en recherche libre : enseignes, restaurants, campings, musées, villes et adresses via Photon/OpenStreetMap ; alias MacDo/McDo reconnus. Ajout direct À essayer / Visité, notes privées et partage volontaire des visites. Ajout manuel dans un panneau avec point sur la carte ; coordonnées réservées aux options avancées. Les suivis Burger King existants sont conservés.
- Conversations durables entre amis, y compris destinataire hors ligne et sans espace commun.
- Projets : tableau/liste, filtres, options contextuelles et corrections de sélection/rattachement/positions/droits.
- Calendrier Mois/Agenda ; administration et préférences guidées ; aide enrichie pour tous les nouveaux parcours.
- Migrations 007/008 additives ; API personnelle isolée des permissions d’espace. La 008 ajoute le type Lieu libre au catalogue.
- [Périmètre et qualification](DOCS/RELEASE_0.5.0.md).

## 0.4.9 — BETA — 2026-10-03

- Refonte globale UX : accueil personnel, navigation regroupée et index contextuel des conversations.
- Commande rapide au clavier, navigation mobile basse et tiroirs dédiés.
- Réception filtrée avec marquage en lot, recherche des pages et sauvegarde explicite des préférences.
- Hiérarchie, contrôles, lisibilité et responsive harmonisés sur les écrans du produit, avec les six thèmes conservés.
- Correction du packaging navigateur de chrono-node et synchronisation des versions.
- Parcours et limites : [RELEASE_0.4.9.md](DOCS/RELEASE_0.4.9.md).

## 0.4.8 — BETA — 2026-10-02

- Détection de dates en langage naturel dans le chat (chrono-node + parseur FR personnalisé) : formats « 22/01/2027 à 15h », « 22 janvier », « demain 14h », « lundi prochain 10h », « dans 2 jours 16h », « ce week-end », heures seules « 15h ».
- Pills cliquables sous le compositeur pendant la saisie, badges 📅 sur les messages envoyés (API `detectedDates`).
- Création d’événement calendrier pré-rempli depuis un clic date/heure (même formulaire que le calendrier, permissions `CREATE_CALENDAR_EVENT`).
- Fix coercion Zod `all_day` / `reminder_minutes` pour compatibilité FormData.

## 0.4.7 — BETA — 2026-09-25

- Finalisation du jalon 0.4.0 : calendrier récurrent avec fuseaux, fins de mois et journées entières ; édition de séries et permissions dédiées.
- Worker transactionnel de rappels, report/récurrence et notifications d’événements, indépendant de la supervision Argos.
- Favoris validés et navigables, filtres de recherche salon/auteur/dates, raccourcis préservant la saisie.
- Web Push complet côté application : consentement, abonnements chiffrés liés à la session, file persistante, chiffrement/VAPID, retries et nettoyage.
- PWA : icônes PNG, précache statique sans données privées, retour hors ligne et mise à jour contrôlée avec retrait des anciens caches.
- Migration 006 additive, tests de calendrier/rappels/favoris/push et parcours navigateur 0.4. Contrats et configuration : DOCS/EXPERIENCE_0.4.md.

## 0.4.6 — BETA — 2026-09-25

- Heartbeat Argos : réception persistée même avant la création de la cible, accusé daté et distinction entre signal jamais reçu et expiré.
- Émetteur autonome pour Argus, contrôle de santé préalable, refus des redirections et guide systemd.
- Aide de configuration directement dans la supervision, lisible sur ordinateur et mobile.
- Enregistrement du service worker déplacé dans un module pour respecter la CSP qui bloquait le script inline.
- Versions package, fichier VERSION et affichage synchronisées (elles divergeaient entre 0.4.5 et 0.4.0). Type des groupes de membres complété pour rétablir la compilation.
- Revue factuelle de la roadmap et de la charte, limites 0.4 et propositions dans DOCS/Idées.md. Aucun déploiement distant effectué.

Les notes 0.4.0 ci-dessous décrivent l’intention historique ; la revue du 25 septembre fait autorité sur les fonctions partielles.

## 0.4.0 — BETA — 2026-09-16

- Calendrier d'équipe avec création, édition, suppression et récurrence des événements.
- Rappels personnels récurrents avec report et archivage.
- Favoris : raccourcis privés vers channels, pages, projets et événements.
- Raccourcis clavier étendus : ⌘1-7 pour les vues principales, ⌘, pour les préférences, ⌘/ pour l'aide.
- Notifications push desktop avec service worker et abonnement aux push.
- Thèmes avancés : Minuit, Forêt et Braise en plus de Graphite, Papier et Crépuscule.
- Gestion fine des états hors ligne avec indicateur et cache service worker.
- PWA installable : manifest, service worker avec cache et notifications push.
- Améliorations mobile : touch targets agrandis, grille calendrier adaptée.

Détails et limites : [DOCS/RELEASE_0.4.0.md](DOCS/RELEASE_0.4.0.md).

## 0.3.0 — BETA — 2026-09-16

- Configuration des modules en base, test, secrets chiffrés et rotation.
- DropIt personnel : consentement, renouvellement, fichiers autorisés et insertion de liens.
- GitHub/Nino/Narra : événements enrichis, HMAC, routage, tâches automatiques et filtres sortants.
- Commandes privées, tutoriels et réglages de supervision.
- Adaptation DropIt 1.1.0 avec Kyros v4 et sessions persistantes.

Détails et limites : [DOCS/RELEASE_0.3.0.md](DOCS/RELEASE_0.3.0.md).

## 0.2.1 — ALPHA — 2026-09-15

- Mentions lisibles, aperçus images/GIF/liens et sélecteur complet des emojis Unicode.
- Invitations par lien, amis et présence, préférences DMs, édition/modération des fils et accès direct aux résultats.
- Aperçu des pages, blocs embarqués, fusion des modifications par bloc et historique.
- Participants, fichiers, activité et modèles de tâches ; gestion des projets/boards et groupes d’accès.
- Avatar, sons, notifications, thème Crépuscule, raccourcis personnels et aide avec tutoriels.
- Pagination, isolation des suppressions, récupération distante contrôlée et résilience aux erreurs de lecture.

Détails et limites : [DOCS/RELEASE_0.2.1.md](DOCS/RELEASE_0.2.1.md).

## 0.2.0 — ALPHA — 2026-09-15

- Supervision réservée aux rôles autorisés, contrôles API et actualisation des droits sans reconnexion.
- Menu de l’espace fonctionnel au clavier, sur ordinateur et mobile.
- Correction de la page blanche Membres → Rôles et permissions et des réponses réseau obsolètes.
- Fils de discussion, messages épinglés et recherche PostgreSQL indexée.
- Salons privés avec accès par membre, conversations directes et fichiers liés aux salons.
- Migration additive, version partagée entre serveur et interface ; tests de confidentialité et de non-régression.

Détails, compatibilité et limites : [DOCS/RELEASE_0.2.0.md](DOCS/RELEASE_0.2.0.md). La suite du lot collaboration reste en 0.2.x.

## 0.1.0 — ALPHA — 2026-09-15

Première version de Liora à la racine du dépôt.

- Identité, logos SVG clair/sombre, icône/favicon, version produit.
- React/TypeScript, API Express, PostgreSQL avec migrations vérifiées, seed LUMA.
- Kyros SSO v4 PAR/PKCE, JWT RS256, refresh automatique sous verrou, sessions chiffrées et révocables.
- Workspaces, rôles personnalisables, permissions locales et audit ; bots et services séparés des comptes humains.
- Salons/catégories, messages SSE, réponses, mentions, réactions, édition et suppression logique.
- Projets, boards, colonnes, Kanban, cartes, responsables, échéances, checklist, liens et commentaires.
- Pages simples à blocs et révisions contre les écrasements concurrents.
- Webhooks entrants dont format Argos natif ; sortants signés, outbox, retries et annulation.
- Monitoring du superviseur Argus/Argos et heartbeat ; notifications personnelles.
- Administration, préférences, sessions, fichiers et emojis personnalisés.
- Modules médias désactivés ; documentation des limites et prochaines étapes.
- Tests des parcours métier et navigateur desktop/mobile sur serveur compilé.

Aucune modification des dépôts externes. Voir DOCS/EXTERNAL_CHANGES.md.
