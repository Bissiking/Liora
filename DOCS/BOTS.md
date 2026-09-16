# Bots et services

Les identités techniques vivent dans technical_accounts, pas dans users. Types Bot et Service. Création par Administration → Bots et services. Choisir les permissions strictement utiles. Token de 32 octets aléatoires affiché une fois, SHA-256 stocké, date de dernière utilisation, révocation et rotation.

Un bot lecteur/rédacteur de salon utilise VIEW_WORKSPACE, VIEW_CHANNEL, SEND_MESSAGE, EDIT_OWN_MESSAGE, ADD_REACTION. Ajouter CREATE_TASK pour des tâches et CREATE_CHANNEL pour des salons ; aucune capacité de contrôle de serveur n’existe. MANAGE_MONITORING permet d’envoyer un heartbeat mais ne confère pas d’accès aux serveurs.

```sh
curl "$LIORA_URL/api/v1/workspaces/$WORKSPACE_ID/channels" \
  -H "Authorization: Bearer $LIORA_BOT_TOKEN"

curl "$LIORA_URL/api/v1/workspaces/$WORKSPACE_ID/channels/$CHANNEL_ID/messages" \
  -H "Authorization: Bearer $LIORA_BOT_TOKEN" -H 'Content-Type: application/json' \
  -d '{"content":"Déploiement terminé."}'
```

Un token est limité à son workspace et aux permissions sélectionnées. Une personne qui crée un bot ne peut pas lui accorder plus de droits qu’elle n’en a. Les commandes slash et niveaux operator/admin d’exécution distante sont FUTURE, absents de l’API 0.1.
