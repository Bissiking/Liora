# LIORA 1.0.0 — REFONTE UX, STRUCTURELLE ET STABILISATION

Tu travailles sur le dépôt Liora.

OBJECTIF :
Faire évoluer Liora vers une version 1.0.0 stable, cohérente et clairement structurée.

La priorité n’est PAS d’ajouter beaucoup de nouvelles fonctionnalités.
La priorité est de :

- clarifier l’UX
- séparer proprement personnel / workspace
- rapprocher le modèle mental de Discord
- stabiliser les canaux, membres, menus contextuels et webhooks
- simplifier les intégrations calendrier
- nettoyer l’interface avant la sortie 1.0.0

Liora est déjà utilisée en production.
Toute modification doit respecter les données existantes, les migrations déjà appliquées et les usages actuels.

Ne jamais faire de migration destructive sans nécessité absolue.

---

# 1. DIRECTION PRODUIT

Liora 1.0 doit suivre ce modèle mental :

PERSONNEL
↓
WORKSPACE / SERVEUR
↓
CATÉGORIES
↓
CANAUX
↓
CONTENU PRINCIPAL
↓
PANNEAU CONTEXTUEL

Le problème actuel est que les espaces personnels et ceux du workspace sont trop mélangés.

L’utilisateur doit toujours comprendre immédiatement :

- où il se trouve
- s’il est dans son espace personnel
- s’il est dans un workspace
- dans quel canal / projet / calendrier il se trouve
- quelles actions sont disponibles

---

# 2. REFONTE DE LA NAVIGATION

Créer une architecture plus proche de Discord, sans copier son apparence pixel par pixel.

## Colonne 1 — Rail principal

Créer une colonne étroite pour :

- Accueil personnel
- Messages privés / Amis
- Workspaces
- Ajouter / rejoindre un workspace
- éventuellement accès global aux notifications

Chaque workspace doit avoir son propre bouton / icône.

Le workspace actif doit être clairement visible.

---

## Colonne 2 — Navigation contextuelle

### En mode PERSONNEL

Afficher :

- Inbox / Activité
- Amis
- Messages privés
- Notes datées
- Rappels
- Mes lieux
- Favoris
- Paramètres personnels

Ne pas afficher ici les modules spécifiques aux workspaces.

### En mode WORKSPACE

Afficher :

- Nom du workspace
- Catégories
- Canaux
- Projets
- Calendrier
- autres modules réellement utiles au workspace

Les catégories doivent pouvoir être repliées.

Les canaux non lus doivent être clairement identifiables.

Les mentions doivent avoir un badge distinct.

---

# 3. RETIRER "PAGES DE L’ÉQUIPE"

Retirer "Pages de l’équipe" de Liora 1.0.0.

Actions :

- retirer l’entrée de navigation
- retirer les accès UI principaux
- ne plus la présenter comme fonctionnalité officielle
- conserver les données / tables / routes existantes si leur suppression risque de casser la compatibilité

Ne PAS faire de DROP destructif uniquement pour nettoyer.

La fonctionnalité pourra être repensée plus tard.

---

# 4. SUPPRIMER GOOGLE CALENDAR

Retirer Google Calendar de Liora 1.0.0.

Nous ne voulons plus dépendre de Google Calendar OAuth pour le calendrier externe.

Supprimer / désactiver :

- UI Google Calendar
- boutons de connexion Google
- routes OAuth Google
- callback Google
- workers de synchronisation Google
- écrans de conflit Google
- paramètres Google Calendar
- variables d’environnement Google Calendar
- documentation Google Calendar
- code client spécifique Google
- code serveur spécifique Google s’il peut être retiré proprement
- dépendances spécifiques devenues inutiles

Ne pas supprimer brutalement les anciennes tables Google Calendar si cela présente un risque pour la base de production.

Les anciennes tables peuvent rester inutilisées pour l’instant.

CalDAV devient la seule solution officielle de synchronisation calendrier externe.

---

# 5. CALDAV DEVIENT LA SOLUTION OFFICIELLE

Améliorer l’expérience CalDAV.

L’utilisateur doit pouvoir :

- créer un accès CalDAV
- choisir un nom d’appareil
- récupérer l’identifiant
- récupérer le mot de passe lors de sa création
- voir l’URL du serveur
- copier chaque valeur facilement
- voir la date de dernière utilisation
- révoquer un appareil
- créer plusieurs accès par appareil

Le mot de passe ne doit être affiché qu’une seule fois.

Ne jamais afficher le hash.

Présenter des instructions simples pour :

- iOS
- macOS
- Apple Calendar
- Thunderbird
- Android avec client DAV compatible

