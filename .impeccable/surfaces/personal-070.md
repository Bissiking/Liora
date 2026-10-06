# Notes, messages et agendas personnels — 1.0

Mode : Operate. Surfaces personnelles Liora dans le nouveau shell 1.0.0-beta.1. Elles restent disponibles sans workspace. CalDAV devient le parcours d’agenda officiel ; Google OAuth/runtime a été retiré.

## Direction contract

THESIS : accéder aux priorités et conversations personnelles sans dépendre d’une équipe.
OWN-WORLD : Manrope et géométrie commune des dix palettes Liora, surfaces mates, traits fins, dates tabulaires et états explicites.
STORY : lire activité/rappels/favoris autorisés, ouvrir un message personnel, suivre une note datée et configurer son appareil.
FIRST VIEWPORT : rail personnel et sidebar d’outils ; accueil en lignes, Messages privés et Amis occupent le corps disponible avec index recherché/filtré adjacent au fil, notes par date/source ; CalDAV présente serveur et compte avant la création d’un accès.
FORM : modèle personnel de la direction Discord/Liora. Mobile : index remplacé par la discussion avec retour, notes empilées, configuration d’appareil en une colonne.
FINISH : unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Comportement construit

L’accueil, réception, rappels et favoris agrègent les données accessibles au compte. La présence de zéro workspace ne supprime pas ces parcours. Messages privés et Amis utilisent toute la largeur et hauteur disponibles du corps, sans plafond de page ni colonne centrale étroite. L’index mesure 300 px, puis 250 px à 1100 px et moins ; la discussion remplit le reste. L’index et le transcript défilent séparément ; identité et composeur restent visibles. À 760 px et moins, la conversation remplace l’index avec retour explicite de 44 px. Les brouillons, aperçu Markdown, heures, Envoyé / Lu et erreurs restent écrits. Les menus d’entité centralisés donnent leurs actions selon la ressource et les droits.

Messages privés propose une recherche et Toutes / Non lues ; les lignes portent avatar fixe de 38 px, nom, extrait lisible, éventuelle portée et compteur de non-lus. Amis garde recherche, Tous / Non lus / En ligne, statut écrit et sélection de la discussion. Ajouter un ami ouvre un dialogue pour créer le lien d’invitation ; l’acceptation reste sur la route dédiée au jeton et l’historique des invitations envoyées garde sa rubrique repliable. Les avatars d’en-tête mesurent 34 px. Les bulles entrantes et sortantes utilisent surface secondaire et sélection ; dates, Envoyé / Lu et aide restent lisibles sans devenir des cartes supplémentaires.

Les notes datées affichent date/heure, titre et source ; notes Liora modifiables, copies BrainDump en lecture seule. Consentement, liaison et actualisation BrainDump restent distincts ; le brief `braindump-integration.md` décrit cette limite de source.

CalDAV affiche serveur et identifiant avec copie, accès distinct nommé par appareil, mot de passe montré une seule fois avec masquage/copie, liste des accès et révocation explicite. Guides repliables adjacents à la configuration. Les calendriers d’équipe suivent les droits ; les notes datées restent en lecture. Aucune interface de connexion ou résolution de conflit Google ne fait partie du produit courant.

## État de fin et preuve

Captures de revue : `v1-personal-desktop.png`, `v1-no-workspace-mobile.png`, `v1-notes-mobile.png`, `v1-caldav-desktop.png`, `v1-caldav-mobile.png` sous `.impeccable/review/`. Verdict final **ship** du lot 1.0, avec système construit enregistré dans `DESIGN.md` et sidecar. Identités, providers et données de démonstration locaux ; ni client CalDAV natif réel, ni consentement fournisseur réel, ni déploiement qualifié. La synchronisation du thème garde ses limites compte/navigateur, sans promesse de propagation instantanée entre sessions ouvertes.

## Correction ciblée du 6 octobre 2026 — preuve et limite

Revue finale **ship** pour Messages privés, Amis, aperçus de fils actifs et paramètres de canal. Le seul finding de cette revue, l’enregistrement des accès privés situé dans le défilement, a été résolu par un pied d’actions séparé. Ce verdict ne constitue pas un audit global des écrans personnels. Les notes, BrainDump et CalDAV conservent leurs contrats précédents.

Captures de ce lot sous `.impeccable/review/` : `social-messages-desktop.png`, `social-messages-mobile.png`, `social-messages-light.png`, `social-messages-dark.png`, `social-friends-desktop.png`, `social-friends-mobile.png`. Le documenter a ouvert le desktop Messages privés, l’accès privé mobile et Général à 320 px ; la revue complète et les assertions de géométrie/runtime sont celles du builder et du reviewer. Le parent rapporte 76/76 tests, build et E2E Chrome for Testing/Puppeteer passés sur base et SSO synthétiques isolés. Providers, appareils et production restent non qualifiés. Aucun raster de production ajouté ; ces images sont des preuves locales de revue, pas une comp approuvée.

Détecteur exécuté une fois sur ce scope : 0 finding primaire, 20 avis sur les tailles et rayons. Les rôles et tailles locaux observés sont consignés dans `DESIGN.md` et le sidecar ; ce pass documentaire ne présente pas ces avis comme supprimés et ne relance pas le détecteur. Sources : `PersonalMessages.tsx`, `FriendMessenger.tsx`, `Social.tsx` et `styles/social.css`.
