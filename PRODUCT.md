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

Kyros SSO v4 authentifie uniquement. Autorisations locales, PostgreSQL obligatoire, bots et services distincts des humains, modules Jellyfin/demandes de médias désactivés. Les images et GIF partagés dans le chat disposent d’aperçus. Modules administrés en base, DropIt personnel, événements et règles filtrées. Calendrier récurrent, rappels effectifs, favoris, recherche filtrée et Web Push sur consentement complètent le lot expérience. Version courante 0.4.7 BETA ; historique dans CHANGELOG.md.

## Evidence on Hand

DOCS/PROJECT_CHARTER.md contient la demande originale. Dépôts Kyros, Drivio et Argos consultables localement. Aucune donnée de production ni preuve commerciale.

## Product Principles

Persistance avant apparence ; permissions côté serveur ; intégrations isolées ; états explicites et actions réversibles.

## Accessibility & Inclusion

Interface française, clavier, focus visibles, mobile fonctionnel.

## Decisions

Nom retenu par délégation : Liora (lumière et liaison). Alternatives : Nacre (moins orienté communication), Relio (plus générique), Atria (déjà courant). Disponibilité commerciale non vérifiée.
Hypothèse de conception : usage fréquent sur ordinateur, navigation compacte et espace central calme.
