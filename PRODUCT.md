# Liora

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Choix délégué explicitement par la charte : React, TypeScript strict, Vite, Express, PostgreSQL et SQL paramétré via pg. Un serveur permanent simplifie SSE, surveillance et livraison de webhooks. Aucun besoin de référencement ne justifie du SSR.

## Users

Équipe LUMA : discuter, organiser les projets et suivre les événements techniques dans un espace quotidien.

## Product Purpose

Relier conversation, tâches et événements de l'écosystème dans des workspaces autonomes.

## Capabilities and Constraints

Kyros SSO v4 authentifie uniquement. Autorisations locales, PostgreSQL obligatoire, bots et services distincts des humains, modules Jellyfin/demandes de médias désactivés. Les images et GIF partagés dans le chat disposent d’aperçus. Modules administrés en base, DropIt personnel, événements et règles filtrées. Calendrier récurrent, rappels effectifs, favoris, recherche filtrée et Web Push sur consentement complètent le lot expérience. Version courante 1.0.0-beta.1 ; historique dans CHANGELOG.md.

## Evidence on Hand

DOCS/PROJECT_CHARTER.md contient la demande originale. Dépôts Kyros, Drivio et Argos consultables localement. Aucune donnée de production ni preuve commerciale.

## Product Principles

Persistance avant apparence ; permissions côté serveur ; intégrations isolées ; états explicites et actions réversibles.

## Accessibility & Inclusion

Interface française, clavier, focus visibles, mobile fonctionnel.

## Decisions

Nom retenu par délégation : Liora (lumière et liaison). Alternatives : Nacre (moins orienté communication), Relio (plus générique), Atria (déjà courant). Disponibilité commerciale non vérifiée.
Hypothèse de conception : usage fréquent sur ordinateur, navigation compacte et espace central calme.

### Décision 0.5.0 — 3 octobre 2026

Mes lieux et les messages entre amis sont personnels et accessibles sans espace. La carte suit à la fois les lieux à essayer et déjà visités ; notes privées, visites partagées sur choix explicite. Recherche libre d’enseignes, restaurants, campings, musées, villes et adresses ; catalogue commun alimenté par ajout manuel ou sélection explicite d’un résultat OpenStreetMap. Le type Burger King historique est conservé, les autres résultats utilisent Lieu libre. Les trois univers structurants prolongent Liora avec typographie/géométrie/rythme distincts. Projets, calendrier et réglages privilégient navigation contextualisée et aide au bon endroit.

### Décision 0.6.0 — 5 octobre 2026

Projets avec index, cartes avec édition Markdown et propriétés, Kanban avec actions contextuelles, pages d’équipe en lecture initiale. Supervision recherchable et filtrable, services personnels structurés. Gotify comme destination personnelle des notifications internes, activation et test explicites. Avatar du compte Kyros synchronisé, surcharge locale conservée. Les catégories de navigation se replient par compte.

## Expérience 0.7.0

Notes datées personnelles reliées à BrainDump, Google Agenda dans les deux sens pour les événements Liora de l’auteur, CalDAV par appareil, choix du thème de compte ou du navigateur, dixième univers Lagune et index amis/conversation côte à côte. Markdown enrichi et aperçu dans les composeurs. Contrats, limites et configuration : DOCS/RELEASE_0.7.0.md.

## Intégration BrainDump — 0.7.1 du 5 octobre 2026

BrainDump 2.1.0 rejoint DropIt dans les paramètres : configuration en base, consentement personnel et PKCE, même sujet/émetteur Kyros, lecture seule des notes datées, refresh rotatif, révocation et retrait des copies. Aucune publication des notes privées dans un salon. Migration Liora 011 et SQLite BrainDump additive 3. Configuration et limites : DOCS/RELEASE_0.7.1.md. Fournisseurs réels et déploiement restent à qualifier.

## Direction 1.0 — 6 octobre 2026

Rail personnel/workspaces, navigation propre à chaque contexte et panneau utile pour les canaux. Rappels et activité personnels disponibles sans workspace ; favoris historiques agrégés selon les droits. Profils et menus centralisés sur les objets applicatifs. Canaux : droits par rôle/utilisateur, slowmode, fils et non-lus. Webhooks génériques TEXT/EMBED avec aperçu, test et historique. CalDAV devient le parcours officiel ; Google OAuth/runtime et interface Pages retirés, données historiques et API Pages conservées. Une géométrie commune aux dix palettes, synchronisation du thème inchangée. Version de développement 1.0.0-beta.1 ; qualification externe de stabilité encore ouverte.
