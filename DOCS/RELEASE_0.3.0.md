# Liora 0.3.0 — BETA · intégrations

16 septembre 2026.

## Livré

- Administration des modules en base : configuration, secret chiffré, test, activation et renouvellement des entrées.
- Connexion personnelle DropIt avec consentement, PKCE, contrôle d’identité, renouvellement et révocation. Liste paginée des fichiers de partages actifs et insertion de leur lien dans un brouillon après confirmation.
- Réception enrichie GitHub/Nino/Narra, signatures HMAC, déduplication et routage type/niveau vers salons et tâches. Filtres des webhooks sortants.
- Commandes privées `/aide`, `/salon`, `/taches`, `/statut` ; tutoriels correspondants.
- Configuration des cibles HTTP de supervision depuis l’interface, sous permissions administratives.
- DropIt passe de 1.0.2 à 1.1.0 : API déléguée, écran Applications connectées, Kyros v4 et sessions durables. Aucun changement dans Kyros, Argos, Nino ou Narra.

## Mise à jour

Sauvegarder PostgreSQL, fichiers et clé maîtresse. Installer les dépendances, construire puis appliquer `004_integrations.sql` avec `npm run db:migrate:prod`. Redémarrer Liora et recharger le navigateur. Migration additive : les pièces jointes, comptes et conversations restent présents. Les anciens webhooks sans signature conservent leur fonctionnement.

Configurer les modules dans Administration → Intégrations. Pour DropIt, déployer aussi 1.1.0, adapter son inscription Kyros en v4 et suivre [INTEGRATIONS.md](INTEGRATIONS.md). Les anciennes sessions mémoire DropIt nécessitent une connexion initiale après mise à jour ; les nouvelles persistent ensuite. Aucun secret `.env` existant n’est modifié automatiquement.

## Périmètre

DropIt expose en lecture les fichiers de partages déjà créés, pas un disque virtuel ni un upload Liora. L’insertion d’un lien concerne tout le partage public, pas seulement le fichier sélectionné. Les émetteurs Nino/Narra restent à configurer selon le contrat. Pas de synchronisation de dossiers PC dans Liora. Le module LUMA dédié et la 0.4 restent séparés.

Tests et limites : [VALIDATION.md](VALIDATION.md). Adaptations externes et retour arrière : [EXTERNAL_CHANGES.md](EXTERNAL_CHANGES.md).
