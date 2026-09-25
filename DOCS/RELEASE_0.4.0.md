# Jalon 0.4.0 — BETA · expérience

Le lot annoncé initialement en 0.4.0 a été achevé dans la maintenance **0.4.7**, le 25 septembre 2026. Les lacunes identifiées lors de la revue 0.4.6 sont corrigées ; le numéro de version installé continue de progresser.

- Calendrier mensuel, agenda mobile, recherche, édition/suppression et récurrences avec fuseaux, DST et fins de mois. Les modifications portent sur toute la série.
- Rappels personnels effectivement notifiés, reportables, archivables et récurrents ; reprise transactionnelle après interruption. Rappels d’événements pour leur auteur.
- Favoris privés validés et ouverture des ressources, recherche de messages filtrée, raccourcis qui respectent permissions et champs de saisie.
- Consentement Web Push depuis les préférences, abonnement chiffré lié à la session, émission serveur VAPID avec file, retries et gestion des abonnements expirés.
- Six thèmes, manifest et icônes PWA, précache des assets seulement, retour hors ligne explicite et mise à jour choisie avant rechargement.

## Installation

Appliquer les migrations jusqu’à **006_experience_complete.sql**, construire et redémarrer le serveur. Les abonnements push non liés aux sessions de l’ancienne 0.4.0 sont supprimés ; l’activation doit être refaite. Configurer une paire VAPID stable via `npm run push:keys` et le contact opérateur. Détails : [EXPERIENCE_0.4.md](EXPERIENCE_0.4.md).

## Périmètre de validation

[VALIDATION.md](VALIDATION.md) distingue tests PostgreSQL, fournisseurs de test, transport push contrôlé et navigateur local. La livraison sur un service push réel, les appareils physiques et les réglages de production nécessitent une recette de déploiement. Pas de modification de série occurrence par occurrence, de vues jour/semaine, de synchronisation de mutations hors ligne ni d’application mobile native dans ce lot.
