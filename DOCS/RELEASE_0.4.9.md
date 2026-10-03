# Liora 0.4.9 BETA — refonte UX

3 octobre 2026. Périmètre confirmé : navigation et tous les écrans.

- Accueil personnel avec notifications non lues, rendez-vous des sept prochains jours, salons accessibles, rappels et favoris. Chargement et erreur isolés par rubrique, avec réessai.
- Une seule navigation globale, regroupée en Mon espace, Équipe, Gestion et Réglages. Les salons occupent un panneau contextuel dans les conversations ; les conversations privées restent accessibles depuis ce panneau.
- Commande rapide ⌘/Ctrl K : noms de rubriques et salons, navigation avec flèches/Entrée, fermeture avec Échap. ⌘/Ctrl 0 ouvre l’accueil, les raccourcis 1–7 restent disponibles et ⌘/Ctrl Maj F garde la recherche des messages.
- Réception : filtres Non lues / Toutes / Lues et marquage de toutes les notifications reçues comme lues. Les échecs partiels sont remontés et la liste est relue. L’archivage existant reste disponible pour une notification lue.
- Projets, pages, calendrier, rappels, favoris, amis, supervision, aide, connexion, préférences et administration partagent la nouvelle hiérarchie, les contrôles et les espacements. Recherche de page ajoutée. Sauvegarde des préférences avec attente et confirmation explicites.
- Navigation mobile basse, tiroirs indépendants, rubriques de réglages défilantes, lisibilité et actions tactiles revues. Les six thèmes et les choix de densité/texte sont conservés.
- Le build inclut désormais `chrono-node` dans le client : l’externaliser laissait un import nu que le navigateur de production ne pouvait pas résoudre.
- Version synchronisée entre package, lockfile, VERSION et source partagée. Aucun changement SQL requis.

Les API, données et permissions existantes sont utilisées. Un favori ouvre sa ressource réelle. Les captures de qualification utilisent des données de test, sans injecter de démonstration en production.

Les contrôles exécutés et leur portée sont consignés dans [VALIDATION.md](VALIDATION.md). Aucun déploiement ni publication effectué ; les fournisseurs réels et appareils physiques restent hors de cette qualification locale.
