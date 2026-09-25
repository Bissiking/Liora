# Argus / Argos

Liora contrôle séparément l’API Argos, l’URL de santé d’Argus et un heartbeat authentifié envoyé **depuis Argus vers Liora**. Deux contrôles HTTP verts ne prouvent pas que cet envoi est configuré. « Aucun reçu » signifie qu’aucun signal n’a été enregistré ; ce n’est pas une mesure de latence.

## Côté Liora

1. Héberger Liora hors d’Argus pour conserver une surveillance indépendante.
2. Définir `ARGOS_BASE_URL` (le worker ajoute `/health/ready`) et `ARGUS_HEALTH_URL` dans l’environnement de Liora. Le worker synchronise les URL configurées ; `npm run monitoring:configure` permet également la mise à jour sur LUMA. Les modifications locales actuelles ont retiré leur administration depuis l’interface.
3. Dans **Menu de l’espace → Paramètres de l’espace → Bots et services**, créer un compte **service** avec uniquement `MANAGE_MONITORING`. Copier son jeton, affiché une seule fois. Ce jeton est émis par Liora, pas par Argos ni par Kyros.
4. Récupérer le chemin de réception dans **Supervision → Heartbeat Argos → Configurer l’envoi depuis Argus** et le préfixer par l’origine HTTPS de Liora.

`POST /api/v1/workspaces/{workspaceId}/heartbeat` utilise `Authorization: Bearer <jeton>`. La réponse confirme la persistance : `{"ok":true,"received_at":"…"}`. La cible est créée si elle manque, même avant le premier cycle du worker. La réception n’efface pas directement l’état ni l’historique : le prochain contrôle constate le rétablissement et émet la notification.

## Émetteur prêt à installer sur Argus

Le script `scripts/send-heartbeat.ts` vérifie d’abord la santé d’Argos, puis effectue un seul envoi. Il n’envoie rien si Argos est indisponible, refuse les redirections, limite chaque requête à cinq secondes et ne journalise ni jeton ni corps de réponse. Il exige un accusé de réception daté. Utiliser la version corrigée de Liora avant cet émetteur.

Après `npm run build`, copier `dist/tools/scripts/send-heartbeat.js` sur Argus sous `/opt/liora-heartbeat/send-heartbeat.mjs`. Le fichier est autonome : **Node.js 22.12 ou supérieur**, sans dépendances npm. Ne pas exécuter cette planification sur Liora, car elle doit témoigner de la disponibilité d’Argus.

Créer sur Argus `/etc/liora-heartbeat.env`, lisible uniquement par le compte qui exécute le service (par exemple `root:root`, mode `600`) :

```dotenv
LIORA_HEARTBEAT_URL=https://liora.example.com/api/v1/workspaces/UUID_ESPACE/heartbeat
LIORA_SERVICE_TOKEN=JETON_SERVICE_LIORA
ARGOS_HEALTH_URL=http://127.0.0.1:PORT_API_ARGOS/health/ready
```

Remplacer les exemples par les valeurs du déploiement. `ARGOS_HEALTH_URL` est l’URL complète accessible depuis Argus, différente de `ARGOS_BASE_URL` côté Liora. Utiliser HTTPS pour la réception distante afin de protéger le jeton.

Tester depuis Argus :

```sh
/usr/bin/node --env-file=/etc/liora-heartbeat.env /opt/liora-heartbeat/send-heartbeat.mjs
```

Résultat attendu : `Heartbeat enregistré par Liora à …`, puis **Disponible** au prochain cycle de contrôle. Adapter `/usr/bin/node` au chemin réel de Node sur Argus.

Créer `/etc/systemd/system/liora-heartbeat.service` :

```ini
[Unit]
Description=Heartbeat Argos vers Liora
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
EnvironmentFile=/etc/liora-heartbeat.env
ExecStart=/usr/bin/node /opt/liora-heartbeat/send-heartbeat.mjs
TimeoutStartSec=20
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
```

Créer `/etc/systemd/system/liora-heartbeat.timer` :

```ini
[Unit]
Description=Envoi du heartbeat Argos toutes les 60 secondes

[Timer]
OnBootSec=30s
OnUnitActiveSec=60s
AccuracySec=1s
Unit=liora-heartbeat.service

[Install]
WantedBy=timers.target
```

Activer après le test manuel :

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now liora-heartbeat.timer
sudo systemctl start liora-heartbeat.service
sudo journalctl -u liora-heartbeat.service -n 20 --no-pager
```

Arrêt réversible : `sudo systemctl disable --now liora-heartbeat.timer`. Pour une rotation, remplacer le jeton dans le fichier privé puis relancer le service. Ces instructions sont fournies pour le déploiement ; aucun service distant n’a été installé pendant la correction locale.

## Diagnostic et comportement

| Observation | Vérification |
| --- | --- |
| Jamais reçu, API et serveur disponibles | Installer l’émetteur et vérifier URL, UUID d’espace et jeton Liora. Les contrôles HTTP ne produisent pas de heartbeat. |
| HTTP 401 | Jeton absent, invalide, remplacé ou révoqué. |
| HTTP 403 | Permission `MANAGE_MONITORING` absente ou jeton d’un autre espace. |
| HTTP 404 / redirection / réponse HTML | URL de réception ou reverse proxy incorrect ; utiliser l’URL finale HTTPS. |
| HTTP 409 | Une cible homonyme existe avec un autre type ; corriger la configuration de cette cible. |
| Refus de santé Argos | Vérifier le service Argos et son URL `/health/ready` depuis Argus. |
| Expiré | Vérifier timer, journal, connectivité vers Liora et rotation du jeton. |
| Réception datée mais état encore rouge | Attendre le prochain cycle du worker, puis actualiser ; vérifier ses logs si l’état persiste. |

Expiration : `HEARTBEAT_TIMEOUT_SECONDS=180` par défaut côté Liora. Fréquence nominale : `MONITOR_INTERVAL_MS=60000`, plus la durée des contrôles. Une absence reste `down`, y compris avant première réception ; jamais de passage artificiel au vert. Chaque transition down/up produit un événement et une notification pour les membres autorisés à `VIEW_MONITORING`, selon leur préférence Argos. Historique conservé 30 jours, 30 derniers contrôles affichés.

Les alertes métier arrivent séparément par webhook entrant. Aucun patch du dépôt Argos requis. L’installation du timer, le vrai heartbeat distant et un arrêt/reprise sur Argus restent à valider sur le déploiement.
