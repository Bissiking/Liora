# Poste de travail Liora — 1.0.0-beta.1

Mode : Operate. Direction imposée par l’utilisateur : modèle mental Discord, identité Liora existante. Construction en code, sans comp raster approuvé. Ce brief remplace la composition 0.4.9 ; les contrats fonctionnels des modules conservés demeurent applicables. Autorité : `.impeccable/directions/liora-100.md`.

## Direction contract

THESIS : retrouver une portée puis agir sur une ressource dans le modèle Discord.
OWN-WORLD : identité Liora, Graphite, Manrope, sauge, plans mats et traits fins ; dix palettes, une géométrie applicative.
STORY : entrer dans son espace personnel, rejoindre un workspace, reprendre un canal et ouvrir une action autorisée.
FIRST VIEWPORT : rail personnel/workspaces (68 px), sidebar de portée (236 px), corps flexible ; canal identifié au-dessus du transcript, contexte membres/fils/épingles/fichiers à droite.
FORM : choix utilisateur Discord dans le monde Liora existant, construction en code sans nouveau seed ni image approuvée. Mobile : rail (56 px), dock personnel, navigation et contexte en tiroirs accessibles.
FINISH : unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Comportement construit

Le rail distingue accueil personnel, messages et workspaces. Les serveurs n’affichent pas de bouton « … » ; leur menu est accessible au clic droit et avec Maj+F10. La sidebar nomme la portée puis affiche ses outils, rubriques, catégories et canaux. Revenir à un workspace restaure la vue et le canal conservés dans la session. Les catégories se replient par compte ; état actif, non-lu et mention restent distincts. La commande rapide et la recherche de messages gardent des entrées dédiées. Pages et Google ne sont plus des entrées du parcours courant.

Le canal chargé commence par ses messages. Membres et rôles, fils, épingles et fichiers proviennent du contexte réel reçu ; chargement, erreur et absence de contenu sont écrits. Les titres de fils actifs sont dérivés du message d’origine, avec mentions résolues via les noms enregistrés des membres de l’espace, y compris ceux absents de la liste visible du canal. L’extrait retire le Markdown, replie les espaces et remplace un nom manquant par « @membre » ; les épingles utilisent la même lecture. Le compteur écrit « 1 réponse » ou « n réponses ». Aucun nouveau stockage de nom de fil n’est introduit. Le contexte permanent quitte la colonne à 1100 px et moins, avec accès par dialogue/tiroir. Les profils et menus se limitent à leur portée. Les autorisations effectives filtrent les actions, réactions et comptes de réponse. Gérer les options, accès individuels et groupes du canal reste possible avec le droit effectif de gestion du canal quand la lecture est refusée ; la commande de suivi reste absente sans lecture effective. Les conversations privées gardent leurs participants fixes et leurs protections propres. Les aperçus de liens demandés depuis un message de workspace sont rattachés à son canal et exigent sa lecture effective ; cette portée ne remplace pas le contrat historique des requêtes d’aperçu sans canal.

À 700 px et moins, le rail reste visible, la sidebar se déploie derrière un fond dismissible et le dock offre Personnel / Amis / Navigation. Ouverture, Tab et Échap gèrent le focus. L’identité du canal occupe sa propre rangée avant les commandes de 44 px ; un seul ellipsis de message remplace les commandes au survol. Champs, zones éditables, code et texte sélectionné gardent les menus natifs.

## Paramètres de canal — correction ciblée du 6 octobre 2026

Le dialogue contient la navigation et son contenu dans une seule couche : largeur maximale 880 px, navigation de 185 px, zone de champs flexible à défilement propre et pied d’actions séparé visible. Général regroupe Identité du canal, Organisation, Fonctionnement et accès ; les libellés et aides nomment le type, la visibilité et l’archivage. Options associe slowmode et bascules des fils/suivi ; Permissions présente le rôle ou membre puis Hériter / Autoriser / Refuser. Suivre ce canal est persisté immédiatement et conserve le délai encore non enregistré, sans rechargement du brouillon.

À 700 px et moins, la navigation se replie sur plusieurs lignes, les paires de champs se superposent et les actions restent accessibles à 390 et 320 px. Accès privés intègre `ChannelAccess` dans le même dialogue : groupes et membres défilent au-dessus de « Enregistrer les accès ». La preuve locale utilise une liste de 21 membres ; le pied d’action reste visible. L’entrée autonome de `ChannelAccess` garde son dialogue et son défilement naturel.

## Modules conservés

Mes lieux reste personnel : recherche libre explicite → résultat → À essayer / Visité, ou ajout manuel dans la page. Notes privées et partage de visite sur choix ; coordonnées avancées repliées. La recherche libre garde l’ordre du fournisseur ; les commandes de proximité seules appliquent rayon et distance. Carte et Kanban défilent dans leur cadre. Aucun accès personnel ne dépend d’un workspace.

## État de fin et preuve

Le reviewer final a donné **ship** après résolution de F1–F4 : texte Papier via `--text`, identité/actions mobiles séparées, ellipsis mobile unique, réactions/réponses filtrées selon les permissions. Les tokens et composants réellement construits sont enregistrés dans `DESIGN.md` et `.impeccable/design.json`.

Captures locales courantes : `desktop.png`, `mobile.png`, `v1-channel-320.png`, `v1-paper-desktop.png`, `v1-readonly-desktop.png`, `v1-context-mobile.png`, `v1-personal-desktop.png`, `v1-no-workspace-mobile.png` sous `.impeccable/review/`. Données nommées démonstration et identité Kyros synthétique. Le lot initial rapportait 73 tests, compilation et E2E locaux passés ; la correction ciblée ci-dessous porte cette preuve locale à 76/76 tests. Aucun check applicatif n’a été relancé par ce pass documentaire. Le verdict qualifie les surfaces examinées, pas les fournisseurs, appareils natifs ou la production. Stable 1.0.0 reste à qualifier.

La revue ciblée finale est **ship** : sur les 16 captures examinées initialement, un seul finding demandait de sortir l’enregistrement des accès privés du défilement ; le pied séparé a résolu ce point. Les autres régions demandées concordaient avec le contrat. Ce verdict qualifie Messages privés, Amis, aperçus de fils et paramètres de canal ; il ne remplace pas une revue globale de Liora.

Captures de cette correction sous `.impeccable/review/` : `social-channel-general-desktop.png`, `social-channel-general-mobile.png`, `social-channel-general-320.png`, `social-channel-access-desktop.png`, `social-channel-access-mobile.png`, `social-channel-options-mobile.png`, `social-channel-permissions-desktop.png`, `social-threads-desktop.png`, ainsi que les messages/amis référencés dans `personal-070.md`. Le documenter a ouvert Messages privés desktop, Accès privés mobile et Général à 320 px ; les autres captures et assertions sont celles du builder/reviewer. Le parent rapporte 76/76 tests, build et E2E Chrome for Testing/Puppeteer passés ; base isolée, Kyros et providers synthétiques seulement, sans preuve de fournisseur réel ni de déploiement. Aucun nouvel asset raster livré ; les captures sont des preuves de revue, pas une comp approuvée.

Détecteur limité à ce scope : 0 finding primaire, 20 avis font/radius. Les tailles locales réellement construites sont documentées sans changer le monde partagé ni prétendre à une liste d’avis vide. Sources : `ChannelSettings.tsx`, `ChannelContextPanel.tsx`, `Collaboration.tsx`, `styles/channel-settings.css`, `shared/message-preview.ts`, `server/channels.ts`. Le sidecar est synchronisé avec ces composants et avec l’exception déjà construite du rail sans ellipsis.
