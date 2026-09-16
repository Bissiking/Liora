# Intégrations LUMA — Liora 0.3.0 / DropIt 1.1.0

Implémentation du 16 septembre 2026. Les réglages quotidiens des modules sont stockés en PostgreSQL et modifiables dans l’interface, sans redémarrage ni variable `.env` par module. La connexion DB, la clé maîtresse et le SSO de l’application restent dans la configuration de démarrage.

## Brancher DropIt

1. Déployer DropIt 1.1.0 avec Node ≥22.13 et son application Kyros **v4**. Liora et DropIt doivent vérifier le même émetteur Kyros, avec leurs propres client IDs et audiences de ressource.
2. Dans Liora, Administration → Intégrations → Ajouter un module. Copier l’URL de retour affichée.
3. Dans DropIt → Applications connectées (`/integrations`), créer une application nommée Liora avec cette URL exacte. Copier son identifiant et la clé affichée une seule fois.
4. Dans Liora, choisir DropIt, renseigner URL, identifiant et clé, puis un salon par défaut. Enregistrer et tester. HTTPS est requis ; un administrateur disposant de MANAGE_SECURITY peut autoriser un réseau privé (HTTP uniquement en boucle locale).
5. Chaque membre ouvre son profil → Comptes connectés → Connecter. DropIt demande son accord. Une autre identité Kyros est refusée. Les fichiers restent personnels, même pour l’administrateur Liora.
6. Mes fichiers affiche les fichiers des partages actifs. Le bouton DropIt du chat insère un lien dans le brouillon après confirmation. **Le lien donne accès à tous les fichiers du partage à quiconque le possède, indépendamment des droits du salon**, jusqu’à expiration ou révocation dans DropIt.

L’accès délégué est limité à `files:list` et `shares:read`. L’upload, la création d’un nouveau partage et le téléchargement restent dans DropIt ; Liora sélectionne un partage existant. Les pièces jointes locales historiques restent conservées et utilisables. Le moteur de synchronisation PC ↔ serveur reste un futur module LUMA distinct, réalisé séparément : aucun moteur Syncthing ou maison n’est ajouté ici.

## Identité, secrets et révocation

La clé API authentifie l’application ; elle ne suffit jamais pour consulter les fichiers. Le compte personnel est prouvé par consentement DropIt, code à usage unique, PKCE S256 et `state` lié à l’utilisateur Liora. Liora contrôle **émetteur Kyros + sub** à l’échange et au renouvellement. Aucun `user_id` fourni librement n’accorde de droit.

Les clés utilisées et les jetons reçus sont chiffrés côté Liora avec la clé maîtresse existante. DropIt conserve uniquement les empreintes de ses clés et jetons délégués. Accès 15 minutes, refresh 30 jours glissants, rotation à chaque renouvellement. Liora sérialise les renouvellements sous verrou PostgreSQL. Les sessions SSO DropIt sont désormais persistantes, avec jetons chiffrés dans `data/auth.sqlite` et clé séparée `data/auth-master.key` (0600).

Un changement d’URL, de client, de clé ou de politique réseau invalide les autorisations locales et le test de connexion. Désactiver un module bloque ses entrées et supprime les connexions personnelles locales. Déconnecter tente aussi la révocation distante ; si DropIt est inaccessible, la suppression locale reste effective, mais l’autorisation distante doit être retirée dans DropIt → Applications connectées. Les liens déjà publiés ne sont pas supprimés par la déconnexion.

## Événements et automatisations

Administration → Intégrations nécessite MANAGE_WORKSPACE et MANAGE_WEBHOOK ; créer un connecteur nécessite aussi CREATE_WEBHOOK. La création montre une seule fois l’URL entrante et le secret. Renouveler remplace les deux : mettre à jour l’émetteur.