Conserver :

- droits utilisateur
- isolation des calendriers
- ETags
- protections existantes
- lecture seule pour les notes datées si déjà prévu ainsi

---

# 6. REFONTE DES CANAUX

Les canaux doivent devenir de vrais objets centraux.

Créer une configuration proche de Discord.

Chaque canal doit pouvoir gérer :

## Général

- nom
- description
- catégorie
- ordre
- type
- visibilité
- état archivé ou actif

## Permissions

- voir le canal
- lire
- écrire
- ajouter pièces jointes
- réactions
- créer des fils
- répondre dans les fils
- mentionner
- gérer les messages
- gérer le canal

Prévoir :

- permissions par rôle
- exceptions par utilisateur si l’architecture le permet déjà ou peut être ajoutée proprement

## Options

- canal public / privé
- slowmode
- threads autorisés ou non
- notifications
- webhooks liés
- intégrations liées

Créer une interface de paramètres claire.

---

# 7. PANEL DROIT

Refondre complètement le panneau droit.

Il doit être réellement utile.

Dans un canal, il peut afficher :

- membres
- membres en ligne / hors ligne
- rôles
- fils actifs
- épingles
- fichiers récents
- description du canal
- infos utiles du canal

Retirer les blocs décoratifs.

Supprimer notamment les blocs de type :

"Dans ce salon
Un fil commun
De l’idée à la prochaine version de Liora."

Sauf si cela correspond à une vraie description du canal.

Si c’est une description :

- l’afficher plus simplement
- sans gros bloc inutile

---

# 8. SUPPRIMER "EN DIRECT"

Retirer le texte "En direct" de la barre supérieure.

Il n’apporte pas de valeur suffisante.

Si un indicateur temps réel est nécessaire :

- utiliser une icône discrète
- ou un état de connexion minimal
- ne pas garder le libellé actuel

---

# 9. GESTION DES MEMBRES

La liste des utilisateurs à droite doit être interactive.

## Clic gauche

Afficher une vraie fiche utilisateur.

La fiche doit contenir :

- avatar
- nom
- pseudo
- statut
- rôles
- informations principales
- actions rapides

## Clic droit

Créer un menu avec :

- voir profil
- envoyer un message privé
- mentionner
- copier ID
- voir rôles
- gérer rôles si autorisé
- modérer si autorisé
- retirer du workspace si autorisé

Respecter strictement les permissions.

---

# 10. MENUS CONTEXTUELS PARTOUT

Créer un système centralisé de menus contextuels custom.

Les menus doivent exister sur :

- workspace
- catégorie
- canal
- message
- utilisateur
- projet
- colonne projet
- carte projet
- événement calendrier
- note
- intégration
- webhook
- fichier

Le menu natif du navigateur doit être désactivé uniquement sur les éléments applicatifs.

Le menu natif doit rester disponible dans :

- input
- textarea
- éditeur texte
- zone code
- zone où copier/coller est utile

Prévoir :

- clic droit desktop
- bouton "..." mobile
- appui long mobile si pertinent
- Maj+F10 clavier
- Escape pour fermer

Les actions interdites ne doivent pas être visibles.

---

# 11. WEBHOOKS 1.0

Améliorer fortement les webhooks.

Supporter au minimum :

## Mode TEXT

- message texte
- métadonnées simples
- aperçu

## Mode EMBED

Configurer :

- titre
- description
- couleur
- URL
- auteur
- footer
- timestamp
- champs multiples
- image
- miniature
- icône
- metadata additionnelles

Créer un format interne générique.

Ne pas coder le système uniquement autour du format Discord.

Prévoir :

- aperçu live
- test webhook
- historique des envois
- statut HTTP
- dernière erreur
- date du dernier envoi
- retry si pertinent

---

# 12. SIDEBAR

La sidebar actuelle doit être fortement simplifiée.

Objectifs :

- moins de bruit visuel
- meilleure hiérarchie
- meilleure distinction personnel / workspace
- moins de blocs imbriqués
- icônes cohérentes
- groupes clairs
- états hover / active / unread cohérents

Éviter les informations redondantes.

---

# 13. HEADER DES CANAUX

Le header d’un canal doit être simple.

Afficher :

- nom du canal
- courte description éventuelle

À droite :

- recherche
- fils
- épingles
- notifications
- membres

Ne rien afficher si l’élément n’a pas d’utilité réelle.

---

# 14. RESPONSIVE / MOBILE

La nouvelle UX doit être conçue dès le départ pour mobile.

Sur mobile :

