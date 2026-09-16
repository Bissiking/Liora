# Webhooks

## Entrants

Créer dans Administration → Webhooks entrants, choisir un salon et éventuellement la création de tâches. Copier l’URL une seule fois. Payload natif :

```json
{
  "type": "nino.video.ready",
  "content": "La vidéo est disponible.",
  "payload": { "videoId": "external-id" }
}
```

Une tâche peut être ajoutée avec `task:{title,column_id}` si autorisée. Le contenu est limité à 8 000 caractères. L’événement est persisté, source dérivée du préfixe du type. `Idempotency-Key` évite les doublons pendant sept jours. Révoquer invalide immédiatement l’URL. Les accès ne journalisent pas l’URL secrète. Rate limit 60/min/IP, JSON global 1,5 Mo. Signature entrante HMAC différée ; l’URL secrète et HTTPS constituent la protection initiale.

## Argos existant

Le format actuel `{event:"alert.active"|"alert.resolved",alert:{title,message,...}}` est accepté et converti en `argos.alert.created` / `argos.alert.resolved`. Aucun patch du dépôt Argos nécessaire. Utiliser le canal de notification de type webhook dans Argos, pas Discord.

## Sortants

Créer une destination HTTPS publique dans Administration. Tous les événements de l’espace sont routés vers ses destinations actives ; choisir une destination de confiance. Secret chiffré en DB et montré une fois à la création. Livraison avec :

- `x-liora-timestamp` : secondes Unix.
- `x-liora-signature` : HMAC-SHA256 hexadécimal de `timestamp + "." + corps JSON brut`.

Le destinataire compare en temps constant, rejette un timestamp trop ancien et déduplique sur event.id. Livraison au moins une fois : une réponse perdue peut provoquer un doublon. Une outbox DB évite de perdre les événements au redémarrage. Jusqu’à cinq tentatives avec backoff (30, 60, 120, 240 secondes…). États pending/sent/failed/cancelled, retry et annulation visibles. L’ALPHA traite cinq envois par cycle worker.

Destinations IPv4 publiques uniquement, pas de redirection. Les secrets ne sont pas présents dans la liste des livraisons. Désactiver un endpoint arrête les nouvelles mises en file ; annuler séparément les livraisons déjà en attente.
