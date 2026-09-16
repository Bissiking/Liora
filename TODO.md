# TODO Liora

## NOW

- Validation Kyros réelle avec configuration d'application et compte autorisé.
- Configurer les URLs Argus/Argos et le heartbeat depuis la machine distante.
- Vérifier une restauration PostgreSQL + fichiers dans l'environnement cible.

## NEXT

- Déployer DropIt 1.1.0 et valider le consentement avec les vraies inscriptions Kyros v4.
- Configurer les clés et les émetteurs GitHub/Nino/Narra selon DOCS/INTEGRATIONS.md.
- Futur module de synchronisation LUMA distinct ; aucun moteur à développer dans Liora.
- Purge contrôlée des fichiers orphelins et pagination des historiques anciens.
- Ajouter limites de débit partagées avant de déployer plusieurs répliques.

## LATER

- Application mobile native (étude de faisabilité en cours).
- Synchronisation temps réel pour les événements calendrier.
- Vue jour/semaine du calendrier.
- VAPID keys pour notifications push en production.

## DONE

- 0.4.0 : calendrier, rappels, favoris, raccourcis, push, thèmes avancés, hors ligne, PWA.

- 0.3.0 : connecteurs en base, DropIt personnel, routage/automatisations, HMAC, filtres et commandes.

- 0.2.1 : collaboration avancée, invitations/amis, aperçus, groupes, personnalisation et tutoriels.

- 0.2.0 : supervision autorisée, menu espace, onglets admin fiables, fils/épingles/recherche et conversations privées.

- Socle PostgreSQL, migration et seed idempotents.
- Kyros v4, refresh verrouillé, permissions et isolation.
- UI responsive et fonctionnalités principales persistées.
- Tests d’intégration, tests navigateur production, build et guides opérateur.
