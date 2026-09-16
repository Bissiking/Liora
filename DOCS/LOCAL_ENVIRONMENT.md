# Environnement local préparé

L’application est servie sur http://localhost:4310 avec le build production.
PostgreSQL a été initialisé séparément des autres projets :

- données locales : `.local/postgres` (ignorées par Git) ;
- écoute : 127.0.0.1:55432 ;
- base de travail : `liora` ;
- bases jetables des tests : `liora_test`, `liora_e2e` ;
- configuration : `.env` privé, conservé hors Git.

Le dossier `.local` doit être préservé pour conserver cette instance de développement. Après un redémarrage de la machine, si elle n’est plus démarrée :

```sh
pg_ctl -D .local/postgres -l .local/postgres.log -o '-p 55432 -h 127.0.0.1' start
NODE_ENV=production npm start
```

La configuration Kyros a été conservée ; le démarrage PAR est accepté. Pour attribuer l’espace LUMA existant, renseigner BOOTSTRAP_OWNER_KYROS_ID avec le sujet réel du propriétaire et se reconnecter. Un login sans espace affiche l’identifiant Kyros utile. Cette étape évite une attribution au premier visiteur inconnu.

Les tests réinitialisent uniquement les bases explicitement dédiées. Ne pas utiliser leurs commandes avec la base `liora` ou une base d’un autre projet. DropIt est adapté en 1.1.0 pour Liora 0.3.0 ; son service réel n’est pas redémarré automatiquement.

## Mise à jour 0.2.0

Migration 002 appliquée le 15 septembre 2026, instance relancée et `/health/ready` vérifié en 0.2.0. Sauvegarde privée préalable : `.local/backups/pre-0.2.0-2026-09-15T20-32-13-073Z/` (PostgreSQL, configuration et fichiers présents). Les données et les sessions locales sont conservées.

## Mise à jour 0.2.1

Migration 003 appliquée le 15 septembre 2026, serveur compilé relancé et `/health/ready` vérifié HTTP 200 en **0.2.1**, PostgreSQL up. Configuration `.env` identique à la sauvegarde ; utilisateurs, sessions, messages et tâches présents après migration.

Sauvegarde privée : `.local/backups/pre-0.2.1-2026-09-15T21-39-39-965Z/`, actualisée une dernière fois serveur arrêté avant migration (PostgreSQL, `.env` et fichiers). Base de travail `liora` conservée ; les fixtures restent exclusivement dans `liora_test` / `liora_e2e`. Recharger le navigateur pour récupérer les nouveaux fichiers client.
