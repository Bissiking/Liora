# Notes de version 0.4.0

Liora 0.4.0 — BETA · expérience

## Nouveautés

### Calendrier

- Vue mensuelle interactive avec grille complète.
- Création, édition et suppression d'événements.
- Récurrence quotidienne, hebdomadaire, mensuelle ou annuelle.
- Couleur personnalisable et lien optionnel vers un salon.

### Rappels

- Rappels personnels avec date et heure de rappel.
- Récurrence optionnelle (quotidien, hebdomadaire, mensuel).
- Report d'une heure ou archivage.
- Filtre par état : tous, en cours, terminés.

### Favoris

- Raccourcis privés vers channels, pages, projets et événements.
- Navigation rapide depuis la vue Favoris.
- Suppression individuelle.

### Raccourcis clavier

- ⌘/Ctrl + 1-7 : navigation directe entre vues principales.
- ⌘/Ctrl + , : Préférences.
- ⌘/Ctrl + / : Aide.
- ⌘/Ctrl + K : recherche de salon.
- Échap : fermer la navigation ou un dialogue.

### Notifications push desktop

- Demande de permission au chargement.
- Service worker avec affichage de notifications.
- Clic sur notification pour focaliser l'application.

### Thèmes avancés

- **Minuit** : bleu nuit profond, accent bleu clair.
- **Forêt** : vert profond, accent vert tendre.
- **Braise** : rouge sombre, accent rouge orangé.
- Total : 6 thèmes disponibles (Graphite, Papier, Crépuscule, Minuit, Forêt, Braise).

### PWA

- Manifest webmanifest avec icône SVG.
- Service worker avec cache des ressources statiques.
- Mode standalone, arrière-plan et barre d'état adaptés.
- Installation possible depuis le navigateur.

### Gestion hors ligne

- Indicateur visuel en bas de l'écran lorsque le réseau est indisponible.
- Cache service worker pour les ressources statiques.
- Réponses 503 structurées pour les appels API hors ligne.

### Mobile

- Touch targets agrandis sur les actions de message.
- Grille calendrier adaptée aux petits écrans.
- Rappels et favoris avec disposition responsive.

## Migration

La migration 005.sql ajoute les tables `calendar_events`, `reminders`, `favorites` et la colonne `push_subscriptions` aux utilisateurs.

## Limites

- Pas de synchronisation temps réel pour les événements de calendrier entre onglets (SSE existant non étendu aux calendar events).
- Notifications push : nécessite VAPID keys pour un déploiement production.
- Pas de vue jour ou semaine du calendrier (mensuelle uniquement en 0.4).
- Application mobile native : étude de faisabilité, pas d'implémentation native.
