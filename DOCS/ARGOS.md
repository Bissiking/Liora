# Argus / Argos

Argos demeure le superviseur des serveurs. Liora surveille seulement son propre superviseur : API Argos, serveur Argus par URL de santé, heartbeat authentifié.

1. Déployer Liora sur une machine distincte d’Argus.
2. Renseigner ARGOS_BASE_URL (contrôle `/health/ready`) et ARGUS_HEALTH_URL (URL HTTP/HTTPS dédiée sur Argus).
3. Exécuter `npm run monitoring:configure` après configuration pour synchroniser ces URL sur les cibles LUMA.
4. Créer un Service Argos avec la permission MANAGE_MONITORING.
5. Depuis Argus, appeler toutes les 60 secondes :

```sh
curl -fsS -X POST "$LIORA_URL/api/v1/workspaces/$WORKSPACE_ID/heartbeat" \
  -H "Authorization: Bearer $LIORA_SERVICE_TOKEN"
```

Une planification opérateur (cron/systemd timer) est nécessaire, sans patch d’Argos. Timeout heartbeat : 180 secondes par défaut. Détecter une panne prend au plus le timeout plus un cycle de contrôle. URL de santé = disponibilité HTTP, pas un ping ICMP.

Contrôles HTTP cinq secondes maximum, redirections refusées. État inconnu si URL absente. Heartbeat absent = down, même avant première réception. Transitions down/up créent événements et notifications pour les membres autorisés à VIEW_MONITORING, sous préférence Argos. Historique 30 jours, derniers 30 contrôles dans la vue.

Les alertes métier d’Argos arrivent séparément par webhook entrant. Réception testée sur le format réel du dépôt local. Aucun appel de production effectué pendant les tests et aucune modification d’Argos.
