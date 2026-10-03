# Sauvegarde et restauration

Sauvegarder ensemble PostgreSQL, le répertoire UPLOAD_DIR et la configuration chiffrée hors dépôt. SESSION_SECRET est indispensable pour relire les tokens de sessions et secrets d’envoi ; perdre cette clé impose reconnexion et recréation des secrets. Les clés Kyros privées restent chez Kyros.

La 0.5.0 ajoute des données personnelles à inclure dans la sauvegarde PostgreSQL : `friend_messages`, `place_categories`, `places` et `place_entries`. Vérifier en restauration l’historique entre amis, les notes et la confidentialité des visites, avec deux identités distinctes.

## Sauvegarde manuelle

Planifier selon le volume et tester les restaurations. Ne jamais publier les fichiers obtenus : ils contiennent des données privées et des tokens chiffrés.

```sh
mkdir -p backups
chmod 700 backups
pg_dump --dbname="$DATABASE_URL" --format=custom --file="backups/liora.dump"
tar -czf backups/uploads.tar.gz uploads
chmod 600 backups/*
```

Exporter la configuration via le gestionnaire de secrets utilisé en production. Pour une sauvegarde cohérente pièces jointes/DB, arrêter temporairement les écritures le temps des deux sauvegardes.

## Restauration sur une base vide séparée

```sh
createdb liora_restore
pg_restore --dbname=liora_restore --no-owner --no-privileges backups/liora.dump
```

Extraire les fichiers dans un nouveau répertoire. Configurer DATABASE_URL et UPLOAD_DIR de l’instance de restauration, fournir la même SESSION_SECRET, puis démarrer. Vérifier `/health/ready`, historique des messages, cartes, rôles et téléchargement d’une pièce jointe. Ne pas diriger l’instance de restauration vers les intégrations de production pendant la validation.

Ne pas utiliser `--clean` contre la base active. Retour arrière : restaurer une sauvegarde compatible avec la version du code ; une migration appliquée n’est jamais réécrite. L’automatisation, le chiffrement des backups et les tests de restauration planifiés restent des responsabilités opérateur.
