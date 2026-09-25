# Adaptations externes — historique versionné

## Liora 0.3.0 / DropIt 1.1.0 — 2026-09-16

DropIt passe de 1.0.2 à 1.1.0. Ajouts : src/integrations.js (API déléguée et SQLite), public/integrations.html et assets (clés/consentements), src/kyros-v4.js ; adaptation src/auth.js vers SSO v4 durable, server.js et navigation, dépendances et tests. Notes dans `DropIt/DOCS/RELEASE_1.1.0.md` et `DropIt/DOCS/LIORA_API.md`.

Compatibilité : Node ≥22.13, inscription Kyros v4 à vérifier, anciennes sessions mémoire à reconnecter une fois ; fichiers/partages conservés. Sauvegarder data (dont auth-master.key et les SQLite) et uploads avant déploiement. Aucun .env réel modifié, aucun service DropIt réel redémarré. Retour arrière : remettre le code/dépendances 1.0.2 et désactiver le connecteur Liora ; garder les nouveaux fichiers de données pour une reprise ultérieure.

Tests isolés de l’API réelle, PKCE, propriété, rotation/révocation et SSO v4 avec fournisseur de test. Aucun changement dans Argos, Kyros, Nino ou Narra. L’émission depuis leurs instances reste à configurer.

## Contrat d’intégration 0.1 — 2026-09-16 — base Liora 0.2.1

Décisions consignées dans ROADMAP.md, PROJECT_CHARTER.md et DOCS/INTEGRATIONS.md : fichiers délégués à DropIt, synchronisation dans un module LUMA distinct, configuration des connecteurs en base et séparation clé applicative/autorisation personnelle. TODO.md, README.md et le guide d’architecture sont alignés.

DropIt 1.0.2 et Kyros consultés en lecture seule pour vérifier API, identité et contraintes existantes. Aucun dépôt externe modifié, aucun secret déplacé, aucune migration ni nouvelle fonction exécutable ; version Liora inchangée. La clarification du 15 septembre ci-dessous est remplacée par ces décisions.

## Clarification de roadmap — base Liora 0.2.1 — 2026-09-15

Syncthing devient explicitement facultatif. ROADMAP.md distingue partage de fichiers dans Liora, synchronisation entre appareils et remontée d’événements. Aucun changement de code, de schéma ou de version exécutable ; aucun logiciel installé ni dépôt externe modifié. La synchronisation maison reste à cadrer selon l’usage demandé.

## Liora 0.2.1 — 2026-09-15

Modifications confinées à Liora : collaboration avancée, invitations et amis, médias/aperçus, pages/tâches, groupes, préférences et aide. Aucun dépôt externe modifié, aucun changement du contrat Kyros v4. Voir [RELEASE_0.2.1.md](RELEASE_0.2.1.md).

## Liora 0.2.0 — 2026-09-15

Modifications confinées au dépôt Liora : permissions de supervision, navigation/admin et collaboration privée. Aucun fichier, version, secret ou contrat modifié dans Argos, Kyros, Drivio ou Nino. Détails dans RELEASE_0.2.0.md.

## Liora 0.1.0 — 2026-09-15

| Dépôt        | Lecture / réutilisation                                              | Modification                           | Version externe |
| ------------ | -------------------------------------------------------------------- | -------------------------------------- | --------------- |
| Drivio       | Contrat client Kyros v4 réadapté dans `src/server/kyros.ts` de Liora | Aucune                                 | Inchangée       |
| kyros        | Vérification PAR, JWT, scopes et `/sso/v4/jwks`                      | Aucune                                 | Inchangée       |
| Argos        | Format `notification-channels.ts` et routes de santé                 | Aucune ; adaptation du récepteur Liora | Inchangée       |
| nino-backend | Réception générique des événements Nino préparée dans Liora          | Aucune                                 | Inchangée       |

Liora porte sa propre adaptation sous la version 0.1.0. Aucun commit, tag, fichier de configuration ou secret d’un dépôt externe n’a été modifié.

Toute future modification externe doit ajouter ici une entrée : dépôt, ancienne/nouvelle version, fichiers, comportement, compatibilité, tests et procédure de déploiement/retour arrière. Ajouter aussi un résumé sous DOCS du dépôt modifié.

## 25 septembre 2026 — heartbeat et revue 0.4.6

Aucun dépôt externe modifié, aucun secret créé sur un service distant. Liora fournit un émetteur autonome à installer sur Argus et une procédure systemd dans ARGOS.md. Le timer n’a pas été installé ni exécuté sur Argus pendant cette intervention. Les changements locaux déjà présents sur les intégrations et la synchronisation des cibles ont été conservés.

## 25 septembre 2026 — finalisation expérience 0.4.7

Modifications limitées à Liora. Dépendances ajoutées : `@js-temporal/polyfill` (calculs horaires) et `web-push` (protocole/chiffrement), avec types de développement. Aucun dépôt ou service Kyros/Argos/DropIt/Nino/Narra modifié. Les tests push utilisent un transport contrôlé ; aucune notification envoyée à un destinataire externe pendant cette intervention.