- rail workspace escamotable
- navigation canal escamotable
- contenu principal prioritaire
- membres dans un drawer
- menus accessibles sans clic droit
- tailles tactiles correctes
- navigation claire
- aucun écran inutilisable

Ne pas faire un responsive uniquement à la fin.

---

# 15. THÈMES

Retirer les thèmes actuels du scope principal de refonte.

Pendant la refonte :

- utiliser un seul thème de référence
- propre
- neutre
- contrasté
- desktop + mobile

Ne pas perdre du temps à adapter tous les thèmes existants à chaque changement UX.

Une fois l’UX stabilisée :

- recréer les thèmes
- repartir de la nouvelle architecture CSS
- éviter l’empilement de release-xxx.css
- nettoyer les anciens tokens inutilisés
- reconstruire proprement les palettes

La refonte des thèmes est la DERNIÈRE étape visuelle avant 1.0.0.

---

# 16. NETTOYAGE CSS

Éviter l’empilement infini de CSS de release.

Objectif :

- réduire les overrides
- fusionner les règles devenues stables
- créer une architecture CSS plus maintenable
- conserver les tokens utiles
- supprimer les styles morts
- éviter les !important inutiles

Ne pas tout réécrire d’un coup si cela met la prod en danger.

Nettoyer progressivement.

---

# 17. ACCESSIBILITÉ

Préserver ou améliorer :

- focus visible
- navigation clavier
- aria-label
- contrastes
- navigation Tab
- Maj+F10
- Escape
- tailles tactiles
- labels des boutons
- navigation utilisable sans souris

---

# 18. À NE PAS FAIRE

Ne pas :

- ajouter de grosse feature hors scope
- remettre Pages de l’équipe
- remettre Google Calendar
- refaire tous les thèmes avant la fin
- supprimer brutalement des tables historiques
- casser CalDAV
- casser les migrations de production
- casser les permissions existantes
- dupliquer inutilement les composants
- copier Discord visuellement à l’identique
- inventer des routes sans vérifier ce qui existe

---

# 19. ORDRE DE TRAVAIL RECOMMANDÉ

1. Audit complet UX + architecture actuelle
2. Inventaire des composants existants
3. Nouvelle navigation globale
4. Séparation personnel / workspace
5. Rail principal
6. Refonte sidebar contextuelle
7. Refonte canaux
8. Refonte panneau droit
9. Fiches utilisateurs
10. Menus contextuels généralisés
11. Webhooks texte + embeds
12. Retrait Google Calendar
13. Consolidation CalDAV
14. Retrait Pages de l’équipe
15. Responsive mobile
16. Accessibilité
17. Nettoyage CSS
18. Tests E2E
19. Refonte complète des thèmes
20. Stabilisation finale
21. Passage version 1.0.0

---

# 20. CONDITIONS DE SORTIE 1.0.0

Liora ne doit passer en 1.0.0 que si :

- navigation cohérente
- séparation personnel / workspace claire
- sidebar stabilisée
- canaux configurables
- membres interactifs
- menus contextuels fonctionnels
- webhooks texte + embeds fonctionnels
- Google Calendar retiré
- CalDAV validé
- Pages de l’équipe retirées
- responsive mobile correct
- permissions cohérentes
- migrations sûres
- aucun crash majeur
- aucune erreur critique console
- documentation à jour
- tests principaux verts
- thème principal propre
- anciens thèmes refaits ou supprimés proprement
- aucun flux critique cassé

---

# 21. CONTRAINTE PRODUCTION

Liora tourne déjà en production.

Avant toute modification :

- lire le code existant
- vérifier les modèles DB
- vérifier les migrations
- vérifier les routes
- vérifier les permissions
- vérifier les tests
- identifier les dépendances réelles

Ne jamais supposer.

Si un élément n’existe pas, le créer proprement.
S’il existe déjà, l’améliorer plutôt que le dupliquer.

Toute migration doit être additive et sûre autant que possible.

Ne pas faire de DROP TABLE ou DROP COLUMN uniquement pour faire "propre".

---

# OBJECTIF FINAL

Liora 1.0.0 doit donner cette sensation :

- personnel clair
- workspaces clairs
- canaux clairs
- interactions naturelles
- interface proche du modèle mental Discord
- productivité propre à Liora
- moins de bruit
- plus de cohérence
- plus mature
- prête à être considérée stable

Architecture cible :

PERSONNEL
↓
WORKSPACE
↓
CATÉGORIE
↓
CANAL
↓
CONTENU
↓
CONTEXTE

Avant d’implémenter, commence par analyser le dépôt et produire un plan de modifications précis, fichier par fichier, avec les risques de migration et les parties pouvant être réutilisées.