- GitHub : signature native `X-Hub-Signature-256: sha256=<hex>` du corps JSON brut. Événements supportés : `push`, `issues`, `pull_request`, `workflow_run`, `release`, `ping`. Les messages reprennent dépôt, titre et lien. Type normalisé : `github.<event>.<action>`. Déduplication avec `X-GitHub-Delivery`.
- Nino/Narra : enveloppe JSON ci-dessous, préfixe du fournisseur obligatoire ; titre, message, niveau et payload sont conservés. Leurs émetteurs ne sont pas installés/modifiés par cette version.
- Argos : format natif `alert.active` / `alert.resolved` accepté. Générique : contrat événementiel Liora habituel.

```json
{
  "type": "nino.video.ready",
  "title": "Vidéo prête",
  "message": "Encodage terminé",
  "severity": "info",
  "payload": { "video_id": "42" }
}
```

Pour Narra, utiliser par exemple `narra.chapter.published`. Signature Liora par défaut : `X-Liora-Timestamp` = secondes Unix, `X-Liora-Signature` = HMAC-SHA256 hex de **timestamp + "." + corps brut** avec le secret montré. Fenêtre ±300 secondes. `Idempotency-Key` évite les répétitions ; sans identifiant, une signature identique est dédupliquée. Option URL secrète seule disponible au renouvellement pour les fournisseurs hors GitHub.

Une règle filtre un type exact, `prefix.*` ou `*`, éventuellement un niveau exact. Elle publie dans un salon autorisé et peut créer une tâche dans une colonne choisie (CREATE_TASK requis). Pas de DM cible. Maximum 30 règles par connecteur. Plusieurs règles visant la même destination ne dupliquent pas le message ou la tâche. **Dès qu’une règle existe, un événement sans correspondance ne produit aucun message/tâche** ; il reste dans le flux événementiel. Sans règle, le salon par défaut reçoit les messages. Supprimer un board/une colonne supprime les règles qui en dépendent.

Les webhooks sortants ont leurs propres filtres : liste vide = tous les événements, sinon types/préfixes sélectionnés. Les livraisons déjà en file ne sont pas recalculées lors d’un changement de filtre. File, retries et annulation restent disponibles.

## Supervision et commandes

Les URL des cibles HTTP de supervision existantes se modifient dans le panneau d’intégrations ; lecture MANAGE_MONITORING, écriture MANAGE_MONITORING + MANAGE_SECURITY. La base fait foi, sans écrasement au redémarrage. Les destinataires internes restent un choix d’opérateur. Un test GitHub contrôle `/user`, Nino/Narra `/health` ; il ne prouve pas que leurs événements sont configurés.

`/aide`, `/salon`, `/taches [texte]`, `/statut` : réponse privée dans un panneau, aucune mutation ni publication. Les permissions du salon, des tâches et de supervision sont recontrôlées côté serveur.

## API Liora

Préfixe `/api/v1/workspaces/:workspaceId` :

- `GET/POST /connectors`, `PATCH /connectors/:id`
- `POST /connectors/:id/test`, `POST /connectors/:id/rotate-incoming`
- `GET/POST /connectors/:id/rules`, `DELETE /connectors/:id/rules/:ruleId`
- `GET /connections`, `POST /connections/:id/start`, `DELETE /connections/:id`
- `GET /connections/:id/files?offset=0&limit=50`
- `POST /connections/:id/shares/:shareId/link`
- `GET /monitoring-settings`, `PATCH /monitoring-settings/:id`, `POST /commands`

Retour global authentifié : `GET /api/v1/integration-callback`. Entrées : `POST /api/webhooks/:token`. Documentation du fournisseur : `DropIt/DOCS/LIORA_API.md`.

## Limites de validation

Le véritable routeur DropIt est exercé en tests isolés, avec des comptes et fichiers synthétiques. Son nouveau SSO v4 est testé contre un fournisseur Kyros de test. Aucun login humain réel ni branchement aux instances publiques de DropIt/GitHub/Nino/Narra n’a été effectué. Les clés réelles se renseignent dans l’interface. Voir [VALIDATION.md](VALIDATION.md) et [EXTERNAL_CHANGES.md](EXTERNAL_CHANGES.md).
